/** Pure menu-navigation rules shared by the keyboard and gamepad handlers. */
export type MenuIntent = "up" | "down" | "confirm" | "back";

/** Next enabled index in `dir`, wrapping; stays put when nothing is enabled. */
export function moveFocus(index: number, dir: 1 | -1, enabled: readonly boolean[]): number {
  const n = enabled.length;
  if (n === 0) return 0;
  for (let step = 1; step <= n; step++) {
    const i = (((index + dir * step) % n) + n) % n;
    if (enabled[i]) return i;
  }
  return index;
}

/** First enabled index (for initial focus). */
export const firstEnabled = (enabled: readonly boolean[]) => Math.max(0, enabled.findIndex(Boolean));

export function keyIntent(code: string): MenuIntent | null {
  switch (code) {
    case "ArrowUp": case "KeyW": return "up";
    case "ArrowDown": case "KeyS": return "down";
    case "Enter": case "NumpadEnter": case "Space": return "confirm";
    case "Escape": case "Backspace": return "back";
    default: return null;
  }
}

export type PadKind = "playstation" | "xbox" | "generic";
export function padKind(id: string): PadKind {
  const s = id.toLowerCase();
  if (/(054c|dualshock|dualsense|playstation|ps4|ps5|wireless controller)/.test(s)) return "playstation";
  if (/(xbox|xinput|045e|microsoft)/.test(s)) return "xbox";
  return "generic";
}
export const PAD_LABELS: Record<PadKind, { confirm: string; back: string; nav: string }> = {
  playstation: { confirm: "✕ Cross", back: "○ Circle", nav: "D-pad" },
  xbox: { confirm: "A", back: "B", nav: "D-pad" },
  generic: { confirm: "Button 1 (A)", back: "Button 2 (B)", nav: "D-pad" },
};

export type PadSnapshot = { buttons: readonly boolean[]; axes: readonly number[] };
export type PadNavState = { held: MenuIntent | null; since: number; lastRepeat: number };
export const NEW_PAD_NAV: PadNavState = { held: null, since: 0, lastRepeat: 0 };
const REPEAT_DELAY = 380, REPEAT_RATE = 130, STICK = 0.6;

/** Standard-mapping read: d-pad 12/13, stick Y axis 1, A/Cross 0 confirm, B/Circle 1 back (also Start = confirm is NOT used,
 * so the pause button can't trigger a destructive choice). Edge-triggered with auto-repeat for up/down only. */
export function padIntent(state: PadNavState, pad: PadSnapshot | null, now: number): { intent: MenuIntent | null; next: PadNavState } {
  let cur: MenuIntent | null = null;
  if (pad) {
    const y = pad.axes[1] ?? 0;
    if (pad.buttons[12] || y < -STICK) cur = "up";
    else if (pad.buttons[13] || y > STICK) cur = "down";
    else if (pad.buttons[0]) cur = "confirm";
    else if (pad.buttons[1]) cur = "back";
  }
  if (cur === null) return { intent: null, next: NEW_PAD_NAV };
  if (state.held !== cur) return { intent: cur, next: { held: cur, since: now, lastRepeat: now } };
  if ((cur === "up" || cur === "down") && now - state.since > REPEAT_DELAY && now - state.lastRepeat > REPEAT_RATE) return { intent: cur, next: { ...state, lastRepeat: now } };
  return { intent: null, next: state };
}
