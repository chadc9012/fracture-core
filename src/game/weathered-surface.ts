import * as THREE from "three";

/**
 * Weathered surfaces for the procedural world (ruins, Rust Port, slabs, hangars): a seeded canvas texture of stained concrete
 * (formwork lines, rain streaks from the top, cracks, rust bleed) applied in world space (triplanar), so every instanced box
 * reads as poured, aged concrete at the same real-world scale however it is scaled, instead of a flat grey block. The texture
 * is a mid-grey detail layer: it multiplies the material's own colour (and per-instance colours) rather than replacing them.
 * Generated once, no downloads; pure apart from the canvas.
 */
let concrete: THREE.CanvasTexture | null = null;

export function weatheredConcreteTexture(): THREE.CanvasTexture | null {
  if (concrete) return concrete;
  if (typeof document === "undefined") return null;
  const size = 256;
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); if (!g) return null;
  let seed = 4242; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // base: mid grey with soft mottling
  g.fillStyle = "#808080"; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * size, y = rnd() * size, r = 2 + rnd() * 14, v = 112 + Math.round(rnd() * 34);
    g.fillStyle = `rgba(${v},${v},${v},0.18)`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // formwork pour lines
  for (let y = 32; y < size; y += 64) { g.fillStyle = "rgba(60,60,60,0.35)"; g.fillRect(0, y, size, 2); g.fillStyle = "rgba(170,170,170,0.18)"; g.fillRect(0, y + 2, size, 1); }
  // rain streaks running down from the top of each band
  for (let i = 0; i < 70; i++) {
    const x = rnd() * size, y = Math.floor(rnd() * 4) * 64 + 34, len = 18 + rnd() * 46, w = 1 + rnd() * 3;
    const grad = g.createLinearGradient(0, y, 0, y + len); grad.addColorStop(0, "rgba(40,38,34,0.45)"); grad.addColorStop(1, "rgba(40,38,34,0)");
    g.fillStyle = grad; g.fillRect(x, y, w, len);
  }
  // rust bleed under imaginary rebar
  for (let i = 0; i < 14; i++) {
    const x = rnd() * size, y = rnd() * size, len = 10 + rnd() * 30;
    const grad = g.createLinearGradient(0, y, 0, y + len); grad.addColorStop(0, "rgba(150,72,30,0.55)"); grad.addColorStop(1, "rgba(150,72,30,0)");
    g.fillStyle = grad; g.fillRect(x, y, 2 + rnd() * 4, len);
  }
  // hairline cracks (random walks)
  g.strokeStyle = "rgba(30,30,30,0.6)"; g.lineWidth = 1;
  for (let i = 0; i < 16; i++) {
    let x = rnd() * size, y = rnd() * size; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 9; k++) { x += (rnd() - 0.5) * 16; y += rnd() * 10; g.lineTo(x, y); }
    g.stroke();
  }
  // chipped edges / spalls
  for (let i = 0; i < 40; i++) { const x = rnd() * size, y = rnd() * size; g.fillStyle = `rgba(185,180,170,${0.2 + rnd() * 0.25})`; g.fillRect(x, y, 2 + rnd() * 5, 1 + rnd() * 3); }
  concrete = new THREE.CanvasTexture(c);
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;
  concrete.colorSpace = THREE.NoColorSpace; // detail data around 0.5, used as a ×2 multiplier: keep it linear so mid grey means "no change"
  concrete.anisotropy = 4;
  return concrete;
}

let plaster: THREE.CanvasTexture | null = null;
/** Painted render/plaster for homes and garages: the same ×2 detail convention as the concrete, but gentler — soft mottling,
 * fine grain and faint grime streaks under sills, with no formwork lines or rust (homes are lived in, not ruined). Why: the
 * residences were flat vertex-coloured boxes, the "Roblox" read the owner's gritty-realistic direction rules out. */
export function weatheredPlasterTexture(): THREE.CanvasTexture | null {
  if (plaster) return plaster;
  if (typeof document === "undefined") return null;
  const size = 256;
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); if (!g) return null;
  let seed = 7717; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  g.fillStyle = "#808080"; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 700; i++) { // soft patchy paint
    const x = rnd() * size, y = rnd() * size, r = 4 + rnd() * 20, v = 116 + Math.round(rnd() * 24);
    g.fillStyle = `rgba(${v},${v},${v},0.2)`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const img = g.getImageData(0, 0, size, size), d = img.data; // fine render grain
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 30; d[i] = d[i]! + n; d[i + 1] = d[i + 1]! + n; d[i + 2] = d[i + 2]! + n; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 26; i++) { // faint grime streaks
    const x = rnd() * size, y = rnd() * size, len = 14 + rnd() * 40, w = 2 + rnd() * 5;
    const grad = g.createLinearGradient(0, y, 0, y + len); grad.addColorStop(0, "rgba(52,48,42,0.32)"); grad.addColorStop(1, "rgba(52,48,42,0)");
    g.fillStyle = grad; g.fillRect(x, y, w, len);
  }
  plaster = new THREE.CanvasTexture(c);
  plaster.wrapS = plaster.wrapT = THREE.RepeatWrapping;
  plaster.colorSpace = THREE.NoColorSpace;
  plaster.anisotropy = 4;
  return plaster;
}
/** metres per plaster tile on homes */
export const PLASTER_TILE = 2.5;

/** world-space metres per texture tile */
export const CONCRETE_TILE = 6;

/**
 * Patches a MeshStandardMaterial so `texture` is sampled in world space from three axes (blended by the surface normal) and
 * multiplies the base colour. Works for plain and instanced meshes. Safe to call once per material; a material without a
 * texture (server render) is left as is.
 */
export function applyWorldTriplanar(material: THREE.MeshStandardMaterial, texture: THREE.Texture | null, tile = CONCRETE_TILE): THREE.MeshStandardMaterial {
  if (!texture) return material;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    shader.uniforms["uTriTex"] = { value: texture };
    shader.uniforms["uTriTile"] = { value: 1 / tile };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTriPos; varying vec3 vTriN;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
{
  vec4 wfWp = vec4(transformed, 1.0);
  vec3 wfN = objectNormal;
  #ifdef USE_INSTANCING
    wfWp = instanceMatrix * wfWp;
    wfN = mat3(instanceMatrix) * wfN;
  #endif
  vTriPos = (modelMatrix * wfWp).xyz;
  vTriN = normalize(mat3(modelMatrix) * wfN);
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D uTriTex; uniform float uTriTile; varying vec3 vTriPos; varying vec3 vTriN;")
      .replace("#include <map_fragment>", `#include <map_fragment>
{
  vec3 bw = pow(abs(normalize(vTriN)), vec3(4.0)); bw /= (bw.x + bw.y + bw.z + 1e-4);
  vec3 p = vTriPos * uTriTile;
  vec3 tri = texture2D(uTriTex, p.zy).rgb * bw.x + texture2D(uTriTex, p.xz).rgb * bw.y + texture2D(uTriTex, p.xy).rgb * bw.z;
  diffuseColor.rgb *= tri * 2.0;
}`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${key ? key() : ""}|triplanar-${tile}`;
  return material;
}

/* ---- house claddings (residences.ts Box.surface). Same ×2 convention as the plaster: a mid-grey canvas that multiplies the box's
 * paint colour, so one texture serves every house colour. Courses run along the texture's x with y up, which the triplanar
 * projection (zy / xy on walls) maps to level courses on every wall. Why: the homes all wore one plaster; owner wanted the towns to
 * read as real streets (Oct 27). */
export type Cladding = "plaster" | "brick" | "siding" | "shingle" | "stone";
/** metres per texture tile for each cladding (a 256 px tile) */
export const CLADDING_TILE: Record<Cladding, number> = { plaster: PLASTER_TILE, brick: 0.9, siding: 2.4, shingle: 2.0, stone: 2.2 };
const claddingCache: Partial<Record<Cladding, THREE.CanvasTexture | null>> = {};

export function claddingTexture(kind: Cladding): THREE.CanvasTexture | null {
  if (kind === "plaster") return weatheredPlasterTexture();
  if (kind in claddingCache) return claddingCache[kind] ?? null;
  if (typeof document === "undefined") return null;
  const size = 256;
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); if (!g) return null;
  let seed = { brick: 911, siding: 4243, shingle: 6151, stone: 3331 }[kind];
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const grey = (v: number, a = 1) => `rgba(${v},${v},${v},${a})`;
  if (kind === "brick") {
    // running bond: a 0.9 m tile = 12 courses of 75 mm (brick + joint), 4 bricks of 225 mm across; light mortar, each brick its own shade
    g.fillStyle = grey(168); g.fillRect(0, 0, size, size);
    const rows = 12, bh = size / rows, cols = 4, bw = size / cols, joint = 3;
    for (let r = 0; r < rows; r++) for (let k = -1; k < cols; k++) {
      const x = k * bw + (r % 2 ? bw / 2 : 0), v = 104 + Math.round(rnd() * 34);
      g.fillStyle = grey(v); g.fillRect(x + joint / 2, r * bh + joint / 2, bw - joint, bh - joint);
      g.fillStyle = grey(v - 14, 0.5); g.fillRect(x + joint / 2, r * bh + bh - joint, bw - joint, joint / 2); // lower lip shadow
    }
  } else if (kind === "siding") {
    // lap siding: 8 boards per 2.4 m tile; each board darkens toward its lower edge and casts a hard shadow line on the next
    const boards = 8, bh = size / boards;
    for (let b = 0; b < boards; b++) {
      const grad = g.createLinearGradient(0, b * bh, 0, b * bh + bh);
      const v = 136 + Math.round(rnd() * 8);
      grad.addColorStop(0, grey(v + 6)); grad.addColorStop(0.85, grey(v - 6)); grad.addColorStop(1, grey(84));
      g.fillStyle = grad; g.fillRect(0, b * bh, size, bh);
    }
    for (let i = 0; i < 90; i++) { g.fillStyle = grey(110, 0.12); g.fillRect(rnd() * size, rnd() * size, 18 + rnd() * 50, 1); } // grain
  } else if (kind === "shingle") {
    // asphalt shingles: staggered tabs with dark gaps and a shadow under each course
    g.fillStyle = grey(70); g.fillRect(0, 0, size, size);
    const rows = 10, rh = size / rows, tabs = 6, tw = size / tabs;
    for (let r = 0; r < rows; r++) for (let k = -1; k < tabs; k++) {
      const x = k * tw + (r % 2 ? tw / 2 : 0), v = 118 + Math.round(rnd() * 30);
      g.fillStyle = grey(v); g.fillRect(x + 1.5, r * rh, tw - 3, rh - 3);
      g.fillStyle = grey(60, 0.6); g.fillRect(x + 1.5, r * rh + rh - 5, tw - 3, 2);
    }
  } else {
    // stone foundation: irregular rectangular blocks in dark joints
    g.fillStyle = grey(78); g.fillRect(0, 0, size, size);
    let y = 0;
    while (y < size) {
      const h = 26 + Math.round(rnd() * 22); let x = -Math.round(rnd() * 40);
      while (x < size) { const w = 40 + Math.round(rnd() * 60), v = 112 + Math.round(rnd() * 40); g.fillStyle = grey(v); g.fillRect(x + 2, y + 2, w - 4, Math.min(h, size - y) - 4); x += w; }
      y += h;
    }
  }
  const img = g.getImageData(0, 0, size, size), px = img.data; // fine grain so no surface reads as flat paint
  for (let i = 0; i < px.length; i += 4) { const n = (rnd() - 0.5) * (kind === "siding" ? 10 : 22); px[i] = px[i]! + n; px[i + 1] = px[i + 1]! + n; px[i + 2] = px[i + 2]! + n; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  claddingCache[kind] = t;
  return t;
}
