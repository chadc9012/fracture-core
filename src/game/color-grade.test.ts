import { describe, expect, test } from "bun:test";
import { cssGrade, gradeFor, gradeRegionAt, REGION_GRADE } from "./color-grade";
import { NEON_SITE, REGIONS } from "./world";

describe("colour grade", () => {
  test("the wilds are muted and firm; Neon City is the one saturated, high-contrast cyberpunk grade", () => {
    for (const id of Object.keys(REGION_GRADE)) {
      const g = gradeFor(id);
      if (id === "neon") { expect(g.saturation).toBeGreaterThan(1); expect(g.contrast).toBeGreaterThan(1.2); }
      else { expect(g.saturation).toBeLessThan(0.9); expect(g.contrast).toBeGreaterThan(1.05); }
    }
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
  test("the CSS fallback is a valid filter that desaturates the wilds", () => {
    const css = cssGrade(gradeFor("wastelands"));
    expect(css).toMatch(/^saturate\(0\.\d+\) contrast\(1\.\d+\) brightness\(0\.\d+\) sepia\(0\.\d+\)$/);
    expect(cssGrade(gradeFor("neon"))).toContain("hue-rotate");
  });
});
