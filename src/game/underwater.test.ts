import { describe, expect, it } from "bun:test";

import { underwaterVisibility } from "./underwater";
describe("underwater visibility", () => {
  it("the city is far more readable than open water, and the deep trench closes in", () => {
    const open = underwaterVisibility(null, 6), dock = underwaterVisibility("SENTRY_DOCK", 6), core = underwaterVisibility("SUNK_CORE", 24);
    expect(dock.far).toBeGreaterThan(open.far * 2);
    expect(core.far).toBeLessThan(dock.far);
    expect(core.light).toBeLessThan(dock.light);
  });
});
