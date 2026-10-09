import { describe, expect, test } from "bun:test";
import { BOOT_TOTAL_MS, BOOT_TOTAL_REDUCED_MS, NOVA_BOOT_LINES, bootFrame, bootSeen, evaluateSave, markBootSeen } from "./startup";
import { DEFAULT_PROGRESSION, normalizeProgression } from "./progression";
import { NEW_PAD_NAV, firstEnabled, keyIntent, moveFocus, padIntent, padKind } from "./menu-nav";

describe("boot timeline", () => {
  test("starts black, reveals, shows the title, then subtitles, then finishes", () => {
    expect(bootFrame(0, false)).toMatchObject({ stage: "black", reveal: 0, title: 0, done: false });
    expect(bootFrame(2000, false).reveal).toBeGreaterThan(0);
    expect(bootFrame(2000, false).reveal).toBeLessThan(1);
    expect(bootFrame(4500, false)).toMatchObject({ stage: "title", reveal: 1, line: -1 });
    expect(bootFrame(7000, false).stage).toBe("nova");
    expect(bootFrame(BOOT_TOTAL_MS, false).done).toBe(true);
  });
  test("is short: never a fake loading screen", () => { expect(BOOT_TOTAL_MS).toBeLessThanOrEqual(12000); });
  test("subtitle index always valid and covers every line", () => {
    const seen = new Set<number>();
    for (let t = 0; t < BOOT_TOTAL_MS; t += 100) { const f = bootFrame(t, false); if (f.line >= 0) { expect(f.line).toBeLessThan(NOVA_BOOT_LINES.length); seen.add(f.line); } }
    expect(seen.size).toBe(NOVA_BOOT_LINES.length);
  });
  test("reduced motion has no fades and ends sooner", () => {
    const f = bootFrame(0, true);
    expect(f).toMatchObject({ reveal: 1, title: 1 });
    expect(BOOT_TOTAL_REDUCED_MS).toBeLessThan(BOOT_TOTAL_MS);
    expect(bootFrame(BOOT_TOTAL_REDUCED_MS, true).done).toBe(true);
  });
  test("session flag round-trips and tolerates broken storage", () => {
    const m = new Map<string, string>();
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(bootSeen(store)).toBe(false);
    markBootSeen(store);
    expect(bootSeen(store)).toBe(true);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(bootSeen(broken)).toBe(false);
    expect(() => markBootSeen(broken)).not.toThrow();
  });
});

describe("save evaluation", () => {
  test("a missing, default or corrupt save is not a save", () => {
    expect(evaluateSave(null).hasSave).toBe(false);
    expect(evaluateSave(DEFAULT_PROGRESSION).hasSave).toBe(false);
    expect(evaluateSave(normalizeProgression("garbage")).hasSave).toBe(false);
  });
  test("progress, a chosen class or a played session counts", () => {
    expect(evaluateSave({ ...DEFAULT_PROGRESSION, completedMissions: ["mission-01"] }).hasSave).toBe(true);
    expect(evaluateSave({ ...DEFAULT_PROGRESSION, identityClass: "HUNTER" })).toMatchObject({ hasSave: true, classId: "HUNTER" });
    expect(evaluateSave({ ...DEFAULT_PROGRESSION, level: 4 }).hasSave).toBe(true);
    expect(evaluateSave(DEFAULT_PROGRESSION, true).hasSave).toBe(true);
  });
});

describe("menu navigation", () => {
  test("focus wraps and skips disabled entries", () => {
    const en = [true, false, true, true];
    expect(moveFocus(0, 1, en)).toBe(2);
    expect(moveFocus(3, 1, en)).toBe(0);
    expect(moveFocus(0, -1, en)).toBe(3);
    expect(moveFocus(2, -1, en)).toBe(0);
    expect(moveFocus(1, 1, [false, false])).toBe(1);
    expect(firstEnabled([false, true])).toBe(1);
  });
  test("keys map to intents; Escape and Backspace go back", () => {
    expect(keyIntent("ArrowDown")).toBe("down");
    expect(keyIntent("KeyW")).toBe("up");
    expect(keyIntent("Enter")).toBe("confirm");
    expect(keyIntent("Escape")).toBe("back");
    expect(keyIntent("KeyQ")).toBeNull();
  });
  test("pad kinds are told apart", () => {
    expect(padKind("Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)")).toBe("playstation");
    expect(padKind("Xbox 360 Controller (XInput STANDARD GAMEPAD)")).toBe("xbox");
    expect(padKind("Some Pad")).toBe("generic");
  });
  test("pad input is edge-triggered, repeats only up/down, and Circle/B goes back", () => {
    const down = { buttons: Array(17).fill(false).map((_, i) => i === 13), axes: [0, 0] };
    let s = NEW_PAD_NAV, r = padIntent(s, down, 0);
    expect(r.intent).toBe("down"); s = r.next;
    expect(padIntent(s, down, 100).intent).toBeNull();
    r = padIntent(s, down, 500); expect(r.intent).toBe("down"); s = r.next;
    expect(padIntent(s, null, 600).next).toEqual(NEW_PAD_NAV);
    const a = { buttons: Array(17).fill(false).map((_, i) => i === 0), axes: [0, 0] };
    r = padIntent(NEW_PAD_NAV, a, 0); expect(r.intent).toBe("confirm");
    expect(padIntent(r.next, a, 2000).intent).toBeNull(); // confirm never repeats
    const b = { buttons: Array(17).fill(false).map((_, i) => i === 1), axes: [0, 0] };
    expect(padIntent(NEW_PAD_NAV, b, 0).intent).toBe("back");
    expect(padIntent(NEW_PAD_NAV, { buttons: [], axes: [0, -0.9] }, 0).intent).toBe("up");
  });
});
