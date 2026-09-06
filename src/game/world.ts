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

export const REGIONS: Region[] = [
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

export const WORLD_RADIUS = 190;

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

export function phaseFor(t: number): Phase {
  const h = ((t % 1) + 1) % 1;
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
  const h = (((t % 1) + 1) % 1) * 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
