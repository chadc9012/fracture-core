/** Configurable input bindings. Keyboard uses KeyboardEvent.code; gamepad uses standard-mapping button indexes. */
export type Action = "reload" | "nextWeapon" | "prevWeapon" | "weaponWheel" | "slot1" | "slot2" | "slot3" | "slot4" | "fire" | "aim" | "crouch" | "prone" | "abilityModifier" | "abilityPrimary" | "abilityTactical" | "abilityUltimate" | "map";
export type Bindings = { keyboard: Record<"reload" | "nextWeapon" | "prevWeapon" | "weaponWheel" | "crouch" | "prone" | "map", string>; gamepad: Record<Action, number> };

export const DEFAULT_BINDINGS: Bindings = {
  keyboard: { reload: "KeyG", nextWeapon: "BracketRight", prevWeapon: "BracketLeft", weaponWheel: "KeyZ", crouch: "ControlLeft", prone: "KeyX", map: "KeyM" },
  gamepad: { reload: 2, nextWeapon: 5, prevWeapon: 4, weaponWheel: 3, slot1: 12, slot2: 15, slot3: 13, slot4: 14, fire: 7, aim: 6, crouch: 1, prone: 11, abilityModifier: 8, abilityPrimary: 2, abilityTactical: 3, abilityUltimate: 1, map: 9 },
};

export const ACTION_LABEL: Record<Action, string> = {
  reload: "Reload", nextWeapon: "Next weapon", prevWeapon: "Previous weapon", weaponWheel: "Weapon wheel (hold)",
  slot1: "Weapon 1", slot2: "Weapon 2", slot3: "Weapon 3", slot4: "Weapon 4", fire: "Fire", aim: "Aim", crouch: "Crouch / slide (hold)", prone: "Prone (toggle)",
  abilityModifier: "Ability chord (hold)", abilityPrimary: "Ability Q (with chord)", abilityTactical: "Ability E (with chord)", abilityUltimate: "Ability R (with chord)", map: "Open / close map",
};

const PAD_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "L3", "R3", "D-Up", "D-Down", "D-Left", "D-Right", "Home"];
export const padName = (i: number) => PAD_NAMES[i] ?? `Button ${i}`;
export const keyName = (code: string) => code.replace(/^Key/, "").replace(/^Digit/, "").replace("BracketRight", "]").replace("BracketLeft", "[").replace("ControlLeft", "Ctrl");

export const normalizeBindings = (b: Partial<Bindings> | undefined): Bindings => ({
  keyboard: { ...DEFAULT_BINDINGS.keyboard, ...(b?.keyboard ?? {}) },
  gamepad: { ...DEFAULT_BINDINGS.gamepad, ...(b?.gamepad ?? {}) },
});

/** Returns the first pressed button on any connected pad, or -1. */
export function firstPressedButton(): number {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return -1;
  for (const pad of navigator.getGamepads()) {
    if (!pad) continue;
    const i = pad.buttons.findIndex((b) => b.pressed);
    if (i >= 0) return i;
  }
  return -1;
}

/** Controller abilities are a chord so no existing button changes meaning: hold the modifier (View by default) and press the
 * primary / tactical / ultimate button. While the modifier is held those three buttons are consumed by the chord
 * (maskChord) so X does not also reload, Y does not also open the weapon wheel and B does not also crouch. */
export type AbilityChord = { PRIMARY: boolean; TACTICAL: boolean; ULTIMATE: boolean };
export function abilityChord(pad: readonly boolean[], g: Bindings["gamepad"]): AbilityChord {
  const on = !!pad[g.abilityModifier];
  return { PRIMARY: on && !!pad[g.abilityPrimary], TACTICAL: on && !!pad[g.abilityTactical], ULTIMATE: on && !!pad[g.abilityUltimate] };
}
export function maskChord(pad: readonly boolean[], g: Bindings["gamepad"]): boolean[] {
  if (!pad[g.abilityModifier]) return [...pad];
  const out = [...pad];
  for (const i of [g.abilityPrimary, g.abilityTactical, g.abilityUltimate]) out[i] = false;
  return out;
}
