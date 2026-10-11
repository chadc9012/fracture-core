import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { CIVILIAN_BODY, civilianClip, civilianModelUrl } from "./civilian-models";

describe("civilian models", () => {
  test("every role has a body", () => {
    for (const r of ["ENGINEER", "VENDOR", "SCAVENGER", "OBSERVER", "MEDIC", "ARTISAN"] as const) expect(civilianModelUrl(r)).toBe(`/models/npcs/${CIVILIAN_BODY[r]}.glb`);
  });
  test("clips follow the AI state", () => {
    expect(civilianClip("WANDER")).toBe("walk");
    expect(civilianClip("GREET")).toBe("wave");
    expect(civilianClip("IDLE")).toBe("idle");
  });
});

describe("civilian model files", () => {
  for (const body of ["general-store", "vehicle-dealer"]) test(body, () => {
    const path = `public/models/npcs/${body}.glb`;
    expect(existsSync(path)).toBe(true);
    const b = readFileSync(path);
    const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
    expect((json.animations as { name: string }[]).map((a) => a.name).sort()).toEqual(["idle", "walk", "wave"]);
  });
});
