/** Wastelands activities (pure), from the owner's Wastelands brief:
 *  - Defend the Vault Gates (Sub-Terra Legion defense contract): three raider waves converge on the Sub-Terra Apex gate;
 *    raiders near the gate wear its integrity down; clear all three waves before it breaks.
 *  - Rust Run (rally time trial): drive a checkpoint loop across the Wastelands in a vehicle; gold/silver/bronze by time.
 *  - The Mash-Pit (derby): a vehicle-only arena round; wreck as many raider buggies as you can in 75 s.
 *
 * Every activity is a small state machine stepped from live sim facts (tagged machines alive/near, player position,
 * in-vehicle, kills). Payouts go through rewardMission with `side-*` ids (first-clear + daily repeat taper) and medal /
 * Legion rewards are once-keyed in earnedRewards, so nothing can be farmed by replaying. Best times/scores live in
 * `progression.records` (merge: best wins). Rendering and spawning are elsewhere (WastelandSites.tsx, wasteland-runtime). */
import type { MaterialId } from "./inventory";
import { rewardMission, type PlayerProgression } from "./progression";
import { applyEffects, trustOf } from "./story";
import { BLADES, grantBlade, type BladeId } from "./foundries";

/* ------------------------------------------------------------ places ------------------------------------------------------------ */
/** the Sub-Terra Apex vault entrance, on open flat ground east of Rust Port */
export const VAULT_GATE = { x: 150, z: -20, radius: 9 } as const;
/** the Mash-Pit derby arena (flat salt pan on the west side) */
export const ARENA = { x: -86, z: -24, radius: 24 } as const;

export type Checkpoint = { x: number; z: number };
export const RALLY_REACH = 10;
/** Rust Run: starts and ends at the start gate; checkpoints in order */
export const RUST_RUN = {
  id: "rust-run", name: "Rust Run",
  start: { x: 48, z: 77 } as Checkpoint,
  checkpoints: [{ x: 98, z: 63 }, { x: 164, z: 43 }, { x: 182, z: -24 }, { x: 135, z: -74 }, { x: 77, z: -75 }, { x: -39, z: -74 }, { x: -53, z: -24 }, { x: -39, z: 26 }, { x: -2, z: 63 }, { x: 48, z: 77 }] as Checkpoint[],
} as const;
export const rallyLength = (): number => {
  let len = 0, prev = RUST_RUN.start;
  for (const c of RUST_RUN.checkpoints) { len += Math.hypot(c.x - prev.x, c.z - prev.z); prev = c; }
  return len;
};
export type Medal = "GOLD" | "SILVER" | "BRONZE";
/** medal target times (s) from course length at average speeds of 32 / 24 / 16 m/s */
export const rallyTargets = (): Record<Medal, number> => { const L = rallyLength(); return { GOLD: Math.round(L / 32), SILVER: Math.round(L / 24), BRONZE: Math.round(L / 16) }; };
export const rallyMedal = (seconds: number): Medal | null => { const t = rallyTargets(); return seconds <= t.GOLD ? "GOLD" : seconds <= t.SILVER ? "SILVER" : seconds <= t.BRONZE ? "BRONZE" : null; };
export const DERBY_TARGETS: Record<Medal, number> = { GOLD: 14, SILVER: 10, BRONZE: 6 };
export const derbyMedal = (wrecks: number): Medal | null => (wrecks >= DERBY_TARGETS.GOLD ? "GOLD" : wrecks >= DERBY_TARGETS.SILVER ? "SILVER" : wrecks >= DERBY_TARGETS.BRONZE ? "BRONZE" : null);

/* ------------------------------------------------------------ vault defense ------------------------------------------------------------ */
export const VAULT_WAVES: readonly { size: number; elites: number }[] = [{ size: 5, elites: 0 }, { size: 7, elites: 1 }, { size: 9, elites: 2 }];
export const GATE_MAX = 100, GATE_DPS_PER_RAIDER = 0.7, GATE_THREAT_RADIUS = 16, VAULT_BREAK = 8, VAULT_LEASH = 120;
export type VaultRun = { id: string; phase: "WAVE" | "BREAK" | "WON" | "FAILED"; wave: number; gate: number; timer: number; spawned: boolean; reason?: string };
export const startVault = (now: number): VaultRun => ({ id: `vault-${now.toString(36)}`, phase: "BREAK", wave: 0, gate: GATE_MAX, timer: 3, spawned: false });

export type VaultInput = { dt: number; tagAlive: number; nearGate: number; playerDist: number; playerAlive: boolean };
export type VaultStep = { run: VaultRun; spawnWave?: { size: number; elites: number }; outcome?: "WON" | "FAILED" };
export function stepVault(run: VaultRun, inp: VaultInput): VaultStep {
  if (run.phase === "WON" || run.phase === "FAILED") return { run };
  const fail = (reason: string): VaultStep => ({ run: { ...run, phase: "FAILED", reason }, outcome: "FAILED" });
  if (!inp.playerAlive) return fail("You went down. The raiders breached the gate.");
  if (inp.playerDist > VAULT_LEASH) return fail("You abandoned the gate.");
  if (run.phase === "BREAK") {
    const timer = run.timer - inp.dt;
    if (timer > 0) return { run: { ...run, timer } };
    const w = VAULT_WAVES[run.wave]!;
    return { run: { ...run, phase: "WAVE", wave: run.wave + 1, timer: 0, spawned: true }, spawnWave: w };
  }
  // WAVE
  const gate = Math.max(0, run.gate - inp.nearGate * GATE_DPS_PER_RAIDER * inp.dt);
  if (gate <= 0) return fail("The vault gate was breached.");
  if (inp.tagAlive === 0) {
    if (run.wave >= VAULT_WAVES.length) return { run: { ...run, gate, phase: "WON" }, outcome: "WON" };
    return { run: { ...run, gate, phase: "BREAK", timer: VAULT_BREAK, spawned: false } };
  }
  return { run: { ...run, gate } };
}

/* ------------------------------------------------------------ rally ------------------------------------------------------------ */
export const RALLY_IDLE_LIMIT = 75;
export type RallyRun = { id: string; phase: "RUNNING" | "FINISHED" | "ABANDONED"; next: number; time: number; sinceCheckpoint: number; reason?: string };
export const startRally = (now = 0): RallyRun => ({ id: `rally-${now.toString(36)}`, phase: "RUNNING", next: 0, time: 0, sinceCheckpoint: 0 });
export type RallyStep = { run: RallyRun; checkpoint?: number; outcome?: { finished: boolean; time: number } };
export function stepRally(run: RallyRun, inp: { dt: number; x: number; z: number; inVehicle: boolean }): RallyStep {
  if (run.phase !== "RUNNING") return { run };
  if (!inp.inVehicle) return { run: { ...run, phase: "ABANDONED", reason: "You left your vehicle." }, outcome: { finished: false, time: run.time } };
  const time = run.time + inp.dt, since = run.sinceCheckpoint + inp.dt;
  if (since > RALLY_IDLE_LIMIT) return { run: { ...run, time, phase: "ABANDONED", reason: "Too long without a checkpoint." }, outcome: { finished: false, time } };
  const cp = RUST_RUN.checkpoints[run.next]!;
  if (Math.hypot(inp.x - cp.x, inp.z - cp.z) <= RALLY_REACH) {
    const next = run.next + 1;
    if (next >= RUST_RUN.checkpoints.length) return { run: { ...run, time, phase: "FINISHED", next }, checkpoint: run.next, outcome: { finished: true, time } };
    return { run: { ...run, time, next, sinceCheckpoint: 0 }, checkpoint: run.next };
  }
  return { run: { ...run, time, sinceCheckpoint: since } };
}

/* ------------------------------------------------------------ derby ------------------------------------------------------------ */
export const DERBY_SECONDS = 75, DERBY_WAVE = 4, DERBY_MAX_ALIVE = 6;
export type DerbyRun = { id: string; phase: "RUNNING" | "DONE"; time: number; wrecks: number; reason?: string };
export const startDerby = (now: number): DerbyRun => ({ id: `derby-${now.toString(36)}`, phase: "RUNNING", time: DERBY_SECONDS, wrecks: 0 });
export type DerbyStep = { run: DerbyRun; spawn?: number; outcome?: { wrecks: number } };
/** `kills` = player kills this step (any weapon or ram) while inside the arena in a vehicle */
export function stepDerby(run: DerbyRun, inp: { dt: number; inArena: boolean; inVehicle: boolean; kills: number; tagAlive: number }): DerbyStep {
  if (run.phase !== "RUNNING") return { run };
  const wrecks = run.wrecks + (inp.inArena && inp.inVehicle ? inp.kills : 0);
  const time = run.time - inp.dt;
  if (!inp.inArena || !inp.inVehicle || time <= 0) {
    const reason = time <= 0 ? "Time." : !inp.inArena ? "You left the pit." : "You left your vehicle.";
    return { run: { ...run, wrecks, time: Math.max(0, time), phase: "DONE", reason }, outcome: { wrecks } };
  }
  const spawn = inp.tagAlive < DERBY_MAX_ALIVE - DERBY_WAVE + 1 ? DERBY_WAVE : 0;
  return { run: { ...run, wrecks, time }, ...(spawn ? { spawn } : {}) };
}

/* ------------------------------------------------------------ saved results ------------------------------------------------------------ */
export const LEGION = "subterra-legion";
export const LEGION_RANKS: readonly { at: number; title: string }[] = [{ at: 0, title: "Outsider" }, { at: 10, title: "Gate Hand" }, { at: 30, title: "Legion Mercenary" }, { at: 60, title: "Vault Warden" }, { at: 90, title: "Iron Vanguard" }];
export const legionRank = (p: Pick<PlayerProgression, "story">) => { const t = trustOf(p.story, LEGION); return [...LEGION_RANKS].reverse().find((r) => t >= r.at)!.title; };

const MEDAL_PAY: Record<Medal, Partial<Record<MaterialId, number>>> = { GOLD: { tuningCore: 2, vehicleParts: 8 }, SILVER: { tuningCore: 1, vehicleParts: 5 }, BRONZE: { vehicleParts: 4, fuel: 6 } };
const MEDAL_ORDER: readonly Medal[] = ["BRONZE", "SILVER", "GOLD"];
const GOLD_BLADE: Record<string, BladeId> = { "rust-run": "sun-cutter", "mash-pit": "aegis-broadsword" };
const matText = (m: Partial<Record<MaterialId, number>>) => Object.entries(m).map(([k, v]) => `+${v} ${k}`).join(", ");

/** pay each medal tier (and the ones below it) once, ever */
function payMedals(p: PlayerProgression, activity: string, medal: Medal | null): { progression: PlayerProgression; lines: string[] } {
  if (!medal) return { progression: p, lines: [] };
  let next = p; const lines: string[] = [];
  for (const m of MEDAL_ORDER.slice(0, MEDAL_ORDER.indexOf(medal) + 1)) {
    const key = `medal:${activity}:${m}`;
    if (next.earnedRewards.includes(key)) continue;
    const materials = { ...next.materials };
    for (const [k, v] of Object.entries(MEDAL_PAY[m]) as [MaterialId, number][]) materials[k] = (materials[k] ?? 0) + v;
    next = { ...next, materials, earnedRewards: [...next.earnedRewards, key] };
    lines.push(`${m.toLowerCase()} medal: ${matText(MEDAL_PAY[m])}`);
    const gold = m === "GOLD" ? GOLD_BLADE[activity] : undefined; // foundries.ts: gold medals award a monoblade
    if (gold) { const g = grantBlade(next, gold); next = g.progression; if (g.granted) lines.push(`you earned the ${BLADES[gold].name}`); }
  }
  return { progression: next, lines };
}

export function resolveVault(p: PlayerProgression, run: Pick<VaultRun, "id" | "gate"> & { reason?: string | undefined }, outcome: "WON" | "FAILED", now = Date.now()): { progression: PlayerProgression; message: string } {
  const key = `vault-run:${run.id}`;
  if (p.earnedRewards.includes(key)) return { progression: p, message: "" };
  let next: PlayerProgression = { ...p, earnedRewards: [...p.earnedRewards, key] };
  if (outcome === "FAILED") return { progression: next, message: `${run.reason ?? "The vault gate was breached."} The Legion will hold the inner doors; try again.` };
  next = rewardMission(next, "side-vault-defense", { reinforcedAlloy: 6, scrapMetal: 20 }, now);
  const blade = grantBlade(next, "vectal"); // foundries.ts: the Legion's Häkke monoblade, once
  next = blade.progression;
  // Legion standing: +10 per defended run, +5 more for a nearly untouched gate (once per run id)
  const bonus = run.gate >= 80 ? 5 : 0;
  next = { ...next, story: applyEffects(next.story, [{ trust: { who: LEGION, amount: 10 + bonus } }], `vault:${run.id}`) };
  return { progression: next, message: `Vault gates held (${Math.round(run.gate)}% integrity). Sub-Terra Legion: ${legionRank(next)}${bonus ? " · clean defense bonus" : ""}${blade.granted ? ` · the Legion hands you the ${BLADES.vectal.name}` : ""}` };
}

export function resolveRally(p: PlayerProgression, runId: string, time: number, now = Date.now()): { progression: PlayerProgression; message: string; medal: Medal | null } {
  const key = `rally-run:${runId}`;
  if (p.earnedRewards.includes(key)) return { progression: p, message: "", medal: null };
  const medal = rallyMedal(time);
  const prev = p.records[RUST_RUN.id];
  let next: PlayerProgression = { ...p, records: { ...p.records, [RUST_RUN.id]: prev === undefined ? time : Math.min(prev, time) }, earnedRewards: [...p.earnedRewards, key] };
  if (medal) next = rewardMission(next, `side-rally-${RUST_RUN.id}`, { fuel: 6 }, now);
  const paid = payMedals(next, RUST_RUN.id, medal);
  const best = prev === undefined || time < prev ? " · new best" : "";
  return { progression: paid.progression, medal, message: `${RUST_RUN.name}: ${time.toFixed(1)} s${best}${medal ? ` · ${medal.toLowerCase()}` : " · no medal"}${paid.lines.length ? ` · ${paid.lines.join(" · ")}` : ""}` };
}

export function resolveDerby(p: PlayerProgression, run: Pick<DerbyRun, "id">, wrecks: number, now = Date.now()): { progression: PlayerProgression; message: string; medal: Medal | null } {
  const key = `derby-run:${run.id}`;
  if (p.earnedRewards.includes(key)) return { progression: p, message: "", medal: null };
  const medal = derbyMedal(wrecks);
  const best = Math.max(p.records["mash-pit"] ?? 0, wrecks);
  let next: PlayerProgression = { ...p, records: { ...p.records, "mash-pit": best }, earnedRewards: [...p.earnedRewards, key] };
  if (medal) next = rewardMission(next, "side-derby-mash-pit", { scrapMetal: 15, vehicleParts: 2 }, now);
  const paid = payMedals(next, "mash-pit", medal);
  return { progression: paid.progression, medal, message: `Mash-Pit: ${wrecks} wrecks${medal ? ` · ${medal.toLowerCase()}` : " · no medal"}${paid.lines.length ? ` · ${paid.lines.join(" · ")}` : ""}` };
}

/** best-wins merge for records: rally times are lower-is-better, everything else (scores) higher-is-better */
export const LOWER_IS_BETTER = new Set<string>([RUST_RUN.id]);
export function mergeRecords(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? (LOWER_IS_BETTER.has(k) ? Math.min(out[k]!, v) : Math.max(out[k]!, v)) : v;
  return out;
}
export function normalizeRecords(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
  return out;
}
