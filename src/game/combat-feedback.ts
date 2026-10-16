/** Combat readability: every hit maps to one feedback class that scales with the attack, so a pistol never looks like an
 * ultimate. Effects draw from a per-frame budget (pooled, capped) so many simultaneous hits never tank the frame rate.
 * Pure tuning + budgeting; Scene/VFX/audio consume it. Gamepad rumble goes through `rumble` (no-op where unsupported). */
export type ImpactClass = "light" | "heavy" | "ability" | "boss";
export type Quality = "HIGH" | "BALANCED" | "PERFORMANCE";

export const COMBAT_FEEDBACK: Record<ImpactClass, { flashMs: number; particles: number; cameraImpulse: number; haptic: number; soundBus: string }> = {
  light: { flashMs: 55, particles: 4, cameraImpulse: 0.015, haptic: 0.12, soundBus: "weapon.impact.light" },
  heavy: { flashMs: 105, particles: 12, cameraImpulse: 0.055, haptic: 0.42, soundBus: "weapon.impact.heavy" },
  ability: { flashMs: 145, particles: 22, cameraImpulse: 0.075, haptic: 0.55, soundBus: "ability.impact" },
  boss: { flashMs: 180, particles: 30, cameraImpulse: 0.09, haptic: 0.72, soundBus: "boss.impact" },
};

/** per-weapon handling identity (rifle/pistol/shotgun/sword) */
export const WEAPON_FEEL = {
  rifle: { impact: "light", recoil: 0.35, shellEject: true },
  pistol: { impact: "light", recoil: 0.2, shellEject: true },
  shotgun: { impact: "heavy", recoil: 0.9, shellEject: true },
  launcher: { impact: "heavy", recoil: 1, shellEject: false },
  sword: { impact: "heavy", recoil: 0, shellEject: false },
} as const satisfies Record<string, { impact: ImpactClass; recoil: number; shellEject: boolean }>;

/** particle budget per frame by quality setting */
export const FRAME_PARTICLE_BUDGET: Record<Quality, number> = { HIGH: 160, BALANCED: 90, PERFORMANCE: 40 };

export function impactFor(opts: { ability?: boolean; boss?: boolean; critical?: boolean; damage: number }): ImpactClass {
  if (opts.boss) return "boss";
  if (opts.ability) return "ability";
  return opts.critical || opts.damage >= 60 ? "heavy" : "light";
}

export const clampIntensity = (v = 1) => Math.max(0, Math.min(1.5, Number.isFinite(v) ? v : 1));

/** Spends from a frame budget. Bigger classes keep priority: light hits get trimmed first, a boss hit always shows at least a flash. */
export function spendBudget(remaining: number, impact: ImpactClass, intensity = 1): { particles: number; remaining: number } {
  const want = Math.round(COMBAT_FEEDBACK[impact].particles * clampIntensity(intensity));
  const floor = impact === "boss" || impact === "ability" ? Math.min(want, 4) : 0;
  const particles = Math.max(floor, Math.min(want, remaining));
  return { particles, remaining: Math.max(0, remaining - particles) };
}

type Rumbler = { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } | null };
/** Controller vibration scaled to the impact; silently does nothing on pads/browsers without support. */
export function rumble(pad: Rumbler | null | undefined, impact: ImpactClass, intensity = 1) {
  const s = COMBAT_FEEDBACK[impact].haptic * clampIntensity(intensity);
  try { void pad?.vibrationActuator?.playEffect?.("dual-rumble", { duration: COMBAT_FEEDBACK[impact].flashMs + 60, strongMagnitude: Math.min(1, s), weakMagnitude: Math.min(1, s * 0.6) })?.catch(() => {}); } catch { /* unsupported */ }
}
