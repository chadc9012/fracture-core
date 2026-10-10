/** Localized hazard zones: the dangerous places that sit on top of the region-wide hazards in region-hazards.ts.
 * Pure + deterministic (position + shared clock), so every client agrees, the map can draw them, and Scene only
 * applies the result. Each zone is telegraphed (warning text, visible on the atlas) and never kills outright:
 * Scene routes damage through the same hazard path as the regional hazards (hurtPlayer floors at 1 hp). */
import { LANDMARKS, landmarkById } from "./landmarks";
import { WORLD_SCALE } from "./world";

/** zones are places you walk into: they grow with the map (half the scale factor) so they stay found-and-felt on a bigger world */
const ZS = Math.max(1, WORLD_SCALE / 2);
import type { HazardEffect } from "./region-hazards";

export type ZoneKind = "quicksand" | "avalanche" | "spatial-sink" | "lava-trench" | "crevasse" | "fracture-tear";

export interface HazardZone {
  id: string;
  kind: ZoneKind;
  name: string;
  landmarkId: string;
  /** zone radius in world units */
  radius: number;
  hint: string;
}

export const HAZARD_ZONES: HazardZone[] = [
  { id: "z-quicksand", kind: "quicksand", name: "Moving Quicksand", landmarkId: "quicksand-basin", radius: 16 * ZS, hint: "Sinks and slows you on foot — vehicles cross it" },
  { id: "z-avalanche", kind: "avalanche", name: "Avalanche Danger Zone", landmarkId: "avalanche-run", radius: 20 * ZS, hint: "Slides on a cycle; the rumble gives a few seconds to run" },
  { id: "z-sink", kind: "spatial-sink", name: "Spatial Sink", landmarkId: "spatial-sink", radius: 14 * ZS, hint: "Distance folds: gravity drops and you are drawn to the centre" },
  { id: "z-trench", kind: "lava-trench", name: "Smoldering Trench", landmarkId: "smoldering-trench", radius: 15 * ZS, hint: "Heat burns anything on foot; keep moving" },
  { id: "z-crevasse", kind: "crevasse", name: "Glacial Crevasse Network", landmarkId: "glacial-crevasse", radius: 17 * ZS, hint: "Ice fields chill and slow you" },
  { id: "z-tear", kind: "fracture-tear", name: "Fracture Tear", landmarkId: "fracture-grottos", radius: 14 * ZS, hint: "Gravity surges when the tear pulses" },
];

export const AVALANCHE_PERIOD = 26;
export const AVALANCHE_WARN = 4;
export const AVALANCHE_SLIDE = 3;
export const SINK_PULL = 3.2;
export const QUICKSAND_DRIFT_RADIUS = 7 * ZS;

/** Effective centre: only quicksand drifts (slowly, on a fixed orbit of the clock). */
export function zoneCenter(zone: HazardZone, t: number): { x: number; z: number } {
  const lm = landmarkById(zone.landmarkId)!;
  if (zone.kind !== "quicksand") return { x: lm.x, z: lm.z };
  const a = (t / 90) * Math.PI * 2;
  return { x: lm.x + Math.cos(a) * QUICKSAND_DRIFT_RADIUS, z: lm.z + Math.sin(a) * QUICKSAND_DRIFT_RADIUS };
}

export interface ZoneEffect {
  zoneId: string | null;
  name: string;
  speedMul: number;
  gravityMul: number;
  damagePerSec: number;
  /** world-space drift velocity applied by Scene on foot (spatial sink) */
  pullX: number;
  pullZ: number;
  /** 0..1 */
  intensity: number;
  warning: string | null;
}

export const NO_ZONE: ZoneEffect = { zoneId: null, name: "", speedMul: 1, gravityMul: 1, damagePerSec: 0, pullX: 0, pullZ: 0, intensity: 0, warning: null };

export function zoneAt(x: number, z: number, t: number, sheltered: boolean): ZoneEffect {
  for (const zone of HAZARD_ZONES) {
    const c = zoneCenter(zone, t);
    const d = Math.hypot(x - c.x, z - c.z);
    if (d > zone.radius) continue;
    const depth = 1 - d / zone.radius; // 0 at the rim, 1 at the centre
    const out: ZoneEffect = { ...NO_ZONE, zoneId: zone.id, name: zone.name, intensity: 0.3 + depth * 0.7 };
    switch (zone.kind) {
      case "quicksand":
        if (!sheltered) { out.speedMul = 0.45 + 0.35 * (1 - depth); out.warning = "Quicksand — keep moving"; }
        break;
      case "avalanche": {
        const ph = t % AVALANCHE_PERIOD;
        const start = AVALANCHE_PERIOD - AVALANCHE_WARN - AVALANCHE_SLIDE;
        if (ph >= start && ph < start + AVALANCHE_WARN) { out.warning = "Avalanche rumble — leave the slope"; out.intensity = 0.6; }
        else if (ph >= start + AVALANCHE_WARN) { out.intensity = 1; out.speedMul = 0.7; if (!sheltered) { out.damagePerSec = 9; out.warning = "Avalanche — buried"; } }
        else out.intensity = 0.15;
        break;
      }
      case "spatial-sink": {
        out.gravityMul = 0.55;
        if (!sheltered && d > 0.5) { out.pullX = ((c.x - x) / d) * SINK_PULL * depth; out.pullZ = ((c.z - z) / d) * SINK_PULL * depth; }
        out.warning = "Spatial sink — gravity unstable";
        break;
      }
      case "lava-trench":
        if (!sheltered) { out.damagePerSec = 2 + 3 * depth; out.speedMul = 0.9; out.warning = "Trench heat — keep moving"; }
        break;
      case "crevasse":
        if (!sheltered) { out.speedMul = 0.8; out.damagePerSec = 0.6; out.warning = "Crevasse chill"; }
        break;
      case "fracture-tear": {
        const g = Math.sin((t / 9) * Math.PI * 2);
        out.gravityMul = 1 + g * 0.5;
        out.warning = g > 0.8 ? "Tear pulse — gravity surge" : null;
        break;
      }
    }
    return out;
  }
  return NO_ZONE;
}

/** Folds a localized zone onto the region hazard so Scene keeps one effect: speed/gravity multiply, damage adds, the louder warning wins. */
export function combineHazard(region: HazardEffect, zone: ZoneEffect): HazardEffect {
  if (!zone.zoneId) return region;
  return {
    ...region,
    name: region.id === "none" ? zone.name : `${region.name} · ${zone.name}`,
    gravityMul: region.gravityMul * zone.gravityMul,
    speedMul: region.speedMul * zone.speedMul,
    damagePerSec: region.damagePerSec + zone.damagePerSec,
    intensity: Math.max(region.intensity, zone.intensity),
    warning: zone.damagePerSec > 0 || !region.warning ? zone.warning ?? region.warning : region.warning,
  };
}

export const zoneLandmarks = () => HAZARD_ZONES.map((z) => ({ zone: z, landmark: LANDMARKS.find((l) => l.id === z.landmarkId)! }));
