import * as THREE from "three";
import { getPerfTier } from "@/game/perf-budget";

/**
 * Lived-in surfaces for the authored fleet (owner, Nov 2026: vehicles "look like 1998 graphics"). The fleet is built from
 * flat-coloured parts with no textures, so every panel read as one even colour. This adds, in the material's own shader:
 *
 *  - the baked occlusion (scripts/bake-fleet-ao.py, the glTF occlusion texture) darkening creases, arches and grilles, and
 *    grime gathering in them;
 *  - road dirt: mud and dust rising from the sills and wheels, thinning out by the waist line;
 *  - a little dust settled on the upward faces (roof, bonnet, deck);
 *  - rust patches on the rusted steel parts, and per-panel roughness variation everywhere, so reflections break up
 *    the way they do on real paint and metal instead of sliding evenly over a flat plastic surface.
 *
 * It works in the model's own space (metres from its origin, which sits on the ground), so a parked copy, a traffic instance
 * (InstancedGlb merges parts into the model's rest space) and the driven car all wear the same dirt in the same places.
 */
export type SurfaceKind = "paint" | "metal" | "rust" | "trim" | "rubber" | "glass" | "lamp";

export function surfaceKindOf(name: string): SurfaceKind {
  const n = name.toLowerCase();
  if (/light|lamp|accent|eye|crystal|navgreen|underglow|glow|holo|beacon|neon|sign/.test(n)) return "lamp";
  if (/glass|window|visor/.test(n)) return "glass";
  if (/rust/.test(n)) return "rust";
  if (/rubber|tyre|tire/.test(n)) return "rubber";
  if (/steel|chrome|metal|rim/.test(n)) return "metal";
  if (/paint|body|plate/.test(n)) return "paint";
  return "trim"; // SatinBlack, Trim, Interior and the rest
}

/** how much of each effect a surface takes: [cavity grime, road dirt, dust, rust, roughness variation] */
const AMOUNT: Record<SurfaceKind, [number, number, number, number, number]> = {
  paint: [0.75, 0.75, 0.45, 0, 0.45],
  metal: [0.9, 0.85, 0.35, 0.12, 0.6],
  rust: [1, 0.9, 0.3, 1, 0.5],
  trim: [0.8, 0.8, 0.3, 0, 0.4],
  rubber: [0.5, 1, 0.5, 0, 0.25],
  glass: [0.3, 0.25, 0.25, 0, 0.1],
  lamp: [0, 0, 0, 0, 0],
};

/** how worn a model is, 0..1: city cars are kept fairly clean, wasteland rigs and war machines are filthy */
const WEAR: Record<string, number> = {
  "luxury-sedan": 0.3, "city-pod": 0.3, "hover-car": 0.3, "security-suv": 0.4, "tuner": 0.4, "street-racer": 0.25, "muscle-car": 0.3,
  "vanguard-jet": 0.35, "void-skimmer": 0.3, "aether-hoverbike": 0.35, "ai-interceptor": 0.35,
  "tech-transport": 0.65, "rift-helicopter": 0.55, "hydro-sub-skiff": 0.5, "leviathan": 0.6,
  "armored-muscle": 1, "offroad-truck": 0.95, "raider-buggy": 1, "war-rig": 1, "goliath-tank": 0.9, "fracture-behemoth": 0.9, "scrap-patrol-boat": 1,
};
/** wear for a fleet model id or url (unknown models sit in the middle) */
export const wearOf = (idOrUrl: string): number => {
  const id = idOrUrl.replace(/^.*\//, "").replace(/(-lod)?\.glb$/, "");
  return WEAR[id] ?? 0.6;
};

const PARS = /* glsl */ `
varying vec3 vVsObj; varying vec3 vVsN;
uniform vec4 uVsAmt; uniform float uVsRust; uniform float uVsMudTop; uniform float uVsWear;
float vsHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vsNoise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(vsHash(i), vsHash(i + vec3(1,0,0)), f.x), mix(vsHash(i + vec3(0,1,0)), vsHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(vsHash(i + vec3(0,0,1)), vsHash(i + vec3(1,0,1)), f.x), mix(vsHash(i + vec3(0,1,1)), vsHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float vsFbm(vec3 p) { float a = 0.5, s = 0.0; for (int k = 0; k < VS_OCT; k++) { s += a * vsNoise(p); p *= 2.07; a *= 0.5; } return s / (1.0 - pow(0.5, float(VS_OCT))) * 0.9375; }
`;

const FRAG_COLOR = /* glsl */ `
  float vsAo = 1.0;
#ifdef USE_AOMAP
  vsAo = texture2D(aoMap, vAoMapUv).r;
#endif
  float vsN1 = vsFbm(vVsObj * 2.3);
  float vsN2 = vsFbm(vVsObj * 7.1 + 3.7);
  // grime settles in the creases the bake found
  float vsCav = smoothstep(0.9, 0.35, vsAo) * uVsAmt.x * (0.55 + 0.45 * uVsWear);
  // road dirt: thick at the sills and arches, patchy, thinning out toward the waist line
  float vsLow = smoothstep(uVsMudTop, 0.05, vVsObj.y);
  float vsMud = vsLow * smoothstep(0.32, 0.62, vsFbm(vec3(vVsObj.x * 1.6, vVsObj.y * 5.0, vVsObj.z * 1.6))) * uVsAmt.y * uVsWear;
  // dust on the upward faces
  float vsDust = smoothstep(0.55, 0.95, vVsN.y) * smoothstep(0.45, 0.8, vsN1) * uVsAmt.z * uVsWear;
  vec3 vsDirt = vec3(0.21, 0.18, 0.14);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45 + vsDirt * 0.25, vsCav * 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, vsDirt * (0.8 + 0.4 * vsN2), clamp(vsMud, 0.0, 0.85));
  // dust is a thin film: it greys the colour toward the dust tone rather than painting pale blotches over dark paint
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(0.42, 0.38, 0.32), 0.5), vsDust * 0.4);
  // rust: orange-brown blooms with dark pitting
  float vsR = smoothstep(0.42, 0.68, vsFbm(vVsObj * 3.3 + 11.0)) * uVsRust * (0.4 + 0.6 * uVsWear);
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.36, 0.16, 0.07), vec3(0.18, 0.08, 0.04), vsN2), vsR);
  // a faint tonal break-up so a panel is never one flat colour
  diffuseColor.rgb *= 0.94 + 0.12 * vsN1;
  float vsRough = clamp(vsMud + vsDust * 0.6 + vsCav * 0.4 + vsR, 0.0, 1.0);
`;

const FRAG_ROUGH = /* glsl */ `
  roughnessFactor = clamp(roughnessFactor * (1.0 + uVsAmt.w * (vsN2 - 0.5)) , 0.03, 1.0);
  roughnessFactor = mix(roughnessFactor, 0.92, vsRough);
  roughnessFactor = min(1.0, roughnessFactor + uVsAmt.w * 0.35 * uVsWear * uVsWear); // weathered paint and metal go flat
  // field machines (tanks, rigs, buggies) wear satin military paint, not a showroom gloss (glass keeps its shine)
  roughnessFactor = max(roughnessFactor, 0.68 * smoothstep(0.6, 1.0, uVsWear) * step(0.2, uVsAmt.w));
`;

const FRAG_COAT = /* glsl */ `
#ifdef USE_CLEARCOAT
  // worn machines lose their lacquer: a war rig is satin, a city sedan keeps its gloss
  material.clearcoat *= (1.0 - clamp(vsRough * 1.2, 0.0, 1.0)) * (1.0 - 0.75 * uVsWear);
#endif
`;

const done = new WeakSet<THREE.Material>();

/** add the lived-in surface to one material (in place; shared materials are fine: every user gets the same look) */
export function vehicleSurface(mat: THREE.Material, wear = 0.6, kind: SurfaceKind = surfaceKindOf(mat.name)): THREE.Material {
  if (!(mat instanceof THREE.MeshStandardMaterial) || done.has(mat) || kind === "lamp") return mat;
  done.add(mat);
  const [cav, mud, dust, rust, rough] = AMOUNT[kind];
  if (mat.aoMap) mat.aoMapIntensity = 1;
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    // noise layers: two on the LOW tier (phones), four above
    sh.defines = { ...(sh.defines ?? {}), VS_OCT: getPerfTier() === "LOW" ? 2 : 4 };
    sh.uniforms["uVsAmt"] = { value: new THREE.Vector4(cav, mud, dust, rough) };
    sh.uniforms["uVsRust"] = { value: rust };
    sh.uniforms["uVsMudTop"] = { value: 0.85 };
    sh.uniforms["uVsWear"] = { value: wear };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vVsObj; varying vec3 vVsN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvVsObj = transformed; vVsN = normalize(objectNormal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${PARS}`)
      .replace("#include <map_fragment>", `#include <map_fragment>\n${FRAG_COLOR}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`)
      .replace("#include <lights_physical_fragment>", `#include <lights_physical_fragment>\n${FRAG_COAT}`);
  };
  mat.customProgramCacheKey = () => `${prevKey()}|vsurf-${kind}-${getPerfTier() === "LOW" ? 2 : 4}`;
  mat.needsUpdate = true;
  return mat;
}

/** every material under a vehicle model */
export function applyVehicleSurface(root: THREE.Object3D, wear = 0.6) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) vehicleSurface(mat, wear);
  });
}
