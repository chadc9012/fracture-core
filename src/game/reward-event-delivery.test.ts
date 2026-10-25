import { describe, expect, test } from "bun:test";
import { deliverQueuedEvents, deliverQueuedBatch } from "./reward-event-delivery";

describe("stage 32 reward event delivery", () => {
  test("a throwing XP consumer retains the failed and later events", () => {
    const queue = [1, 2, 3];
    expect(() => deliverQueuedEvents(queue, n => { if (n === 2) throw new Error("save unavailable"); })).toThrow();
    expect(queue).toEqual([2, 3]);
  });
  test("a throwing loot consumer retains the whole batch", () => {
    const queue = ["weapon", "scrap"];
    expect(() => deliverQueuedBatch(queue, () => { throw new Error("inventory unavailable"); })).toThrow();
    expect(queue).toEqual(["weapon", "scrap"]);
  });
  test("successful delivery drains only the original batch", () => {
    const queue = [1, 2];
    expect(deliverQueuedBatch(queue, () => queue.push(3))).toBe(2);
    expect(queue).toEqual([3]);
  });
});
