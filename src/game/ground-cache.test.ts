import { describe, expect, it } from "bun:test";
import { makeGroundCache, GROUND_TILE } from "./ground-cache";
import { walkHeight } from "./terrain";

describe("AI ground cache", () => {
  it("reads back the exact ground on its sample points and interpolates between them", () => {
    const plane = (x: number, z: number) => 0.3 * x - 0.2 * z + 5;
    const g = makeGroundCache(plane);
    for (const [x, z] of [[0, 0], [3.25, -7.5], [-40.6, 18.1], [GROUND_TILE, GROUND_TILE * 2]] as const) expect(g.at(x, z)).toBeCloseTo(plane(x, z), 4);
  });
  it("stays close to the real ground (what line of sight needs)", () => {
    const g = makeGroundCache(walkHeight);
    let worst = 0, sum = 0, n = 0;
    // a Nexus street block and a stretch of forest hills
    for (let k = 0; k < 1200; k++) { const [ox, oz] = k % 2 ? [40, -320] : [540, -90]; const x = ox + ((k * 7919) % 64) + 0.37, z = oz + ((k * 104729) % 64) + 0.61; const e = Math.abs(g.at(x, z) - walkHeight(x, z)); worst = Math.max(worst, e); sum += e; n++; }
    expect(sum / n).toBeLessThan(0.08);
    expect(worst).toBeLessThan(2.5);
    console.log(`ai ground cache error: mean ${(sum / n).toFixed(3)} m, worst ${worst.toFixed(2)} m`);
  });
  it("keeps at most its cap of tiles", () => {
    const g = makeGroundCache(() => 0, 4);
    for (let i = 0; i < 10; i++) g.at(i * GROUND_TILE + 1, 0);
    expect(g.size()).toBe(4);
  });
});
