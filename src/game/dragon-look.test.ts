import { expect, test } from "bun:test";
import { DRAGON_PALETTE, WYRMLING_MOODS, vyrakFire, wyrmlingMood } from "./dragon-look";
test("Vyrak's fire turns white-hot gold only in phase 3", () => {
  expect(vyrakFire(0).fire).toBe("#ff6a1f");
  expect(vyrakFire(1).fire).not.toBe(vyrakFire(2).fire);
  expect(vyrakFire(2).fire).toBe("#ffd36a");
  expect(vyrakFire(2).glow).toBeGreaterThan(vyrakFire(0).glow);
  expect(vyrakFire(9)).toBe(vyrakFire(2)); expect(vyrakFire(-1)).toBe(vyrakFire(0)); expect(vyrakFire(NaN)).toBe(vyrakFire(0));
});
test("the Wyrmling is cream-bellied where Vyrak is dark", () => {
  expect(DRAGON_PALETTE.wyrmling.belly).not.toBe(DRAGON_PALETTE.vyrak.belly);
  expect(DRAGON_PALETTE.wyrmling.horn).toBe("#efe0c0");
});
test("four distinct Wyrmling moods, mouth glow only when aggressive", () => {
  expect(new Set(Object.values(WYRMLING_MOODS).map((m) => JSON.stringify(m))).size).toBe(4);
  expect(WYRMLING_MOODS.aggressive.ember).toBeGreaterThan(WYRMLING_MOODS.alert.ember);
  expect(WYRMLING_MOODS.happy.brow).toBeLessThan(0);
});
test("mood follows what the Operator is doing", () => {
  expect(wyrmlingMood({ speed: 0 })).toBe("happy");
  expect(wyrmlingMood({ speed: 4 })).toBe("neutral");
  expect(wyrmlingMood({ speed: 12 })).toBe("alert");
  expect(wyrmlingMood({ speed: 0, hurt: true })).toBe("alert");
  expect(wyrmlingMood({ speed: 12, inCombat: true })).toBe("aggressive");
});

import { wyrmlingOffset } from "./dragon-covenant";
test("perch blends the companion from hovering high to settled on the shoulder", () => {
  const hover = wyrmlingOffset(0, 0, 0), perched = wyrmlingOffset(0, 0, 1), half = wyrmlingOffset(0, 0, 0.5);
  expect(perched[1]).toBeLessThan(0);
  expect(hover[1]).toBeGreaterThan(2);
  expect(half[1]).toBeGreaterThan(perched[1]);
  expect(half[1]).toBeLessThan(hover[1]);
  expect(wyrmlingOffset(1, 0, 1)[1]).toBe(wyrmlingOffset(2, 0, 1)[1]);
  expect(wyrmlingOffset(0, 0, Number.NaN)).toEqual(hover);
});
