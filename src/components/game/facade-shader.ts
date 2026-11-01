/**
 * Modern facades for box buildings, all in the fragment shader (owner, Nov 2026: the buildings "look like 1998 graphics").
 * The city's towers are instanced boxes; what made them read as old was flat colour walls, windows painted as flat
 * rectangles and blank ground floors. This adds, at no geometry cost:
 *
 *  - interior mapping: behind each window a real-looking room (floor, ceiling, side walls, back wall with furniture shapes,
 *    blinds), traced per pixel from the view ray, so rooms shift with parallax as you move. Rooms are lit warm/cool at night,
 *    dim by day;
 *  - real glass: the window panes become smooth dielectric, so they reflect the sky / city environment (Fresnel: strong at
 *    grazing angles, see-through head on), with a shadowed reveal at the head of each window;
 *  - weathering on the walls: large stains, dirt streaks washing down from each sill, per-panel tone and roughness variation;
 *  - shopfronts on ground floors (`mode` "shop"): stone piers, tall shop glass with a bright shop interior, a dark sign
 *    fascia with a lit strip — instead of a blank dark plinth.
 *
 * Wire it with `facadeMaterial(...)`; the window grid follows world space so it never stretches with the box.
 */
import * as THREE from "three";
import { streetTexture } from "./city-surface";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type FacadeLook = {
  color: string; glass: string; metal: number; rough: number;
  /** window bay width and storey height, m */
  cell: [number, number];
  /** window size as a fraction of the bay */
  win: [number, number];
  /** share of rooms lit at night */
  lit: number;
  /** wall weathering strength 0..1 */
  grime: number;
};

/** shared night level (0 day .. 1 night) for every facade material; owners update `.value` each frame */
export const facadeNight = { value: 0 };

const COMMON = /* glsl */ `
varying vec3 vWp; varying vec3 vWn; varying vec3 vObj; varying vec3 vScale;
uniform sampler2D uFacadeN; uniform vec3 uGlass; uniform vec2 uCell; uniform vec2 uWin; uniform float uLit; uniform float uNight; uniform float uGrime; uniform float uShop;
float fHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), u.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fFbm(vec2 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * fNoise(p); p *= 2.03; a *= 0.5; } return s; }
/* a room behind the glass: ray from the pane (p in metres within the bay, z = 0 at the glass) going d (z into the building) */
vec3 fRoom(vec2 p, vec3 d, vec2 size, float depth, float h, out float lightAmt) {
  vec3 o = vec3(p, 0.0);
  float tx = d.x > 0.0 ? (size.x - o.x) / d.x : -o.x / min(d.x, -1e-4);
  float ty = d.y > 0.0 ? (size.y - o.y) / d.y : -o.y / min(d.y, -1e-4);
  float tz = depth / max(d.z, 1e-4);
  float t = min(tx, min(ty, tz));
  vec3 q = o + d * t;
  // room palette from the room hash: warm offices, cool labs, a few coloured flats
  float hc = fract(h * 9.7);
  vec3 wall = hc < 0.45 ? vec3(0.58, 0.5, 0.42) : hc < 0.8 ? vec3(0.45, 0.5, 0.55) : hc < 0.92 ? vec3(0.32, 0.46, 0.48) : vec3(0.55, 0.38, 0.32);
  vec3 c;
  if (t == tz) {
    // back wall: a desk / sofa block and a picture or screen
    c = wall * 0.85;
    float seg = floor(q.x / size.x * 3.0 + h * 5.0);
    float furn = step(q.y, size.y * (0.22 + 0.16 * fHash(vec2(seg, h)))) * step(0.25, fHash(vec2(seg + 3.0, h)));
    c = mix(c, vec3(0.16, 0.14, 0.13) + 0.1 * fHash(vec2(seg, h * 3.0)), furn);
    float art = step(abs(q.x - size.x * (0.3 + 0.4 * fract(h * 3.1))), size.x * 0.12) * step(abs(q.y - size.y * 0.6), size.y * 0.1);
    c = mix(c, vec3(0.2, 0.35, 0.5) * (0.6 + fract(h * 17.0)), art * step(0.4, fract(h * 23.0)));
  } else if (t == ty) {
    // floor (dark, warm) or ceiling (pale, with a light panel)
    if (d.y < 0.0) {
      if (uShop > 0.5) {
        // a shop floor: pale tiles, with display counters standing on it
        float tile = mod(floor(q.x / 0.6) + floor(q.z / 0.6), 2.0);
        c = vec3(0.6, 0.58, 0.54) * (0.9 + 0.1 * tile);
        float counter = step(abs(fract(q.x / 1.8) - 0.5), 0.22) * step(abs(q.z - depth * 0.45), depth * 0.12);
        c = mix(c, vec3(0.3, 0.27, 0.24), counter);
      } else c = vec3(0.24, 0.2, 0.17) * (0.8 + 0.4 * fract(h * 31.0));
    }
    else { c = vec3(0.62, 0.62, 0.6); float panel = step(abs(q.x - size.x * 0.5), size.x * 0.22) * step(abs(q.z - depth * 0.5), depth * 0.15); c += panel * 0.55; }
  } else {
    c = wall * 0.72; // side walls, a touch darker
  }
  // light falls off toward the back of the room
  lightAmt = 1.0 - 0.45 * clamp(q.z / depth, 0.0, 1.0);
  return c;
}
`;

const VERT_DECL = "varying vec3 vWp; varying vec3 vWn; varying vec3 vObj; varying vec3 vScale;";
const VERT_BODY = `
#ifdef USE_INSTANCING
 mat4 wfIm = modelMatrix * instanceMatrix;
#else
 mat4 wfIm = modelMatrix;
#endif
 vWp = (wfIm * vec4(transformed, 1.0)).xyz; vWn = normalize(mat3(wfIm) * objectNormal);
 vObj = transformed; vScale = vec3(length(wfIm[0].xyz), length(wfIm[1].xyz), length(wfIm[2].xyz));`;

/* the per-pixel facade: sets wfGlass (pane mask), wfRoom (interior colour, linear) and adjusts the wall colour */
const FRAG_FACADE = /* glsl */ `
  float wfGlass = 0.0; vec3 wfRoom = vec3(0.0); float wfRoomLit = 0.0; float wfFres = 0.0;
  if (abs(vWn.y) < 0.5) {
    vec3 tng = normalize(vec3(-vWn.z, 0.0, vWn.x));
    float um = dot(vWp, tng), vm = vWp.y;
    vec3 V = normalize(vWp - cameraPosition);
    vec3 dRoom = vec3(dot(V, tng), V.y, -dot(V, vWn));
    wfFres = 0.04 + 0.96 * pow(1.0 - clamp(dot(-V, vWn), 0.0, 1.0), 5.0);
    // ---- wall weathering: broad stains, streaks under each sill, per-panel tone
    float stain = fFbm(vec2(um, vm) * 0.07);
    float streakCol = fNoise(vec2(um * 2.3, 0.0));
    float cellV = fract(vm / uCell.y);
    float streak = smoothstep(0.55, 0.95, streakCol) * smoothstep(0.62, 0.15, cellV) * 0.6;
    diffuseColor.rgb *= 1.0 - uGrime * (0.18 * smoothstep(0.35, 0.75, stain) + 0.16 * streak);
    diffuseColor.rgb *= 0.93 + 0.14 * fNoise(floor(vec2(um / (uCell.x * 2.0), vm / (uCell.y * 2.0))) + 7.0);
    if (uShop > 0.5) {
      // ---- ground floor shopfronts: bays of pier + glass, a fascia band over them
      float yb = (vObj.y + 0.5) * vScale.y - 0.5; // height above the pavement
      float bay = 5.2, bu = um / bay, bf = fract(bu), bid = floor(bu);
      float pier = 1.0 - step(0.09, bf) * step(bf, 0.91);
      float glassH = step(0.35, yb) * step(yb, 3.05);
      float fascia = step(3.15, yb) * step(yb, 3.95);
      float h = fHash(vec2(bid, floor(vWn.x * 3.0 + vWn.z * 7.0 + 11.0)));
      vec3 stone = vec3(0.56, 0.53, 0.48) * (0.85 + 0.3 * fFbm(vec2(um, vm) * 1.7));
      diffuseColor.rgb = mix(diffuseColor.rgb, stone, pier * step(yb, 3.95));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.065, 0.07), fascia * (1.0 - pier));
      // a lit sign strip in the fascia, in one of the shop colours
      vec3 signC = h < 0.25 ? vec3(1.0, 0.45, 0.2) : h < 0.5 ? vec3(0.25, 0.85, 1.0) : h < 0.75 ? vec3(1.0, 0.3, 0.6) : vec3(0.95, 0.9, 0.6);
      float sign = fascia * (1.0 - pier) * step(abs(yb - 3.55), 0.14) * step(abs(bf - 0.5), 0.3) * step(0.2, h);
      wfRoomLit += sign * 0.0;
      totalEmissiveRadiance += signC * sign * (0.6 + 2.4 * uNight);
      float pane = glassH * (1.0 - pier);
      if (pane > 0.5) {
        float la; vec2 pp = vec2((bf - 0.09) / 0.82 * bay * 0.82, yb - 0.35);
        vec3 room = fRoom(pp, normalize(dRoom), vec2(bay * 0.82, 2.7), 5.0, h, la);
        // shops are brightly lit day and night, and stocked: shelves of colour along the back
        room = mix(room, room * vec3(1.1, 1.0, 0.9) + 0.25 * signC * step(0.5, fract(pp.y * 2.2)), 0.35);
        wfGlass = 1.0; wfRoom = room * la; wfRoomLit = 0.2 + 0.14 * uNight; // lit shops, without burning out to white
        // mullion and door frame
        float mfr = fract(pp.x / 1.45), mdist = min(mfr, 1.0 - mfr) * 1.45; // metres to the nearest mullion
        float mull = 1.0 - step(0.035, mdist);
        wfGlass *= 1.0 - mull;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.09, 0.1), mull);
      }
    } else {
      // ---- upper floors: windows with rooms behind
      float u = um / uCell.x, v = vm / uCell.y;
      vec2 f = fract(vec2(u, v)), id = floor(vec2(u, v));
      float inside = step(abs(f.x - 0.5), uWin.x * 0.5) * step(abs(f.y - 0.55), uWin.y * 0.5);
      float outer = step(abs(f.x - 0.5), min(0.49, uWin.x * 0.5 + 0.045)) * step(abs(f.y - 0.55), min(0.49, uWin.y * 0.5 + 0.045));
      float frame = max(0.0, outer - inside);
      float seam = 1.0 - smoothstep(0.0, 0.025, min(f.y, 1.0 - f.y));
      float joint = 1.0 - smoothstep(0.0, 0.018, min(f.x, 1.0 - f.x));
      diffuseColor.rgb *= 1.0 - seam * 0.14 - joint * 0.1;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.06, 0.07), frame * 0.9);
      if (inside > 0.5) {
        float h = fHash(mod(id + floor(vWn.xz * 3.0 + 0.5) * 17.0, 1024.0));
        // pane position in metres from the bay's lower-left; the room spans the whole bay behind it
        vec2 pp = vec2(f.x * uCell.x, f.y * uCell.y);
        float la;
        vec3 room = fRoom(pp, normalize(dRoom), uCell, 4.5, h, la);
        // blinds drawn part way down in some rooms
        float wy = (f.y - (0.55 - uWin.y * 0.5)) / uWin.y; // 0 bottom of the pane .. 1 top
        float blind = step(1.0 - 0.7 * step(0.55, fract(h * 41.0)) * fract(h * 13.0), wy);
        room = mix(room, vec3(0.6, 0.58, 0.54) * (0.85 + 0.15 * step(0.5, fract(wy * 40.0))), blind);
        // the reveal: the head of the window is in shadow
        float reveal = smoothstep(0.86, 1.0, wy) * 0.6;
        float lit = step(h, uLit);
        vec3 tint = fract(h * 7.0) < 0.55 ? vec3(0.95, 0.97, 1.0) : fract(h * 7.0) < 0.9 ? vec3(1.0, 0.82, 0.6) : vec3(0.6, 0.9, 1.0);
        wfGlass = 1.0;
        wfRoom = room * tint * la * (1.0 - reveal);
        // by day rooms show dimly through the glass; at night lit rooms glow and unlit ones are near black
        wfRoomLit = mix(0.14, lit * (0.38 + 0.3 * fract(h * 13.0)), uNight);
        float mull = step(abs(f.x - 0.5), 0.008);
        wfGlass *= 1.0 - mull;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.08, 0.09), mull);
      }
    }
    // the pane itself: dark tinted glass (its look comes from reflections and the room behind)
    diffuseColor.rgb = mix(diffuseColor.rgb, uGlass * 0.25, wfGlass);
  }
`;

/* after the material's roughness/metalness are read: glass is smooth and non-metal, so it reflects the environment */
const FRAG_SURFACE = /* glsl */ `
  if (wfGlass > 0.5) { roughnessFactor = 0.035; metalnessFactor = 0.0; }
  else if (abs(vWn.y) < 0.5) { roughnessFactor = clamp(roughnessFactor * (0.85 + 0.3 * fNoise(vWp.xy * 0.6 + vWp.zy * 0.6)), 0.04, 1.0); }
`;

/* concrete / panel relief on the walls (public/textures/facade_nrm.jpg), in the facade's own plane, so the walls catch
   the light instead of reading as flat colour */
const FRAG_NORMAL = /* glsl */ `
  if (abs(vWn.y) < 0.5 && wfGlass < 0.5) {
    vec3 tn2 = normalize(vec3(-vWn.z, 0.0, vWn.x));
    vec2 fuv = vec2(dot(vWp, tn2), vWp.y) / 2.6;
    vec3 tn = texture2D(uFacadeN, fuv).xyz * 2.0 - 1.0;
    vec3 nw = normalize(tn2 * tn.x * 0.9 + vec3(0.0, 1.0, 0.0) * tn.y * 0.9 + vWn * max(tn.z, 0.2));
    normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
  }
`;

/* the room light through the glass (seen less at grazing angles, where the pane reflects instead), and by day the sky the
   pane reflects: a cool gradient, brighter toward the horizon and at grazing angles, broken up a little per pane so a tower
   reads as glass under the sky instead of a grid of lit rooms */
const FRAG_EMISSIVE = /* glsl */ `
  totalEmissiveRadiance += wfRoom * wfRoomLit * (1.0 - wfFres) * wfGlass;
  if (wfGlass > 0.5) {
    vec3 Vr = normalize(vWp - cameraPosition);
    float up = clamp(reflect(Vr, vWn).y * 0.5 + 0.5, 0.0, 1.0);
    vec3 sky = mix(vec3(0.62, 0.68, 0.74), vec3(0.36, 0.5, 0.66), up);
    float pane = 0.85 + 0.3 * fHash(floor(vec2(dot(vWp, normalize(vec3(-vWn.z, 0.0, vWn.x))) / uCell.x, vWp.y / uCell.y)));
    totalEmissiveRadiance += sky * (0.1 + 0.4 * wfFres) * pane * (1.0 - uNight);
  }
`;

/** a MeshStandardMaterial with the modern facade; roofs and floors (|n.y| > 0.5) stay plain */
export function facadeMaterial(look: FacadeLook, opts: { shop?: boolean; key: string }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: look.color, metalness: look.metal, roughness: look.rough });
  m.onBeforeCompile = (sh) => {
    sh.uniforms["uGlass"] = { value: new THREE.Color(look.glass) };
    sh.uniforms["uCell"] = { value: new THREE.Vector2(...look.cell) };
    sh.uniforms["uWin"] = { value: new THREE.Vector2(...look.win) };
    sh.uniforms["uLit"] = { value: look.lit };
    sh.uniforms["uGrime"] = { value: look.grime };
    sh.uniforms["uShop"] = { value: opts.shop ? 1 : 0 };
    sh.uniforms["uNight"] = facadeNight;
    sh.uniforms["uFacadeN"] = { value: streetTexture("/textures/facade_nrm.jpg", false) };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_DECL}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_BODY}`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${COMMON}`)
      .replace("#include <map_fragment>", `#include <map_fragment>\n${FRAG_FACADE}`)
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n${FRAG_SURFACE}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${FRAG_NORMAL}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`);
  };
  m.customProgramCacheKey = () => `wf-facade-${opts.key}`;
  return m;
}

/** awnings: striped canvas in the shop colour (instance colour) with a darker, shaded underside, instead of a flat slab */
export function awningMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0.0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vAwW; varying vec3 vAwN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n#ifdef USE_INSTANCING\n vAwW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vAwN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);\n#else\n vAwW = (modelMatrix * vec4(transformed, 1.0)).xyz; vAwN = normalize(mat3(modelMatrix) * objectNormal);\n#endif");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vAwW; varying vec3 vAwN;")
      .replace("#include <color_fragment>", `#include <color_fragment>
  float stripe = step(0.5, fract((vAwW.x + vAwW.z) * 1.4));
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(0.92, 0.9, 0.86), 0.75), stripe);
  diffuseColor.rgb *= vAwN.y < -0.5 ? 0.45 : 1.0; // the shaded underside
  diffuseColor.rgb *= 0.9 + 0.1 * fract(sin(dot(floor(vAwW.xz * 8.0), vec2(12.9, 78.2))) * 43758.5); // weave`);
  };
  m.customProgramCacheKey = () => "wf-awning";
  return m;
}

/**
 * A shop awning as one shape (width 1 along X, so instances scale X to the shopfront's length; depth out from the wall along +Z):
 * a canopy sloping down from the wall and a hanging valance across the front. Replaces the flat slab.
 */
export function awningGeometry(depth = 1.7, rise = 0.55): THREE.BufferGeometry {
  const len = Math.hypot(depth, rise), slope = Math.atan2(rise, depth);
  const canopy = new THREE.BoxGeometry(1, 0.035, len);
  canopy.rotateX(slope); // the front (+Z) edge drops
  const valance = new THREE.BoxGeometry(1, 0.3, 0.025);
  valance.translate(0, -rise / 2 - 0.15, depth / 2);
  const parts = [canopy, valance];
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

/**
 * A lit blade sign hanging off a shopfront (instance colour = the shop's colour): a dark metal frame and edges, and on both
 * faces a dark panel carrying a column of glowing glyph blocks and an inset neon outline, bright at night, softer by day.
 * Replaces the flat saturated slab. Unit box: thin along X, the sign faces are the +/-X faces.
 */
export function signMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35, metalness: 0.4 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms["uNight"] = facadeNight;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vSgUv; varying vec3 vSgN; varying float vSgSeed;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n vSgUv = uv; vSgN = normal;\n#ifdef USE_INSTANCING\n vSgSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);\n#else\n vSgSeed = 0.5;\n#endif");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
varying vec2 vSgUv; varying vec3 vSgN; varying float vSgSeed; uniform float uNight; float sgGlow = 0.0; vec3 sgTint = vec3(1.0);
float sgHash(vec2 p) { return fract(sin(dot(p, vec2(41.7, 289.3))) * 43758.5453); }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
  sgTint = diffuseColor.rgb;
  vec3 frameC = vec3(0.07, 0.075, 0.085);
  if (abs(vSgN.x) > 0.5) {
    vec2 u = vSgUv;
    float edge = min(min(u.x, 1.0 - u.x) * 0.9, min(u.y, 1.0 - u.y) * 2.4);
    float frame = 1.0 - step(0.07, edge);
    // an inset neon outline just inside the frame
    float outline = step(0.09, edge) * (1.0 - step(0.12, edge));
    // a column of glyphs: 4 bold characters down the sign, each a 2 x 3 grid of lit blocks picked by hash
    vec2 g = vec2((u.x - 0.18) / 0.64, (u.y - 0.08) / 0.84);
    float glyph = 0.0;
    if (g.x > 0.0 && g.x < 1.0 && g.y > 0.0 && g.y < 1.0) {
      float row = floor(g.y * 4.0); vec2 c = vec2(g.x, fract(g.y * 4.0));
      vec2 cell = floor(c * vec2(2.0, 3.0)); vec2 f = fract(c * vec2(2.0, 3.0));
      float on = step(0.42, sgHash(cell + row * 7.0 + vSgSeed * 97.0));
      glyph = on * step(0.12, f.x) * step(f.x, 0.88) * step(0.1, f.y) * step(f.y, 0.9) * step(0.1, c.y) * step(c.y, 0.9);
    }
    diffuseColor.rgb = mix(sgTint * 0.12, frameC, frame);
    sgGlow = max(glyph, outline * 0.8) * (1.0 - frame);
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(sgTint, vec3(1.0), 0.25), sgGlow * 0.6);
  } else {
    diffuseColor.rgb = frameC;
  }`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
  totalEmissiveRadiance += mix(sgTint, vec3(1.0), 0.2) * sgGlow * mix(0.9, 2.6, uNight);`);
  };
  m.customProgramCacheKey = () => "wf-sign";
  return m;
}
