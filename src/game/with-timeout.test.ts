import { describe, expect, test } from "bun:test";
import { orFallback, TimeoutError, withTimeout } from "./with-timeout";

const never = () => new Promise<number>(() => {});
describe("withTimeout", () => {
  test("passes through a fast result", async () => { expect(await withTimeout(Promise.resolve(7), 50)).toBe(7); });
  test("rejects a stalled call", async () => {
    await expect(withTimeout(never(), 10, "auth")).rejects.toBeInstanceOf(TimeoutError);
  });
  test("passes through the original rejection", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 50)).rejects.toThrow("boom");
  });
  test("orFallback resolves on timeout and on failure", async () => {
    expect(await orFallback(never(), 10, -1)).toBe(-1);
    expect(await orFallback(Promise.reject(new Error("x")), 50, -2)).toBe(-2);
    expect(await orFallback(Promise.resolve(3), 50, -1)).toBe(3);
  });
});
