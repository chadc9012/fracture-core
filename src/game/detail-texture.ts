import * as THREE from "three";

/**
 * Procedural tileable grain + normal detail textures, generated once at runtime from a canvas —
 * no external image downloads (this sandbox can't fetch art assets). Layered as a `map`/`normalMap`
 * on top of the terrain's per-vertex biome colouring so flat sand/dirt/rock/grass reads as a real
 * granular surface instead of a smooth colour gradient, and catches directional light at oblique
 * angles instead of looking perfectly flat.
 */
let cache: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } | null = null;

export function groundDetailTextures() {
  if (cache) return cache;
  const size = 256;

  // seeded so the grain pattern is stable across reloads instead of re-randomizing every session
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const raw = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) raw[i] = rnd();

  // 3x3 box blur (wrapped, so the tile edges stay seamless) — turns pixel static into soft grain clumps
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const xx = (x + ox + size) % size;
          const yy = (y + oy + size) % size;
          sum += raw[yy * size + xx]!;
        }
      }
      h[y * size + x] = sum / 9;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, Math.round(128 + (h[i]! - 0.5) * 140)));
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(240, 240);
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;

  const ncanvas = document.createElement("canvas");
  ncanvas.width = ncanvas.height = size;
  const nctx = ncanvas.getContext("2d")!;
  const nimg = nctx.createImageData(size, size);
  const strength = 1.8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)]!;
      const r = h[y * size + ((x + 1) % size)]!;
      const u = h[((y - 1 + size) % size) * size + x]!;
      const d = h[((y + 1) % size) * size + x]!;
      const nx = (l - r) * strength;
      const ny = (u - d) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      nimg.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      nimg.data[i + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
  const normalMap = new THREE.CanvasTexture(ncanvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.copy(map.repeat);
  normalMap.needsUpdate = true;

  cache = { map, normalMap };
  return cache;
}

/** Same texture pair at a much lower repeat, for small individually-UV'd meshes (rocks, boulders)
 * where the grain should read as rock speckle across one instance, not hundreds of tiny tiles. */
export function propDetailTextures(repeat = 3) {
  const base = groundDetailTextures();
  const map = base.map.clone();
  const normalMap = base.normalMap.clone();
  map.repeat.set(repeat, repeat);
  normalMap.repeat.set(repeat, repeat);
  map.needsUpdate = true;
  normalMap.needsUpdate = true;
  return { map, normalMap };
}
