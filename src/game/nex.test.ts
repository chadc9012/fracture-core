import { describe, expect, test } from "bun:test";
import { formatNex, nexBalance, normalizeNex, spendNex } from "./nex";

describe("NEX", () => {
  test("formats with the NΞ symbol and thousands separators", () => {
    expect(formatNex(8000)).toBe("NΞ 8,000");
    expect(formatNex(-5)).toBe("NΞ 0");
    expect(formatNex(12.9)).toBe("NΞ 12");
  });
  test("a spend is one ledger entry that cannot repeat and cannot overdraw", () => {
    const l = { grant: 500 };
    const a = spendNex(l, "item:x", 300)!;
    expect(nexBalance(a)).toBe(200);
    expect(spendNex(a, "item:x", 1)).toBeNull();
    expect(spendNex(a, "item:y", 300)).toBeNull();
  });
  test("normalizing drops junk", () => expect(normalizeNex({ a: 5, b: "x", c: 1.5, d: NaN })).toEqual({ a: 5 }));
});
