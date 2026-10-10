import * as THREE from "three";

/**
 * Soft particle sprites drawn once on a small canvas and shared. Without a `map`, THREE.Points and
 * instanced primitives render as hard squares / low-poly blobs, which is what read as "boxes falling
 * from the sky". Presentation only; returns undefined where there is no DOM (SSR), so callers just
 * render unmapped there.
 *
 *  - dot:   a soft round puff (motes, pollen, sparks, mist)
 *  - flake: a six-armed crystal with a soft core (snow)
 *  - ember: a hot core with a long falloff (ash cinders)
 */
export type SpriteKind = "dot" | "flake" | "ember";

const cache = new Map<SpriteKind, THREE.CanvasTexture>();
const SIZE = 64;

function draw(kind: SpriteKind, g: CanvasRenderingContext2D) {
  const c = SIZE / 2;
  const radial = (r: number, stops: [number, string][]) => {
    const gr = g.createRadialGradient(c, c, 0, c, c, r);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr; g.fillRect(0, 0, SIZE, SIZE);
  };
  g.clearRect(0, 0, SIZE, SIZE);
  if (kind === "dot") {
    radial(c, [[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,0.55)"], [0.7, "rgba(255,255,255,0.12)"], [1, "rgba(255,255,255,0)"]]);
  } else if (kind === "ember") {
    radial(c, [[0, "rgba(255,255,255,1)"], [0.18, "rgba(255,255,255,0.9)"], [0.5, "rgba(255,255,255,0.22)"], [1, "rgba(255,255,255,0)"]]);
  } else {
    radial(c * 0.55, [[0, "rgba(255,255,255,0.95)"], [1, "rgba(255,255,255,0)"]]);
    g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      const dx = Math.cos(a) * c * 0.86, dy = Math.sin(a) * c * 0.86;
      g.lineWidth = 3.2; g.beginPath(); g.moveTo(c - dx, c - dy); g.lineTo(c + dx, c + dy); g.stroke();
      // small barbs near the tips so it reads as a crystal rather than an asterisk
      for (const s of [-1, 1]) for (const t of [0.5, 0.78]) {
        const bx = c + dx * t * s, by = c + dy * t * s, px = -Math.sin(a) * c * 0.16, py = Math.cos(a) * c * 0.16;
        g.lineWidth = 1.6; g.beginPath(); g.moveTo(bx - px, by - py); g.lineTo(bx + px, by + py); g.stroke();
      }
    }
  }
}

export function softSprite(kind: SpriteKind): THREE.CanvasTexture | undefined {
  if (typeof document === "undefined") return undefined;
  const hit = cache.get(kind);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = cv.height = SIZE;
  const g = cv.getContext("2d");
  if (!g) return undefined;
  draw(kind, g);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(kind, tex);
  return tex;
}
