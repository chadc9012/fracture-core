/**
 * GLSL for the operator head's skin material (operator-head.ts patches it into MeshStandardMaterial): the skin-tone retint,
 * taking the authored hair off the scalp for a chosen hairstyle (operator-styling.ts), and the markings — scars, tattoos,
 * stretch marks, Resonance traces — painted from shapes in head space.
 *
 * Head space: metres on a 1.85 m human, origin at the Head bone's rest position, the character facing +Z, its left at +X.
 * Marking shapes are given as points on or near the head's surface; the shader compares directions from the skull's centre,
 * so a shape lands on the surface of any face whether its cheek sits a few millimetres further out or in.
 *
 * Pure string building (no three.js), so the generated program can be checked in tests.
 */
import type { MarkingDef } from "./operator-styling.ts";

export type Vec3 = readonly [number, number, number];
type Shape = { kind: "line"; a: Vec3; b: Vec3; w: number } | { kind: "dot"; c: Vec3; r: number };
const line = (a: Vec3, b: Vec3, w: number): Shape => ({ kind: "line", a, b, w });
const dot = (c: Vec3, r: number): Shape => ({ kind: "dot", c, r });
/** a polyline of equal-width segments */
const path = (w: number, ...pts: Vec3[]): Shape[] => pts.slice(1).map((p, i) => line(pts[i]!, p, w));
/** the same shapes on the other side of the face */
const mirror = (shapes: Shape[]): Shape[] => shapes.map((s) => (s.kind === "line" ? line([-s.a[0], s.a[1], s.a[2]], [-s.b[0], s.b[1], s.b[2]], s.w) : dot([-s.c[0], s.c[1], s.c[2]], s.r)));

/** The skull as an ellipsoid in head space: hair geometry outside it is not the skull's own hair (ponytails, topknots). */
export const SKULL = { centre: [0, 0.09, -0.005] as Vec3, radii: [0.085, 0.11, 0.1] as Vec3 };

/** Shapes for every marking id in operator-styling.ts MARKINGS. Landmarks measured on the authored heads (head space): chin
 * (0, 0, 0.08), lips (0, 0.02, 0.088), nose tip (0, 0.04, 0.1), eyes (±0.03, 0.068, 0.078), brows (±0.03, 0.085, 0.082),
 * forehead (0, 0.11, 0.085), hairline y 0.125, cheeks (±0.065, 0.045, 0.045), temples (±0.07, 0.095, 0.03), jaw (±0.06, 0.025, 0.03),
 * neck sides (±0.045, -0.03…-0.1, 0). */
export const MARKING_SHAPES: Readonly<Record<string, Shape[]>> = {
  "scar-cheek": path(0.0035, [0.07, 0.062, 0.03], [0.06, 0.042, 0.06], [0.042, 0.02, 0.076]),
  "scar-eye": path(0.0032, [-0.034, 0.1, 0.078], [-0.04, 0.072, 0.08], [-0.046, 0.042, 0.072]),
  "scar-brow": path(0.0028, [0.02, 0.095, 0.082], [0.03, 0.08, 0.082]),
  "scar-jaw": path(0.003, [-0.066, 0.035, 0.025], [-0.05, 0.008, 0.058], [-0.025, -0.002, 0.076]),
  "scar-lip": path(0.0026, [0.008, 0.034, 0.088], [0.006, 0.014, 0.09]),
  "scar-neck": path(0.0035, [0.05, -0.02, 0.025], [0.04, -0.045, 0.05], [0.015, -0.06, 0.06]),
  "scar-nose": path(0.0028, [-0.014, 0.075, 0.09], [0.016, 0.068, 0.09]),
  "tattoo-tribal": [...path(0.0045, [0.07, 0.095, 0.025], [0.074, 0.068, 0.035], [0.066, 0.045, 0.055], [0.05, 0.03, 0.072]),
    ...path(0.003, [0.075, 0.08, 0.018], [0.07, 0.055, 0.042], [0.058, 0.04, 0.062]),
    ...path(0.0035, [0.068, 0.032, 0.048], [0.06, 0.016, 0.062])],
  "tattoo-temple": [...path(0.0016, [-0.072, 0.11, 0.028], [-0.07, 0.072, 0.033]), ...path(0.0016, [-0.077, 0.107, 0.018], [-0.074, 0.07, 0.022]),
    ...path(0.0016, [-0.08, 0.103, 0.008], [-0.078, 0.068, 0.012])],
  "tattoo-tears": [dot([0.036, 0.052, 0.078], 0.0022), dot([0.04, 0.042, 0.074], 0.0019), dot([0.043, 0.033, 0.07], 0.0016)],
  "tattoo-collar": path(0.006, [0.05, -0.045, 0.02], [0.03, -0.05, 0.05], [0, -0.052, 0.06], [-0.03, -0.05, 0.05], [-0.05, -0.045, 0.02], [-0.045, -0.045, -0.02], [0, -0.045, -0.04], [0.045, -0.045, -0.02], [0.05, -0.045, 0.02]),
  "tattoo-neck": [...path(0.002, [0.045, -0.015, 0.03], [0.047, -0.085, 0.025]), ...path(0.002, [0.052, -0.02, 0.012], [0.053, -0.09, 0.008]),
    ...path(0.002, [0.038, -0.03, 0.045], [0.04, -0.08, 0.04])],
  "tattoo-chin": [...path(0.0024, [0, 0.01, 0.088], [0, -0.012, 0.08]), ...path(0.0018, [0.008, 0.009, 0.087], [0.009, -0.01, 0.079]),
    ...path(0.0018, [-0.008, 0.009, 0.087], [-0.009, -0.01, 0.079])],
  "tattoo-forehead": path(0.0022, [-0.06, 0.1, 0.05], [-0.03, 0.104, 0.074], [0, 0.105, 0.082], [0.03, 0.104, 0.074], [0.06, 0.1, 0.05]),
  "stretch-neck": [...[-0.014, -0.004, 0.006, 0.016].flatMap((dz) => path(0.0014, [0.046, -0.025, dz], [0.05, -0.075, dz - 0.004])),
    ...[-0.014, -0.004, 0.006, 0.016].flatMap((dz) => path(0.0014, [-0.046, -0.025, dz], [-0.05, -0.075, dz - 0.004]))],
  "stretch-jaw": [...[-0.03, -0.015, 0, 0.015, 0.03].flatMap((dx) => path(0.0013, [dx, 0.004, 0.065], [dx * 1.2, -0.02, 0.052]))],
  "burn-cheek": [dot([-0.064, 0.048, 0.05], 0.02), dot([-0.058, 0.028, 0.064], 0.014), dot([-0.07, 0.068, 0.034], 0.012)],
  "resonance-temple": [...path(0.0016, [0.074, 0.108, 0.022], [0.074, 0.085, 0.032], [0.068, 0.078, 0.048]), ...path(0.0016, [0.078, 0.095, 0.012], [0.072, 0.062, 0.038]),
    dot([0.074, 0.085, 0.032], 0.003), dot([0.072, 0.062, 0.038], 0.0026)],
  "resonance-neck": [...path(0.0015, [0.03, -0.015, 0.05], [0.032, -0.06, 0.048], [0.036, -0.062, 0.04], [0.038, -0.095, 0.035]), dot([0.032, -0.06, 0.048], 0.0026)],
};

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);
const v3 = (v: Vec3) => `vec3(${f(v[0])}, ${f(v[1])}, ${f(v[2])})`;

/** How the authored hair on the scalp is treated: 0 keep, 1 recolour to skin (bald), 2 recolour to the chosen hair colour. */
export type HairMode = 0 | 1 | 2;

export const SKIN_UNIFORMS = "uniform vec3 wfSkin; uniform float wfSkinLum; uniform vec3 wfHead; uniform float wfUnit; uniform vec3 wfHair; uniform int wfHairMode; uniform vec3 wfBald;\nvarying vec3 wfRest;\nfloat wfGlow = 0.0;";

export const VERTEX_REST = "varying vec3 wfRest;";
/** the bind-space (unskinned) position, so shapes stay put while the head animates */
export const VERTEX_REST_ASSIGN = "wfRest = position;";

/** GLSL helpers: direction-space mapping and distances */
const HELPERS = `
vec3 wfMap(vec3 v) { return normalize((v - ${v3(SKULL.centre)}) / ${v3(SKULL.radii)}) * 0.1; }
float wfLine(vec3 q, vec3 a, vec3 b, float w) {
  vec3 ma = wfMap(a), mb = wfMap(b), ab = mb - ma;
  float t = clamp(dot(q - ma, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return 1.0 - smoothstep(w, w + 0.0025, length(q - (ma + ab * t)));
}
float wfDot(vec3 q, vec3 c, float r) { return 1.0 - smoothstep(r, r + 0.004, length(q - wfMap(c))); }
float wfHash(vec3 q) { return fract(sin(dot(q, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
`;

function markingCode(m: MarkingDef): string {
  const shapes = MARKING_SHAPES[m.id];
  if (!shapes) return "";
  const terms = shapes.map((s) => (s.kind === "line" ? `wfLine(q, ${v3(s.a)}, ${v3(s.b)}, ${f(s.w)})` : `wfDot(q, ${v3(s.c)}, ${f(s.r)})`));
  const alpha = terms.reduce((acc, t) => (acc ? `max(${acc}, ${t})` : t), "");
  switch (m.kind) {
    case "scar":
      if (m.id.startsWith("burn")) {
        // mottled, darker, desaturated and reddened; the edge breaks up with noise
        return `{ float a = ${alpha}; a *= 0.55 + 0.45 * wfHash(floor(q * 400.0)); vec3 g = vec3(dot(c, vec3(0.3, 0.59, 0.11)));
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(g, c, 0.45) * vec3(0.95, 0.68, 0.62), a * 0.8); }`;
      }
      // a healed cut: paler raised ridge with a darker seam down the middle
      return `{ float a = ${alpha}; vec3 ridge = c * vec3(1.14, 0.98, 0.95) + 0.035;
  diffuseColor.rgb = mix(diffuseColor.rgb, ridge, a); diffuseColor.rgb = mix(diffuseColor.rgb, c * vec3(0.78, 0.5, 0.48), smoothstep(0.55, 1.0, a) * 0.55); }`;
    case "stretch":
      // fine pale streaks, slightly silvered
      return `{ float a = ${alpha} * (0.7 + 0.3 * wfHash(floor(q * 900.0))); vec3 g = vec3(dot(c, vec3(0.3, 0.59, 0.11)));
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(c, g, 0.5) * 1.22 + 0.03, a * 0.6); }`;
    case "tattoo":
      return `{ float a = ${alpha}; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.065, 0.085) * (0.6 + 0.4 * c.r / max(wfSkinLum, 0.02)), a * 0.88); }`;
    case "resonance":
      return `{ float a = ${alpha}; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.5, 0.6), a * 0.7); wfGlow = max(wfGlow, a); }`;
  }
}

/** The fragment code inserted after <map_fragment>: skin retint, hair treatment, markings. */
export function skinFragment(marks: readonly MarkingDef[]): string {
  return `{
  vec3 c = diffuseColor.rgb;
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  float sat = (mx - mn) / (mx + 1e-4);
  // skin: warm (red over blue, green between), moderately saturated, not near-black (hair, brows) or vivid (a red scarf, lips)
  float k = smoothstep(0.015, 0.05, c.r - c.b) * smoothstep(0.12, 0.25, sat) * (1.0 - smoothstep(0.78, 0.9, sat))
    * smoothstep(0.012, 0.035, l) * step(c.b, c.g + 0.04);
  vec3 p = (wfRest - wfHead) / wfUnit;
  if (wfSkinLum > 0.0 && wfSkin.r + wfSkin.g + wfSkin.b > 0.0) {
    vec3 tone = wfSkin * clamp(l / wfSkinLum, 0.0, 2.2);
    diffuseColor.rgb = mix(c, tone, k);
  }
  if (wfHairMode > 0) {
    // the head's own hair: whatever isn't skin-coloured, or is far darker than this face's skin (dark hair reads as skin to
    // the colour test), anywhere above the jaw except the face itself (eyes, brows, lips, beard, goggles) and the ears. The
    // authored heads have no scalp under their hair, so the hair is cut away and operator-head.ts closes the skull with a
    // skin-toned cap under the chosen style (or bare, for bald).
    // hair-like: far darker than this face's skin, or neither skin-coloured nor vivid (a scarf or collar is vivid)
    float notSkin = max(1.0 - smoothstep(0.35, 0.55, l / max(wfSkinLum, 0.02)), (1.0 - k) * (1.0 - smoothstep(0.3, 0.45, sat)));
    float face = step(0.03, p.z) * step(p.y, 0.098) * step(abs(p.x), 0.058);
    float ears = step(0.05, abs(p.x)) * step(0.035, p.y) * step(p.y, 0.1) * step(-0.035, p.z) * step(p.z, 0.025) * smoothstep(0.2, 0.4, k);
    float neck = step(p.y, 0.045) * step(length(vec2(p.x, p.z + 0.02)), 0.062); // the neck column and the collar on it
    float scalp = notSkin * smoothstep(0.0, 0.015, p.y) * (1.0 - max(face, max(ears, neck)));
    if (scalp > 0.35) discard;
    // hair left on the face above the brows (a fringe over the forehead, the hair by the ears) takes the style's colour, or
    // skin for bald; the brows, eyes and lips keep their own
    float kept = notSkin * step(0.098, p.y) * max(face, ears);
    vec3 hairTone = wfHairMode == 1 ? wfBald * clamp(l / 0.05, 0.6, 1.3) : wfHair * clamp(l / 0.06, 0.3, 1.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, hairTone, max(scalp / 0.35, kept));
  }
  c = diffuseColor.rgb;
  vec3 q = wfMap(p);
${marks.map(markingCode).filter(Boolean).join("\n")}
}`;
}

export const EMISSIVE_GLOW = "totalEmissiveRadiance += vec3(0.15, 0.85, 1.0) * wfGlow * 1.6;";

export type SkinProgram = { vertexDecl: string; vertexAssign: string; fragmentDecl: string; fragmentBody: string; emissive: string; key: string };

/** Everything operator-head.ts splices into the material's shaders, plus a cache key for the program. */
export function skinProgram(opts: { skinHex: string; skinLum: number; hairMode: HairMode; hairHex: string; marks: readonly MarkingDef[] }): SkinProgram {
  return {
    vertexDecl: VERTEX_REST,
    vertexAssign: VERTEX_REST_ASSIGN,
    fragmentDecl: `${SKIN_UNIFORMS}\n${HELPERS}`,
    fragmentBody: skinFragment(opts.marks),
    emissive: EMISSIVE_GLOW,
    key: `operator-skin|${opts.skinHex}|${opts.skinLum}|${opts.hairMode}|${opts.hairHex}|${opts.marks.map((m) => m.id).join(",")}`,
  };
}
