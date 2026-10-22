import { expect, test } from "bun:test";
import { assertValidSlot, parseLocalSlots, parseStoredSlotRecord, SLOT_COUNT } from "./save-slots";

test("save slot boundaries accept only existing integer slots", () => {
  for (let slot = 1; slot <= SLOT_COUNT; slot++) expect(() => assertValidSlot(slot)).not.toThrow();
  for (const slot of [0, -1, SLOT_COUNT + 1, 1.5, NaN, Infinity, -Infinity]) {
    expect(() => assertValidSlot(slot)).toThrow(RangeError);
  }
});


test("malformed local save slot storage is safely ignored", () => {
  for (const raw of [null, "", "not-json", "null", "[]", "42", '"hello"']) {
    expect(parseLocalSlots(raw)).toEqual({});
  }
});

test("local slot storage retains only valid slots and records", () => {
  const record = { label: "A".repeat(40), data: { level: 5 }, updated_at: "2026-10-22" };
  const parsed = parseLocalSlots(JSON.stringify({ 1: record, 2: { label: 7 }, 4: record, "__proto__": record }));
  expect(Object.keys(parsed)).toEqual(["1"]);
  expect(parsed[1].label).toHaveLength(32);
  expect(parsed[1].data).toEqual({ level: 5 });
});


test("corrupt progression payloads are not presented as saved games", () => {
  const valid = { label: "Valid", updated_at: "2026-10-22", data: { level: 2 } };
  const parsed = parseLocalSlots(JSON.stringify({
    1: { ...valid, data: null },
    2: { ...valid, data: [] },
    3: valid,
  }));
  expect(Object.keys(parsed)).toEqual(["3"]);
});

test("active slot falls back safely when browser storage is blocked", async () => {
  const { activeSlot } = await import("./save-slots");
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() { throw new Error("Storage access denied"); },
    });
    expect(activeSlot()).toBe(1);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});


test("browser and cloud save records share strict record validation", () => {
  const record = { label: "Test", data: { level: 4 }, updated_at: "2026-10-22T12:00:00.000Z" };
  expect(parseStoredSlotRecord(record)).toEqual(record);
  expect(parseStoredSlotRecord({ ...record, updated_at: "not-a-date" })).toBeNull();
  expect(parseStoredSlotRecord({ ...record, data: [] })).toBeNull();
  expect(parseStoredSlotRecord({ ...record, label: null })).toBeNull();
  expect(parseLocalSlots(JSON.stringify({ 1: { ...record, updated_at: "not-a-date" } }))).toEqual({});
});


test("future-dated save records are rejected", () => {
  const record = { label: "Future", data: { level: 4 }, updated_at: "2999-01-01T00:00:00.000Z" };
  expect(parseStoredSlotRecord(record)).toBeNull();
  expect(parseLocalSlots(JSON.stringify({ 1: record }))).toEqual({});
});
