/** Starter held-weapon geometry for the authored operator rigs (pure data, procedural, NOT final art). Each weapon is a few primitive parts parented to the
 * right-hand bone so the operator visibly carries what the player has equipped (third person and forge). Units are metres on a 1.85 m operator; the barrel
 * points along the hand bone's +Z, with the grip at the origin. The pose is "carried", not an aimed two-handed pose, and has not been checked in a browser. */
import type { WeaponId } from "./weapons";

export const HAND_BONE = "mixamorig:RightHand";
export type PropPart = { shape: "box" | "cylinder" | "cone" | "sphere"; /** box = x,y,z; cylinder/cone = radius, length, radius; sphere = radii */ size: [number, number, number]; pos: [number, number, number]; rot?: [number, number, number]; tone: "body" | "trim" | "accent" };
const ALONG_Z: [number, number, number] = [Math.PI / 2, 0, 0];

const rifle = (len: number, thick: number): PropPart[] => [
  { shape: "box", size: [thick, thick * 1.5, len], pos: [0, 0.03, len * 0.38], tone: "body" },
  { shape: "box", size: [thick * 0.9, thick * 1.6, 0.18], pos: [0, 0.01, -0.06], tone: "trim" },
  { shape: "cylinder", size: [0.016, 0.3, 0.016], pos: [0, 0.04, len * 0.38 + len / 2 + 0.1], rot: ALONG_Z, tone: "trim" },
  { shape: "box", size: [thick * 0.7, 0.13, 0.06], pos: [0, -0.08, len * 0.3], tone: "trim" },
  { shape: "box", size: [0.02, 0.03, 0.08], pos: [0, 0.1, len * 0.45], tone: "accent" },
];
const launcher = (tube: number, flare: number): PropPart[] => [
  { shape: "cylinder", size: [0.075, tube, 0.075], pos: [0, 0.07, tube * 0.3], rot: ALONG_Z, tone: "body" },
  { shape: "cone", size: [flare, 0.16, flare], pos: [0, 0.07, tube * 0.3 + tube / 2 + 0.06], rot: ALONG_Z, tone: "trim" },
  { shape: "box", size: [0.05, 0.1, 0.1], pos: [0, -0.04, 0.05], tone: "trim" },
  { shape: "box", size: [0.04, 0.05, 0.14], pos: [0, 0.17, tube * 0.2], tone: "accent" },
];

export const WEAPON_PROPS: Record<WeaponId, PropPart[]> = {
  AUTO: rifle(0.62, 0.06),
  PULSE: [...rifle(0.5, 0.07), { shape: "box", size: [0.075, 0.015, 0.3], pos: [0, 0.075, 0.2], tone: "accent" }],
  HEAVY: [...rifle(0.7, 0.1), { shape: "cylinder", size: [0.045, 0.25, 0.045], pos: [0, 0.04, 0.95], rot: ALONG_Z, tone: "trim" }],
  SWORD: [
    { shape: "box", size: [0.03, 0.05, 0.14], pos: [0, 0, 0.02], tone: "trim" },
    { shape: "box", size: [0.06, 0.14, 0.03], pos: [0, 0, 0.1], tone: "trim" },
    { shape: "box", size: [0.02, 0.07, 0.95], pos: [0, 0, 0.6], tone: "accent" },
  ],
  ROCKET: launcher(0.9, 0.1),
  CINDER: launcher(0.8, 0.11),
  FROSTBITE: [...launcher(0.85, 0.08), { shape: "sphere", size: [0.05, 0.05, 0.05], pos: [0, 0.17, 0.55], tone: "accent" }],
  VITRIOL: launcher(0.8, 0.13),
};

/** longest extent along the barrel axis, metres: a sanity number for tests and for scaling decisions */
export const propLength = (id: WeaponId) => Math.max(...WEAPON_PROPS[id].map((p) => p.pos[2] + (p.shape === "cylinder" || p.shape === "cone" ? (p.rot ? p.size[1] / 2 : 0) : p.size[2] / 2)));
