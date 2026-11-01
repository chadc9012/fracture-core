/**
 * Records golden Pixel Pit runs from the web build's real arcade.ts for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/ArcadeCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs arcade
 *
 *   TF round -> tolerance    RT venue day round -> targets    SA venue day now -> run
 *   TK run now -> run    TP run now -> run    SG run now -> signal    (each from the recorded run before it)
 *   P earned    AB venue -> best    RA venue score -> earned
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { arcadeBest, arcadeSignal, arcadeTap, arcadeTick, recordArcade, roundTargets, startArcade, toleranceFor, type ArcadeRun } from "../../src/game/arcade";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "arcade_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0xa4c4;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const run = (s: ArcadeRun) => [s.venueId, s.day, n(s.round), n(s.roundStartsAt), s.targets.map(n).join(";") || "~", n(s.next), n(s.hits), n(s.misses), n(s.score), b(s.pressedThisRound), b(s.done), b(s.won), s.endedBy ?? "~",
  s.last ? `${s.last.kind};${n(s.last.points)};${n(s.last.at)}` : "~"].join(",");
const day = () => new Date(1_768_000_000_000 + Math.floor(rand() * 500) * 86_400_000).toISOString().slice(0, 10);

for (let r = 0; r < 12; r++) out("TF", r, toleranceFor(r));
for (let k = 0; k < 400; k++) { const v = pick(["crown-casino", "pulse-array", "x"]), d = day(), r = Math.floor(rand() * 7); out("RT", v, d, r, roundTargets(v, d, r).map(n).join(";")); }

let taps = 0, jackpots = 0;
for (let k = 0; k < 900; k++) {
  let now = 1_000_000 + Math.floor(rand() * 1e6);
  const v = pick(["crown-casino", "crown-casino", "pulse-array"]), d = day();
  let s = startArcade(v, d, now);
  out("SA", v, d, now, run(s));
  const skill = pick([0, 30, 80, 150, 400]);
  for (let j = 0; j < 80 && !s.done; j++) {
    const q = rand();
    const target = s.next < s.targets.length ? s.roundStartsAt + s.targets[s.next]! : now + 300;
    if (q < 0.65) {
      now = Math.max(now, rand() < 0.1 ? now + pick([0, 100, 2000, 9000]) : Math.round(target + (rand() - 0.5) * 2 * skill));
      const before = run(s); s = arcadeTap(s, now); taps++; out("TP", before, now, run(s));
    } else if (q < 0.85) {
      now += pick([16, 100, 400, 1500, 4000]);
      const before = run(s); s = arcadeTick(s, now); out("TK", before, now, run(s));
    } else { const at = now + pick([0, 50, -50, 300]); out("SG", run(s), at, arcadeSignal(s, at)); }
  }
  if (s.won) jackpots++;
  out("SG", run(s), now, arcadeSignal(s, now));
  for (const t of [NaN, Infinity]) out("TP", run(s), t, run(arcadeTap(s, t)));
}
// window edges: a press exactly at target - tol and target + tol, and one ms outside
{
  const s0 = startArcade("crown-casino", "2026-03-01", 0);
  const tol = toleranceFor(0), tgt = s0.roundStartsAt + s0.targets[0]!;
  for (const t of [tgt - tol, tgt - tol - 1, tgt + tol, tgt + tol + 1, s0.roundStartsAt - 1, s0.roundStartsAt]) { out("TP", run(s0), t, run(arcadeTap(s0, t))); out("TK", run(s0), t, run(arcadeTick(s0, t))); out("SG", run(s0), t, arcadeSignal(s0, t)); }
}
for (let k = 0; k < 300; k++) {
  let p = { earnedRewards: rand() < 0.2 ? ["arcade-best:crown-casino:junk", "arcade-best:crown-casino:"] : [] as string[] };
  out("P", p.earnedRewards.join(",") || "~");
  for (let j = 0; j < 6; j++) {
    const v = pick(["crown-casino", "pulse-array"]), sc = pick([0, 0.6, 120, 999.5, 2300, 2300.4]);
    p = recordArcade(p, v, sc); out("RA", v, sc, p.earnedRewards.join(",") || "~");
    out("AB", v, arcadeBest(p, v));
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`arcade golden: ${lines.length} lines (${taps} taps, ${jackpots} jackpots) -> ${OUT}`);
