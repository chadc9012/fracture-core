/**
 * Records golden squad steps from the web build's real squad.ts for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/SquadCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs squad
 *
 *   CR px pz enabled -> squad            FS i px pz yaw -> slot
 *   PT targets mx mz px pz -> index      SD target dmg -> damage
 *   ST squad targets px pz yaw dt heat inVehicle rands -> squad|hits   (each step from the recorded state before it; the
 *                                                                       random draws it took are recorded in order)
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSquad, formationSlot, pickTarget, squadDamage, stepSquad, ENGAGE_RANGE, type SquadState, type SquadTarget } from "../../src/game/squad";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "squad_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0x5a1d;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const squadText = (s: SquadState) => [b(s.enabled), n(s.nextShot), n(s.clock),
  s.mates.map((m) => [n(m.id), m.name, n(m.x), n(m.z), n(m.yaw), n(m.speed), n(m.cool), n(m.target), n(m.firing)].join(",")).join(";") || "~",
  s.shots.map((h) => [n(h.id), n(h.fromX), n(h.fromZ), n(h.toX), n(h.toZ), b(h.hit), n(h.at)].join(",")).join(";") || "~"].join("/");
const targetText = (t: SquadTarget) => [n(t.x), n(t.z), b(t.alive), b(t.boss), n(t.hp), t.maxHp === undefined ? "~" : n(t.maxHp), b(!!t.decoy)].join(",");
const targetsText = (ts: SquadTarget[]) => ts.map(targetText).join(";") || "~";

const target = (px: number, pz: number): SquadTarget => {
  const far = rand() < 0.2 ? ENGAGE_RANGE + rand() * 20 : rand() * ENGAGE_RANGE;
  const edge = rand() < 0.05 ? ENGAGE_RANGE : far;
  const a = rand() * Math.PI * 2, boss = rand() < 0.15, hp = 1 + rand() * (boss ? 200 : 20);
  const t: SquadTarget = { x: px + Math.cos(a) * edge, z: pz + Math.sin(a) * edge, alive: rand() < 0.9, boss, hp };
  if (rand() < 0.7) t.maxHp = hp * (1 + rand() * 3);
  if (rand() < 0.1) t.decoy = true;
  return t;
};

for (let k = 0; k < 400; k++) {
  const px = (rand() - 0.5) * 600, pz = (rand() - 0.5) * 600, en = rand() < 0.9;
  out("CR", px, pz, b(en), squadText(createSquad(px, pz, en)));
  const i = Math.floor(rand() * 4), yaw = (rand() - 0.5) * 20;
  const s = formationSlot(i, px, pz, yaw);
  out("FS", i, px, pz, yaw, `${n(s.x)},${n(s.z)}`);
  const ts = Array.from({ length: Math.floor(rand() * 7) }, () => target(px, pz));
  const mx = px + (rand() - 0.5) * 30, mz = pz + (rand() - 0.5) * 30;
  out("PT", targetsText(ts), mx, mz, px, pz, pickTarget(ts, mx, mz, px, pz));
  for (const t of ts) { const d = pick([0, 0.5, 2.64, 10, 300, -1]); out("SD", targetText(t), d, squadDamage(t, d)); }
}

let steps = 0, shots = 0, hitsTotal = 0;
for (let run = 0; run < 260; run++) {
  let px = (rand() - 0.5) * 400, pz = (rand() - 0.5) * 400, yaw = (rand() - 0.5) * 6, heat = 0, inVehicle = false;
  const squad = createSquad(px + (rand() < 0.2 ? 90 : 0), pz, rand() < 0.95);
  let ts: SquadTarget[] = Array.from({ length: 1 + Math.floor(rand() * 6) }, () => target(px, pz));
  for (let k = 0; k < 260; k++) {
    const dt = pick([1 / 60, 1 / 60, 1 / 30, 0.05, 0.1, 0.25, 0, 0.0005]);
    const r = rand();
    if (r < 0.3) { const sp = pick([0, 3, 7, 14]); px += Math.sin(yaw) * sp * dt; pz += Math.cos(yaw) * sp * dt; }
    else if (r < 0.33) yaw += (rand() - 0.5) * 4;
    else if (r < 0.335) { px += (rand() - 0.5) * 300; pz += (rand() - 0.5) * 300; } // fast travel
    if (rand() < 0.08) heat = pick([0, 0.49, 0.5, 3, 12]);
    if (rand() < 0.02) inVehicle = !inVehicle;
    if (rand() < 0.03) ts.push(target(px, pz));
    if (rand() < 0.01) ts = ts.filter(() => rand() < 0.6);
    for (const t of ts) if (rand() < 0.1) { t.x += (rand() - 0.5) * 2; t.z += (rand() - 0.5) * 2; }
    const before = squadText(squad), tsText = targetsText(ts);
    const draws: number[] = [];
    const hits = stepSquad(squad, ts, { px, pz, yaw, dt, heat, inVehicle, rand: () => { const v = rand(); draws.push(v); return v; } });
    out("ST", before, tsText, px, pz, yaw, dt, heat, b(inVehicle), draws.map(n).join(",") || "~", squadText(squad) + "|" + (hits.map((h) => `${h.index};${n(h.damage)}`).join(",") || "~"));
    ++steps; shots += draws.length ? 1 : 0; hitsTotal += hits.length;
    // the host applies hits (sim.ts: a boss stops at 0.01, others fall)
    for (const h of hits) { const t = ts[h.index]!; t.hp -= h.damage; if (t.hp <= 0) { if (t.boss) t.hp = 0.01; else t.alive = false; } }
  }
}
// edge probes: player at (3.2, 2.6) facing +z puts VEX's slot exactly at (0, 0)
const probe = (setup: (s: SquadState) => void, ts: SquadTarget[], dt: number, heat: number) => {
  const squad = createSquad(3.2, 2.6);
  squad.mates[0]!.cool = 0;
  setup(squad);
  const before = squadText(squad), tsText = targetsText(ts);
  const draws: number[] = [];
  const hits = stepSquad(squad, ts, { px: 3.2, pz: 2.6, yaw: 0, dt, heat, inVehicle: false, rand: () => { const v = rand(); draws.push(v); return v; } });
  out("ST", before, tsText, 3.2, 2.6, 0, dt, heat, "0", draws.map(n).join(",") || "~", squadText(squad) + "|" + (hits.map((h) => `${h.index};${n(h.damage)}`).join(",") || "~"));
};
for (const x of [0.6, 6, 0.75]) probe((s) => { s.mates[0]!.x = x; }, [], x === 0.75 ? 2.5 : 0.05, 0);
probe(() => {}, [{ x: 5, z: 0, alive: true, boss: false, hp: 9 }, { x: 0, z: 5, alive: true, boss: false, hp: 9 }], 0.05, 1); // a tie: the first wins
probe(() => {}, [{ x: 0, z: -5, alive: true, boss: false, hp: 9 }], 0.05, 1); // straight behind: a half turn
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`squad golden: ${steps} steps (${hitsTotal} hits), ${lines.length} lines -> ${OUT}`);
