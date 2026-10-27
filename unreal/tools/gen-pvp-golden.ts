/**
 * Records golden Killbox matches and rival fields from the web build's real pvp.ts and crucible.ts for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/PvpCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs pvp
 *
 *   MD mode -> data      CM mode -> data      NP mode seed -> state
 *   SP dt kills died px pz rivalsAlive -> decided|state|line|fieldSize|respawns|storm(at 0, at radius+1)
 *   RR t -> radius|phase|closing     LU mode class -> lineup     SQ n offset -> squad
 *   F kind -> field (NC crucible mode | NF)   SR class dt alive draws -> spawns|field   SF lineup respawn dt alive draws -> spawns|field   RF -> field
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PVP_MODES, fieldSize, newPvp, pvpLine, respawns, royaleRadius, stepPvp, stormDamage, type PvpModeId, type PvpState } from "../../src/game/pvp";
import { CRUCIBLE_MODES, newCrucible, resetField, rivalLineup, rivalSquad, stepField, stepRivals, type CrucibleState, type RivalClass } from "../../src/game/crucible";
import type { WorldSim } from "../../src/game/sim";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "pvp_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0x9b1;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const st = (s: PvpState) => [s.mode, n(s.clock), n(s.us), n(s.them), s.board.map(n).join(",") || "~", s.zones.map((z) => `${z.id}:${n(z.dx)}:${n(z.dz)}:${z.owner ?? "~"}:${n(z.cap)}`).join(",") || "~",
  n(s.round), n(s.roundClock), n(s.usRounds), n(s.themRounds), b(s.attacking), n(s.plant), n(s.zoneHold), n(s.roundRivalsLeft), n(s.roundOver), n(s.alive), n(s.phase), n(s.radius), n(s.nextWave), s.result ?? "~", s.reason || "~", n(s.seed)].join("|");
const fld = (f: CrucibleState) => [f.mode, f.respawn.map((v) => (v === undefined ? "~" : n(v))).join(",") || "~", f.spent === undefined ? "U" : Array.from({ length: f.spent.length }, (_, i) => (f.spent![i] ? "1" : "0")).join(",") || "~"].join("|");

for (const m of Object.values(PVP_MODES)) out("MD", m.id, [m.name, m.kind, m.tagline, m.brief, m.teamSize, m.players, m.onField, m.target, m.timeLimit, m.roundTime ?? 0, m.activity, b(!!m.elite)].join("^"));
for (const m of Object.values(CRUCIBLE_MODES)) out("CM", m.id, [m.name, m.rivals, m.target, m.brief].join("^"));

for (const mode of Object.keys(PVP_MODES) as PvpModeId[]) for (let t = 0; t < 40; t++) {
  const s = newPvp(mode, Math.floor(rand() * 2 ** 32) >>> 0);
  out("NP", mode, s.seed, st(s));
  let rivals = PVP_MODES[mode].onField;
  for (let k = 0; k < 3000 && !s.result; k++) {
    const dt = pick([1 / 60, 0.1, 0.5, 1, 2]);
    const kills = rand() < 0.04 ? pick([1, 1, 2]) : 0, died = rand() < 0.01;
    const onZone = rand() < 0.4, px = onZone ? pick([0, -22, 22, 3]) + (rand() - 0.5) * 4 : (rand() - 0.5) * 80, pz = onZone ? (rand() - 0.5) * 4 : (rand() - 0.5) * 80;
    if (rand() < 0.05) rivals = Math.max(0, rivals - 1); if (rand() < 0.02) rivals = PVP_MODES[mode].onField;
    const done = stepPvp(s, { dt, kills, died, px, pz, rivalsAlive: rivals });
    out("SP", dt, kills, b(died), px, pz, rivals, [b(done), st(s), pvpLine(s), n(fieldSize(s)), b(respawns(s)), n(stormDamage(s, 0)), n(stormDamage(s, s.radius + 1))].join("\t"));
  }
}
// scripted edges: an attacker holding the Lockdown objective in whole seconds (secured at exactly 8 s); Freefall run to its
// 480 s limit in 2 s frames
for (const [mode, dt, px] of [["lockdown", 1, 0], ["lockdown", 0.5, 0], ["freefall", 2, 50], ["clash", 2, 50]] as [PvpModeId, number, number][]) for (let t = 0; t < 6; t++) {
  const s = newPvp(mode, 1000 + t);
  out("NP", mode, s.seed, st(s));
  for (let k = 0; k < 400 && !s.result; k++) {
    const done = stepPvp(s, { dt, kills: 0, died: false, px, pz: 0, rivalsAlive: 2 });
    out("SP", dt, 0, b(false), px, 0, 2, [b(done), st(s), pvpLine(s), n(fieldSize(s)), b(respawns(s)), n(stormDamage(s, 0)), n(stormDamage(s, s.radius + 1))].join("\t"));
  }
}
// the time limit: matches never get there in play (the off-field fight reaches the target first), so set the clock just short
for (const mode of ["clash", "dominion", "freefall"] as PvpModeId[]) for (const [us, them] of [[3, 1], [1, 3], [2, 2]]) for (const dt of [1, 0.5]) {
  const s = newPvp(mode, 77);
  out("NP", mode, s.seed, st(s));
  s.clock = PVP_MODES[mode].timeLimit - 1; s.us = us!; s.them = them!; if (s.board.length) { s.board[0] = us!; s.board[1] = them!; }
  out("PS", s.clock, us!, them!);
  for (let k = 0; k < 4 && !s.result; k++) {
    const done = stepPvp(s, { dt, kills: 0, died: false, px: 50, pz: 0, rivalsAlive: 2 });
    out("SP", dt, 0, b(false), 50, 0, 2, [b(done), st(s), pvpLine(s), n(fieldSize(s)), b(respawns(s)), n(stormDamage(s, 0)), n(stormDamage(s, s.radius + 1))].join("\t"));
  }
}
for (let k = 0; k < 2000; k++) { const t = pick([rand() * 600, Math.floor(rand() * 7) * 85, Math.floor(rand() * 7) * 85 + 50]); const r = royaleRadius(t); out("RR", t, `${n(r.radius)}|${n(r.phase)}|${b(r.closing)}`); }
for (const m of ["duel", "skirmish"] as const) for (const c of ["TITAN", "HUNTER", "WARLOCK", "X"]) out("LU", m, c, rivalLineup(m, c as RivalClass).join(","));
for (let i = 0; i < 8; i++) for (let o = 0; o < 4; o++) out("SQ", i, o, rivalSquad(i, o).join(",") || "~");

// fields: the world is a fake sim whose machines answer which slots are alive and whether one is free
const fakeSim = (alive: Set<number>, room: boolean) => ({ machines: [...[...alive].map((slot) => ({ alive: true, rival: "TITAN", living: `crucible:${slot}` })), ...(room ? [{ alive: false }] : [])] }) as unknown as WorldSim;
for (let t = 0; t < 300; t++) {
  const kind = pick(["duel", "skirmish", "field"]);
  const f = newCrucible(kind === "field" ? "skirmish" : (kind as "duel"));
  out(kind === "field" ? "NF" : "NC", f.mode, fld(f));
  for (let k = 0; k < 60; k++) {
    const dt = pick([0.1, 0.5, 1, 3.5]), alive = new Set<number>([0, 1, 2, 3].filter(() => rand() < 0.4)), room = rand() < 0.9;
    const draws: number[] = [];
    const rng = () => { const v = rand(); draws.push(v); return v; };
    const sim = fakeSim(alive, room);
    const before = sim.machines.length;
    if (kind === "field" && rand() < 0.05) { resetField(sim, f); out("RF", fld(f)); continue; }
    if (kind === "field") {
      const lineup = rivalSquad(pick([0, 1, 3, 4]), pick([0, 1])), resp = rand() < 0.6;
      stepField(sim, f, { x: 0, z: 0 }, lineup, 34 * 0.8, resp, dt, rng);
      out("SF", lineup.join(",") || "~", b(resp), dt, [...alive].join(",") || "~", b(room), draws.map(n).join(",") || "~", `${spawned(sim, before)}|${fld(f)}`);
    } else {
      const cls = pick(["TITAN", "HUNTER", "WARLOCK"]) as RivalClass;
      stepRivals(sim, f, { x: 0, z: 0 }, cls, dt, rng);
      out("SR", cls, dt, [...alive].join(",") || "~", b(room), draws.map(n).join(",") || "~", `${spawned(sim, before)}|${fld(f)}`);
    }
  }
}
function spawned(sim: WorldSim, before: number): string {
  // machines that took a rival this step carry a first-shot delay (cool); the ones already on the field never had one
  void before;
  const got = (sim.machines as unknown as { alive: boolean; living?: string; rival?: string; cool?: number }[]).filter((x) => x.alive && x.living && x.cool !== undefined);
  return got.map((m) => `${m.living!.slice(9)}:${m.rival}:${n(m.cool!)}`).sort().join(",") || "~";
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`pvp golden: ${lines.length} lines -> ${OUT}`);
