/**
 * Records golden heavy arms from the web build's real melee-arc.ts, foundries.ts (blades, swingStats, inShockwave,
 * activeBlade) and launchers.ts (the launcher table, fired through ordnance.ts fireRound and launchers.ts pickLockTarget)
 * for the C++ port's test (Plugins/WorldFractureCore/Tests/ArmsCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs arms
 *
 * Lines are tab-separated; "~" = absent.
 *   BL id name foundry rarity perk damage armored reach shockwave(length|width|damage) deflect
 *   AR px pz pfeet yaw ex ez efeet scale reach -> 0/1
 *   SW blade combo damage reach armored -> damage|reach|shockwave|deflect
 *   SK length width ox oz yaw x z -> 0/1          AB earned(,) equipped -> blade id
 *   LA id element fx guided lockCone lockRange kind speed turnRate life splash proximity
 *   LF id x y z yaw pitch damage cands(x:z:alive;) -> target|x|y|z|dx|dy|dz|speed|damage
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { inSwordArc } from "../../src/game/melee-arc";
import { BLADES, swingStats, inShockwave, activeBlade, bladeKey, type BladeId } from "../../src/game/foundries";
import { LAUNCHERS, pickLockTarget, type LauncherId } from "../../src/game/launchers";
import { fireRound } from "../../src/game/ordnance";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "arms_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
let seed = 0xa4b5;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const sw = (s: { length: number; width: number; damage: number } | null | undefined) => (s ? `${n(s.length)}|${n(s.width)}|${n(s.damage)}` : NONE);

const IDS = Object.keys(BLADES) as BladeId[];
for (const id of IDS) { const b = BLADES[id]; out("BL", b.id, b.name, b.foundry, b.rarity, b.perk, b.damage, b.armored, b.reach, sw(b.shockwave), b.deflect); }
for (let i = 0; i < 4000; i++) {
  const p = { x: rand() * 40, z: rand() * 40, feet: pick([0, 1, 4]), yaw: rand() * 8 - 4 };
  const r = pick([0, 0.3, 0.59, 0.61, 3, 6, 7, 9, 12]), a = p.yaw + pick([0, 1.3, 1.309, 1.31, 1.4, 3, -1.308, -1.3095]);
  const scale = pick([0.9, 1, 1.25, 1.8, 2.5]);
  const e = { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r, feet: p.feet + pick([0, 1, 2.5, 2.6, 4.5, -3]), scale };
  const reach = pick([6, 7, 8, 10]);
  out("AR", p.x, p.z, p.feet, p.yaw, e.x, e.z, e.feet, e.scale, reach, inSwordArc(p, e, reach) ? 1 : 0);
}
for (let i = 0; i < 600; i++) {
  const id = rand() < 0.25 ? null : pick(IDS), combo = pick([0, 1, 2, 3]), dmg = pick([3.2, 1, 4.5]), reach = pick([6, 8]), armored = rand() < 0.5;
  const s = swingStats(id ? BLADES[id] : null, combo, { damage: dmg, reach }, armored);
  out("SW", id ?? NONE, combo, dmg, reach, armored ? 1 : 0, `${n(s.damage)}|${n(s.reach)}|${sw(s.shockwave)}|${n(s.deflect)}`);
}
for (let i = 0; i < 2000; i++) {
  const s = { length: 12, width: 2.5, damage: 4 }, ox = rand() * 20, oz = rand() * 20, yaw = rand() * 7 - 3.5;
  // edges are probed 1e-9 inside or outside: Math.sin / std::sin may differ in the last bit right on the line
  const along = pick([-0.5, -1e-9, 1e-9, 6, 12 - 1e-9, 12 + 1e-9, 15]), across = pick([0, 1, 2.5 - 1e-9, 2.5 + 1e-9, 4]) * pick([1, -1]);
  const x = ox + Math.sin(yaw) * along + Math.cos(yaw) * across, z = oz + Math.cos(yaw) * along - Math.sin(yaw) * across;
  out("SK", s.length, s.width, ox, oz, yaw, x, z, inShockwave(s, ox, oz, yaw, x, z) ? 1 : 0);
}
for (let i = 0; i < 200; i++) {
  const earned = IDS.filter(() => rand() < 0.5).map(bladeKey).concat(rand() < 0.3 ? ["race-title:x"] : []);
  const eq = pick([null, "vectal", "aegis-broadsword", "sun-cutter", "excalibur"]);
  const b = activeBlade({ earnedRewards: earned, blade: eq });
  out("AB", earned.join(",") || NONE, eq ?? NONE, b ? b.id : NONE);
}
const LIDS = Object.keys(LAUNCHERS) as LauncherId[];
for (const id of LIDS) { const l = LAUNCHERS[id], o = l.ordnance; out("LA", l.id, l.element, l.fx, l.guided ? 1 : 0, l.lockCone, l.lockRange, o.kind, o.speed, o.turnRate, o.life, o.splashRadius, o.proximity); }
for (let i = 0; i < 1500; i++) {
  const id = pick(LIDS), L = LAUNCHERS[id], x = rand() * 100, y = rand() * 5, z = rand() * 100, yaw = rand() * 7 - 3.5, pitch = rand() * 0.6 - 0.2, dmg = pick([5, 4, 4.5]) * pick([1, 1.2]);
  const cands = Array.from({ length: Math.floor(rand() * 6) }, () => ({ x: x + (rand() - 0.5) * 200, z: z + (rand() - 0.5) * 200, alive: rand() < 0.85 }));
  // sim.ts fireLauncher: the lock, then fireRound with the shot's damage
  const lock = L.guided ? pickLockTarget({ x, z }, yaw, cands, L.lockCone, L.lockRange) : -1;
  const aim: [number, number, number] = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const r = fireRound({ ...L.ordnance, damage: dmg }, { x, y, z }, aim);
  out("LF", id, x, y, z, yaw, pitch, dmg, cands.map((c) => `${n(c.x)}:${n(c.z)}:${c.alive ? 1 : 0}`).join(";") || NONE,
    [lock, r.x, r.y, r.z, r.dx, r.dy, r.dz, r.def.speed, r.def.damage].map(n).join("|"));
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`arms golden: ${lines.length} lines -> ${OUT}`);
