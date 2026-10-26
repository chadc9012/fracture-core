/**
 * Records the golden world clock, weather, seasons and environmental hazards from the web build's real world.ts, weather-cycle.ts
 * and environment.ts (and Scene.tsx's nightFactor) for the C++ port's test (Plugins/WorldFractureCore/Tests/EnvironmentCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs environment
 *
 *   CL t -> hour sun phase clock night     WX region t -> weather     EA region t night -> environment
 *   H region  (a fresh hazard state)   then  HS dt t sheltered px pz draws -> state | damage cause warning detonated
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { hourOf, sunElevation, phaseFor, clockLabel } from "../../src/game/world";
import { sampleWeather, weatherName, type WeatherSample } from "../../src/game/weather-cycle";
import { environmentAt, createEnvState, stepEnvironment, type EnvState } from "../../src/game/environment";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "environment_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0x3e71;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
// Scene.tsx nightFactor (not exported there; copied verbatim)
function nightFactor(t: number) { const theta = (((t % 1) + 1) % 1) * Math.PI * 2 - Math.PI / 2; return Math.min(1, Math.max(0, -Math.sin(theta) * 1.2 + 0.15)); }
const wx = (w: WeatherSample) => [w.state, n(w.precipitation), n(w.cloud), n(w.visibility), n(w.windX), n(w.windZ), w.label].join("|");
const REGIONS = ["veridan", "ember", "frostspire", "swamps", "wastelands", "solara", "nexus", "neon", "", "thalassia"];

for (let i = 0; i < 3000; i++) {
  const t = i < 1000 ? i / 1000 : rand() * 40 - 2;
  out("CL", t, hourOf(t), sunElevation(t), phaseFor(t), clockLabel(t), nightFactor(t));
}
for (let i = 0; i < 6000; i++) {
  const r = pick(REGIONS), t = rand() < 0.3 ? Math.floor(rand() * 100) * 0.35 + pick([0, 0.2625, 0.3, 0.34999]) : rand() * 60;
  const w = sampleWeather(r || undefined, t);
  out("WX", r || "~", t, wx(w), weatherName(w, r || undefined));
}
for (let i = 0; i < 6000; i++) {
  const r = pick(REGIONS), t = rand() < 0.2 ? -rand() : rand() * 80, night = pick([0, 0.3, 1, rand()]);
  const e = environmentAt(r || undefined, t, night);
  out("EA", r || "~", t, night, [e.season, n(e.seasonProgress), wx(e.weather), n(e.thermal), n(e.tempC), b(e.shielded), e.summary].join("|"));
}
const st = (s: EnvState) => [n(s.heat), n(s.cold), n(s.toxic), s.strikes.map((k) => `${k.id}:${n(k.x)}:${n(k.z)}:${n(k.radius)}:${n(k.warn)}`).join(";") || "~", s.flashes.map((f) => `${n(f.x)}:${n(f.z)}:${n(f.t)}`).join(";") || "~", n(s.nextStrike), n(s.nextId)].join("|");
for (let k = 0; k < 120; k++) {
  // every fifth track is an Ember Peaks summer on a slow clock, so heat exposure builds all the way
  const summer = k % 5 === 0;
  const r = summer ? "ember" : pick(["swamps", "frostspire", "ember", "wastelands", "solara", "nexus", "veridan"]);
  const s = createEnvState();
  out("H", r);
  let t = summer ? 6.4 + rand() * 0.2 : rand() * 40;
  for (let i = 0; i < 400; i++) {
    const dt = pick([1 / 30, 0.25, 1, 3]);
    t += dt * (summer ? 0.002 : pick([0.008, 0.06, 0.5]));
    const sheltered = rand() < 0.1;
    const px = Math.round(rand() * 200 - 100), pz = Math.round(rand() * 200 - 100);
    const env = environmentAt(r, t, nightFactor(t));
    const draws: number[] = [];
    const o = stepEnvironment(s, { dt, regionId: r, env, sheltered, px, pz, rand: () => { const v = rand(); draws.push(v); return v; } });
    out("HS", dt, t, b(sheltered), px, pz, draws.map(n).join(",") || "~", st(s), n(o.damage), o.cause || "~", o.warning || "~", o.detonated.map((d) => n(d.id)).join(",") || "~");
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`environment golden: ${lines.length} lines -> ${OUT}`);
