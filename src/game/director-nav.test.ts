import { describe, expect, test } from "bun:test";
import { NEW_DIRECTOR_NAV, current, cycle, padTabIntent, pop, popTo, push, recall, remember, tabKeyIntent } from "./director-nav";

describe("director navigation", () => {
  test("planet → destination → area → activity, and Back returns one level at a time", () => {
    let n = push(NEW_DIRECTOR_NAV, { level: "destination", id: "nexus" });
    n = push(n, { level: "area", id: "area:nexus:spire", destinationId: "nexus" });
    n = push(n, { level: "activity", id: "story:x", destinationId: "nexus" });
    expect(current(n).level).toBe("activity");
    n = pop(n); expect(current(n).level).toBe("area");
    n = pop(n); n = pop(n); expect(current(n).level).toBe("planet");
    expect(pop(n)).toBe(n);
  });
  test("selections survive leaving and returning to a screen", () => {
    let n = remember(NEW_DIRECTOR_NAV, { level: "planet" }, "veridan");
    n = push(n, { level: "destination", id: "veridan" });
    n = remember(n, current(n), "story:broken-signal");
    n = push(n, { level: "activity", id: "story:broken-signal", destinationId: "veridan" });
    n = pop(n);
    expect(recall(n, current(n))).toBe("story:broken-signal");
    n = pop(n);
    expect(recall(n, current(n))).toBe("veridan");
  });
  test("re-opening a screen already in the history returns to it; breadcrumbs jump", () => {
    let n = push(NEW_DIRECTOR_NAV, { level: "destination", id: "nexus" });
    n = push(n, { level: "area", id: "a", destinationId: "nexus" });
    n = push(n, { level: "destination", id: "nexus" });
    expect(n.stack.length).toBe(2);
    n = push(n, { level: "area", id: "a", destinationId: "nexus" });
    expect(popTo(n, 0).stack.length).toBe(1);
  });
  test("tabs: Q/E and L1/R1 (edge-triggered)", () => {
    expect(tabKeyIntent("KeyQ")).toBe("prev"); expect(tabKeyIntent("KeyE")).toBe("next"); expect(tabKeyIntent("KeyW")).toBeNull();
    const up = Array(16).fill(false), l1 = up.map((_, i) => i === 4), r1 = up.map((_, i) => i === 5);
    expect(padTabIntent(up, l1)).toBe("prev"); expect(padTabIntent(l1, l1)).toBeNull(); expect(padTabIntent(up, r1)).toBe("next");
    expect(cycle(["a", "b", "c"], "a", "prev")).toBe("c"); expect(cycle(["a", "b", "c"], "c", "next")).toBe("a");
  });
});
