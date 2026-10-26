/**
 * Records golden enemy perception from the web build's real enemy-perception.ts, enemy-tuning.ts and line-of-sight.ts
 * enemyHitChance for the C++ port's test (Plugins/WorldFractureCore/Tests/PerceptionCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs perception
 *
 * Lines are tab-separated.
 *   SR night visibility elite -> sight          AG distance sight noise damaged facing inView -> gain
 *   AI x z hp                                   a fresh awareness track (createAi); then
 *   ST distance sight noise damaged facing inView px pz dt -> state|awareness|lastX|lastZ|timer
 *   TC hpFraction coverTime boss -> 0/1         PC mx mz px pz side -> x|z
 *   HC distance range speed stance -> chance    AR night elite radiusMod aggression -> radius
 *   TS night elite -> speed                     WU boss elite -> windup|cooldown
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAi, sightRange, awarenessGain, stepAwareness, shouldTakeCover, pickCover, type EnemyAi } from "../../src/game/enemy-perception";
import { aggroRadius, trooperSpeed, windupFor, rangedCooldownFor } from "../../src/game/enemy-tuning";
import { enemyHitChance } from "../../src/game/line-of-sight";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "perception_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0x9e7c;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));

for (let i = 0; i < 400; i++) { const nt = pick([0, 0.5, 1, rand()]), vis = pick([0, 0.2, 0.25, 0.6, 1]), el = rand() < 0.4; out("SR", nt, vis, b(el), sightRange(nt, vis, el)); }
const stim = () => ({ distance: pick([0, 3, 20, 46.7, 59.9, 60, 84.9, 85, 110, rand() * 140]), sight: pick([46.75, 85, 110.5, 30]), noise: pick([0, 0.1, 0.5, 1, rand()]), damaged: rand() < 0.15, facing: rand() < 0.5, inView: rand() < 0.8 });
for (let i = 0; i < 3000; i++) { const s = stim(); out("AG", s.distance, s.sight, s.noise, b(s.damaged), b(s.facing), b(s.inView), awarenessGain(s)); }
let tracks = 0;
for (let c = 0; c < 300; c++) {
  const x = rand() * 100, z = rand() * 100, hp = pick([3, 7, 34]);
  const ai: EnemyAi = createAi(x, z, hp); tracks++;
  out("AI", x, z, hp);
  for (let k = 0; k < 60; k++) {
    // runs of perceived and unperceived frames, so states climb, lock, fall to SEARCH and time out
    const s = rand() < 0.5 ? stim() : { distance: 200, sight: 85, noise: 0, damaged: false, facing: false, inView: false };
    const px = rand() * 100, pz = rand() * 100, dt = pick([1 / 30, 0.1, 0.5, 2, 6]);
    const st = stepAwareness(ai, s, px, pz, dt);
    out("ST", s.distance, s.sight, s.noise, b(s.damaged), b(s.facing), b(s.inView), px, pz, dt, `${st}|${n(ai.awareness)}|${n(ai.lastX)}|${n(ai.lastZ)}|${n(ai.timer)}`);
  }
}
for (let i = 0; i < 200; i++) { const f = pick([0, 0.49, 0.5, 0.8]), ct = pick([-1, 0, 0.1, 3]), boss = rand() < 0.3; out("TC", f, ct, b(boss), b(shouldTakeCover(f, ct, boss))); }
for (let i = 0; i < 300; i++) { const mx = rand() * 100, mz = rand() * 100, px = rand() < 0.05 ? mx : rand() * 100, pz = rand() < 0.05 ? mz : rand() * 100, side = pick([1, -1]); const c = pickCover(mx, mz, px, pz, side); out("PC", mx, mz, px, pz, side, `${n(c.x)}|${n(c.z)}`); }
for (let i = 0; i < 1500; i++) {
  const d = pick([0, 0.3, 0.7, 5, 20, 40, 41, 80, rand() * 60]), r = pick([0, 0.5, 1, 40]), sp = pick([-3, 0, 6, 16, 30, 50]), st = pick(["STAND", "CROUCH", "PRONE"] as const);
  out("HC", d, r, sp, st, enemyHitChance(d, r, sp, st));
}
for (let i = 0; i < 300; i++) { const nt = pick([0, 1, rand()]), el = rand() < 0.5, rm = pick([0.5, 1, 1.2, 2]), ag = pick([0.5, 1, 1.4]); out("AR", nt, b(el), rm, ag, aggroRadius(nt, el, rm, ag)); out("TS", nt, b(el), trooperSpeed(nt, el)); }
for (const boss of [false, true]) for (const el of [false, true]) out("WU", b(boss), b(el), `${n(windupFor({ boss, elite: el }))}|${n(rangedCooldownFor({ boss, elite: el }))}`);
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`perception golden: ${tracks} awareness tracks, ${lines.length} lines -> ${OUT}`);
