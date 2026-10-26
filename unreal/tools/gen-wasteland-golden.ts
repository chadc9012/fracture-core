/**
 * Records golden Wastelands activities from the web build's real wasteland-activities.ts and wasteland-runtime.ts for the C++ port's
 * test (Plugins/WorldFractureCore/Tests/WastelandCoreTest.cpp). rewardMission and the live sim go through recording shims
 * (tools/shims/wasteland-*-shim.ts).
 *
 *   node unreal/tools/gen-goldens.mjs wasteland
 *
 *   SITE gate arena start checkpoints     LEN length targets     RM seconds medal     DM wrecks medal     TF value digits text
 *   VST now state | VS dt tagAlive nearGate dist alive  state spawn outcome          (vault machine)
 *   RST now state | RS dt x z inVehicle  state checkpoint outcome                     (rally machine)
 *   DST now state | DS dt inArena inVehicle kills tagAlive  state spawn outcome       (derby machine)
 *   P progression | RV id gate reason outcome now | RR id time now | RD id wrecks now  -> message medal progression
 *   MR a b merged
 *   WC kills pool full (fresh runtime; full = the pool starts full of untagged machines at -300, 180) | K i | KX | MV i x z | HP hp | WS dt now px pz inVehicle blocked, then E lines (alerts, freeSlots,
 *   spawns in call order), then WR emits hud runtime
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ARENA, RUST_RUN, VAULT_GATE, rallyLength, rallyTargets, rallyMedal, derbyMedal, startVault, stepVault, startRally, stepRally, startDerby, stepDerby,
  resolveVault, resolveRally, resolveDerby, mergeRecords, type VaultRun, type RallyRun, type DerbyRun,
} from "../../src/game/wasteland-activities";
import { createWasteRuntime, stepWasteRuntime, type WasteRuntime, type WasteHud, type WasteEmit } from "../../src/game/wasteland-runtime";
import { simLog, type WorldSim } from "./shims/wasteland-sim-shim";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "wasteland_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
const o = (v: string | undefined | null) => (v === undefined || v === null ? "~" : v);
let seed = 0x5a17;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));

const vs = (r: VaultRun) => [r.id, r.phase, n(r.wave), n(r.gate), n(r.timer), b(r.spawned), o(r.reason)].join("|");
const rs = (r: RallyRun) => [r.id, r.phase, n(r.next), n(r.time), n(r.sinceCheckpoint), o(r.reason)].join("|");
const ds = (r: DerbyRun) => [r.id, r.phase, n(r.time), n(r.wrecks), o(r.reason)].join("|");
const kv = (m: Record<string, number | undefined>) => Object.keys(m).filter((k) => m[k] !== undefined).sort().map((k) => `${k}=${n(m[k]!)}`).join(",") || "~";
const list = (xs: readonly string[]) => (xs.length ? xs.join(",") : "~");
const ps = (p: PlayerProgression) => [list(p.earnedRewards), kv(p.materials as Record<string, number>), kv(p.records), kv(p.story.trust), list(p.story.flags), o(p.blade)].join("|");

/* ---- sites, medals, toFixed ---- */
out("SITE", `${n(VAULT_GATE.x)},${n(VAULT_GATE.z)},${n(VAULT_GATE.radius)}`, `${n(ARENA.x)},${n(ARENA.z)},${n(ARENA.radius)}`, `${n(RUST_RUN.start.x)},${n(RUST_RUN.start.z)}`, RUST_RUN.checkpoints.map((c) => `${n(c.x)},${n(c.z)}`).join(";"));
const T = rallyTargets();
out("LEN", rallyLength(), `${n(T.GOLD)}|${n(T.SILVER)}|${n(T.BRONZE)}`);
for (const s of [0, 19.99, 20, 20.01, 26.9, 27, 27.0001, 39, 40, 40.5, 100]) out("RM", s, o(rallyMedal(s)));
for (const w of [0, 5, 6, 9, 10, 13, 14, 30]) out("DM", w, o(derbyMedal(w)));
for (const v of [0, 0.05, 0.25, 0.35, 1.05, 2.45, 19.95, 19.949999, 9.96, 99.95, 123.456, -0.04, -1.25, 1e-7, 40.5]) out("TF", v, 1, v.toFixed(1));
for (let i = 0; i < 300; i++) { const v = Math.round(rand() * 2e6) / 1000; out("TF", v, 1, v.toFixed(1)); }

/* ---- the three state machines ---- */
let now = 1_760_000_000_000;
for (let t = 0; t < 120; t++) {
  now += Math.floor(rand() * 1e7);
  let r = startVault(now); out("VST", now, vs(r));
  for (let k = 0; k < 50; k++) {
    const dt = pick([1 / 60, 0.5, 1, 3, 9]), tagAlive = pick([0, 0, 1, 4]), near = Math.min(tagAlive, pick([0, 1, 3, 9])), dist = pick([0, 50, 119.99, 120, 120.01]), alive = rand() < 0.98;
    const s = stepVault(r, { dt, tagAlive, nearGate: near, playerDist: dist, playerAlive: alive });
    out("VS", dt, tagAlive, near, dist, b(alive), vs(s.run), s.spawnWave ? `${n(s.spawnWave.size)},${n(s.spawnWave.elites)}` : "~", o(s.outcome));
    r = s.run;
  }
}
for (let t = 0; t < 120; t++) {
  now += Math.floor(rand() * 1e7);
  let r = startRally(now); out("RST", now, rs(r));
  for (let k = 0; k < 40; k++) {
    const cp = RUST_RUN.checkpoints[Math.min(r.next, RUST_RUN.checkpoints.length - 1)]!;
    const a = rand() * 6.28, d = pick([0, 5, 9.999, 10, 10.001, 40]);
    const x = cp.x + Math.sin(a) * d, z = cp.z + Math.cos(a) * d;
    const dt = pick([0.5, 2, 9, 35, 40]), inV = rand() < 0.97;
    const s = stepRally(r, { dt, x, z, inVehicle: inV });
    out("RS", dt, x, z, b(inV), rs(s.run), s.checkpoint === undefined ? "~" : n(s.checkpoint), s.outcome ? `${b(s.outcome.finished)},${n(s.outcome.time)}` : "~");
    r = s.run;
  }
}
for (let t = 0; t < 120; t++) {
  now += Math.floor(rand() * 1e7);
  let r = startDerby(now); out("DST", now, ds(r));
  for (let k = 0; k < 40; k++) {
    const dt = pick([0.5, 1, 4]), inA = rand() < 0.97, inV = rand() < 0.97, kills = pick([0, 0, 1, 2]), alive = pick([0, 2, 3, 6]);
    const s = stepDerby(r, { dt, inArena: inA, inVehicle: inV, kills, tagAlive: alive });
    out("DS", dt, b(inA), b(inV), kills, alive, ds(s.run), s.spawn ? n(s.spawn) : "0", s.outcome ? n(s.outcome.wrecks) : "~");
    r = s.run;
  }
}

/* ---- resolving results into the save ---- */
for (let t = 0; t < 400; t++) {
  let p: PlayerProgression = structuredClone(DEFAULT_PROGRESSION);
  const pre: string[] = [];
  for (const k of ["medal:rust-run:BRONZE", "medal:rust-run:SILVER", "medal:rust-run:GOLD", "medal:mash-pit:BRONZE", "medal:mash-pit:GOLD", "blade:vectal", "blade:sun-cutter", "blade:aegis-broadsword"]) if (rand() < 0.2) pre.push(k);
  const trust: Record<string, number> = rand() < 0.7 ? { "subterra-legion": pick([0, 5, 9, 15, 25, 29, 55, 59, 80, 89, 95]) } : {};
  const records: Record<string, number> = {};
  if (rand() < 0.5) records["rust-run"] = pick([18, 25.5, 30, 60]);
  if (rand() < 0.5) records["mash-pit"] = pick([3, 9, 15]);
  p = { ...p, earnedRewards: pre, materials: rand() < 0.5 ? { fuel: 3, vehicleParts: 1 } as PlayerProgression["materials"] : {} as PlayerProgression["materials"], records, story: { ...p.story, trust, flags: [] }, blade: rand() < 0.3 ? pick(["vectal", "sun-cutter"]) : null };
  out("P", ps(p));
  for (let k = 0; k < 6; k++) {
    now += 1000;
    const r = rand(), id = `x${Math.floor(rand() * 4)}`;
    if (r < 0.34) {
      const gate = pick([0, 12.4, 50.5, 79.99, 80, 99.5, 100]), reason = pick([undefined, "You abandoned the gate."]), outcome = rand() < 0.75 ? "WON" : "FAILED";
      const res = resolveVault(p, { id, gate, ...(reason ? { reason } : {}) }, outcome, now);
      out("RV", id, gate, o(reason), outcome, now, res.message || "~", "~", ps(res.progression)); p = res.progression;
    } else if (r < 0.67) {
      const time = pick([12.34, 19.95, 20, 21.05, 27, 33.333, 40, 41.25, 90]);
      const res = resolveRally(p, id, time, now);
      out("RR", id, time, now, res.message || "~", o(res.medal), ps(res.progression)); p = res.progression;
    } else {
      const wrecks = pick([0, 5, 6, 9, 10, 13, 14, 20]);
      const res = resolveDerby(p, { id }, wrecks, now);
      out("RD", id, wrecks, now, res.message || "~", o(res.medal), ps(res.progression)); p = res.progression;
    }
  }
}
for (let t = 0; t < 200; t++) {
  const mk = () => { const m: Record<string, number> = {}; for (const k of ["rust-run", "mash-pit", "other"]) if (rand() < 0.6) m[k] = Math.floor(rand() * 50); return m; };
  const a = mk(), c = mk();
  out("MR", kv(a), kv(c), kv(mergeRecords(a, c)));
}

/* ---- the runtime against a fake world ---- */
const POOL = 20;
const hud = (h: WasteHud) => (h ? [h.kind, h.title, h.lines.join("/"), h.progress === undefined ? "~" : n(h.progress), h.tx === undefined ? "~" : n(h.tx), h.tz === undefined ? "~" : n(h.tz)].join("|") : "~");
const em = (e: WasteEmit) => (e.type === "VAULT" ? `VAULT:${e.run.id}:${e.outcome}:${n(e.run.gate)}:${o(e.run.reason)}` : e.type === "RALLY" ? `RALLY:${e.id}:${n(e.time)}` : `DERBY:${e.run.id}:${n(e.wrecks)}`);
const rts = (rt: WasteRuntime) => [rt.vault ? vs(rt.vault) : "~", rt.rally ? rs(rt.rally) : "~", rt.derby ? ds(rt.derby) : "~", n(rt.killsSeen), `${b(rt.rearm.vault)}${b(rt.rearm.rally)}${b(rt.rearm.derby)}`, n(rt.doneHold), o(rt.last)].join("#");
for (let t = 0; t < 60; t++) {
  // some worlds start with the pool full of ambient machines (no tag), so waves fail to spawn until kills free slots
  const pool = t % 4 === 0 ? 8 : POOL, full = t % 5 === 0;
  const sim: WorldSim = { machines: Array.from({ length: pool }, () => ({ alive: full, x: -300, z: 180 })), kills: Math.floor(rand() * 30), hp: 10 };
  const rt = createWasteRuntime(sim);
  out("WC", sim.kills, pool, b(full));
  let px = -300, pz = 180, inV = false;
  for (let k = 0; k < 400; k++) {
    // a scenario per stretch: walk the vault, drive the rally, fight the derby, or wander
    const mode = Math.floor(k / 100 + t) % 4;
    const e = rand();
    if (e < 0.06) { const i = Math.floor(rand() * pool); if (sim.machines[i]!.alive) { sim.machines[i]!.alive = false; sim.kills++; out("K", i); } }
    else if (e < 0.08) { sim.kills++; out("KX"); }
    else if (e < 0.11) { const i = Math.floor(rand() * pool); const x = VAULT_GATE.x + (rand() - 0.5) * 40, z = VAULT_GATE.z + (rand() - 0.5) * 40; sim.machines[i]!.x = x; sim.machines[i]!.z = z; out("MV", i, x, z); }
    else if (e < 0.115) { sim.hp = sim.hp > 0 ? 0 : 10; out("HP", sim.hp); }
    if (mode === 0) {
      const a = rand() * 6.28, d = rand() < 0.02 ? 130 : pick([0, 3, 8.99, 9, 15, 15.01, 60]); px = VAULT_GATE.x + Math.sin(a) * d; pz = VAULT_GATE.z + Math.cos(a) * d; inV = rand() < 0.2;
      // fight the wave (on some runs too slowly, so the pool fills and a wave fails to spawn)
      if (rand() < (t % 3 === 0 ? 0.15 : 0.6)) { const i = sim.machines.findIndex((m) => m.alive && m.living?.startsWith("vault:")); if (i >= 0) { sim.machines[i]!.alive = false; sim.kills++; out("K", i); } }
    }
    else if (mode === 1) {
      inV = rand() < 0.98;
      const tgt = rt.rally ? RUST_RUN.checkpoints[rt.rally.next]! : RUST_RUN.start;
      const a = rand() * 6.28, d = pick([0, 4, 9.99, 10.01, 17.99, 18, 18.01, 30]);
      if (rand() < 0.8) { px = tgt.x + Math.sin(a) * d; pz = tgt.z + Math.cos(a) * d; }
    } else if (mode === 2) {
      inV = rand() < 0.97;
      const a = rand() * 6.28, d = pick([0, 10, 19.99, 20.01, 23.99, 24.01, 28.01]); px = ARENA.x + Math.sin(a) * d; pz = ARENA.z + Math.cos(a) * d;
      if (rand() < 0.4) { const i = sim.machines.findIndex((m) => m.alive && m.living?.startsWith("derby:")); if (i >= 0) { sim.machines[i]!.alive = false; sim.kills++; out("K", i); } }
    } else { px = -300 + (rand() - 0.5) * 400; pz = 180 + (rand() - 0.5) * 300; inV = rand() < 0.5; }
    const dt = pick([1 / 30, 0.5, 1, 2.5]), blocked = rand() < 0.03;
    now += Math.floor(dt * 1000) + Math.floor(rand() * 50);
    simLog.length = 0;
    const s = stepWasteRuntime(rt, sim, { dt, now, px, pz, inVehicle: inV, blocked });
    out("WS", dt, now, px, pz, b(inV), b(blocked));
    for (const l of simLog) lines.push(l);
    out("WR", s.emits.map(em).join(";") || "~", hud(s.hud), rts(rt));
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`wasteland golden: ${lines.length} lines -> ${OUT}`);
