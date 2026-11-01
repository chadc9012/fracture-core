/**
 * The face editor (owner, Nov 2026: "more faces to choose from and a face editor"): sliders that reshape the authored heads
 * (operators.ts FACES) and preset faces built from them. Each morph is a smooth displacement field in head space — metres on a
 * 1.85 m human, origin at the Head bone, +Z forward, +X the character's left (operator-skin-shader.ts has the landmarks) —
 * applied to the head mesh once at load (operator-head.ts), so the result skins and animates like the original.
 *
 * Values run -1 … 1 (0 is the head as authored). Pure data and maths, no three.js, so saves and tests share it.
 */

export type MorphId = "jaw" | "chin" | "cheeks" | "nose" | "noseWidth" | "brow" | "eyes" | "width" | "forehead" | "lips";
export type FaceMorphs = Partial<Record<MorphId, number>>;
export type MorphDef = { id: MorphId; label: string; low: string; high: string };

export const MORPHS: readonly MorphDef[] = [
  { id: "width", label: "Face width", low: "Narrow", high: "Wide" },
  { id: "jaw", label: "Jaw", low: "Fine", high: "Square" },
  { id: "chin", label: "Chin", low: "Short", high: "Long" },
  { id: "cheeks", label: "Cheekbones", low: "Soft", high: "Sharp" },
  { id: "nose", label: "Nose size", low: "Small", high: "Large" },
  { id: "noseWidth", label: "Nose width", low: "Thin", high: "Broad" },
  { id: "brow", label: "Brow", low: "Smooth", high: "Heavy" },
  { id: "eyes", label: "Eye spacing", low: "Close", high: "Wide" },
  { id: "forehead", label: "Forehead", low: "Low", high: "Tall" },
  { id: "lips", label: "Lips", low: "Thin", high: "Full" },
];
const IDS = new Set<string>(MORPHS.map((m) => m.id));

/** clamps to -1…1 and drops unknown or zero entries (old saves carry none) */
export function morphsOr(raw: unknown): FaceMorphs {
  if (!raw || typeof raw !== "object") return {};
  const out: FaceMorphs = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!IDS.has(k) || typeof v !== "number" || !Number.isFinite(v)) continue;
    const c = Math.max(-1, Math.min(1, Math.round(v * 100) / 100));
    if (c !== 0) out[k as MorphId] = c;
  }
  return out;
}
export const morphsEqual = (a: FaceMorphs, b: FaceMorphs): boolean => MORPHS.every((m) => (a[m.id] ?? 0) === (b[m.id] ?? 0));

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** 1 inside `lo`, falling smoothly to 0 by `hi` */
const fall = (d: number, lo: number, hi: number) => { const t = clamp01((d - lo) / (hi - lo)); return 1 - t * t * (3 - 2 * t); };
/** 0 below `lo`, rising smoothly to 1 by `hi` */
const rise = (d: number, lo: number, hi: number) => 1 - fall(d, lo, hi);
/** weight of a soft box: 1 well inside, feathered by `soft` at every face */
function box(x: number, y: number, z: number, min: [number, number, number], max: [number, number, number], soft: number): number {
  const w = (v: number, a: number, b: number) => rise(v, a - soft, a + soft * 0.2) * fall(v, b - soft * 0.2, b + soft);
  return w(x, min[0], max[0]) * w(y, min[1], max[1]) * w(z, min[2], max[2]);
}
/** weight of a soft ball around `c` */
function ball(x: number, y: number, z: number, c: [number, number, number], r: number): number {
  return fall(Math.hypot(x - c[0], y - c[1], z - c[2]), r * 0.35, r);
}

/** The displacement (metres) a point gets from one morph at value 1; negative values pull the other way. The face is the front
 * of the head (z > 0); the neck and the back stay put. */
export function morphOffset(id: MorphId, x: number, y: number, z: number): [number, number, number] {
  const sx = Math.sign(x) || 1, ax = Math.abs(x);
  switch (id) {
    case "width": {
      // the whole face widens about the centre line, most at the cheeks, fading into the neck and the back of the head
      const w = rise(z, -0.03, 0.02) * rise(y, -0.01, 0.03) * fall(y, 0.11, 0.14) * rise(ax, 0.01, 0.04);
      return [sx * 0.008 * w, 0, 0];
    }
    case "jaw": {
      // the jaw corners move out and square off
      const w = ball(x, y, z, [sx * 0.06, 0.02, 0.025], 0.045);
      return [sx * 0.011 * w, -0.003 * w, 0.002 * w];
    }
    case "chin": {
      const w = ball(x, y, z, [0, 0.0, 0.075], 0.04) * rise(z, 0.03, 0.06);
      return [0, -0.012 * w, 0.004 * w];
    }
    case "cheeks": {
      // cheekbones stand out and up; the hollow below them sinks a little
      const bone = ball(x, y, z, [sx * 0.058, 0.055, 0.045], 0.035);
      const hollow = ball(x, y, z, [sx * 0.05, 0.03, 0.05], 0.03);
      return [sx * (0.008 * bone - 0.003 * hollow), 0.003 * bone, 0.006 * bone - 0.003 * hollow];
    }
    case "nose": {
      // the whole nose grows forward and down from the bridge
      const w = box(x, y, z, [-0.02, 0.03, 0.078], [0.02, 0.085, 0.12], 0.012);
      const tip = ball(x, y, z, [0, 0.042, 0.1], 0.025);
      return [0, -0.004 * tip, 0.008 * w + 0.006 * tip];
    }
    case "noseWidth": {
      const w = box(x, y, z, [-0.025, 0.03, 0.078], [0.025, 0.065, 0.12], 0.01) * rise(ax, 0.004, 0.012);
      return [sx * 0.007 * w, 0, 0];
    }
    case "brow": {
      // the brow ridge comes forward over the eyes
      const w = box(x, y, z, [-0.055, 0.08, 0.065], [0.055, 0.105, 0.11], 0.012);
      return [0, 0, 0.007 * w];
    }
    case "eyes": {
      // each eye socket slides outward
      const w = ball(x, y, z, [sx * 0.03, 0.068, 0.078], 0.028);
      return [sx * 0.006 * w, 0, 0];
    }
    case "forehead": {
      // the forehead rises and the hairline with it
      const w = box(x, y, z, [-0.08, 0.098, 0.02], [0.08, 0.2, 0.12], 0.015) * rise(y, 0.095, 0.115);
      return [0, 0.01 * w, 0.002 * w];
    }
    case "lips": {
      const w = ball(x, y, z, [0, 0.022, 0.088], 0.022) * rise(z, 0.06, 0.08);
      return [0, 0, 0.006 * w];
    }
  }
}

/** the fields above are modest on their own; this is how far a slider at ±1 actually pushes (checked by eye on the heads) */
const GAIN = 1.4;
/** The total displacement at a point for a set of morph values. */
export function morphDisplacement(morphs: FaceMorphs, x: number, y: number, z: number): [number, number, number] {
  let dx = 0, dy = 0, dz = 0;
  for (const m of MORPHS) {
    const v = morphs[m.id] ?? 0;
    if (!v) continue;
    const [ox, oy, oz] = morphOffset(m.id, x, y, z);
    dx += ox * v * GAIN; dy += oy * v * GAIN; dz += oz * v * GAIN;
  }
  return [dx, dy, dz];
}

/** Applies morphs in place to a flat xyz array already in head space. */
export function morphPositions(xyz: Float32Array, morphs: FaceMorphs): void {
  if (MORPHS.every((m) => !(morphs[m.id] ?? 0))) return;
  for (let i = 0; i < xyz.length; i += 3) {
    const [dx, dy, dz] = morphDisplacement(morphs, xyz[i]!, xyz[i + 1]!, xyz[i + 2]!);
    xyz[i] = xyz[i]! + dx; xyz[i + 1] = xyz[i + 1]! + dy; xyz[i + 2] = xyz[i + 2]! + dz;
  }
}

/** A sculpt of all zeros: the head as cut (the forge's "reset"). */
export const NO_SCULPT: FaceMorphs = {};
