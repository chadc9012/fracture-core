// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { chooseRespawn, isCheckpointSafe } from "./respawn";
import { REGIONS, regionAt } from "./world";

const war = REGIONS.find((r) => r.kind === "war")!;
const veridan = REGIONS.find((r) => r.id === "veridan")!;

describe("respawn", () => {
  test("never records a checkpoint inside a war zone", () => {
    expect(isCheckpointSafe({ x: war.x, z: war.z }, [], false)).toBe(false);
  });
  test("no checkpoint while hostiles are within 40m", () => {
    expect(isCheckpointSafe({ x: veridan.x, z: veridan.z }, [{ x: veridan.x + 20, z: veridan.z }], false)).toBe(false);
  });
  test("dying in a war zone without checkpoint respawns in a safe area", () => {
    const p = chooseRespawn({ x: war.x, z: war.z }, null, []);
    expect(["safe", "starter"]).toContain(regionAt(p.x, p.z)!.kind);
  });
  test("uses the last checkpoint when it is clear", () => {
    const cp = { x: veridan.x, z: veridan.z };
    expect(chooseRespawn({ x: war.x, z: war.z }, cp, []).label).toBe("last checkpoint");
  });
  test("skips a checkpoint now under fire and spawns away from crossfire", () => {
    const cp = { x: veridan.x, z: veridan.z };
    const p = chooseRespawn(cp, cp, [{ x: veridan.x + 5, z: veridan.z }]);
    expect(p.label).not.toBe("last checkpoint");
    expect(Math.hypot(p.x - veridan.x - 5, p.z - veridan.z)).toBeGreaterThanOrEqual(40);
  });
});
