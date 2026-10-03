import * as THREE from "three";

/**
 * Procedural cloud-puff sprite texture — a handful of overlapping soft radial gradients baked
 * to a canvas at load, giving an irregular fluffy silhouette instead of a single clean circle.
 * No external image, same zero-network approach as detail-texture.ts; generated once and cached.
 */
let cache: THREE.CanvasTexture | null = null;

export function cloudPuffTexture() {
  if (cache) return cache;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  // seeded so the puff shape is stable across reloads instead of re-randomizing every session
  let seed = 8821;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  ctx.globalCompositeOperation = "lighten";
  const blobs = 7;
  for (let i = 0; i < blobs; i++) {
    const cx = size * (0.28 + rnd() * 0.44);
    const cy = size * (0.32 + rnd() * 0.4);
    const r = size * (0.2 + rnd() * 0.22);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.55, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  cache = texture;
  return texture;
}
