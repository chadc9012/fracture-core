/** Operator colorway (pure parameters + the shader snippet that applies them) for the authored operator bodies.
 *
 * NYX, GOLIATH and CIPHER ship as authored GLBs with one baked texture (OPERATOR_MODELS `tint: false`), so the procedural
 * paint path never ran on them and the appearance colours chosen in the forge or the Character menu changed nothing on screen.
 * The colorway recolours that texture by what each texel is: neutral, mid-tone plate shifts toward the armor colour (keeping
 * its own light and dark, so seams, wear and shading stay), and saturated bright accent lines (glow strips, visor) take the
 * accent hue and glow in it. Nothing else changes: no stats, no geometry. The operator's own signature preset means "as
 * authored": colorwayFor returns null, so a default operator looks exactly like the art.
 * recolorTexel is the CPU mirror of COLORWAY_GLSL, kept for tests. */
import { appearanceById, operatorByClass, type AppearanceDefinition, type ClassId } from "./loadout";

export type RGB = [number, number, number];
export type Colorway = { armor: RGB; accent: RGB; plate: number; glow: number };

export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** how strongly plate and accents follow the chosen colours (0..1) */
export const PLATE_STRENGTH = 0.65, GLOW_STRENGTH = 0.9;

export function colorwayFor(classId: ClassId, appearance: Pick<AppearanceDefinition, "armor" | "visor">): Colorway | null {
  const preset = appearanceById(operatorByClass(classId).appearanceId);
  const plateChanged = !same(appearance.armor, preset.armor), accentChanged = !same(appearance.visor, preset.visor);
  if (!plateChanged && !accentChanged) return null;
  return { armor: hexToRgb(appearance.armor), accent: hexToRgb(appearance.visor), plate: plateChanged ? PLATE_STRENGTH : 0, glow: accentChanged ? GLOW_STRENGTH : 0 };
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** CPU mirror of the shader (display space): coloured texels take the accent hue with their own saturation and value;
 * neutral texels take the armor colour, lifted a little toward its brightness so dark suits still read the colour; near-white
 * highlights are left alone. Returns the colour and how much it glows. */
export function recolorTexel(c: RGB, w: Colorway): { color: RGB; glow: number } {
  const mx = Math.max(...c), mn = Math.min(...c), s = (mx - mn) / Math.max(mx, 1e-4);
  const hueMask = smooth(0.12, 0.3, s) * smooth(0.08, 0.2, mx);
  const amax = Math.max(...w.accent, 1e-4);
  const hue = w.accent.map((v) => mx * (1 - s * (1 - v / amax))) as RGB;
  let out = c.map((v, i) => v + (hue[i]! - v) * hueMask * w.glow) as RGB;
  const plateMask = (1 - hueMask) * (1 - smooth(0.85, 0.97, mx));
  const av = Math.max(...w.armor, 1e-4);
  const value = Math.max(mx, mx + (av * 0.55 - mx) * 0.35);
  const plate = w.armor.map((v) => value * (v / av)) as RGB;
  out = out.map((v, i) => v + (plate[i]! - v) * plateMask * w.plate) as RGB;
  return { color: out, glow: hueMask * smooth(0.35, 0.6, mx) * w.glow * 0.5 };
}

/** fragment snippets injected into the authored body's MeshStandardMaterial (onBeforeCompile) */
export const COLORWAY_UNIFORMS = "uniform vec3 wfArmor;\nuniform vec3 wfAccent;\nuniform float wfPlate;\nuniform float wfGlow;\nfloat wfAccentMask;";
export const COLORWAY_MAP = `
{
  // the texture arrives linear; the masks and the recolour work in display (sRGB-like) space, matching recolorTexel
  vec3 c = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  float s = (mx - mn) / max(mx, 1e-4);
  float hueMask = smoothstep(0.12, 0.3, s) * smoothstep(0.08, 0.2, mx);
  vec3 an = wfAccent / max(max(wfAccent.r, max(wfAccent.g, wfAccent.b)), 1e-4);
  c = mix(c, mx * (1.0 - s * (1.0 - an)), hueMask * wfGlow);
  float plateMask = (1.0 - hueMask) * (1.0 - smoothstep(0.85, 0.97, mx));
  float av = max(max(wfArmor.r, max(wfArmor.g, wfArmor.b)), 1e-4);
  float value = max(mx, mx + (av * 0.55 - mx) * 0.35);
  c = mix(c, value * (wfArmor / av), plateMask * wfPlate);
  wfAccentMask = hueMask * smoothstep(0.35, 0.6, mx);
  diffuseColor.rgb = pow(c, vec3(2.2));
}`;
export const COLORWAY_EMISSIVE = "totalEmissiveRadiance += pow(wfAccent, vec3(2.2)) * wfAccentMask * wfGlow * 0.5;";
