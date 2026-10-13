import { expect, test } from "bun:test";
import { skateDesign } from "./skate-visuals";
test("all four boot types have distinct silhouettes on every operator", () => {
  for (const cls of ["TITAN", "HUNTER", "WARLOCK"] as const) {
    const designs = ["street", "grind", "sky", "rocket"].map((id) => skateDesign(id as "street" | "grind" | "sky" | "rocket", cls));
    expect(new Set(designs.map((d) => JSON.stringify(d))).size).toBe(4);
    expect(designs[0]?.wheelRadius).toBe(0.035); expect(designs[1]?.rail).toBe(true); expect(designs[2]?.wings).toBe(true); expect(designs[3]?.turbines).toBe(true);
  }
});