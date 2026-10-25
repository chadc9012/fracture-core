/** Contextual gameplay HUD: the three ability icons are no longer permanent screen furniture. Q / E / R keep their bindings and
 * rules (ability-hud.ts reads the same LiveBuild the sim accepts); this module only decides what is worth showing right now.
 * The "Super" is the class's ULTIMATE slot: its charge is whichever of cooldown or energy is still holding it back, so the meter
 * can never disagree with whether R will actually fire (no second charge pipeline). */
import type { AbilityHud } from "./ability-hud";

export type HudMode = "exploration" | "combat" | "boss";
/** audio.ts combat intensity at which the HUD expands */
export const COMBAT_HUD_LEVEL = 0.25;

export function hudMode(bossActive: boolean, combatLevel: number): HudMode {
  return bossActive ? "boss" : combatLevel >= COMBAT_HUD_LEVEL ? "combat" : "exploration";
}

export function hudVisibility(mode: HudMode) {
  return {
    abilityIcons: false,
    superMeter: true,
    missionTracker: mode !== "combat",
    bossHealth: mode === "boss",
    enemyIndicators: mode !== "exploration",
  };
}

/** abilities worth a short readout: cooling down or active. Ready ones (and ones waiting on energy) stay off the screen. */
export const contextualAbilities = (abilities: AbilityHud[]): AbilityHud[] => abilities.filter((a) => a.slot !== "ULTIMATE" && (a.state === "COOLDOWN" || a.state === "ACTIVE"));

export type SuperMeter = { name: string; charge: number; ready: boolean; active: boolean; label: "SUPER READY" | "ACTIVE" | "CHARGING" };

export function superMeter(abilities: AbilityHud[], energy: number): SuperMeter | null {
  const a = abilities.find((x) => x.slot === "ULTIMATE");
  if (!a) return null;
  if (a.state === "ACTIVE") return { name: a.name, charge: 1, ready: false, active: true, label: "ACTIVE" };
  const byCooldown = a.cooldownMax > 0 ? 1 - Math.min(1, Math.max(0, a.cooldown / a.cooldownMax)) : 1;
  const byEnergy = a.cost > 0 ? Math.min(1, Math.max(0, energy / a.cost)) : 1;
  const charge = a.ready ? 1 : Math.min(byCooldown, byEnergy, 0.99);
  return { name: a.name, charge, ready: a.ready, active: false, label: a.ready ? "SUPER READY" : "CHARGING" };
}

/** true on the render where the Super becomes ready (drives the one-off pulse) */
export const superJustReady = (prev: SuperMeter | null, next: SuperMeter | null): boolean => Boolean(next?.ready && prev && !prev.ready && !prev.active);
