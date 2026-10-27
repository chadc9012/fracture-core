/**
 * Records golden stunts and the Stunt Park from the web build's real stunts.ts and stunt-park.ts for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/StuntCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs stunt
 *
 *   AF air dt stand throttle brake steer handbrake -> air|landing       (each frame from the recorded state before it)
 *   WR a -> wrap(a)      LT landing -> tricks
 *   R  -> a fresh run    SL landing now -> points|run      PS slip speed dt now -> points|run
 *   CM n -> comboMult    SN points paid -> stuntNex        PY ledger day points -> ledger
 *   PK -> park   RP ramp -> centre|deck(ground)|profile   IN x z margin -> inStuntPark
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { comboMult, freshAir, freshRun, landingTricks, payStunts, scoreLanding, stepAir, stepPowerslide, stuntNex, wrap, type AirState, type Landing, type StuntRun } from "../../src/game/stunts";
import { RAMPS, STUNT_PARK, inStuntPark, rampCentre, rampDeck, rampProfile } from "../../src/game/stunt-park";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "stunt_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0x57a7;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const air = (a: AirState) => [n(a.y), n(a.vy), b(a.airborne), n(a.lastStand), n(a.pitch), n(a.roll), n(a.spinYaw), n(a.airTime)].join(",");
const land = (l: Landing | null) => (l ? [n(l.airTime), n(l.pitch), n(l.roll), n(l.spinYaw), n(l.impact), b(l.clean)].join(",") : "~");
const run = (r: StuntRun) => [n(r.combo), n(r.comboUntil), n(r.total), n(r.best), n(r.slideTime), r.last ? `${r.last.label};${n(r.last.points)};${n(r.last.at)};${b(r.last.wipeout)}` : "~"].join(",");
const TAU = Math.PI * 2;

// ---- flight: ground profiles with crests, ramps and drops, under random stick input ----
for (let t = 0; t < 300; t++) {
  let stand = (rand() - 0.5) * 40, slope = 0;
  const a = freshAir(stand);
  const input = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const speed = pick([8, 20, 35, 55]);
  for (let k = 0; k < 220; k++) {
    const dt = pick([1 / 60, 1 / 60, 1 / 30, 0.05, 0.1, 0, -0.01]);
    const r = rand();
    if (r < 0.04) slope = (rand() - 0.3) * 1.2; // a ramp up or a run down
    else if (r < 0.06) stand -= pick([1, 3, 8]); // a ledge
    else if (r < 0.08) slope = 0;
    if (dt > 0) stand += slope * speed * dt;
    if (rand() < 0.15) Object.assign(input, { throttle: pick([0, 0, 1, 0.5]), brake: pick([0, 0, 1]), steer: pick([-1, 0, 0, 1, 0.4]), handbrake: rand() < 0.3 });
    if (rand() < 0.01) Object.assign(a, { y: a.y + 20, airborne: true, pitch: pick([TAU - 0.86, TAU - 0.84, -TAU + 0.5, 3 * TAU]), roll: pick([0, TAU + 0.84, -0.9]) });
    const before = air(a);
    const landing = stepAir(a, stand, input, dt);
    out("AF", before, dt, stand, input.throttle, input.brake, input.steer, b(input.handbrake), `${air(a)}|${land(landing)}`);
  }
}
// the exact edges: leaving the ground exactly at the launch gap, touching down exactly at the stand height
for (let t = 0, found = 0; t < 20000 && found < 60; t++) {
  const y = Math.round((rand() - 0.5) * 400) / 8, vy = Math.round(rand() * 160) / 8, dt = pick([1 / 64, 1 / 32, 0.125, 0.0625]);
  const nextY = y + vy * dt - 0.5 * 21 * dt * dt, stand = nextY - 0.35;
  if (stand + 0.35 !== nextY) continue;
  found++;
  const a: AirState = { ...freshAir(y), vy, lastStand: stand };
  const before = air(a), l = stepAir(a, stand, { throttle: 0, brake: 0, steer: 0, handbrake: false }, dt);
  out("AF", before, dt, stand, 0, 0, 0, "0", `${air(a)}|${land(l)}`);
  const f: AirState = { ...freshAir(y), vy, airborne: true, lastStand: y, airTime: 0.5 };
  const vy2 = vy - 21 * dt, stand2 = y + vy2 * dt;
  const before2 = air(f), l2 = stepAir(f, stand2, { throttle: 1, brake: 0, steer: 0, handbrake: false }, dt);
  out("AF", before2, dt, stand2, 1, 0, 0, "0", `${air(f)}|${land(l2)}`);
}
for (let t = 0; t < 2000; t++) { const v = (rand() - 0.5) * 60; out("WR", v, wrap(v)); }
for (const v of [Math.PI, -Math.PI, 0, TAU, -TAU, 3 * Math.PI, -3 * Math.PI, 1e-12]) out("WR", v, wrap(v));

// ---- scoring ----
const ROT = [0, 0.3, TAU - 0.86, TAU - 0.85, TAU - 0.84, TAU, 2 * TAU - 0.8, 2 * TAU + 0.2, 3 * TAU - 0.5, 4 * TAU + 0.1, 5 * TAU];
const landing = (): Landing => ({
  airTime: pick([0.1, 0.4, 1.39, 1.4, 2.39, 2.4, 3.7, rand() * 4]), pitch: pick(ROT) * pick([1, -1]), roll: rand() < 0.5 ? 0 : pick(ROT) * pick([1, -1]),
  spinYaw: rand() < 0.5 ? 0 : pick([TAU - 0.5, TAU - 0.51, 2 * TAU - 0.5, 3 * TAU, 0.2, rand() * 20]) * pick([1, -1]), impact: rand() * 20, clean: rand() < 0.8,
});
for (let t = 0; t < 2500; t++) { const l = landing(); out("LT", land(l), landingTricks(l).map((x) => `${x.name};${n(x.points)}`).join(",") || "~"); }
for (let t = 0; t < 300; t++) {
  const r = freshRun();
  out("R", run(r));
  let now = rand() * 1000;
  for (let k = 0; k < 40; k++) {
    now += pick([0.5, 2, 3.99, 4, 4.01, 9]);
    if (rand() < 0.5) { const l = landing(); const pts = scoreLanding(r, l, now); out("SL", land(l), now, `${n(pts)}|${run(r)}`); }
    else for (let j = 0; j < 30; j++) { const slip = pick([0.1, 0.3, 0.31, 0.6]), sp = pick([5, 15, 15.01, -20, 30]), dt = pick([1 / 60, 0.05, 0.1]); now += dt; const pts = stepPowerslide(r, slip, sp, dt, now); out("PS", slip, sp, dt, now, `${n(pts)}|${run(r)}`); }
  }
}
// a slide of exactly 1.2 s (0.6 + 0.6) scores; one just short does not
for (const dts of [[0.6, 0.6], [0.6, 0.5999999999999999]]) {
  const r = freshRun();
  out("R", run(r));
  let now = 50;
  for (const dt of dts) { now += dt; out("PS", 0.5, 30, dt, now, `${n(stepPowerslide(r, 0.5, 30, dt, now))}|${run(r)}`); }
  now += 0.1; out("PS", 0.1, 30, 0.1, now, `${n(stepPowerslide(r, 0.1, 30, 0.1, now))}|${run(r)}`);
}
for (let i = -1; i <= 12; i++) out("CM", i, comboMult(i));
for (let t = 0; t < 1500; t++) {
  const pts = pick([0, 49, 50, 99, 1000, 30000, Math.floor(rand() * 40000)]), paid = pick([0, 100, 599, 600, 700]);
  out("SN", pts, paid, stuntNex(pts, paid));
  const ledger: Record<string, number> = rand() < 0.5 ? { "stunts:2026-10-25": paid } : { other: 3 };
  const day = pick(["2026-10-25", "2026-10-26"]);
  const next = payStunts({ nexLedger: ledger }, day, pts).nexLedger ?? {};
  const kv = (m: Record<string, number>) => Object.keys(m).sort().map((k) => `${k}=${n(m[k]!)}`).join(",") || "~";
  out("PY", kv(ledger), day, pts, kv(next));
}

// ---- the park ----
out("PK", [STUNT_PARK.x, STUNT_PARK.z, STUNT_PARK.dirX, STUNT_PARK.dirZ, STUNT_PARK.length, STUNT_PARK.width].map(n).join(","));
for (const r of RAMPS) {
  const c = rampCentre(r), ground = pick([0, 3.7, -2.5]), d = rampDeck(r, ground);
  out("RP", [r.id, n(r.along), n(r.across), n(r.length), n(r.ramp), n(r.width), n(r.height), r.label].join(","), ground,
    `${n(c.x)},${n(c.z)}|${[d.id, d.x, d.z, d.dirX, d.dirZ, d.length, d.width, d.top, d.base, d.ramp].map((v) => (typeof v === "number" ? n(v) : v)).join(",")}|${rampProfile(r).map(([u, h]) => `${n(u)}:${n(h)}`).join(",")}`);
}
for (let t = 0; t < 3000; t++) {
  const x = STUNT_PARK.x + (rand() - 0.5) * 220, z = STUNT_PARK.z + (rand() - 0.5) * 90, m = pick([0, 0, 6, 20]);
  out("IN", x, z, m, b(inStuntPark(x, z, m)));
}
for (const [dx, dz] of [[75, 0], [-75, 0], [0, 23], [0, -23], [74.999, 22.999]]) out("IN", STUNT_PARK.x + dx!, STUNT_PARK.z + dz!, 0, b(inStuntPark(STUNT_PARK.x + dx!, STUNT_PARK.z + dz!)));
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`stunt golden: ${lines.length} lines -> ${OUT}`);
