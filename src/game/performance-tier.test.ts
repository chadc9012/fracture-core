import { describe, expect, test } from "bun:test";
import { defaultTierForGpu } from "./performance";

describe("defaultTierForGpu", () => {
  test("integrated and software GPUs start on LOW", () => {
    expect(defaultTierForGpu("ANGLE (Intel, ANGLE Metal Renderer: Intel(R) Iris(TM) Plus Graphics, Unspecified Version)")).toBe("LOW");
    expect(defaultTierForGpu("Mali-G78")).toBe("LOW");
    expect(defaultTierForGpu("Google SwiftShader")).toBe("LOW");
  });
  test("discrete and Apple GPUs start on MEDIUM; unknown stays MEDIUM", () => {
    expect(defaultTierForGpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)")).toBe("MEDIUM");
    expect(defaultTierForGpu("ANGLE (Apple, ANGLE Metal Renderer: Apple M2)")).toBe("MEDIUM");
    expect(defaultTierForGpu(null)).toBe("MEDIUM");
  });
});
