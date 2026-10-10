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
export const DEFAULT_WORLD_SCALE = 4;
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
    x: 78,
    z: 6,
    radius: 26,
    difficulty: 0,
    ground: "#2b3a4a",
    accent: "#66e0ff",
    speed: 1.1,
    rules: ["No PvP — stability field active", "Trade, upgrades, contracts", "Fast travel gate"],
  },
  {
    id: "veridan",
    name: "Veridan Forest",
    sub: "Safe Zone / Resources",
    kind: "starter",
    x: -58,
    z: -34,
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
    x: 18,
    z: -96,
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
    x: -52,
    z: 16,
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
    x: 12,
    z: -6,
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
    x: -18,
    z: 76,
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
    x: 62,
    z: 82,
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
export function scaleSite(x: number, z: number, offsetScale: number = WORLD_SCALE): { x: number; z: number } {
  if (WORLD_SCALE === 1) return { x, z };
  let best = -1; let bestScore = Infinity;
  BASE_REGIONS.forEach((r, i) => { const sc = Math.hypot(x - r.x, z - r.z) / r.radius; if (sc < 1.15 && sc < bestScore) { bestScore = sc; best = i; } });
  if (best < 0) return { x: x * WORLD_SCALE, z: z * WORLD_SCALE };
  const b = BASE_REGIONS[best]!, r = REGIONS[best]!;
  const k = b.id === "nexus" ? 1 : offsetScale;
  return { x: r.x + (x - b.x) * k, z: r.z + (z - b.z) * k };
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

export function phaseFor(t: number): Phase {
  const h = hourOf(t) / 24;
  if (h < 0.12) return "Dawn";
  if (h < 0.42) return "Day";
  if (h < 0.55) return "Sunset";
  if (h < 0.8) return "Night";
  return "Moonlight";
}

export const SKY: Record<Phase, { top: string; bottom: string; fog: string; light: string; intensity: number }> = {
  Dawn: { top: "#2f4d7a", bottom: "#f2a25c", fog: "#9fb6cf", light: "#ffcf9b", intensity: 1.1 },
  Day: { top: "#4aa3d8", bottom: "#bfe4f2", fog: "#c6e2ee", light: "#fff6e2", intensity: 1.6 },
  Sunset: { top: "#3b2a5c", bottom: "#ff7a3c", fog: "#c98a6a", light: "#ff9a52", intensity: 1.2 },
  Night: { top: "#070d1c", bottom: "#16233d", fog: "#121c30", light: "#8fb6ff", intensity: 0.35 },
  Moonlight: { top: "#0a1430", bottom: "#1d3358", fog: "#1a2a49", light: "#b9d4ff", intensity: 0.6 },
};

export function clockLabel(t: number) {
  const h = hourOf(t);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Neon City sits beside the Nexus hub; its offset grows with the world (half the wild-region scale) so the districts stay distinct neighbours. */
export const NEON_OFFSET = { x: 82 * Math.max(1, WORLD_SCALE / 2), z: -38 * Math.max(1, WORLD_SCALE / 2) } as const;
