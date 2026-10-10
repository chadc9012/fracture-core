import { expect, test } from "bun:test";
import { mulberry32 } from "./rng";

test("mulberry32 is deterministic, in [0,1), and different seeds diverge", () => {
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
  const sa = Array.from({ length: 20 }, a), sb = Array.from({ length: 20 }, b), sc = Array.from({ length: 20 }, c);
  expect(sa).toEqual(sb);
  expect(sa).not.toEqual(sc);
  for (const v of sa) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
});
