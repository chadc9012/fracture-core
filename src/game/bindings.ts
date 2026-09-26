/** Configurable input bindings. Keyboard uses KeyboardEvent.code; gamepad uses standard-mapping button indexes. */
export type Action = "reload" | "nextWeapon" | "prevWeapon" | "weaponWheel" | "slot1" | "slot2" | "slot3" | "slot4" | "fire" | "aim";
export type Bindings = { keyboard: Record<"reload" | "nextWeapon" | "prevWeapon" | "weaponWheel", string>; gamepad: Record<Action, number> };

export const DEFAULT_BINDINGS: Bindings = {
  keyboard: { reload: "KeyT", nextWeapon: "BracketRight", prevWeapon: "BracketLeft", weaponWheel: "Tab" },
  gamepad: { reload: 2, nextWeapon: 5, prevWeapon: 4, weaponWheel: 3, slot1: 12, slot2: 15, slot3: 13, slot4: 14, fire: 7, aim: 6 },
};

export const ACTION_LABEL: Record<Action, string> = {
  reload: "Reload", nextWeapon: "Next weapon", prevWeapon: "Previous weapon", weaponWheel: "Weapon wheel (hold)",
  slot1: "Weapon 1", slot2: "Weapon 2", slot3: "Weapon 3", slot4: "Weapon 4", fire: "Fire", aim: "Aim",
};

const PAD_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "L3", "R3", "D-Up", "D-Down", "D-Left", "D-Right", "Home"];
export const padName = (i: number) => PAD_NAMES[i] ?? `Button ${i}`;
export const keyName = (code: string) => code.replace(/^Key/, "").replace(/^Digit/, "").replace("BracketRight", "]").replace("BracketLeft", "[");

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
