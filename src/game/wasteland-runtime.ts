/** Wastelands activities runtime: per-frame glue between wasteland-activities.ts and the live sim (like living-runtime.ts).
 * Starts an activity when the player steps onto its start (the vault gate pad on foot or in a vehicle, the rally start gate
 * and the Mash-Pit only in a vehicle), spawns its tagged raiders, steps its state machine and returns `emits` that
 * GameCanvas applies to the save through the resolve* reducers. */
import { alert, spawnEventSquad, type WorldSim } from "./sim";
import {
  ARENA, DERBY_TARGETS, GATE_THREAT_RADIUS, RALLY_REACH, RUST_RUN, VAULT_GATE, VAULT_WAVES, rallyTargets,
  startDerby, startRally, startVault, stepDerby, stepRally, stepVault, type DerbyRun, type RallyRun, type VaultRun,
} from "./wasteland-activities";

export type WasteEmit =
  | { type: "VAULT"; run: VaultRun; outcome: "WON" | "FAILED" }
  | { type: "RALLY"; id: string; time: number }
  | { type: "DERBY"; run: DerbyRun; wrecks: number };

export type WasteHud = null | { kind: "VAULT" | "RALLY" | "DERBY"; title: string; lines: string[]; progress?: number; tx?: number; tz?: number };

export type WasteRuntime = { vault: VaultRun | null; rally: RallyRun | null; derby: DerbyRun | null; killsSeen: number; rearm: { vault: boolean; rally: boolean; derby: boolean }; doneHold: number; last: string | null };
export const createWasteRuntime = (sim: Pick<WorldSim, "kills">): WasteRuntime => ({ vault: null, rally: null, derby: null, killsSeen: sim.kills, rearm: { vault: true, rally: true, derby: true }, doneHold: 0, last: null });

const tagCount = (sim: WorldSim, tag: string, near?: { x: number; z: number; r: number }) =>
  sim.machines.reduce((n, m) => n + (m.alive && m.living === tag && (!near || Math.hypot(m.x - near.x, m.z - near.z) <= near.r) ? 1 : 0), 0);
const despawn = (sim: WorldSim, tag: string) => { for (const m of sim.machines) if (m.alive && m.living === tag) { m.alive = false; delete m.living; } };
const vaultTag = (r: VaultRun) => `vault:${r.id}`, derbyTag = (r: DerbyRun) => `derby:${r.id}`;

export function stepWasteRuntime(rt: WasteRuntime, sim: WorldSim, inp: { dt: number; now: number; px: number; pz: number; inVehicle: boolean; blocked: boolean }): { emits: WasteEmit[]; hud: WasteHud } {
  const emits: WasteEmit[] = [];
  const alive = sim.hp > 0;
  const kills = Math.max(0, sim.kills - rt.killsSeen);
  rt.killsSeen = sim.kills;
  const dGate = Math.hypot(inp.px - VAULT_GATE.x, inp.pz - VAULT_GATE.z);
  const dStart = Math.hypot(inp.px - RUST_RUN.start.x, inp.pz - RUST_RUN.start.z);
  const dArena = Math.hypot(inp.px - ARENA.x, inp.pz - ARENA.z);
  // re-arm a start only once the player has stepped off it, so finishing never instantly restarts
  if (dGate > VAULT_GATE.radius + 6) rt.rearm.vault = true;
  if (dStart > RALLY_REACH + 8) rt.rearm.rally = true;
  if (dArena > ARENA.radius + 4) rt.rearm.derby = true;
  const busy = !!(rt.vault || rt.rally || rt.derby);

  if (!busy && !inp.blocked && alive) {
    if (rt.rearm.vault && dGate <= VAULT_GATE.radius) { rt.vault = startVault(inp.now); rt.rearm.vault = false; alert(sim, "Defense contract · Sub-Terra Perimeter: hold the vault gate against three raider waves"); }
    else if (rt.rearm.rally && inp.inVehicle && dStart <= RALLY_REACH) { rt.rally = startRally(inp.now); rt.rearm.rally = false; const t = rallyTargets(); alert(sim, `Rust Run: go! Gold ${t.GOLD}s · Silver ${t.SILVER}s · Bronze ${t.BRONZE}s`); }
    else if (rt.rearm.derby && inp.inVehicle && dArena <= ARENA.radius - 4) { rt.derby = startDerby(inp.now); rt.rearm.derby = false; alert(sim, "The Mash-Pit: wreck every buggy you can. Leave the pit or your vehicle and the round ends"); }
  }

  let hud: WasteHud = null;
  if (rt.vault) {
    const r = rt.vault, tag = vaultTag(r);
    const s = stepVault(r, { dt: inp.dt, tagAlive: tagCount(sim, tag), nearGate: tagCount(sim, tag, { x: VAULT_GATE.x, z: VAULT_GATE.z, r: GATE_THREAT_RADIUS }), playerDist: dGate, playerAlive: alive });
    rt.vault = s.run;
    if (s.spawnWave) {
      const a = (inp.now / 997) % (Math.PI * 2); // waves come from a different side each time
      spawnEventSquad(sim, tag, VAULT_GATE.x + Math.cos(a) * 48, VAULT_GATE.z + Math.sin(a) * 48, s.spawnWave.size, s.spawnWave.elites, "wastelands", 9);
      alert(sim, `Wave ${s.run.wave}/${VAULT_WAVES.length} inbound`);
    }
    if (s.outcome) { if (s.outcome === "FAILED") despawn(sim, tag); emits.push({ type: "VAULT", run: s.run, outcome: s.outcome }); rt.vault = null; rt.last = s.outcome === "WON" ? "Vault gates held" : s.run.reason ?? "The gate fell"; rt.doneHold = 6; }
    else hud = { kind: "VAULT", title: "Defend the Vault Gates", lines: [s.run.phase === "BREAK" ? (s.run.wave === 0 ? `Raiders incoming · ${Math.ceil(s.run.timer)} s` : `Wave ${s.run.wave} cleared · next in ${Math.ceil(s.run.timer)} s`) : `Wave ${s.run.wave}/${VAULT_WAVES.length} · raiders ${tagCount(sim, tag)}`, `Gate integrity ${Math.round(s.run.gate)}%`], progress: s.run.gate / 100, tx: VAULT_GATE.x, tz: VAULT_GATE.z };
  } else if (rt.rally) {
    const s = stepRally(rt.rally, { dt: inp.dt, x: inp.px, z: inp.pz, inVehicle: inp.inVehicle });
    rt.rally = s.run;
    if (s.checkpoint !== undefined && !s.outcome) alert(sim, `Checkpoint ${s.checkpoint + 1}/${RUST_RUN.checkpoints.length} · ${s.run.time.toFixed(1)} s`);
    if (s.outcome) { if (s.outcome.finished) emits.push({ type: "RALLY", id: s.run.id, time: s.outcome.time }); rt.last = s.outcome.finished ? `Finished in ${s.outcome.time.toFixed(1)} s` : s.run.reason ?? "Run abandoned"; rt.rally = null; rt.doneHold = 6; }
    else { const cp = RUST_RUN.checkpoints[s.run.next]!; const t = rallyTargets(); hud = { kind: "RALLY", title: RUST_RUN.name, lines: [`${s.run.time.toFixed(1)} s · checkpoint ${s.run.next + 1}/${RUST_RUN.checkpoints.length}`, `Gold ${t.GOLD} · Silver ${t.SILVER} · Bronze ${t.BRONZE}`], progress: s.run.next / RUST_RUN.checkpoints.length, tx: cp.x, tz: cp.z }; }
  } else if (rt.derby) {
    const r = rt.derby, tag = derbyTag(r);
    const s = stepDerby(r, { dt: inp.dt, inArena: dArena <= ARENA.radius, inVehicle: inp.inVehicle, kills, tagAlive: tagCount(sim, tag) });
    rt.derby = s.run;
    if (s.spawn) spawnEventSquad(sim, tag, ARENA.x, ARENA.z, s.spawn, 0, "wastelands", ARENA.radius - 6, 2 /* Rust-Runner Buggy */);
    if (s.outcome) { despawn(sim, tag); emits.push({ type: "DERBY", run: s.run, wrecks: s.outcome.wrecks }); rt.last = `${s.run.reason ?? ""} ${s.outcome.wrecks} wrecks`.trim(); rt.derby = null; rt.doneHold = 6; }
    else hud = { kind: "DERBY", title: "The Mash-Pit", lines: [`${s.run.wrecks} wrecks · ${Math.ceil(s.run.time)} s left`, `Gold ${DERBY_TARGETS.GOLD} · Silver ${DERBY_TARGETS.SILVER} · Bronze ${DERBY_TARGETS.BRONZE}`], progress: s.run.time / 75, tx: ARENA.x, tz: ARENA.z };
  }
  if (!hud && rt.doneHold > 0 && rt.last) { rt.doneHold -= inp.dt; hud = { kind: "VAULT", title: "Activity over", lines: [rt.last] }; }
  return { emits, hud };
}
