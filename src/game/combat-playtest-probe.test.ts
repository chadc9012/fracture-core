import { test } from "bun:test";
import { heightAt, walkHeight, WATER_LEVEL } from "./terrain";
import { REGIONS, WORLD_SCALE } from "./world";
test("probe", () => {
  console.log("WORLD_SCALE", WORLD_SCALE, "water", WATER_LEVEL);
  for (const r of REGIONS) {
    const hs: number[] = [];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) hs.push(heightAt(r.x + i * 20, r.z + j * 20));
    console.log(r.id, r.kind, r.x.toFixed(0), r.z.toFixed(0), "r", r.radius.toFixed(0), "h min/max", Math.min(...hs).toFixed(1), Math.max(...hs).toFixed(1), "walk", walkHeight(r.x, r.z).toFixed(1), (r as any).speed);
  }
  console.log("ocean", heightAt(4000, 4000), walkHeight(4000, 4000));
});
