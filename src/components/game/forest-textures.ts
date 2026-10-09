import * as THREE from "three";

/* Small procedural canvas textures for the Verdant Forest ground layer and crash site. No project asset covers
 * leaf litter, moss, scorch, churned soil, smoke or damaged hull plating, so these are generated once (seeded,
 * cached) and shared. They are texture work, not models: every one falls back to nothing if a canvas is unavailable. */

function rng(seed: number) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const cache = new Map<string, THREE.Texture | null>();

function make(key: string, size: number, draw: (g: CanvasRenderingContext2D, r: () => number, n: number) => void, seed: number, srgb = true): THREE.Texture | null {
  if (cache.has(key)) return cache.get(key)!;
  let tex: THREE.Texture | null = null;
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    if (g) {
      draw(g, rng(seed), size);
      tex = new THREE.CanvasTexture(c);
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
    }
  }
  cache.set(key, tex);
  return tex;
}

/** scattered fallen leaves on transparent ground: muted olive, ochre, rust and brown, some half-rotted */
export function leafLitterTexture() {
  return make("leaf", 256, (g, r, n) => {
    const cols = ["#6b6a2e", "#8a6a2a", "#7a4a22", "#5c3a1e", "#8c7a3a", "#4d5a28", "#a0622a"];
    for (let i = 0; i < 70; i++) {
      const x = r() * n, y = r() * n, s = 7 + r() * 11;
      g.save(); g.translate(x, y); g.rotate(r() * 6.28);
      g.globalAlpha = 0.55 + r() * 0.4; g.fillStyle = cols[Math.floor(r() * cols.length)]!;
      g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * 0.7, -s * 0.2, 0, s); g.quadraticCurveTo(-s * 0.7, -s * 0.2, 0, -s); g.fill();
      g.globalAlpha = 0.35; g.strokeStyle = "#2a1c10"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -s); g.lineTo(0, s); g.stroke();
      g.restore();
    }
  }, 11);
}

/** soft, blotchy moss cover that fades to nothing at the edge */
export function mossTexture() {
  return make("moss", 128, (g, r, n) => {
    for (let i = 0; i < 90; i++) {
      const x = n / 2 + (r() - 0.5) * n * 0.7, y = n / 2 + (r() - 0.5) * n * 0.7, s = 5 + r() * 14;
      const d = Math.hypot(x - n / 2, y - n / 2) / (n / 2);
      const grad = g.createRadialGradient(x, y, 0, x, y, s);
      const c = r() < 0.5 ? "62,104,38" : "86,128,44";
      grad.addColorStop(0, `rgba(${c},${0.55 * (1 - d)})`); grad.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, s, 0, 6.28); g.fill();
    }
  }, 23);
}

/** scorched ground: dark soot core with ragged edge and streaks, transparent outside */
export function scorchTexture() {
  return make("scorch", 256, (g, r, n) => {
    const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grad.addColorStop(0, "rgba(10,9,10,0.92)"); grad.addColorStop(0.45, "rgba(18,15,14,0.7)"); grad.addColorStop(1, "rgba(18,15,14,0)");
    g.fillStyle = grad; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 160; i++) {
      const a = r() * 6.28, d = (0.25 + r() * 0.7) * (n / 2), s = 3 + r() * 10;
      g.fillStyle = `rgba(8,8,9,${0.18 + r() * 0.3})`; g.beginPath(); g.arc(n / 2 + Math.cos(a) * d, n / 2 + Math.sin(a) * d, s, 0, 6.28); g.fill();
    }
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 120; i++) { const a = r() * 6.28; const d = (0.8 + r() * 0.2) * (n / 2); g.fillStyle = "rgba(0,0,0,0.5)"; g.beginPath(); g.arc(n / 2 + Math.cos(a) * d, n / 2 + Math.sin(a) * d, 6 + r() * 12, 0, 6.28); g.fill(); }
  }, 31);
}

/** churned, disturbed soil with stones and pale roots torn up, fading along its long edges (u runs along the strip) */
export function soilTexture() {
  return make("soil", 256, (g, r, n) => {
    g.fillStyle = "#4a3624"; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 420; i++) {
      const x = r() * n, y = r() * n, s = 2 + r() * 9;
      g.fillStyle = r() < 0.5 ? `rgba(${60 + r() * 40},${40 + r() * 26},${24 + r() * 16},0.7)` : `rgba(${24 + r() * 20},${18 + r() * 14},${12 + r() * 10},0.6)`;
      g.beginPath(); g.ellipse(x, y, s, s * (0.4 + r() * 0.5), r() * 3, 0, 6.28); g.fill();
    }
    for (let i = 0; i < 18; i++) { g.strokeStyle = "rgba(170,150,110,0.55)"; g.lineWidth = 1 + r() * 1.5; g.beginPath(); const x = r() * n, y = r() * n; g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 40, x + (r() - 0.5) * 60, y + (r() - 0.5) * 60); g.stroke(); }
    // feather the long edges to transparent
    g.globalCompositeOperation = "destination-in";
    const f = g.createLinearGradient(0, 0, 0, n);
    f.addColorStop(0, "rgba(0,0,0,0)"); f.addColorStop(0.28, "rgba(0,0,0,1)"); f.addColorStop(0.72, "rgba(0,0,0,1)"); f.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = f; g.fillRect(0, 0, n, n);
    const h = g.createLinearGradient(0, 0, n, 0);
    h.addColorStop(0, "rgba(0,0,0,1)"); h.addColorStop(0.8, "rgba(0,0,0,0.9)"); h.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = h; g.fillRect(0, 0, n, n);
  }, 47);
}

/** soft grey puff for smoke sprites */
export function smokeTexture() {
  return make("smoke", 64, (g, _r, n) => {
    const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grad.addColorStop(0, "rgba(70,72,78,0.9)"); grad.addColorStop(0.5, "rgba(60,62,68,0.4)"); grad.addColorStop(1, "rgba(60,62,68,0)");
    g.fillStyle = grad; g.fillRect(0, 0, n, n);
  }, 5);
}

/** damaged hull plating: soot, scratches, dents, rusty burn-through and bright bare-metal scrapes */
export function hullDamageTexture() {
  return make("hull", 256, (g, r, n) => {
    g.fillStyle = "#3a404b"; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 40; i++) { const x = r() * n, y = r() * n, s = 12 + r() * 40; const grad = g.createRadialGradient(x, y, 0, x, y, s); grad.addColorStop(0, `rgba(10,10,12,${0.25 + r() * 0.35})`); grad.addColorStop(1, "rgba(10,10,12,0)"); g.fillStyle = grad; g.beginPath(); g.arc(x, y, s, 0, 6.28); g.fill(); }
    for (let i = 0; i < 12; i++) { const x = r() * n, y = r() * n, s = 8 + r() * 24; const grad = g.createRadialGradient(x, y, 0, x, y, s); grad.addColorStop(0, "rgba(120,62,24,0.5)"); grad.addColorStop(1, "rgba(120,62,24,0)"); g.fillStyle = grad; g.beginPath(); g.arc(x, y, s, 0, 6.28); g.fill(); }
    g.lineWidth = 1;
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${170 + r() * 60},${175 + r() * 60},${185 + r() * 60},${0.15 + r() * 0.35})`; g.beginPath(); const x = r() * n, y = r() * n, a = r() * 6.28, l = 6 + r() * 40; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const x = (i + 0.5) * (n / 6); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 8, n); g.stroke(); } // panel seams
  }, 59);
}
