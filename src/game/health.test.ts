import { expect, test } from "bun:test";
import { REGEN_DELAY, REGEN_RATE, stepHealth } from "./health";

test("no recovery while under fire; steady recovery after the delay; armor adds; safe zones heal at once; never above 100", () => {
  expect(stepHealth(40, 1, REGEN_DELAY - 1)).toBe(40);
  expect(stepHealth(40, 1, REGEN_DELAY)).toBe(40 + REGEN_RATE);
  expect(stepHealth(40, 1, 0, { bonusRate: 2 })).toBe(42);
  expect(stepHealth(40, 1, 0, { safe: true })).toBeGreaterThan(60);
  expect(stepHealth(99, 5, 99)).toBe(100);
  expect(stepHealth(0, 1, 99)).toBe(0); // dead stays dead; respawn restores
  // the stuck-at-1 case from the playtest: out of the hazard, health comes back within ~15 s
  let hp = 1, t = 0;
  for (let since = 0; t < 20; t += 0.1, since += 0.1) hp = stepHealth(hp, 0.1, since);
  expect(hp).toBe(100);
});
