import { describe, expect, test } from "bun:test";
import { cssGrade, gradeFor, gradeRegionAt, REGION_GRADE } from "./color-grade";
import { NEON_SITE, REGIONS } from "./world";

describe("colour grade", () => {
  test("the wilds keep their colour (the references are lush, not washed out) with firm contrast; Neon City is the most saturated", () => {
    for (const id of Object.keys(REGION_GRADE)) {
      const g = gradeFor(id);
      expect(g.contrast).toBeGreaterThan(1.05);
      if (id === "neon") { expect(g.contrast).toBeGreaterThan(1.2); continue; }
      expect(g.saturation).toBeGreaterThan(0.9); expect(g.saturation).toBeLessThan(gradeFor("neon").saturation);
    }
    expect(gradeFor("veridan").saturation).toBeGreaterThan(gradeFor("swamps").saturation); // the forest is the lush one
  });
  test("nights get firmer and darker at the edges", () => {
    expect(gradeFor("veridan", 1).contrast).toBeGreaterThan(gradeFor("veridan", 0).contrast);
    expect(gradeFor("veridan", 1).vignette).toBeGreaterThan(gradeFor("veridan", 0).vignette);
  });
  test("Neon City's plateau picks the neon grade, a region centre picks its own", () => {
    expect(gradeRegionAt(NEON_SITE.x, NEON_SITE.z)).toBe("neon");
    // any region centre off Neon City's plateau grades as that region
    for (const r of REGIONS) if (Math.hypot(r.x - NEON_SITE.x, r.z - NEON_SITE.z) > 400) expect(gradeRegionAt(r.x, r.z)).toBe(r.id);
  });
  test("the CSS fallback is a valid filter", () => {
    const css = cssGrade(gradeFor("wastelands"));
    expect(css).toMatch(/^saturate\([01]\.\d+\) contrast\(1\.\d+\) brightness\([01]\.\d+\) sepia\(0\.\d+\)$/);
    expect(cssGrade(gradeFor("neon"))).toContain("hue-rotate");
  });
});
