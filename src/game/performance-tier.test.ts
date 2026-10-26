import { describe, expect, test } from "bun:test";
import { defaultTierForGpu } from "./performance";

describe("defaultTierForGpu", () => {
  test("integrated and software GPUs start on LOW", () => {
    expect(defaultTierForGpu("ANGLE (Intel, ANGLE Metal Renderer: Intel(R) Iris(TM) Plus Graphics, Unspecified Version)")).toBe("LOW");
    expect(defaultTierForGpu("Mali-G52")).toBe("LOW");
    expect(defaultTierForGpu("Adreno (TM) 610")).toBe("LOW");
    expect(defaultTierForGpu("Google SwiftShader")).toBe("LOW");
  });
  test("discrete and Apple GPUs start on MEDIUM; unknown stays MEDIUM", () => {
    expect(defaultTierForGpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)")).toBe("MEDIUM");
    expect(defaultTierForGpu("ANGLE (Apple, ANGLE Metal Renderer: Apple M2)")).toBe("MEDIUM");
    expect(defaultTierForGpu(null)).toBe("MEDIUM");
  });
  test("flagship phone GPUs start on MEDIUM (the 30 fps phone cap keeps them steady)", () => {
    expect(defaultTierForGpu("Adreno (TM) 730")).toBe("MEDIUM");
    expect(defaultTierForGpu("Samsung Xclipse 920")).toBe("MEDIUM");
    expect(defaultTierForGpu("Mali-G710 MC10")).toBe("MEDIUM");
    expect(defaultTierForGpu("Mali-G78")).toBe("MEDIUM");
  });
});
