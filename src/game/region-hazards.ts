/** Per-region environmental hazards. Pure + deterministic (sampled from a clock) so every client agrees
 * and the rules stay testable. Scene applies the result to gravity, movement and hull each frame. */

export type HazardId = "none" | "overgrowth" | "exposure" | "gravity-shift" | "dust-storm" | "solar-flare" | "toxic-mire";

export interface HazardDef { id: HazardId; name: string; hint: string }

export const REGION_HAZARD: Record<string, HazardDef> = {
  nexus: { id: "none", name: "Safe zone", hint: "No hazards" },
  veridan: { id: "overgrowth", name: "Overgrowth", hint: "Dense growth slows you on foot" },
  frostspire: { id: "exposure", name: "Exposure", hint: "Cold builds outside — shelter in vehicles or interiors" },
  ember: { id: "gravity-shift", name: "Shifting gravity", hint: "Gravity swings between light and crushing" },
  wastelands: { id: "dust-storm", name: "Dust storms", hint: "Storm pulses scour the hull — vehicles shield you" },
  solara: { id: "solar-flare", name: "Solar flares", hint: "Flares burn exposed hulls — take shelter when warned" },
  swamps: { id: "toxic-mire", name: "Toxic mire + gravity drift", hint: "Bog drags and corrodes; gravity drifts" },
};

export interface HazardInput {
  regionId: string | null;
  t: number; // seconds, shared clock
  dt: number;
  sheltered: boolean; // in vehicle or interior
  exposure: number; // carried cold level 0..1
}

export interface HazardEffect {
  id: HazardId;
  name: string;
  gravityMul: number;
  speedMul: number;
  damagePerSec: number;
  exposure: number;
  /** 0..1 how strongly the hazard is acting now (HUD meter) */
  intensity: number;
  warning: string | null;
}

export const FLARE_PERIOD = 30;
export const FLARE_WARN = 4;
export const FLARE_BURN = 4;
export const EXPOSURE_FILL_S = 40;
export const EXPOSURE_HARM = 0.6;

export function hazardAt(i: HazardInput): HazardEffect {
  const def = (i.regionId && REGION_HAZARD[i.regionId]) || REGION_HAZARD["nexus"]!;
  const out: HazardEffect = { id: def.id, name: def.name, gravityMul: 1, speedMul: 1, damagePerSec: 0, exposure: Math.max(0, i.exposure - i.dt / 10), intensity: 0, warning: null };
  switch (def.id) {
    case "overgrowth":
      if (!i.sheltered) { out.speedMul = 0.9; out.intensity = 0.2; }
      break;
    case "exposure": {
      const e = i.sheltered ? Math.max(0, i.exposure - i.dt / 8) : Math.min(1, i.exposure + i.dt / EXPOSURE_FILL_S);
      out.exposure = e;
      out.intensity = e;
      if (e > EXPOSURE_HARM) { out.damagePerSec = 4 * (e - EXPOSURE_HARM) / (1 - EXPOSURE_HARM); out.speedMul = 0.85; out.warning = "Exposure critical — find shelter"; }
      break;
    }
    case "gravity-shift": {
      const g = Math.sin((i.t / 12) * Math.PI * 2);
      out.gravityMul = 1 + g * (g > 0 ? 0.6 : 0.65); // 0.35 .. 1.6
      out.intensity = Math.abs(g);
      if (g > 0.85) out.warning = "Gravity surge"; else if (g < -0.85) out.warning = "Low gravity";
      break;
    }
    case "dust-storm": {
      const pulse = Math.max(0, Math.sin((i.t / 20) * Math.PI * 2));
      out.intensity = pulse;
      if (pulse > 0.5 && !i.sheltered) { out.damagePerSec = 1.5 * pulse; out.speedMul = 0.9; out.warning = "Dust storm — hull scouring"; }
      break;
    }
    case "solar-flare": {
      const ph = i.t % FLARE_PERIOD;
      const start = FLARE_PERIOD - FLARE_WARN - FLARE_BURN;
      if (ph >= start && ph < start + FLARE_WARN) { out.intensity = 0.5; out.warning = "Solar flare incoming — take shelter"; }
      else if (ph >= start + FLARE_WARN) { out.intensity = 1; if (!i.sheltered) { out.damagePerSec = 6; out.warning = "Solar flare — hull burning"; } }
      break;
    }
    case "toxic-mire": {
      const g = Math.sin((i.t / 18) * Math.PI * 2 + 1.3);
      out.gravityMul = 1 + g * 0.35;
      if (!i.sheltered) { out.speedMul = 0.8; out.damagePerSec = 0.5; }
      out.intensity = 0.4 + Math.abs(g) * 0.4;
      break;
    }
  }
  return out;
}

/** Region containing a world point (closest centre within radius). */
export function regionIdAt(x: number, z: number, regions: { id: string; x: number; z: number; radius: number }[]): string | null {
  let best: string | null = null; let bd = Infinity;
  for (const r of regions) { const d = Math.hypot(x - r.x, z - r.z); if (d < r.radius && d < bd) { bd = d; best = r.id; } }
  return best;
}
