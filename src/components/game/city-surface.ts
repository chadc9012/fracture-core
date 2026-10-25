import * as THREE from "three";

/**
 * City street surface (public/textures, scripts/build-textures.py): asphalt with aggregate, tar seams, patches and cracks
 * on the carriageways, offset concrete pavers on the sidewalks and lots, painted markings — a dashed centre line, solid
 * edge lines and a dark gutter at the kerb — all decided in world space from the district's street grid (the zebra
 * crossings, stop lines and kerbs are geometry from src/game/city-streets.ts, CityStreets.tsx), so one draped mesh carries the whole city in a single draw call. Asphalt is a little glossy so
 * street lights and neon smear across it at night like the trailer's wet streets.
 *
 * Grid: block centres at `center + k * pitch`; a block is `block` metres square, streets fill the rest.
 */
export type StreetGrid = { cx: number; cz: number; pitch: number; block: number; /** sidewalk band inside the block edge */ walk: number; wet?: number };

const loader = typeof document !== "undefined" ? new THREE.TextureLoader() : null;
const cache = new Map<string, THREE.Texture>();
export function streetTexture(url: string, color: boolean): THREE.Texture | null {
  if (!loader) return null;
  let t = cache.get(url);
  if (!t) {
    t = loader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    cache.set(url, t);
  }
  return t;
}

export function cityStreetMaterial(grid: StreetGrid): THREE.MeshStandardMaterial {
  const asphalt = streetTexture("/textures/asphalt_col.jpg", true), asphaltN = streetTexture("/textures/asphalt_nrm.jpg", false), asphaltR = streetTexture("/textures/asphalt_rough.jpg", false);
  const pav = streetTexture("/textures/pavers_col.jpg", true), pavN = streetTexture("/textures/pavers_nrm.jpg", false), pavR = streetTexture("/textures/pavers_rough.jpg", false);
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, metalness: 0.02, map: asphalt, normalMap: asphaltN, roughnessMap: asphaltR, normalScale: new THREE.Vector2(1, 1), polygonOffset: true, polygonOffsetFactor: -1 });
  if (!asphalt || !pav) return m;
  const wet = grid.wet ?? 0.35;
  m.customProgramCacheKey = () => `city-street|${grid.pitch}|${grid.block}|${grid.walk}|${wet}`;
  m.onBeforeCompile = (sh) => {
    sh.uniforms["uPav"] = { value: pav }; sh.uniforms["uPavN"] = { value: pavN }; sh.uniforms["uPavR"] = { value: pavR };
    sh.uniforms["uGrid"] = { value: new THREE.Vector4(grid.cx, grid.cz, grid.pitch, grid.block / 2) };
    sh.uniforms["uWalk"] = { value: grid.walk };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCityW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCityW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vCityW; uniform sampler2D uPav; uniform sampler2D uPavN; uniform sampler2D uPavR; uniform vec4 uGrid; uniform float uWalk;
float cityStreet; float cityPaint; vec2 cityPavUv;`)
      .replace("#include <map_fragment>", `#include <map_fragment>
{
  vec2 c = (fract((vCityW.xz - uGrid.xy) / uGrid.z + 0.5) - 0.5) * uGrid.z;   // offset from the nearest block centre
  vec2 a = abs(c);
  float half_ = uGrid.w;
  cityStreet = max(step(half_, a.x), step(half_, a.y));
  cityPavUv = vCityW.xz / 4.0;
  vec3 pavers = texture2D(uPav, cityPavUv).rgb;
  // kerb gutter: a dark wet strip along the block edge on the street side
  float gutter = cityStreet * (1.0 - smoothstep(0.0, 0.45, min(abs(a.x - half_), abs(a.y - half_)) ));
  float mid = uGrid.z * 0.5;
  float inX = step(half_, a.x) * (1.0 - step(half_, a.y)); // street running along z
  float inZ = step(half_, a.y) * (1.0 - step(half_, a.x)); // street running along x
  float cross_ = step(half_, a.x) * step(half_, a.y);      // intersection
  // dashed centre lines (3 m dash, 3 m gap) and solid edge lines 0.6 m off the kerb
  float dashZ = step(0.5, fract(vCityW.z / 6.0)), dashX = step(0.5, fract(vCityW.x / 6.0));
  float centre = inX * (1.0 - smoothstep(0.06, 0.1, abs(a.x - mid))) * dashZ + inZ * (1.0 - smoothstep(0.06, 0.1, abs(a.y - mid))) * dashX;
  float edge = inX * (1.0 - smoothstep(0.05, 0.09, abs(a.x - half_ - 0.6))) + inZ * (1.0 - smoothstep(0.05, 0.09, abs(a.y - half_ - 0.6)));
  // painted lines wear: break them up with the asphalt's own aggregate
  float wear = smoothstep(0.12, 0.22, diffuseColor.r);
  // Subtle aggregate breakup and repaired asphalt panels in world coordinates.
  float patchCell = fract(sin(dot(floor(vCityW.xz / 7.0), vec2(127.1, 311.7))) * 43758.5453);
  float patched = step(0.84, patchCell) * cityStreet * (1.0 - cross_);
  float asphaltVariation = 0.965 + 0.035 * sin(vCityW.x * 1.7) * sin(vCityW.z * 1.3);
  cityPaint = clamp(centre + edge, 0.0, 1.0) * (0.75 + 0.25 * wear);
  vec3 street = diffuseColor.rgb * asphaltVariation * (1.0 - gutter * 0.35) * (1.0 - patched * 0.075);
  street = mix(street, vec3(0.78, 0.76, 0.7), cityPaint * (1.0 - cross_ * 0.0));
  street = mix(street, vec3(0.85, 0.66, 0.2), centre * 0.0);
  diffuseColor.rgb = mix(pavers, street, cityStreet);
}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = mix(texture2D(uPavR, cityPavUv).g, roughnessFactor * ${(1 - wet).toFixed(2)} + ${(wet * 0.25).toFixed(2)}, cityStreet);
roughnessFactor = mix(roughnessFactor, 0.6, cityPaint);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
if (cityStreet < 0.5) {
  vec3 pn = texture2D(uPavN, cityPavUv).xyz * 2.0 - 1.0;
  mat3 ptbn = getTangentFrame(-vViewPosition, nonPerturbedNormal, cityPavUv);
  normal = normalize(ptbn * pn);
}`);
  };
  return m;
}

/** Neon City's plateau asphalt (NeonCity.tsx): the same aggregate, seams and cracks as the Nexus carriageways, tiled every
 * 8 m across the disc and kept dark and glossy (acid rain), so the lane paint and puddles (CityStreets.tsx) sit on a real
 * road surface instead of a flat colour. `diameter` is the disc's, metres. */
export function wetAsphaltMaterial(diameter: number): THREE.MeshStandardMaterial {
  const rep = (t: THREE.Texture | null) => {
    if (!t) return null;
    const c = t.clone(); c.repeat.set(diameter / 8, diameter / 8); c.needsUpdate = true;
    return c;
  };
  return new THREE.MeshStandardMaterial({
    color: "#4c3f60", roughness: 0.3, metalness: 0.38,
    map: rep(streetTexture("/textures/asphalt_col.jpg", true)), normalMap: rep(streetTexture("/textures/asphalt_nrm.jpg", false)), normalScale: new THREE.Vector2(0.8, 0.8),
  });
}
