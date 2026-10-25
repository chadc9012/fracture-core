/**
 * Records golden vehicle handling, surfaces, condition, repair and ownership from the web build's real
 * vehicle-handling.ts, vehicle-surface.ts, vehicle-condition.ts and progression.ts rewardVehicle for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/VehicleCoreTest.cpp).
 *
 *   npx esbuild unreal/tools/gen-vehicle-golden.ts --bundle --platform=node --format=esm --alias:@=./src \
 *     --outfile=/tmp/wf-vehicle-golden.mjs && node /tmp/wf-vehicle-golden.mjs
 *
 * Lines (tab-separated):
 *   V id domain speed handling      a vehicle; KIND -> handling kind; RUN state  a run's starting state
 *   ST throttle brake steer ascend descend handbrake boost | grip slope floor water overWater | topSpeed dt -> state
 *   EX deepWater -> exit check (against the current state)       CAM -> distance|height
 *   SF region height water -> surface    SG surface slope -> grip
 *   IM body engine tires susp speedLost mode -> condition      FX cond -> effects    RP cond -> price|cost
 *   RV cond calm stopped -> condition    TS biome mod speed gear damage race -> top speed
 *   RW owned loadout selected id -> owned|loadout|selected      RR ledger cond id now -> ok|message|ledger|cond
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { VEHICLES } from "../../src/game/vehicles";
import { handlingFor, stepVehicle, canExitVehicle, vehicleCamera, type VehicleState } from "../../src/game/vehicle-handling";
import { surfaceAt, surfaceGrip, SURFACE_GRIP, type Surface } from "../../src/game/vehicle-surface";
import { impactVehicle, conditionEffects, repairPrice, repairCost, recoverVehicle, repairVehicle, type VehicleCondition } from "../../src/game/vehicle-condition";
import { rewardVehicle, DEFAULT_PROGRESSION } from "../../src/game/progression";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "vehicle_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0xca12;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
Math.random = () => { throw new Error("vehicle rules must not draw random numbers"); };
const stateText = (s: VehicleState & Partial<{ landed: boolean; hardLanding: boolean; blocked: boolean; skidding: boolean }>) =>
  [n(s.speed), n(s.yaw), n(s.y), n(s.vy), b(s.airborne), n(s.slip), n(s.roll), n(s.pitch), b(!!s.landed), b(!!s.hardLanding), b(!!s.blocked), b(!!s.skidding)].join("|");

const lines: string[] = [];
let steps = 0;
for (const v of VEHICLES) {
  const p = handlingFor(v);
  lines.push(["V", v.id, v.domain, n(v.speed), n(v.handling)].join("\t"), ["KIND", p.kind].join("\t"));
  const cam = vehicleCamera(p);
  lines.push(["CAM", `${n(cam.distance)}|${n(cam.height)}`].join("\t"));
  for (let run = 0; run < 12; run++) {
    let st: VehicleState = { speed: pick([0, 0, 5, 20, -3]), yaw: rand() * 6, y: 10, vy: 0, airborne: false, slip: 0, roll: 0, pitch: 0 };
    lines.push(["RUN", stateText(st)].join("\t"));
    const style = pick(["cruise", "drift", "climb", "brake", "chaos"] as const);
    const floor = pick([0, 5, 12]), water = pick([0, 4]);
    for (let i = 0; i < 90; i++) {
      const input = {
        throttle: style === "brake" && i > 40 ? 0 : rand() < 0.75 ? pick([1, 1, 0.5]) : 0,
        brake: style === "brake" && i > 40 ? 1 : rand() < 0.1 ? 1 : 0,
        steer: style === "drift" ? pick([1, -1, 0.7]) : rand() < 0.4 ? pick([1, -1, 0.3, -0.6]) : 0,
        // a sub's climb run dives first (down to its floor clearance), then surfaces
        ascend: style === "climb" ? (p.kind === "SUB" ? (i >= 50 ? 1 : 0) : i < 60 ? 1 : 0) : rand() < 0.2 ? 1 : 0,
        descend: style === "climb" ? (p.kind === "SUB" ? (i < 50 ? 1 : 0) : i >= 60 ? 1 : 0) : rand() < 0.1 ? 1 : 0,
        handbrake: style === "drift" ? rand() < 0.5 : rand() < 0.05,
        boost: rand() < 0.2,
      };
      const env = { grip: pick([1, 0.85, 0.62, 0.35, 0.2]), slope: pick([0, 0.1, 0.4]), floor: floor + (style === "chaos" ? pick([0, 1, 3]) : 0), water, overWater: rand() < (p.mode === "WATER" ? 0.85 : 0.2) };
      const top = 62 * pick([0.9, 1, 1.1]) * v.speed * pick([1, 0.94]);
      const dt = pick([1 / 60, 1 / 30, 0.05, 0.1, 0.25]);
      const r = stepVehicle(p, st, input, env, top, dt);
      lines.push(["ST", [n(input.throttle), n(input.brake), n(input.steer), n(input.ascend), n(input.descend), b(input.handbrake), b(input.boost)].join("|"), [n(env.grip), n(env.slope), n(env.floor), n(env.water), b(env.overWater)].join("|"), n(top), n(dt), stateText(r)].join("\t"));
      st = { speed: r.speed, yaw: r.yaw, y: r.y, vy: r.vy, airborne: r.airborne, slip: r.slip, roll: r.roll, pitch: r.pitch };
      steps++;
      if (rand() < 0.1) { const deep = rand() < 0.5; const e = canExitVehicle(p, st, deep); lines.push(["EX", b(deep), e.ok ? "ok" : e.reason].join("\t")); }
    }
  }
}
const regions = ["nexus", "solara", "swamps", "frostspire", "ember", "wastelands", "veridan", "unknown"];
for (const r of regions) for (const h of [-5, -0.3, 0, 10, 40, 41]) lines.push(["SF", r, n(h), "0", surfaceAt(r, h, 0)].join("\t"));
for (const s of Object.keys(SURFACE_GRIP) as Surface[]) for (const sl of [0, 0.3, 1, 2]) lines.push(["SG", s, n(sl), n(surfaceGrip(s, sl))].join("\t"));
const cond = (c: VehicleCondition) => [c.body, c.engine, c.tires, c.suspension].map(n).join("|");
for (let i = 0; i < 200; i++) {
  const c: VehicleCondition = { body: pick([0, 10, 50, 99, 100]), engine: pick([0, 20, 70, 89, 90]), tires: pick([0, 33, 100]), suspension: pick([0, 15, 60]) };
  const lost = pick([0, 1, 2, 2.5, 5, 18, 18.5, 30, -10]), mode = pick(["world", "casual", "competitive"] as const);
  lines.push(["IM", cond(c), n(lost), mode, cond(impactVehicle(c, lost, mode))].join("\t"));
  const fx = conditionEffects(c);
  lines.push(["FX", cond(c), [fx.speed, fx.acceleration, fx.grip, fx.stability].map(n).join("|") + "|" + b(fx.disabled)].join("\t"));
  lines.push(["RP", cond(c), `${n(repairPrice(c))}|${n(repairCost(c))}`].join("\t"));
  const calm = rand() < 0.5, stopped = rand() < 0.5;
  lines.push(["RV", cond(c), b(calm), b(stopped), cond(recoverVehicle(c, calm, stopped))].join("\t"));
  const ledger: Record<string, number> = rand() < 0.7 ? { "mission:awakening:2026-01-01:1": pick([0, 50, 300, 1500]) } : {};
  if (rand() < 0.3) ledger["spend:x"] = -20;
  const now = 1_700_000_000_000 + i;
  const res = repairVehicle({ nexLedger: ledger, vehicleConditions: { "goliath-tank": c } }, "goliath-tank", now);
  const ledText = (l: Record<string, number>) => Object.keys(l).sort().map((k) => `${k}=${n(l[k]!)}`).join(",");
  lines.push(["RR", ledText(ledger), cond(c), "goliath-tank", n(now), "error" in res ? `0|${res.error}|${ledText(ledger)}|${cond(c)}` : `1|${res.message}|${ledText(res.progression.nexLedger)}|${cond(res.progression.vehicleConditions["goliath-tank"]!)}`].join("\t"));
  const ts = [pick([0.7, 0.9, 1]), pick([1, 1.2]), pick(VEHICLES).speed, rand() < 0.5 ? pick([1, 5, 10]) : undefined, fx.speed, pick([1, 0.6])] as const;
  lines.push(["TS", ts.map((x) => (x === undefined ? "~" : n(x))).join("|"), n(62 * ts[0] * ts[1] * ts[2] * (ts[3] !== undefined ? 1 + ts[3] * 0.04 : 1) * ts[4] * ts[5])].join("\t"));
}
let g = DEFAULT_PROGRESSION;
for (let i = 0; i < 30; i++) {
  const id = pick(VEHICLES).id;
  const before = `${g.ownedVehicles.join(",")}|${g.garageLoadout.join(",")}|${g.selectedVehicle ?? "~"}`;
  g = rewardVehicle(g, id);
  lines.push(["RW", before, id, `${g.ownedVehicles.join(",")}|${g.garageLoadout.join(",")}|${g.selectedVehicle ?? "~"}`].join("\t"));
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`${VEHICLES.length} vehicles, ${steps} handling steps -> ${OUT}`);
