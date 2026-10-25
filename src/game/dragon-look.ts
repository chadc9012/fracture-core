/** Look data for the two dragons on the owner's reference sheet (docs/reference/vyrak-wyrmling-sheet.png), pure so it is testable.
 * Vyrak: obsidian ash-scale with molten crack veins; his fire runs orange through the first two phases and shifts to white-hot gold
 * in phase 3 (Covenant Trial). Wyrmling: small, big-headed, cream horns and belly, amber eyes, four moods from the sheet. */
export type DragonVariant = "vyrak" | "wyrmling";
export type VyrakPhase = 0 | 1 | 2;

export const VYRAK_FIRE: Record<VyrakPhase, { fire: string; glow: number }> = {
  0: { fire: "#ff6a1f", glow: 1 },
  1: { fire: "#ff5a14", glow: 1.35 },
  2: { fire: "#ffd36a", glow: 1.9 },
};
export const vyrakFire = (phase: number) => VYRAK_FIRE[Math.max(0, Math.min(2, Math.floor(Number.isFinite(phase) ? phase : 0))) as VyrakPhase];

export const DRAGON_PALETTE = {
  vyrak: { scale: "#1b1210", belly: "#3a2218", horn: "#2a1a14", membrane: "#4a1a10", eye: "#ffb23a" },
  wyrmling: { scale: "#241612", belly: "#e8d3ad", horn: "#efe0c0", membrane: "#d9692a", eye: "#ffae2a" },
} as const;

export type WyrmlingMood = "neutral" | "happy" | "alert" | "aggressive";
/** eye: eyeball scale, brow: brow tilt (rad, + = angry), jaw: mouth open (rad), wing: wing raise (rad), flap: flap speed multiplier, ember: mouth glow 0-1 */
export const WYRMLING_MOODS: Record<WyrmlingMood, { eye: number; brow: number; jaw: number; wing: number; flap: number; ember: number }> = {
  neutral: { eye: 1, brow: 0, jaw: 0.05, wing: 0, flap: 1, ember: 0 },
  happy: { eye: 1.1, brow: -0.2, jaw: 0.25, wing: 0.1, flap: 1.3, ember: 0 },
  alert: { eye: 1.25, brow: 0.12, jaw: 0.08, wing: 0.35, flap: 0.8, ember: 0.1 },
  aggressive: { eye: 0.9, brow: 0.5, jaw: 0.45, wing: 0.5, flap: 1.6, ember: 0.8 },
};
/** the Wyrmling reacts to what the Operator is doing: sprinting or hurt puts it on alert, a fight makes it aggressive */
export function wyrmlingMood(o: { speed: number; inCombat?: boolean; hurt?: boolean }): WyrmlingMood {
  if (o.inCombat) return "aggressive";
  if (o.hurt || o.speed > 8) return "alert";
  return o.speed < 0.5 ? "happy" : "neutral";
}
