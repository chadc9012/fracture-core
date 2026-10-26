/**
 * Records golden city systems from the web build's real heat.ts, stealth.ts, chase-ai.ts, quest-signals.ts and the
 * createSim turret layout for the C++ port's test (Plugins/WorldFractureCore/Tests/CityCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs city
 *
 * Lines are tab-separated; "~" = absent.
 *   HM heat intensity dt -> heat'            HS heat -> level|label|response
 *   VD healthPct -> stage|speed|handling|weaponsDisabled      FF stage blocked -> 0/1
 *   VC sx sz rot range px pz -> 0/1          DM meter dt seen hacking -> meter'      DS meter -> state
 *   LS meter -> tier|label|response          HK progress dt detection -> progress'
 *   TU x z zone rot range                    the createSim turret layout, in order
 *   NS x z rot range                         nexusSensors of that layout
 *   QC                                       a fresh signal track; then QH region heat tier hack diving kills hp dt -> events
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { heatStatus, stepHeatMeter } from "../../src/game/heat";
import { inVisionCone, stepDetectionMeter, detectionStateFor, lockdownStatus, stepHackProgress, nexusSensors, type LockdownTier, type DetectionState } from "../../src/game/stealth";
import { vehicleDamageStage, VEHICLE_DAMAGE_EFFECT, shouldForceFootTransition, type VehicleDamageStage } from "../../src/game/chase-ai";
import { questEventsFromHud, NEW_QUEST_SIGNALS, type QuestSignals } from "../../src/game/quest-signals";
import { createSim } from "../../src/game/sim";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "city_golden.txt");
const n = (v: number) => String(v);
let seed = 0xc17e;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));

for (let i = 0; i < 2000; i++) {
  const h = pick([0, 5, 11.9, 12, 31.9, 32, 54.99, 55, 79.9, 80, 99, 100, rand() * 100]), c = pick([0, 8, 8.01, 20, rand() * 60]), dt = pick([1 / 60, 0.1, 0.5, 3]);
  out("HM", h, c, dt, stepHeatMeter(h, c, dt));
  const s = heatStatus(h); out("HS", h, `${s.level}|${s.label}|${s.response}`);
}
for (const p of [0, 14.9, 15, 15.1, 35, 35.5, 60, 61, 85, 85.01, 100, ...Array.from({ length: 40 }, () => rand() * 100)]) {
  const st = vehicleDamageStage(p), e = VEHICLE_DAMAGE_EFFECT[st];
  out("VD", p, `${st}|${n(e.speedMult)}|${n(e.handlingMult)}|${e.weaponsDisabled ? 1 : 0}`);
}
for (const st of ["NOMINAL", "LIGHT", "MEDIUM", "HEAVY", "CRITICAL"] as VehicleDamageStage[]) for (const b of [false, true]) out("FF", st, b ? 1 : 0, shouldForceFootTransition(st, b) ? 1 : 0);
for (let i = 0; i < 3000; i++) {
  const sensor = { x: rand() * 100 - 50, z: rand() * 100 - 50, rot: rand() * 8 - 4, range: pick([20, 46.5, 33]) };
  const ang = sensor.rot + pick([0, 0.5, Math.PI / 5 - 1e-9, Math.PI / 5 + 1e-9, 1, 3, -0.62, -0.63]) , r = pick([0, 0.04, 5, 20, 33, 46.5, 47, rand() * 60]);
  const px = rand() < 0.7 ? sensor.x + Math.sin(ang) * r : rand() * 100 - 50, pz = rand() < 0.7 ? sensor.z + Math.cos(ang) * r : rand() * 100 - 50;
  out("VC", sensor.x, sensor.z, sensor.rot, sensor.range, px, pz, inVisionCone(sensor, px, pz) ? 1 : 0);
}
for (let i = 0; i < 2000; i++) {
  const m = pick([0, 29.9, 30, 74.9, 75, 89.9, 90, 100, rand() * 100]), dt = pick([1 / 60, 0.2, 2]), seen = rand() < 0.5, hack = rand() < 0.4;
  out("DM", m, dt, seen ? 1 : 0, hack ? 1 : 0, stepDetectionMeter(m, dt, seen, hack));
  out("DS", m, detectionStateFor(m));
  const l = lockdownStatus(m); out("LS", m, `${l.tier}|${l.label}|${l.response}`);
  const p = pick([0, 10, 50, 99.5, 100, rand() * 100]), det = pick(["GREEN", "YELLOW", "RED"] as DetectionState[]);
  out("HK", p, dt, det, stepHackProgress(p, dt, det));
}
// the turret layout (createSim draws its own random numbers; the cooldowns are not compared)
const sim = createSim();
for (const t of sim.turrets) out("TU", t.x, t.z, t.zone, t.rot, t.range);
for (const s of nexusSensors(sim.turrets)) out("NS", s.x, s.z, s.rot, s.range);
// quest signals over random HUD snapshots
const TIERS: LockdownTier[] = ["MONITORING", "DRONE_TRACKING", "INTERCEPTION", "LOCKDOWN_PURGE"];
for (let c = 0; c < 120; c++) {
  let sig: QuestSignals = { ...NEW_QUEST_SIGNALS };
  out("QC");
  let kills = pick([0, 3, 40]), heat = 1, hack = 0;
  for (let k = 0; k < 40; k++) {
    if (rand() < 0.3) heat = Math.max(1, Math.min(5, heat + pick([-1, 1, 2])));
    if (rand() < 0.4) kills = Math.max(0, kills + pick([0, 1, 2, 30, -50]));
    if (rand() < 0.4) hack = pick([0, 30, 49.9, 50, 80, 100, 100]);
    const hud = { regionId: rand() < 0.08 ? "" : pick(["neon", "nexus", "swamps", "thalassia"]), heatLevel: heat, nexusLockdownTier: pick(TIERS), hackProgress: hack, diving: rand() < 0.2, kills, hp: pick([100, 40, 0]) };
    const dt = pick([0, 0.016, 0.25, 0.5, 0.75, 3, -1, NaN]);
    const r = questEventsFromHud(sig, hud, dt);
    sig = r.next;
    const ev = r.events.map((e) => e.type === "ENTER_WORLD" || e.type === "KILL" ? `${e.type}:${e.world}` : e.type === "HEAT_LEVEL" ? `HEAT_LEVEL:${e.level}` : e.type === "LOCKDOWN_TIER" ? `LOCKDOWN_TIER:${e.tier}` : e.type === "SURVIVED" ? `SURVIVED:${e.world}:${n(e.seconds)}` : e.type).join(",") || "~";
    out("QH", hud.regionId || "~", hud.heatLevel, hud.nexusLockdownTier, hud.hackProgress, hud.diving ? 1 : 0, hud.kills, hud.hp, n(dt), ev);
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`city golden: ${lines.length} lines, ${sim.turrets.length} turrets -> ${OUT}`);
