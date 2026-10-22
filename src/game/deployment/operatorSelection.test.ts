import { describe, expect, test } from "bun:test";
import { initialOperatorSelection, rememberedOperator, rememberOperator, selectionKey } from "./operatorSelection";
import type { ClassId } from "../loadout";

const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
};
describe("remembered Operator selection", () => {
  for (const classId of ["TITAN", "HUNTER", "WARLOCK"] satisfies ClassId[]) {
    test(`${classId} stays selected on a return visit before deployment`, () => {
      const store = storage();
      const key = selectionKey(false);
      rememberOperator(store, key, classId);
      expect(initialOperatorSelection(null, rememberedOperator(store, key)).classId).toBe(classId);
    });
  }
  test("confirmed identity takes priority over a menu preference", () => {
    const saved = { classId: "HUNTER", subclassId: "TRACKER_HUNTER", bodyType: "robot", appearance: { callsign: "RAVEN" } } as Parameters<typeof initialOperatorSelection>[0];
    expect(initialOperatorSelection(saved, "WARLOCK")).toMatchObject({ classId: "HUNTER", subclassId: "TRACKER_HUNTER", bodyType: "robot", appearance: { callsign: "RAVEN" } });
  });
  test("discarding clears the draft, and test preferences are isolated", () => {
    const store = storage();
    rememberOperator(store, selectionKey(true), "WARLOCK");
    expect(rememberedOperator(store, selectionKey(false))).toBeNull();
    rememberOperator(store, selectionKey(true), null);
    expect(rememberedOperator(store, selectionKey(true))).toBeNull();
  });
  test("invalid or unavailable storage falls back without blocking the menu", () => {
    const store = storage();
    store.setItem(selectionKey(false), "unknown");
    expect(initialOperatorSelection(null, rememberedOperator(store, selectionKey(false))).classId).toBe("TITAN");
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(rememberedOperator(blocked, selectionKey(false))).toBeNull();
    expect(() => rememberOperator(blocked, selectionKey(false), "HUNTER")).not.toThrow();
  });
});