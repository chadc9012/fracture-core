// @ts-ignore bun:test types
import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { MERCHANT_MODEL_IDS, keeperName, merchantModelPath, merchantModelUrl } from "./merchant-models";
import { REFERENCE_MERCHANTS } from "./reference-roster";

test("every merchant model listed is a real file for a real sheet merchant", () => {
  for (const id of MERCHANT_MODEL_IDS) {
    expect(REFERENCE_MERCHANTS.some((m) => m.id === id)).toBe(true);
    expect(existsSync(`public${merchantModelPath(id)}`)).toBe(true);
  }
});
test("shops resolve to their merchant's model only when it exists, and keepers go by their names", () => {
  for (const m of REFERENCE_MERCHANTS) if (m.shopId) expect(merchantModelUrl(m.shopId)).toBe(MERCHANT_MODEL_IDS.has(m.id) ? merchantModelPath(m.id) : null);
  expect(merchantModelUrl(undefined)).toBeNull();
  expect(keeperName("nexus-bastion", "The Bastion")).toBe("Thalia \"Forge\" Ren");
  expect(keeperName("no-such-shop", "Somewhere")).toBe("Somewhere specialist");
});
