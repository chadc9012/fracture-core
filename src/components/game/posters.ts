import * as THREE from "three";

/** Street posters for the bus-shelter adverts (owner's Neon target frame: glowing ads along the boulevard). Four designs for the
 * game's own brands, drawn once on canvases: a dark-to-bright gradient in the brand colour, a glowing figure or emblem, the brand name
 * and a tagline, fine scanlines. Neon gets the hot palette, Nexus the cooler civic one. */
export type PosterDesign = { brand: string; tagline: string; colour: string; accent: string; motif: "figure" | "ring" | "chevron" | "bars" };
export const NEON_POSTERS: readonly PosterDesign[] = [
  { brand: "NEXUS CITY", tagline: "A BRIGHTER TOMORROW", colour: "#2a5bff", accent: "#7fe8ff", motif: "chevron" },
  { brand: "SYNTH-CORE", tagline: "UPGRADE YOURSELF", colour: "#ff2ea6", accent: "#ffd0f0", motif: "figure" },
  { brand: "ORBIT", tagline: "RIDE THE SKY LANES", colour: "#b968ff", accent: "#e6d4ff", motif: "ring" },
  { brand: "AEGIS", tagline: "STABILITY IS FREEDOM", colour: "#ff7a3a", accent: "#ffe2b0", motif: "bars" },
];
export const NEXUS_POSTERS: readonly PosterDesign[] = [
  { brand: "AEGIS", tagline: "STABILITY IS FREEDOM", colour: "#e0a030", accent: "#fff2cc", motif: "bars" },
  { brand: "NEXUS CITY", tagline: "A BRIGHTER TOMORROW", colour: "#2a7bd8", accent: "#cfefff", motif: "chevron" },
  { brand: "ORBIT", tagline: "RIDE THE SKY LANES", colour: "#28a8c8", accent: "#d8fbff", motif: "ring" },
];

const cache = new Map<string, THREE.CanvasTexture>();
export function posterTexture(d: PosterDesign): THREE.CanvasTexture | null {
  const key = `${d.brand}|${d.colour}`;
  const hit = cache.get(key); if (hit) return hit;
  if (typeof document === "undefined") return null;
  const W = 256, H = 448, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); if (!g) return null;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#05060c"); grad.addColorStop(0.55, d.colour); grad.addColorStop(1, "#0a0710");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.save(); g.shadowColor = d.accent; g.shadowBlur = 24; g.strokeStyle = d.accent; g.fillStyle = d.accent; g.lineWidth = 6;
  const cx = W / 2, cy = H * 0.5;
  if (d.motif === "figure") { g.beginPath(); g.arc(cx, cy - 70, 26, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(cx - 52, cy + 110); g.quadraticCurveTo(cx - 40, cy - 30, cx, cy - 36); g.quadraticCurveTo(cx + 40, cy - 30, cx + 52, cy + 110); g.stroke(); }
  if (d.motif === "ring") { for (const r of [70, 48, 26]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.ellipse(cx, cy, 110, 22, -0.3, 0, Math.PI * 2); g.stroke(); }
  if (d.motif === "chevron") { for (let k = 0; k < 3; k++) { const y = cy - 60 + k * 44; g.beginPath(); g.moveTo(cx - 70, y); g.lineTo(cx, y + 40); g.lineTo(cx + 70, y); g.stroke(); } }
  if (d.motif === "bars") { for (let k = 0; k < 5; k++) { const h = 30 + k * 26; g.fillRect(cx - 80 + k * 34, cy + 80 - h, 22, h); } }
  g.restore();
  g.fillStyle = "#ffffff"; g.textAlign = "center"; g.shadowColor = d.accent; g.shadowBlur = 14;
  g.font = `bold ${d.brand.length > 7 ? 34 : 46}px sans-serif`; g.fillText(d.brand, cx, 70);
  g.shadowBlur = 0; g.fillStyle = d.accent; g.font = "bold 15px sans-serif"; g.fillText(d.tagline, cx, H - 40);
  g.globalAlpha = 0.12; g.fillStyle = "#000"; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(key, t);
  return t;
}
