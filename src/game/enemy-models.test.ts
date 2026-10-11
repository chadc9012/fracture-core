import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { ENEMY_VISUALS } from "./enemy-visuals";

/** The rigged faction enemies must exist on disk, stay web-sized, and carry the clips EnemyModel blends. */
describe("rigged faction enemy models", () => {
  for (const kind of ["RAIDER", "OVERCLOCKED", "VANGUARD"] as const) for (const role of ["standard", "elite", "boss"] as const) {
    const v = ENEMY_VISUALS[kind][role];
    test(`${kind} ${role}`, () => {
      const path = `public${v.url}`;
      expect(existsSync(path)).toBe(true);
      const b = readFileSync(path);
      expect(b.length).toBeLessThan(4.5 * 1024 * 1024);
      const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
      expect((json.animations as { name: string }[]).map((a) => a.name).sort()).toEqual(["idle", "run", "shoot", "walk"]);
    });
  }
});
