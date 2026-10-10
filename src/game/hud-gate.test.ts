import { describe, expect, test } from "bun:test";
import { createHudGate } from "./hud-gate";

describe("hud gate", () => {
  test("first report always goes through", () => {
    expect(createHudGate()(({ a: 1 }), 0)).toBe(true);
  });
  test("an identical snapshot is dropped inside the quiet window", () => {
    const gate = createHudGate(500);
    expect(gate({ a: 1, list: [1, 2] }, 0)).toBe(true);
    expect(gate({ a: 1, list: [1, 2] }, 180)).toBe(false);
    expect(gate({ a: 1, list: [1, 2] }, 360)).toBe(false);
  });
  test("a changed snapshot goes through at once", () => {
    const gate = createHudGate(500);
    gate({ a: 1 }, 0);
    expect(gate({ a: 2 }, 100)).toBe(true);
  });
  test("an unchanged snapshot is still sent after the quiet window (heartbeat)", () => {
    const gate = createHudGate(500);
    gate({ a: 1 }, 0);
    expect(gate({ a: 1 }, 400)).toBe(false);
    expect(gate({ a: 1 }, 600)).toBe(true);
    expect(gate({ a: 1 }, 700)).toBe(false);
  });
  test("an unserialisable snapshot is always sent", () => {
    const gate = createHudGate(500);
    const cyc: Record<string, unknown> = {}; cyc["self"] = cyc;
    expect(gate(cyc, 0)).toBe(true);
    expect(gate(cyc, 10)).toBe(true);
  });
});
