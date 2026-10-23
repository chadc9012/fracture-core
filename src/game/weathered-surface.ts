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
