/**
 * Records golden enemy tactics from the web build's real enemy-intelligence.ts (squadRole, squadMove), ability-network.ts
 * (buildSynergy), enemy-tactics.ts (findFlankSpot with the line-of-sight stand-in, lobVelocity, stepGrenade, grenadeDamage,
 * beepEvery, throwsGrenades) and enemy-evasion.ts (roundThreat, diveDirection, reactsInTime, fleeDirection) for the C++
 * port's test (Plugins/WorldFractureCore/Tests/TacticsCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs tactics
 *
 * The ground in every case is the same rolling function (TcGround in the C++ test). Lines are tab-separated, "~" = absent.
 *   SR index elite boss -> role      SM role distance hp threat t archetype hold posture -> forward|strafe
 *   SA slotA slotB slotC -> archetype (buildSynergy mapped as in Scene.tsx)
 *   FF mx mz px py pz side -> x|z     LV fx fy fz tx ty tz -> vx|vy|vz|t
 *   GR x y z vx vy vz fuse            a grenade; then GS dt -> x|y|z|vx|vy|vz|fuse|rest
 *   GD dist covered -> damage          BE fuse -> interval      TG kind -> 0/1
 *   RT x y z dx dy dz speed splash proximity life age mx mz body -> x|z|t
 *   DD mx mz bx bz rdx rdz side -> x|z     RE t elite roll -> 0/1     FD mx mz cx cz seed -> x|z
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { squadRole, squadMove } from "../../src/game/enemy-intelligence";
import { buildSynergy, DEFAULT_BUILD } from "../../src/game/ability-network";
import { ABILITY_NODES } from "../../src/game/ability-network";
import { findFlankSpot, lobVelocity, stepGrenade, grenadeDamage, beepEvery, throwsGrenades, type Grenade } from "../../src/game/enemy-tactics";
import { roundThreat, diveDirection, reactsInTime, fleeDirection } from "../../src/game/enemy-evasion";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "tactics_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
let seed = 0x7ac7;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
/** rolling ground shared with the C++ test: plain arithmetic only, so both sides compute it bit for bit */
const ground = (x: number, z: number) => Math.floor(x / 9) * 0.5 - Math.floor(z / 13) * 0.3 + 1;

for (let i = 0; i < 60; i++) { const idx = Math.floor(rand() * 12), el = rand() < 0.2, bo = rand() < 0.1; out("SR", idx, el ? 1 : 0, bo ? 1 : 0, squadRole(idx, el, bo)); }
const ARCH = ["BALANCED", "DEFENSIVE", "STRIKER", "STRATEGIST"] as const, POST = ["NONE", "POWER", "CONTROL", "UTILITY"] as const;
for (let i = 0; i < 4000; i++) {
  const role = pick(["ASSAULT", "RANGED", "FLANKER", "LEADER"] as const), d = pick([3, 9.9, 10, 10.1, 13, 18, 20, 28, 36, 38, 60, rand() * 70]);
  const hp = pick([0.2, 0.34, 0.35, 0.8, 1]), th = pick([0, 40, 41, 90]), t = rand() * 30, ar = pick(ARCH), hold = rand() < 0.2, po = pick(POST);
  const m = squadMove(role, d, hp, th, t, ar, hold, po);
  out("SM", role, d, hp, th, t, ar, hold ? 1 : 0, po, `${n(m.forward)}|${n(m.strafe)}`);
}
const ids = ABILITY_NODES.map((x) => x.id);
for (let i = 0; i < 300; i++) {
  const slots = { PRIMARY: pick(ids), TACTICAL: pick(ids), ULTIMATE: pick(ids) };
  const a = buildSynergy({ ...DEFAULT_BUILD, slots } as typeof DEFAULT_BUILD).archetype;
  out("SA", slots.PRIMARY, slots.TACTICAL, slots.ULTIMATE, a === "Defender" ? "DEFENSIVE" : a === "Striker" ? "STRIKER" : a === "Strategist" ? "STRATEGIST" : "BALANCED");
}
const world = { ground, obstaclesNear: () => [], solids: [] };
for (let i = 0; i < 2000; i++) {
  const p = { x: rand() * 200 - 100, y: 0, z: rand() * 200 - 100 }; p.y = ground(p.x, p.z) + 1.6;
  const mx = p.x + (rand() - 0.5) * 60, mz = p.z + (rand() - 0.5) * 60, side = pick([1, -1] as const);
  const s = findFlankSpot(mx, mz, p, side, world as never);
  out("FF", mx, mz, p.x, p.y, p.z, side, s ? `${n(s.x)}|${n(s.z)}` : NONE);
}
for (let i = 0; i < 1000; i++) {
  const f = { x: rand() * 50, y: rand() * 3, z: rand() * 50 }, t = { x: f.x + (rand() - 0.5) * pick([2, 20, 60]), y: rand() * 3, z: f.z + (rand() - 0.5) * pick([2, 20, 60]) };
  const v = lobVelocity(f, t); out("LV", f.x, f.y, f.z, t.x, t.y, t.z, `${n(v.vx)}|${n(v.vy)}|${n(v.vz)}|${n(v.t)}`);
}
for (let g = 0; g < 200; g++) {
  const from = { x: rand() * 40, y: 3, z: rand() * 40 }, to = { x: from.x + (rand() - 0.5) * 50, y: 1, z: from.z + (rand() - 0.5) * 50 };
  const v = lobVelocity(from, { ...to, y: ground(to.x, to.z) });
  const gr: Grenade = { ...from, vx: v.vx, vy: v.vy, vz: v.vz, fuse: 2.4, id: g, rest: false };
  out("GR", gr.x, gr.y, gr.z, gr.vx, gr.vy, gr.vz, gr.fuse);
  for (let k = 0; k < 40; k++) { const dt = pick([1 / 60, 1 / 30, 0.1]); stepGrenade(gr, dt, ground); out("GS", dt, [gr.x, gr.y, gr.z, gr.vx, gr.vy, gr.vz, gr.fuse].map(n).join("|") + `|${gr.rest ? 1 : 0}`); }
}
for (const d of [0, 1, 3, 5.99, 6, 9]) for (const c of [false, true]) out("GD", d, c ? 1 : 0, grenadeDamage(d, c));
for (const f of [3, 2.4, 1, 0.4, 0.1, 0]) out("BE", f, beepEvery(f));
for (const k of ["RAIDER", "VANGUARD", "OVERCLOCKED", "ABERRATION", "SKYBORN"]) out("TG", k, throwsGrenades(k) ? 1 : 0);
for (let i = 0; i < 3000; i++) {
  const x = rand() * 80, z = rand() * 80, y = ground(x, z) + pick([1, 3, 8, 1.3]);
  const yaw = rand() * 6.28, pitch = pick([0, -0.05, -0.2, 0.1, -0.012]);
  const dx = Math.sin(yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = Math.cos(yaw) * Math.cos(pitch);
  const speed = pick([55, 62, 70, 75]), splash = pick([6, 7, 8, 9]), prox = pick([1.4, 2]), life = pick([4, 4.5, 6]), age = pick([0, 0.5, 3.9]);
  const far = pick([2, 10, 25, 60]), mx = x + dx * far + (rand() - 0.5) * pick([0, 3, 12]), mz = z + dz * far + (rand() - 0.5) * pick([0, 3, 12]), body = pick([1.5, 1.875, 2.7]);
  const r = { x, y, z, dx, dy, dz, def: { speed, splashRadius: splash, proximity: prox, life }, age };
  const th = roundThreat(r, mx, mz, ground, body);
  out("RT", x, y, z, dx, dy, dz, speed, splash, prox, life, age, mx, mz, body, th ? `${n(th.x)}|${n(th.z)}|${n(th.t)}` : NONE);
}
for (let i = 0; i < 500; i++) {
  const mx = rand() * 20, mz = rand() * 20, b = rand() < 0.3 ? { x: mx + (rand() - 0.5) * 1.4, z: mz + (rand() - 0.5) * 1.4 } : { x: rand() * 20, z: rand() * 20 };
  const rdx = rand() < 0.02 ? 0 : rand() - 0.5, rdz = rand() < 0.03 ? 0 : rand() - 0.5, side = pick([1, -1] as const);
  const d = diveDirection(mx, mz, b, rdx, rdz, side); out("DD", mx, mz, b.x, b.z, rdx, rdz, side, `${n(d.x)}|${n(d.z)}`);
}
for (const t of [0, 0.27, 0.28, 1]) for (const e of [false, true]) for (const r of [0.2, 0.5, 0.6, 0.75, 0.9]) out("RE", t, e ? 1 : 0, r, reactsInTime(t, e, r) ? 1 : 0);
for (let i = 0; i < 300; i++) { const cx = rand() * 20, cz = rand() * 20, mx = rand() < 0.2 ? cx + (rand() - 0.5) * 0.8 : rand() * 20, mz = rand() < 0.2 ? cz : rand() * 20, s = rand(); const f = fleeDirection(mx, mz, cx, cz, s); out("FD", mx, mz, cx, cz, s, `${n(f.x)}|${n(f.z)}`); }
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`tactics golden: ${lines.length} lines -> ${OUT}`);
