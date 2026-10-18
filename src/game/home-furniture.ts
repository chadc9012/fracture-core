/**
 * Detailed furniture models for walkable homes (pure data, no three.js). Each decor item is a small assembly of
 * boxes, cylinders and spheres (cushions, legs, trim, screens, taps...) instead of one slab. A model is built for the
 * room it sits in and for the style of the home it sits in, so a salvage flat and a penthouse do not look alike.
 *
 * Room frame (matches HomeInteriors.tsx): the room is centred on (0, 0), 10 m square, walls 3.6 m high, inner back
 * wall at z = -4.875. Doorways to neighbouring rooms are on x = ±5 for |z| < 1.2; room 0 has its exit gap in the front
 * wall (|x| < 1.4, z = +5) and the player spawns/leaves around (0, +2..+4). Models are placed to keep those lanes clear;
 * home-furniture.test.ts checks every combination.
 */
import type { RoomId } from "./housing";

export type Shape = "box" | "cyl" | "sphere";
/** box: size = [w, h, d]. cyl: size = [diameter, height, diameter]. sphere: size = [diameter, diameter, diameter]. pos is the centre. */
export type Part = {
  name: string;
  shape: Shape;
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  rotY?: number;
  emissive?: string;
  opacity?: number;
  metal?: number;
  rough?: number;
  /** not solid: light, glass, hologram, rugs. Skipped by overlap checks. */
  ghost?: boolean;
  /** adds a point light at this part */
  light?: { intensity: number; distance: number };
};

export type HomeStyle = "salvage" | "neon" | "rustic" | "desert" | "luxe";
export const HOME_STYLE: Record<string, HomeStyle> = {
  "rustmuck-capsule": "salvage",
  "grid-loft": "neon",
  "veridan-cabin": "rustic",
  "solara-villa": "desert",
  "aegis-penthouse": "luxe",
  "wastes-hangar-bunk": "salvage",
  "frost-bunker-suite": "salvage",
};
export const styleOf = (homeId: string): HomeStyle => HOME_STYLE[homeId] ?? "salvage";

type Pal = { wood: string; fabric2: string; metal: string; accent: string; glow: string; pillow: string; ceramic: string };
const PALETTE: Record<HomeStyle, Pal> = {
  salvage: { wood: "#6b5a45", fabric2: "#4f6068", metal: "#6c7075", accent: "#c8742c", glow: "#ffb35c", pillow: "#a8402a", ceramic: "#cfd3d4" },
  neon: { wood: "#2a2d38", fabric2: "#3a2a55", metal: "#8a93a3", accent: "#ff2fd0", glow: "#19e0ff", pillow: "#19e0ff", ceramic: "#e4e8ee" },
  rustic: { wood: "#8a6238", fabric2: "#5b6e48", metal: "#3b3b3b", accent: "#c58a3a", glow: "#ffcf80", pillow: "#b4472f", ceramic: "#ece4d6" },
  desert: { wood: "#a87b4a", fabric2: "#b5683a", metal: "#c9a05a", accent: "#2a8aa0", glow: "#ffe3a0", pillow: "#2a8aa0", ceramic: "#f1e8d6" },
  luxe: { wood: "#1c1c22", fabric2: "#2b2e36", metal: "#d0d6dc", accent: "#c9a24b", glow: "#8fd8ff", pillow: "#c9a24b", ceramic: "#f5f6f8" },
};

/* ---------------- tiny builders ---------------- */
type O = Partial<Pick<Part, "rotY" | "emissive" | "opacity" | "metal" | "rough" | "ghost" | "light">>;
const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, color: string, o: O = {}): Part => ({ name, shape: "box", pos: [x, y, z], size: [w, h, d], color, ...o });
const cyl = (name: string, x: number, y: number, z: number, dia: number, h: number, color: string, o: O = {}): Part => ({ name, shape: "cyl", pos: [x, y, z], size: [dia, h, dia], color, ...o });
const ball = (name: string, x: number, y: number, z: number, dia: number, color: string, o: O = {}): Part => ({ name, shape: "sphere", pos: [x, y, z], size: [dia, dia, dia], color, ...o });

/** Move a model built around its own origin (front = +z) to (x, z) in the room, turned by rotY. y is kept. */
function place(parts: readonly Part[], x: number, z: number, rotY = 0): Part[] {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  return parts.map((p) => ({
    ...p,
    pos: [x + p.pos[0] * c + p.pos[2] * s, p.pos[1], z - p.pos[0] * s + p.pos[2] * c] as [number, number, number],
    rotY: (p.rotY ?? 0) + rotY,
  }));
}

const BACK = -4.8; // z of a model's back when it stands against the back wall

/* ---------------- models ---------------- */
function sofa(p: Pal, o: { w: number; fabric: string; fabric2: string; legs: string; chrome: boolean }): Part[] {
  const { w, fabric, fabric2, legs } = o;
  const n = Math.max(2, Math.round(w / 0.85));
  const cw = (w - 0.4) / n;
  const out: Part[] = [box("base", 0, 0.3, 0, w, 0.22, 0.95, fabric2, { rough: 0.9 })];
  for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const) out.push(cyl(`leg${sx}${sz}`, sx * (w / 2 - 0.12), 0.1, sz * 0.36, 0.08, 0.2, legs, { metal: o.chrome ? 0.9 : 0.4, rough: o.chrome ? 0.2 : 0.6 }));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.2 + cw * (i + 0.5);
    out.push(box(`seat${i}`, x, 0.52, 0.08, cw - 0.03, 0.22, 0.72, fabric, { rough: 0.9 }));
    out.push(box(`back${i}`, x, 0.88, -0.3, cw - 0.03, 0.55, 0.24, fabric, { rough: 0.9, rotY: 0 }));
  }
  out.push(box("backframe", 0, 0.7, -0.42, w, 0.9, 0.1, fabric2, { rough: 0.9 }));
  for (const sx of [-1, 1] as const) out.push(box(`arm${sx}`, sx * (w / 2 - 0.1), 0.58, 0.02, 0.2, 0.55, 0.95, fabric2, { rough: 0.9 }));
  out.push(box("pillowA", -w / 2 + 0.55, 0.85, 0.05, 0.4, 0.38, 0.12, p.pillow, { rotY: 0.35, rough: 0.95 }));
  out.push(box("pillowB", w / 2 - 0.6, 0.83, 0.05, 0.36, 0.34, 0.12, p.accent, { rotY: -0.3, rough: 0.95 }));
  return out;
}
const rug = (name: string, w: number, d: number, color: string, trim: string): Part[] => [
  box(name, 0, 0.015, 0, w, 0.03, d, color, { ghost: true, rough: 1 }),
  box(`${name}-trim`, 0, 0.032, 0, w - 0.3, 0.005, d - 0.3, trim, { ghost: true, rough: 1 }),
];
function sideTable(p: Pal, lampGlow: string): Part[] {
  return [
    cyl("top", 0, 0.55, 0, 0.5, 0.04, p.metal, { metal: 0.8, rough: 0.3 }), cyl("stem", 0, 0.28, 0, 0.06, 0.52, p.metal, { metal: 0.8 }), cyl("foot", 0, 0.02, 0, 0.36, 0.04, p.metal, { metal: 0.8 }),
    cyl("lampstem", 0, 0.85, 0, 0.03, 0.55, p.metal, { metal: 0.8 }), cyl("shade", 0, 1.2, 0, 0.3, 0.22, lampGlow, { emissive: lampGlow, opacity: 0.85, light: { intensity: 2, distance: 5 } }),
  ];
}

function modelSofaStreet(p: Pal): Part[] {
  return [...rug("rug", 3.4, 2.4, p.fabric2, p.accent).map((r) => ({ ...r, pos: [r.pos[0], r.pos[1], r.pos[2] + 0.5] as Part["pos"] })),
    ...sofa(p, { w: 2.4, fabric: "#6b4a3a", fabric2: "#54382b", legs: p.wood, chrome: false }),
    box("crate", -1.9, 0.2, 0.15, 0.5, 0.4, 0.5, p.wood, { rough: 0.9 }), box("cratelid", -1.9, 0.42, 0.15, 0.54, 0.04, 0.54, p.metal, { metal: 0.5 }), cyl("mug", -1.9, 0.5, 0.15, 0.09, 0.1, p.accent)];
}
function modelSofaAegis(p: Pal): Part[] {
  return [...rug("rug", 4.4, 3.2, "#2a2d33", p.accent).map((r) => ({ ...r, pos: [r.pos[0], r.pos[1], r.pos[2] + 0.7] as Part["pos"] })),
    ...sofa(p, { w: 3.2, fabric: "#d8d4cc", fabric2: "#bdb8ae", legs: p.metal, chrome: true }),
    // ottoman and a lit side table
    box("ottoman", 0, 0.22, 1.1, 1.3, 0.38, 0.7, "#cfcac0", { rough: 0.8 }), box("ottomantray", 0, 0.43, 1.1, 0.6, 0.03, 0.35, p.metal, { metal: 0.9, rough: 0.2 }),
    ...place(sideTable(p, p.glow), 2.15, -0.1)];
}

function modelTvWall(p: Pal): Part[] {
  return [
    box("bezel", 0, 1.85, 0.06, 2.0, 1.12, 0.07, "#0b0d10", { metal: 0.5, rough: 0.3 }),
    box("screen", 0, 1.85, 0.1, 1.9, 1.02, 0.02, "#10304c", { emissive: "#2a8fd0" }),
    box("glare", -0.45, 2.1, 0.115, 0.5, 0.35, 0.005, "#9fd8ff", { ghost: true, opacity: 0.18, emissive: "#9fd8ff" }),
    box("console", 0, 0.28, 0.2, 2.2, 0.5, 0.42, p.wood, { rough: 0.7 }),
    box("consolegap", 0, 0.28, 0.42, 2.0, 0.34, 0.02, "#15171a"),
    box("soundbar", 0, 0.56, 0.2, 1.3, 0.08, 0.12, "#111318", { metal: 0.6 }),
    box("boxA", -0.8, 0.58, 0.18, 0.28, 0.06, 0.22, p.metal, { metal: 0.6 }), cyl("plant", 0.85, 0.66, 0.2, 0.16, 0.2, p.accent), ball("plantleaf", 0.85, 0.84, 0.2, 0.26, p.fabric2),
  ];
}
function modelTvHolo(p: Pal): Part[] {
  return [
    cyl("pad", 0, 0.06, 0, 1.2, 0.12, "#14181d", { metal: 0.8, rough: 0.3 }), cyl("ring", 0, 0.14, 0, 0.95, 0.03, p.glow, { emissive: p.glow }),
    cyl("emitter", 0, 0.2, 0, 0.35, 0.12, "#20242c", { metal: 0.9 }),
    cyl("beam", 0, 1.0, 0, 0.8, 1.6, p.glow, { emissive: p.glow, opacity: 0.16, ghost: true, light: { intensity: 3, distance: 6 } }),
    ball("core", 0, 1.05, 0, 0.42, "#bfeaff", { emissive: p.glow, opacity: 0.55, ghost: true }),
    cyl("halo1", 0, 0.65, 0, 0.9, 0.015, p.glow, { emissive: p.glow, opacity: 0.5, ghost: true }), cyl("halo2", 0, 1.45, 0, 0.7, 0.015, p.glow, { emissive: p.glow, opacity: 0.5, ghost: true }),
    ...[-1, 1].map((s) => box(`speaker${s}`, s * 1.0, 0.45, 0.2, 0.22, 0.9, 0.22, "#15171a", { metal: 0.5 })),
  ];
}

function frame(w: number, h: number, frameColor: string): Part[] {
  return [box("frame", 0, 0, 0, w, h, 0.06, frameColor, { rough: 0.5 }), box("mat", 0, 0, 0.035, w - 0.12, h - 0.12, 0.01, "#111", { rough: 1 })];
}
function modelArtFracture(p: Pal): Part[] {
  const bars = [0.25, 0.5, 0.8, 0.4, 0.9, 0.6, 0.3, 0.7];
  return [...frame(1.5, 1.0, "#101418"), box("glassbg", 0, 0, 0.05, 1.36, 0.86, 0.01, "#0a1020"),
    ...bars.map((v, i) => box(`bar${i}`, -0.6 + i * 0.17, -0.38 + v * 0.38, 0.065, 0.1, v * 0.76, 0.02, i % 3 === 0 ? p.accent : "#8f4dff", { emissive: i % 3 === 0 ? p.accent : "#8f4dff" })),
    box("crack", 0.1, 0, 0.075, 0.015, 0.84, 0.01, "#ffffff", { emissive: "#ffffff" })];
}
function modelArtVyrak(p: Pal): Part[] {
  return [...frame(1.5, 1.0, "#2b2010"), box("sky", 0, 0, 0.05, 1.36, 0.86, 0.01, "#2a1245"),
    box("sun", 0.35, 0.18, 0.06, 0.4, 0.4, 0.02, "#ff9a3c", { emissive: "#ff7a1c" }),
    box("ridge1", -0.3, -0.3, 0.065, 0.7, 0.22, 0.02, "#120a1c"), box("ridge2", 0.3, -0.34, 0.07, 0.6, 0.14, 0.02, "#0a0612"),
    box("wingL", -0.35, 0.2, 0.075, 0.5, 0.05, 0.02, p.accent, { emissive: p.accent }), box("wingR", 0.0, 0.22, 0.075, 0.4, 0.05, 0.02, p.accent, { emissive: p.accent }),
    box("body", -0.15, 0.12, 0.08, 0.3, 0.1, 0.02, "#d95a1c", { emissive: "#7a2a10" })];
}

function modelBunk(p: Pal): Part[] {
  const out: Part[] = [];
  for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const) out.push(box(`post${sx}${sz}`, sx * 0.55, 0.97, sz * 1.0, 0.08, 1.94, 0.08, p.metal, { metal: 0.6 }));
  for (const [i, y] of [0.38, 1.38].entries()) {
    out.push(box(`frame${i}`, 0, y, 0, 1.1, 0.06, 2.1, p.metal, { metal: 0.6 }));
    out.push(box(`mattress${i}`, 0, y + 0.13, 0.05, 1.0, 0.2, 1.95, i ? "#6b7886" : "#586573", { rough: 0.95 }));
    out.push(box(`pillow${i}`, 0, y + 0.28, -0.8, 0.7, 0.12, 0.3, "#d8d6cf", { rough: 0.95 }));
    out.push(box(`blanket${i}`, 0, y + 0.25, 0.35, 1.02, 0.07, 1.2, i ? p.accent : p.fabric2, { rough: 1 }));
  }
  out.push(box("rail", 0.56, 1.7, 0, 0.04, 0.2, 2.0, p.metal, { metal: 0.6 }));
  for (const sx of [-1, 1] as const) out.push(box(`ladderrail${sx}`, -0.62, 0.85, 0.5 + sx * 0.15, 0.04, 1.4, 0.04, p.metal, { metal: 0.6, rotY: 0 }));
  for (let i = 0; i < 4; i++) out.push(box(`rung${i}`, -0.62, 0.35 + i * 0.35, 0.5, 0.04, 0.04, 0.34, p.metal, { metal: 0.6 }));
  return out;
}
function modelBedKing(p: Pal): Part[] {
  const out: Part[] = [
    box("floorglow", 0, 0.12, 0.0, 2.1, 0.03, 2.3, p.glow, { emissive: p.glow, ghost: true, opacity: 0.7, light: { intensity: 2.5, distance: 6 } }),
    box("platform", 0, 0.38, 0, 2.3, 0.3, 2.4, "#1b1d24", { metal: 0.5, rough: 0.35 }),
    box("mattress", 0, 0.68, 0.05, 2.1, 0.3, 2.2, "#e6e2da", { rough: 0.9 }),
    box("duvet", 0, 0.85, 0.5, 2.14, 0.08, 1.3, p.fabric2, { rough: 1 }), box("fold", 0, 0.9, -0.12, 2.14, 0.06, 0.2, p.accent, { rough: 1 }),
    box("headboard", 0, 1.1, -1.2, 2.5, 1.5, 0.14, "#2b2f38", { rough: 0.5 }), box("headtrim", 0, 1.84, -1.2, 2.5, 0.05, 0.16, p.metal, { metal: 0.9, rough: 0.25 }),
    box("headglow", 0, 1.1, -1.12, 2.2, 0.04, 0.02, p.glow, { emissive: p.glow }),
  ];
  for (const sx of [-1, 1] as const) {
    out.push(box(`pillow${sx}`, sx * 0.55, 0.9, -0.8, 0.85, 0.16, 0.45, "#f1efe9", { rough: 1, rotY: sx * 0.05 }));
    out.push(...place(bedside(p), sx * 1.7, -1.0));
  }
  return out;
}
function bedside(p: Pal): Part[] {
  return [box("cabinet", 0, 0.28, 0, 0.5, 0.56, 0.4, "#20232a", { metal: 0.3 }), box("drawer", 0, 0.34, 0.205, 0.42, 0.18, 0.01, p.metal, { metal: 0.8 }),
    cyl("lampbase", 0, 0.6, 0, 0.1, 0.05, p.metal, { metal: 0.8 }), cyl("lampshade", 0, 0.78, 0, 0.2, 0.22, p.glow, { emissive: p.glow, opacity: 0.85, light: { intensity: 1.2, distance: 4 } })];
}

function modelShower(p: Pal): Part[] {
  return [
    box("tray", 0, 0.05, 0, 1.2, 0.1, 1.2, p.ceramic, { rough: 0.3 }), cyl("drain", 0, 0.105, 0, 0.12, 0.012, p.metal, { metal: 0.9 }),
    box("glassfront", 0, 1.1, 0.59, 1.18, 2.1, 0.02, "#a9dbe9", { opacity: 0.22, ghost: true, rough: 0.05 }), box("glassside", 0.59, 1.1, 0, 0.02, 2.1, 1.18, "#a9dbe9", { opacity: 0.22, ghost: true, rough: 0.05 }),
    box("frametop", 0, 2.17, 0.59, 1.2, 0.04, 0.04, p.metal, { metal: 0.9, rough: 0.3 }), box("framepost", 0.59, 1.1, 0.59, 0.04, 2.1, 0.04, p.metal, { metal: 0.9, rough: 0.3 }),
    cyl("pipe", -0.5, 1.2, -0.5, 0.04, 2.0, p.metal, { metal: 0.9 }), box("arm", -0.3, 2.1, -0.5, 0.4, 0.04, 0.04, p.metal, { metal: 0.9 }),
    cyl("head", -0.1, 2.08, -0.5, 0.26, 0.04, p.metal, { metal: 0.9 }), box("steam", 0, 1.0, 0, 0.9, 1.7, 0.9, "#ffffff", { opacity: 0.06, ghost: true }),
    box("shelf", 0.2, 1.3, -0.55, 0.5, 0.03, 0.12, p.metal), cyl("bottle", 0.1, 1.4, -0.55, 0.08, 0.18, p.accent), cyl("bottle2", 0.28, 1.38, -0.55, 0.07, 0.14, p.fabric2),
  ];
}
function modelSoak(p: Pal): Part[] {
  return [
    box("shell", 0, 0.34, 0, 1.9, 0.68, 0.95, p.ceramic, { rough: 0.2 }),
    box("water", 0, 0.62, 0, 1.68, 0.05, 0.73, "#4aa3b8", { emissive: "#2a7a8c", opacity: 0.8, rough: 0.05 }),
    box("rimA", 0, 0.7, -0.45, 1.9, 0.05, 0.08, p.ceramic), box("rimB", 0, 0.7, 0.45, 1.9, 0.05, 0.08, p.ceramic),
    box("rimC", -0.91, 0.7, 0, 0.08, 0.05, 0.95, p.ceramic), box("rimD", 0.91, 0.7, 0, 0.08, 0.05, 0.95, p.ceramic),
    cyl("tapstem", -0.7, 0.85, -0.5, 0.05, 0.3, p.metal, { metal: 0.9 }), box("tapspout", -0.7, 1.0, -0.4, 0.04, 0.04, 0.2, p.metal, { metal: 0.9 }),
    ball("stone1", 1.15, 0.14, 0.25, 0.28, "#6e6a64", { rough: 1 }), ball("stone2", 1.2, 0.1, 0.0, 0.2, "#807a72", { rough: 1 }), ball("stone3", 1.12, 0.11, -0.2, 0.22, "#5b5852", { rough: 1 }),
    cyl("candle", 0.7, 0.78, 0.45, 0.05, 0.08, "#f1e8d6"), ball("flame", 0.7, 0.85, 0.45, 0.04, p.glow, { emissive: p.glow, ghost: true, light: { intensity: 0.8, distance: 3 } }),
  ];
}

function modelNeon(p: Pal): Part[] {
  const c = p.glow;
  return [
    box("panel", 0, 3.45, 0, 2.4, 0.05, 0.3, "#fff1cf", { emissive: "#ffd28a", ghost: true, light: { intensity: 5, distance: 9 } }),
    box("tubeBack", 0, 3.3, -4.78, 8.0, 0.05, 0.05, c, { emissive: c, ghost: true }),
    box("tubeFront", 0, 3.3, 4.78, 8.0, 0.05, 0.05, p.accent, { emissive: p.accent, ghost: true }),
    box("tubeBackLow", 0, 0.12, -4.8, 8.0, 0.04, 0.04, c, { emissive: c, ghost: true }),
  ];
}

/* ---------------- fixtures: what makes a room read as what it is ---------------- */
function fixtures(room: RoomId, p: Pal): Part[] {
  switch (room) {
    case "living": return place([cyl("pot", 0, 0.22, 0, 0.36, 0.44, p.wood), cyl("soil", 0, 0.45, 0, 0.3, 0.02, "#2a1d12"), ball("leafA", 0, 0.8, 0, 0.5, p.fabric2, { rough: 1 }), ball("leafB", 0.12, 1.1, 0.05, 0.36, "#4f7a46", { rough: 1 }), ball("leafC", -0.1, 1.3, -0.04, 0.26, "#5f8f55", { rough: 1 })], -4.1, 3.9);
    case "bedroom": return place([
      box("body", 0, 1.1, 0, 1.6, 2.2, 0.6, p.wood, { rough: 0.7 }), box("doorL", -0.4, 1.1, 0.31, 0.78, 2.1, 0.02, p.fabric2, { metal: 0.2 }), box("doorR", 0.4, 1.1, 0.31, 0.78, 2.1, 0.02, p.fabric2, { metal: 0.2 }),
      box("handleL", -0.06, 1.1, 0.34, 0.03, 0.3, 0.03, p.metal, { metal: 0.9 }), box("handleR", 0.06, 1.1, 0.34, 0.03, 0.3, 0.03, p.metal, { metal: 0.9 }), box("plinth", 0, 0.05, 0.02, 1.6, 0.1, 0.6, "#15171a")], 3.5, 4.3, Math.PI);
    case "bathroom": return [
      ...place([box("vanity", 0, 0.42, 0, 1.1, 0.84, 0.5, p.wood, { rough: 0.6 }), box("top", 0, 0.86, 0, 1.14, 0.04, 0.54, p.ceramic, { rough: 0.2 }), box("bowl", 0, 0.9, 0.02, 0.5, 0.06, 0.34, p.ceramic, { rough: 0.15 }),
        cyl("tap", 0, 1.0, -0.15, 0.04, 0.2, p.metal, { metal: 0.9 }), box("mirror", 0, 1.75, -0.22, 0.95, 1.0, 0.03, "#b8c8d2", { metal: 0.9, rough: 0.05 }), box("mirrorframe", 0, 1.75, -0.235, 1.0, 1.05, 0.02, p.metal, { metal: 0.8 })], 1.6, BACK + 0.35),
      ...place([box("cistern", 0, 0.5, -0.2, 0.5, 0.7, 0.2, p.ceramic, { rough: 0.2 }), cyl("bowl", 0, 0.22, 0.1, 0.4, 0.4, p.ceramic, { rough: 0.2 }), box("seat", 0, 0.43, 0.1, 0.42, 0.04, 0.5, p.ceramic, { rough: 0.2 })], 3.8, BACK + 0.45),
      box("towelrail", -0.0, 1.2, BACK + 0.1, 0.04, 0.04, 0.04, p.metal, { ghost: true }), ...place([box("rail", 0, 1.3, 0, 0.8, 0.03, 0.03, p.metal, { metal: 0.9 }), box("towel", 0, 1.1, 0.02, 0.5, 0.45, 0.04, p.accent, { rough: 1 })], 0.1, BACK + 0.2),
    ];
    case "kitchen": return [
      ...place([box("cabinets", 0, 0.45, 0, 4.2, 0.9, 0.62, p.wood, { rough: 0.6 }), box("worktop", 0, 0.92, 0, 4.3, 0.05, 0.66, "#d9d6cf", { rough: 0.3 }),
        box("hob", 0.9, 0.96, 0, 0.7, 0.03, 0.5, "#15171a"), cyl("ring1", 0.75, 0.985, -0.1, 0.18, 0.01, "#333", { metal: 0.6 }), cyl("ring2", 1.05, 0.985, 0.1, 0.18, 0.01, "#333", { metal: 0.6 }),
        box("sink", -0.9, 0.95, 0, 0.75, 0.04, 0.45, p.metal, { metal: 0.9, rough: 0.2 }), cyl("tap", -0.9, 1.1, -0.2, 0.04, 0.3, p.metal, { metal: 0.9 }),
        box("hood", 0.9, 2.3, -0.1, 0.9, 0.2, 0.45, p.metal, { metal: 0.8 }), box("upper", -1.0, 1.9, -0.12, 1.8, 0.7, 0.35, p.wood, { rough: 0.6 })], 1.3, BACK + 0.38),
      ...place([box("body", 0, 0.95, 0, 0.9, 1.9, 0.75, p.metal, { metal: 0.7, rough: 0.3 }), box("split", 0, 1.3, 0.38, 0.84, 0.02, 0.01, "#222"), box("handle", 0.35, 1.5, 0.4, 0.03, 0.5, 0.03, "#999", { metal: 0.9 })], -4.2, BACK + 0.45),
      ...place([box("island", 0, 0.46, 0, 2.2, 0.92, 0.9, p.wood, { rough: 0.6 }), box("top", 0, 0.94, 0, 2.3, 0.05, 1.0, "#d9d6cf", { rough: 0.3 }), ...[-0.7, 0.7].map((x) => cyl(`stool${x}`, x, 0.5, 0.85, 0.34, 0.06, p.accent)), ...[-0.7, 0.7].map((x) => cyl(`stoolleg${x}`, x, 0.25, 0.85, 0.06, 0.5, p.metal, { metal: 0.8 }))], 0, -2.4),
    ];
    case "garage": return [
      ...place([box("bench", 0, 0.45, 0, 2.4, 0.9, 0.7, p.wood, { rough: 0.8 }), box("benchtop", 0, 0.92, 0, 2.5, 0.06, 0.78, p.metal, { metal: 0.6, rough: 0.5 }), box("vice", 0.9, 1.05, 0, 0.18, 0.2, 0.2, "#b04a2a", { metal: 0.6 }),
        box("pegboard", 0, 1.9, -0.32, 2.4, 1.1, 0.04, "#4a4d52"), box("wrench", -0.6, 1.9, -0.28, 0.5, 0.05, 0.02, p.metal, { metal: 0.9 }), box("saw", 0.2, 1.8, -0.28, 0.06, 0.6, 0.02, p.metal, { metal: 0.9 }), box("lamp", 0.7, 2.6, -0.1, 0.6, 0.06, 0.12, p.glow, { emissive: p.glow, light: { intensity: 2, distance: 5 } })], -3.2, BACK + 0.4),
      ...place([box("toolbox", 0, 0.45, 0, 0.9, 0.9, 0.5, "#a83a2a", { metal: 0.4 }), box("drawerA", 0, 0.7, 0.26, 0.8, 0.02, 0.01, "#600"), box("drawerB", 0, 0.45, 0.26, 0.8, 0.02, 0.01, "#600"), box("drawerC", 0, 0.2, 0.26, 0.8, 0.02, 0.01, "#600")], 0, BACK + 0.35),
      ...[0, 1, 2].map((i) => cyl(`tyre${i}`, 4.15, 0.12 + i * 0.24, -3.9, 0.7, 0.22, "#17181a", { rough: 1 })),
      cyl("barrel", 4.2, 0.45, -2.6, 0.55, 0.9, "#2f5f8a", { metal: 0.5 }), cyl("barrelband", 4.2, 0.45, -2.6, 0.57, 0.06, "#c8a02a"),
    ];
  }
}

/* ---------------- placement ---------------- */
/** The only decor ids that have a 3D model; anything else is a finish (paint / wallpaper / floor). */
const FLOOR_SOFA_X = 2.0;
type Slots = Partial<Record<string, string>>;

function bedX(id: string) { return id === "bed-king" ? -2.6 : -3.7; }

/** Parts for one placed item, positioned for the room it is in. Unknown ids and ids that do not belong in the room give []. */
export function itemParts(decorId: string, room: RoomId, style: HomeStyle): Part[] {
  const p = PALETTE[style];
  const artX = room === "bedroom" ? -2.6 : -2.8;
  const tvX = room === "bedroom" ? 2.6 : FLOOR_SOFA_X;
  switch (decorId) {
    case "sofa-street": return place(modelSofaStreet(p), FLOOR_SOFA_X, -1.9, Math.PI);
    case "sofa-aegis": return place(modelSofaAegis(p), FLOOR_SOFA_X, -1.9, Math.PI);
    case "art-fracture": return place(modelArtFracture(p).map((q) => ({ ...q, pos: [q.pos[0], q.pos[1] + 2.45, q.pos[2]] as Part["pos"] })), artX, BACK + 0.02);
    case "art-vyrak": return place(modelArtVyrak(p).map((q) => ({ ...q, pos: [q.pos[0], q.pos[1] + 2.45, q.pos[2]] as Part["pos"] })), artX, BACK + 0.02);
    case "tv-wall": return place(modelTvWall(p), tvX, BACK + 0.05);
    case "tv-holo": return place(modelTvHolo(p), FLOOR_SOFA_X, -4.1);
    case "bed-bunk": return place(modelBunk(p), bedX(decorId), -3.75);
    case "bed-king": return place(modelBedKing(p), bedX(decorId), -3.6);
    case "bath-shower": return place(modelShower(p), -3.9, -4.2);
    case "bath-soak": return place(modelSoak(p), -3.0, -4.3);
    case "light-neon": return modelNeon(p);
    default: return [];
  }
}

export type RoomFurniture = { fixtures: Part[]; items: { slot: string; id: string; parts: Part[] }[] };

/** Everything to draw in one room: its built-in fixtures plus the model of each placed item that is valid there. */
export function roomFurniture(room: RoomId, style: HomeStyle, slots: Slots, allowed: (decorId: string, slot: string, room: RoomId) => boolean = () => true): RoomFurniture {
  const items: RoomFurniture["items"] = [];
  for (const [slot, id] of Object.entries(slots)) {
    if (!id || !allowed(id, slot, room)) continue;
    const parts = itemParts(id, room, style);
    if (parts.length) items.push({ slot, id, parts });
  }
  return { fixtures: fixtures(room, PALETTE[style]), items };
}

/* ---------------- geometry helpers (used by tests and by the renderer's culling) ---------------- */
export type Aabb = { min: [number, number, number]; max: [number, number, number] };
export function partBounds(p: Part): Aabb {
  const [w, h, d] = p.size;
  const hx = (p.shape === "box" ? w : w) / 2, hz = d / 2;
  const t = p.rotY ?? 0, c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  const ex = c * hx + s * hz, ez = s * hx + c * hz;
  return { min: [p.pos[0] - ex, p.pos[1] - h / 2, p.pos[2] - ez], max: [p.pos[0] + ex, p.pos[1] + h / 2, p.pos[2] + ez] };
}
export const aabbOverlap = (a: Aabb, b: Aabb, eps = 0.02): boolean =>
  a.min[0] < b.max[0] - eps && a.max[0] > b.min[0] + eps && a.min[1] < b.max[1] - eps && a.max[1] > b.min[1] + eps && a.min[2] < b.max[2] - eps && a.max[2] > b.min[2] + eps;
