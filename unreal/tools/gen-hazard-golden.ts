/**
 * Records golden region hazards and hazard zones from the web build's real region-hazards.ts, hazard-zones.ts and landmarks.ts
 * for the C++ port's test (Plugins/WorldFractureCore/Tests/HazardCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs hazard
 *
 *   RG id x z radius            the regions (world.ts REGIONS)
 *   ZN zones    LM id -> x|z (landmarks.ts)    RH region -> id|name|hint
 *   HA region t dt sheltered exposure -> effect                     (each from the recorded exposure before it)
 *   ZA x z t sheltered -> zone effect      CB (the two above) -> combined      RI x z -> regionIdAt
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { REGIONS } from "../../src/game/world";
import { REGION_HAZARD, hazardAt, regionIdAt, type HazardEffect } from "../../src/game/region-hazards";
import { HAZARD_ZONES, combineHazard, zoneAt, zoneCenter, type ZoneEffect } from "../../src/game/hazard-zones";
import { landmarkById } from "../../src/game/landmarks";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "hazard_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0x4a2d;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const he = (e: HazardEffect) => [e.id, e.name, n(e.gravityMul), n(e.speedMul), n(e.damagePerSec), n(e.exposure), n(e.intensity), e.warning ?? "~"].join("|");
const ze = (e: ZoneEffect) => [e.zoneId ?? "~", e.name, n(e.speedMul), n(e.gravityMul), n(e.damagePerSec), n(e.pullX), n(e.pullZ), n(e.intensity), e.warning ?? "~"].join("|");

for (const r of REGIONS) out("RG", r.id, r.x, r.z, r.radius);
out("ZN", HAZARD_ZONES.map((z) => [z.id, z.kind, z.name, z.landmarkId, n(z.radius), z.hint].join("^")).join(";"));
for (const z of HAZARD_ZONES) { const l = landmarkById(z.landmarkId)!; out("LM", z.landmarkId, `${n(l.x)}|${n(l.z)}`); }
for (const id of [...Object.keys(REGION_HAZARD), "neon", ""]) { const d = id ? REGION_HAZARD[id] : undefined; const e = hazardAt({ regionId: id || null, t: 0, dt: 0, sheltered: false, exposure: 0 }); out("RH", id || "~", `${e.id}|${e.name}|${(d ?? REGION_HAZARD.nexus!).hint}`); }

// region hazards over time: each region, walking in and out of shelter, the exposure carried
const IDS = [...Object.keys(REGION_HAZARD), "neon", ""];
for (const id of IDS) {
  let exposure = 0, t = rand() * 100;
  for (let k = 0; k < 600; k++) {
    const dt = pick([1 / 60, 1 / 30, 0.1, 0.5, 0]);
    t += dt * pick([1, 1, 7]);
    if (rand() < 0.01) t = Math.floor(t / 30) * 30 + pick([22, 21.999, 26, 25.999, 29.999, 0]);
    const sheltered = rand() < 0.25;
    const e = hazardAt({ regionId: id || null, t, dt, sheltered, exposure });
    out("HA", id || "~", t, dt, b(sheltered), exposure, he(e));
    exposure = e.exposure;
  }
}

// zones: points around every zone (rim, centre, outside), at times through the avalanche and tear cycles
for (let k = 0; k < 12000; k++) {
  const z = pick(HAZARD_ZONES), t = pick([rand() * 400, Math.floor(rand() * 20) * 26 + pick([18.999, 19, 22.999, 23, 25.999]), rand() * 9]);
  const c = zoneCenter(z, t), a = rand() * Math.PI * 2, d = pick([0, 0.3, z.radius * 0.5, z.radius - 0.001, z.radius, z.radius + 0.001, z.radius * 1.5, rand() * z.radius]);
  const x = c.x + Math.cos(a) * d, zz = c.z + Math.sin(a) * d, sheltered = rand() < 0.3;
  const zone = zoneAt(x, zz, t, sheltered);
  out("ZA", x, zz, t, b(sheltered), ze(zone));
  const region = hazardAt({ regionId: pick(IDS) || null, t, dt: 0.016, sheltered, exposure: pick([0, 0.7, 1]) });
  out("CB", he(region), ze(zone), he(combineHazard(region, zone)));
}
for (let k = 0; k < 4000; k++) {
  const r = pick(REGIONS), a = rand() * Math.PI * 2, d = rand() * r.radius * 1.4;
  const x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
  out("RI", x, z, regionIdAt(x, z, REGIONS) ?? "~");
}
// the exact edges: exposure at the harm line, points on a region's rim
for (const e of [0.6, 0.6000000000000001, 0.5999999999999999, 1]) for (const sh of [false, true]) out("HA", "frostspire", 3, 0, b(sh), e, he(hazardAt({ regionId: "frostspire", t: 3, dt: 0, sheltered: sh, exposure: e })));
for (const r of REGIONS) for (const [dx, dz] of [[r.radius, 0], [0, -r.radius], [r.radius - 1e-9, 0]]) out("RI", r.x + dx!, r.z + dz!, regionIdAt(r.x + dx!, r.z + dz!, REGIONS) ?? "~");
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`hazard golden: ${lines.length} lines -> ${OUT}`);
