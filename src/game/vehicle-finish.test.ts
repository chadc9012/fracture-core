import { describe, expect, test } from "bun:test";
import { classifyCarMaterial, finishFor } from "./vehicle-finish";

describe("vehicle finish", () => {
  test("classifies authored and CC0 kit material names", () => {
    expect(classifyCarMaterial("InterceptorPaint")).toBe("paint");
    expect(classifyCarMaterial("paintRed")).toBe("paint");
    expect(classifyCarMaterial("Glass")).toBe("glass");
    expect(classifyCarMaterial("window")).toBe("glass");
    expect(classifyCarMaterial("carTire")).toBe("rubber");
    expect(classifyCarMaterial("Rubber")).toBe("rubber");
    expect(classifyCarMaterial("Chrome")).toBe("chrome");
    expect(classifyCarMaterial("Rim")).toBe("metal");
    expect(classifyCarMaterial("Headlight")).toBe("lamp");
    expect(classifyCarMaterial("lightBack")).toBe("lamp");
    expect(classifyCarMaterial("colormap")).toBe("other");
  });
  test("lamps and unknown materials are left alone; clearcoat only on HIGH/ULTRA", () => {
    for (const t of ["LOW", "MEDIUM", "HIGH", "ULTRA"] as const) {
      expect(finishFor("lamp", t)).toBeNull();
      expect(finishFor("other", t)).toBeNull();
      const paint = finishFor("paint", t);
      if (t === "LOW") expect(paint).toBeNull();
      else expect(!!paint?.clearcoat).toBe(t === "HIGH" || t === "ULTRA");
      expect(finishFor("glass", t)?.roughness).toBeLessThan(0.1);
    }
  });
});
