export type ZoneKind = "safe" | "war" | "fracture" | "core" | "starter";

export type Region = {
  id: string;
  name: string;
  sub: string;
  kind: ZoneKind;
  /** center on the XZ plane */
  x: number;
  z: number;
  radius: number;
  difficulty: number;
  /** ground tint */
  ground: string;
  accent: string;
  /** player speed multiplier */
  speed: number;
  rules: string[];
};

export const ZONE_COLOR: Record<ZoneKind, string> = {
  safe: "#3ddc97",
  starter: "#7ed957",
  war: "#ff4d4d",
  fracture: "#ff9f1c",
  core: "#c86bff",
};

export const ZONE_LABEL: Record<ZoneKind, string> = {
  safe: "Safe Zone",
  starter: "Starter Zone",
  war: "War Zone",
  fracture: "Fracture Zone",
  core: "Core Zone",
};

/* ---------- world scale ----------
 * Every region below is authored at BASE size (the original ~380 m world). WORLD_SCALE stretches the map: wild regions
 * move apart and grow by WORLD_SCALE, the Nexus city keeps its authored footprint (a bigger plateau around it, not
 * bigger buildings). ?worldScale=1 restores the original layout for A/B performance checks. Set once at module load. */
export const DEFAULT_WORLD_SCALE = 6;
function readWorldScale(): number {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.["WORLD_SCALE"]; // tests / tooling
    if (env !== undefined && Number.isFinite(Number(env))) return Math.min(6, Math.max(1, Number(env)));
    const q = typeof location !== "undefined" ? new URLSearchParams(location.search).get("worldScale") : null;
    const v = q == null ? NaN : Number(q);
    if (Number.isFinite(v)) return Math.min(6, Math.max(1, v));
  } catch { /* SSR / blocked */ }
  return DEFAULT_WORLD_SCALE;
}
export const WORLD_SCALE = readWorldScale();
/** vertical stretch of the landform: heights grow less than widths so a big map has mountains, not walls (1 at scale 1) */
export const HEIGHT_K = WORLD_SCALE === 1 ? 1 : 1 + (WORLD_SCALE - 1) * 0.35;

const BASE_REGIONS: Region[] = [
  {
    id: "nexus",
    name: "Nexus City",
    sub: "Safe Zone / Hub",
    kind: "safe",
    x: 8,
    z: -38,
    radius: 26,
    difficulty: 0,
    ground: "#2b3a4a",
    accent: "#66e0ff",
    speed: 1.1,
    rules: ["No PvP — stability field active", "Trade, upgrades, contracts", "Fast travel gate"],
  },
  {
    id: "veridan",
    name: "Verdant Forest",
    sub: "Safe Zone / Resources",
    kind: "starter",
    x: 72,
    z: -10,
    radius: 34,
    difficulty: 1,
    ground: "#2f6b3a",
    accent: "#8fe08a",
    speed: 0.82,
    rules: ["Trees give cover and resources", "Low combat — learn the basics", "Movement slowed by undergrowth"],
  },
  {
    id: "frostspire",
    name: "Frostspire Mountains",
    sub: "High Risk / Rare Resources",
    kind: "core",
    x: 4,
    z: -104,
    radius: 40,
    difficulty: 5,
    ground: "#8fa8c8",
    accent: "#e8f4ff",
    speed: 0.7,
    rules: ["Vertical traversal challenge", "Snow slows movement", "Endgame raids near The Overseer"],
  },
  {
    id: "ember",
    name: "Ember Peaks",
    sub: "Fracture Zone / High Risk",
    kind: "fracture",
    x: -78,
    z: -56,
    radius: 30,
    difficulty: 5,
    ground: "#3a2320",
    accent: "#ff6a1f",
    speed: 0.9,
    rules: ["Lava damage zones", "Eruption events reshape terrain", "Ash falls — reduced visibility"],
  },
  {
    id: "wastelands",
    name: "The Wastelands",
    sub: "War Zone / PvP",
    kind: "war",
    x: -50,
    z: 30,
    radius: 42,
    difficulty: 3,
    ground: "#c9a25f",
    accent: "#ffd27a",
    speed: 1,
    rules: ["Faction wars and convoy raids", "Ownership shifts over time", "Open ground — high exposure"],
  },
  {
    id: "solara",
    name: "Solara Desert",
    sub: "Resources / Missions",
    kind: "war",
    x: 30,
    z: 80,
    radius: 44,
    difficulty: 2,
    ground: "#dcb26a",
    accent: "#ffe8a8",
    speed: 1.25,
    rules: ["Fast travel on foot and wheels", "Heat drains stamina", "Dust storms cut visibility"],
  },
  {
    id: "swamps",
    name: "The Shrouded Swamps",
    sub: "Fracture Zone / High Risk",
    kind: "fracture",
    x: 102,
    z: 52,
    radius: 30,
    difficulty: 4,
    ground: "#25412f",
    accent: "#63d6a8",
    speed: 0.62,
    rules: ["Stealth gameplay — fog cover", "Ambush AI in the reeds", "Vehicles bog down"],
  },
];

/** original-size regions (terrain shaping noise runs in this space and is stretched by WORLD_SCALE) */
export const BASE_WORLD_REGIONS: readonly Region[] = BASE_REGIONS;
export const BASE_WORLD_RADIUS = 190;
export const WORLD_RADIUS = BASE_WORLD_RADIUS * WORLD_SCALE;

/** Regions at world size: centres and wild radii x WORLD_SCALE; Nexus keeps its authored radius. */
export const REGIONS: Region[] = BASE_REGIONS.map((r) => ({ ...r, x: r.x * WORLD_SCALE, z: r.z * WORLD_SCALE, radius: r.id === "nexus" ? r.radius : r.radius * WORLD_SCALE }));

/** Maps a coordinate authored at base size to the same place in the scaled world. Points inside a base region keep
 * their offset from its centre multiplied by WORLD_SCALE (the Nexus city keeps a 1:1 offset); anything else (ocean sites)
 * scales from the origin. With WORLD_SCALE = 1 this is the identity. */
/** Region centres as sites were first authored (base units), before the October 2026 re-layout to the owner's map boards.
 * Authored coordinates are still written against these; scaleSite moves each point with its region. */
export const AUTHORED_CENTRES: Record<string, { x: number; z: number }> = {
  nexus: { x: 78, z: 6 }, veridan: { x: -58, z: -34 }, frostspire: { x: 18, z: -96 }, ember: { x: -52, z: 16 }, wastelands: { x: 12, z: -6 }, solara: { x: -18, z: 76 }, swamps: { x: 62, z: 82 },
};
/** Base coordinates in the new layout -> where the same ground was authored. Inside a region (and out to 1.6x its radius)
 * the point moves with its region, so every landform, noise field and authored site keeps exactly the ground it was tuned
 * on; between regions the shift blends, stretching the land that joins them. Pure. */
const SHIFTS = BASE_REGIONS.map((r) => { const a = AUTHORED_CENTRES[r.id] ?? r; return { x: r.x, z: r.z, reach: r.radius, dx: r.x - a.x, dz: r.z - a.z }; });
export function legacyBase(x: number, z: number): { x: number; z: number } {
  // each region pulls with weight f/(1-f) (f = 1 inside it, easing to 0 at 1.6x its radius), against a unit "stay put" weight
  // for open ground: exact inside a region, and continuous everywhere else (no seam where two blend zones meet)
  let wx = 0, wz = 0, ws = 0;
  for (let i = 0; i < SHIFTS.length; i++) {
    const s = SHIFTS[i]!; const d = Math.hypot(x - s.x, z - s.z) / s.reach;
    if (d <= 1) return { x: x - s.dx, z: z - s.dz };
    if (d >= 1.6) continue;
    const t = (d - 1) / 0.6, f = 1 - t * t * (3 - 2 * t), w = f / (1 - f);
    wx += w * s.dx; wz += w * s.dz; ws += w;
  }
  return { x: x - wx / (1 + ws), z: z - wz / (1 + ws) };
}
/** The rigid moves that apply at base point (x, z), with weights summing to 1: inside a region just its own move; between
 * regions a cross-fade of each nearby region's move and "stay put". Terrain samples its authored landform once per move
 * and blends the heights, so land between two moved regions is faded, never squeezed (legacyBase compresses it). Pure. */
export function legacyShifts(x: number, z: number): { dx: number; dz: number; w: number }[] {
  const out: { dx: number; dz: number; w: number }[] = [];
  let ws = 1;
  for (let i = 0; i < SHIFTS.length; i++) {
    const s = SHIFTS[i]!; const d = Math.hypot(x - s.x, z - s.z) / s.reach;
    if (d <= 1) return [{ dx: s.dx, dz: s.dz, w: 1 }];
    if (d >= 1.6) continue;
    const t = (d - 1) / 0.6, f = 1 - t * t * (3 - 2 * t), w = f / (1 - f);
    out.push({ dx: s.dx, dz: s.dz, w }); ws += w;
  }
  out.push({ dx: 0, dz: 0, w: 1 });
  for (const o of out) o.w /= ws;
  return out;
}
/** the same, in world metres */
export function legacyWorld(x: number, z: number): { x: number; z: number } {
  if (WORLD_SCALE === 1) return legacyBase(x, z);
  const b = legacyBase(x / WORLD_SCALE, z / WORLD_SCALE);
  return { x: b.x * WORLD_SCALE, z: b.z * WORLD_SCALE };
}

/** Inverse of legacyWorld: where authored ground now lies (fixed-point iteration on the smooth shift field). */
export function fromLegacyWorld(x: number, z: number): { x: number; z: number } {
  let px = x, pz = z;
  for (let i = 0; i < 8; i++) { const l = legacyWorld(px, pz); px = x + (px - l.x); pz = z + (pz - l.z); }
  return { x: px, z: pz };
}

/** A world position authored (in metres) around a region before the re-layout, carried along with that region. */
export function movedWithRegion<T extends { x: number; z: number }>(regionId: string, p: T): T {
  const r = BASE_REGIONS.find((q) => q.id === regionId), a = AUTHORED_CENTRES[regionId];
  if (!r || !a) return p;
  return { ...p, x: p.x + (r.x - a.x) * WORLD_SCALE, z: p.z + (r.z - a.z) * WORLD_SCALE };
}

export function scaleSite(x: number, z: number, offsetScale: number = WORLD_SCALE): { x: number; z: number } {
  let best = -1; let bestScore = Infinity;
  BASE_REGIONS.forEach((r, i) => { const a = AUTHORED_CENTRES[r.id] ?? r; const sc = Math.hypot(x - a.x, z - a.z) / r.radius; if (sc < 1.15 && sc < bestScore) { bestScore = sc; best = i; } });
  if (best < 0) return { x: x * WORLD_SCALE, z: z * WORLD_SCALE };
  if (WORLD_SCALE === 1) { const b0 = BASE_REGIONS[best]!, a0 = AUTHORED_CENTRES[b0.id] ?? b0; return { x: b0.x + (x - a0.x), z: b0.z + (z - a0.z) }; }
  const b = BASE_REGIONS[best]!, r = REGIONS[best]!, a = AUTHORED_CENTRES[b.id] ?? b;
  const k = b.id === "nexus" ? 1 : offsetScale;
  return { x: r.x + (x - a.x) * k, z: r.z + (z - a.z) * k };
}

/** Distance authored at base size -> world size (use for travel distances, not object sizes). */
export const scaleDist = (d: number) => d * WORLD_SCALE;

export function regionAt(x: number, z: number): Region | null {
  let best: Region | null = null;
  let bestScore = Infinity;
  for (const r of REGIONS) {
    const d = Math.hypot(x - r.x, z - r.z);
    if (d < r.radius && d / r.radius < bestScore) {
      bestScore = d / r.radius;
      best = r;
    }
  }
  return best;
}

/* ---------- day / night cycle ---------- */

export type Phase = "Dawn" | "Day" | "Sunset" | "Night" | "Moonlight";

/** The day cycle's `time` ref (a 0-1 fraction, ~0.008/frame) expressed as a 0-24 hour — the one place this conversion lives; phaseFor, clockLabel and the interior system's shop hours all read it from here. */
export function hourOf(t: number): number {
  return (((t % 1) + 1) % 1) * 24;
}

/** The sun (Scene.tsx) rises at t 0.25 (06:00), peaks at 0.5 (12:00) and sets at 0.75 (18:00): `sunElevation`. The sky palette
 * and the phase used to be a quarter day off (noon painted as sunset, a 35°-high sun under a night sky, dawn at midnight); both
 * now follow the same clock. */
export function sunElevation(t: number): number {
  return Math.sin((((t % 1) + 1) % 1) * Math.PI * 2 - Math.PI / 2);
}
export function phaseFor(t: number): Phase {
  const h = hourOf(t) / 24;
  if (h < 0.22) return "Moonlight";
  if (h < 0.3) return "Dawn";
  if (h < 0.7) return "Day";
  if (h < 0.79) return "Sunset";
  if (h < 0.92) return "Night";
  return "Moonlight";
}
/** sky palette keyframes along the same clock (Scene blends between neighbours) */
export const SKY_STOPS: readonly { t: number; key: Phase }[] = [
  { t: 0, key: "Moonlight" },
  { t: 0.2, key: "Moonlight" },
  { t: 0.26, key: "Dawn" },
  { t: 0.34, key: "Day" },
  { t: 0.68, key: "Day" },
  { t: 0.75, key: "Sunset" },
  { t: 0.82, key: "Night" },
  { t: 0.93, key: "Moonlight" },
  { t: 1, key: "Moonlight" },
];

export const SKY: Record<Phase, { top: string; bottom: string; fog: string; light: string; intensity: number }> = {
  Dawn: { top: "#2f4d7a", bottom: "#f2a25c", fog: "#9fb6cf", light: "#ffcf9b", intensity: 1.1 },
  Day: { top: "#4aa3d8", bottom: "#bfe4f2", fog: "#c6e2ee", light: "#fff6e2", intensity: 1.6 },
  Sunset: { top: "#3b2a5c", bottom: "#ff7a3c", fog: "#c98a6a", light: "#ff9a52", intensity: 1.2 },
  // nights are deep blue and readable (reference "night - Frostspire"), not black: bluer air and a brighter moon key
  Night: { top: "#081430", bottom: "#17305a", fog: "#132a52", light: "#9cc0ff", intensity: 0.5 },
  Moonlight: { top: "#0a1838", bottom: "#1d3c6a", fog: "#1a3664", light: "#b9d4ff", intensity: 0.75 },
};

export function clockLabel(t: number) {
  const h = hourOf(t);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Neon City sits beside the Nexus hub, along this bearing from it */
const NEON_DIR = { x: -82 / Math.hypot(82, 38), z: 38 / Math.hypot(82, 38) };
/** the authored spacing (half the wild-region scale), and the room the city plateau needs past it */
const NEON_BASE_DIST = Math.hypot(82, 38) * Math.max(1, WORLD_SCALE / 2);
const NEON_CLEAR = 50 + 25 + 20; // plateau fade + the hub's building ring + a gap
/** Largest city plateau (flat radius, 40..160 m) that fits between the hub and the world's edge, and how far out the city sits
 * for it: never closer than the authored spacing, pushed out just enough to clear the hub. At the default scale this is
 * the full 160 m at the authored 271 m; on the smaller ?worldScale=4 map a 135 m city 230 m out (it used to get 70 m,
 * too small for a single tower block). */
const NEON_FIT = (() => {
  const nexus = BASE_REGIONS.find((r) => r.id === "nexus")!;
  const nx = nexus.x * WORLD_SCALE, nz = nexus.z * WORLD_SCALE, edge = BASE_WORLD_RADIUS * WORLD_SCALE - 40;
  for (let flat = 160; flat >= 40; flat -= 5) {
    const dist = Math.max(NEON_BASE_DIST, flat + NEON_CLEAR);
    if (Math.hypot(nx + NEON_DIR.x * dist, nz + NEON_DIR.z * dist) + flat + 50 < edge) return { flat, dist };
  }
  return { flat: 40, dist: NEON_BASE_DIST };
})();
export const NEON_OFFSET = { x: NEON_DIR.x * NEON_FIT.dist, z: NEON_DIR.z * NEON_FIT.dist } as const;

/** Neon City's own level ground: flat out to NEON_FLAT metres from its centre, easing back to the land over NEON_FADE.
 * Sized to the room between it and the Nexus hub (the hub's buildings stay within ~25 m of its centre), so at the default
 * scale the whole city — districts, race loop and the tower blocks around them — stands on one level. */
const NEON_NEXUS = REGIONS.find((r) => r.id === "nexus")!;
export const NEON_SITE = { x: NEON_NEXUS.x + NEON_OFFSET.x, z: NEON_NEXUS.z + NEON_OFFSET.z } as const;
export const NEON_FADE = 50; // keep equal to the fade inside NEON_FIT
export const NEON_FLAT = NEON_FIT.flat;

/** Nexus City's residential street (residences.ts): a disc south of the outer districts where the walkable-scale
 * ground rolls (terrain.ts detailHeight) ease out, as they already do around the hub, so houses stand level. */
export const NEXUS_SUBURB = { x: NEON_NEXUS.x, z: NEON_NEXUS.z + 155, r: 62, fade: 30 } as const;
