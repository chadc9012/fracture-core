// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, test } from "bun:test";
import { WATER_LEVEL, colorAt, heightAt, walkHeight } from "./terrain";
import { REGIONS, WORLD_RADIUS } from "./world";
import { surfaceWeights } from "./region-materials";
import { buildChunk, chunkOf, chunksNear, type ChunkSamplers } from "./terrain-chunks";
import { clearWalls, collideWalls, setWalls, type Wall } from "./walls";
import { REGIONAL_SHOPS } from "./regional-shops";
import { shopAccessKind } from "./shop-access";
import { storefrontWalls } from "./storefronts";

const REAL_SAMPLERS: ChunkSamplers = { height: heightAt, color: colorAt, weights: surfaceWeights };

describe("terrain geometry across every region", () => {
  for (const region of REGIONS) {
    test(`${region.name}: heights are finite, bounded and continuous`, () => {
      const r = Math.min(region.radius, 120);
      for (let x = region.x - r; x <= region.x + r; x += 8) {
        for (let z = region.z - r; z <= region.z + r; z += 8) {
          const h = heightAt(x, z);
          expect(Number.isFinite(h)).toBe(true);
          expect(h).toBeGreaterThan(-40);
          expect(h).toBeLessThan(260); // Frostspire's peaks reach ~200m
          // no tears: at 1m resolution even a mountain face rises smoothly (Frostspire reaches ~3m/m)
          const step = Math.abs(heightAt(x + 1, z) - h);
          expect(step).toBeLessThan(5);
        }
      }
    });

    test(`${region.name}: a walker never sinks below the water table`, () => {
      const r = Math.min(region.radius, 120);
      for (let x = region.x - r; x <= region.x + r; x += 16) {
        for (let z = region.z - r; z <= region.z + r; z += 16) {
          const w = walkHeight(x, z);
          expect(Number.isFinite(w)).toBe(true);
          expect(w).toBeGreaterThanOrEqual(WATER_LEVEL - 0.6);
        }
      }
    });
  }

  test("Verdant Forest grassland is walkable: gentle slopes near its heart", () => {
    const forest = REGIONS.find((r) => r.id === "veridan")!;
    let steep = 0, total = 0;
    for (let x = forest.x - 60; x <= forest.x + 60; x += 6) {
      for (let z = forest.z - 60; z <= forest.z + 60; z += 6) {
        total++;
        const step = Math.max(
          Math.abs(heightAt(x + 2, z) - heightAt(x - 2, z)),
          Math.abs(heightAt(x, z + 2) - heightAt(x, z - 2)),
        );
        if (step / 4 > 0.9) steep++;
      }
    }
    // forest floor may have banks and river cuts, but most of it must be traversable on foot
    expect(steep / total).toBeLessThan(0.25);
  });

  test("terrain colours stay in range on the real heightmap world-wide", () => {
    for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x += 60) {
      for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z += 60) {
        for (const v of colorAt(x, z, heightAt(x, z))) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("chunk loading on the real terrain", () => {
  test("every region's home chunk builds a valid mesh at every LOD", () => {
    for (const region of REGIONS) {
      const c = chunkOf(region.x, region.z);
      for (let lod = 0; lod < 4; lod++) {
        const m = buildChunk(c, lod, REAL_SAMPLERS);
        expect(m.vertexCount).toBeGreaterThan(0);
        expect(Number.isFinite(m.minH)).toBe(true);
        expect(m.minH).toBeLessThanOrEqual(m.maxH);
        for (const i of m.index) expect(i).toBeLessThan(m.vertexCount);
        for (let v = 0; v < m.vertexCount; v += 7) {
          expect(Number.isFinite(m.position[v * 3]!)).toBe(true);
          expect(Number.isFinite(m.position[v * 3 + 2]!)).toBe(true);
        }
      }
    }
  });

  test("chunksNear covers the chunks around each region centre", () => {
    for (const region of REGIONS) {
      const near = chunksNear(region.x, region.z, 200, WORLD_RADIUS);
      expect(near.length).toBeGreaterThan(0);
      const home = chunkOf(region.x, region.z);
      expect(near.some((c) => c.cx === home.cx && c.cz === home.cz)).toBe(true);
    }
  });
});

describe("player collision", () => {
  test("a wall stops a body walking through it, from both sides", () => {
    clearWalls();
    const wall: Wall = { ax: 0, az: -10, bx: 0, bz: 10, half: 0.3, base: 0, top: 4 };
    setWalls("test", [wall]);
    for (const side of [-1, 1]) {
      const body = { x: side * 0.1, z: 0 };
      expect(collideWalls(body, 0.5, 0)).toBe(true);
      expect(Math.sign(body.x)).toBe(side); // pushed back out the side it came from
      expect(Math.abs(body.x)).toBeGreaterThanOrEqual(0.79); // radius + half thickness
    }
    clearWalls();
  });

  test("a body above the wall's top or below its base passes through", () => {
    clearWalls();
    setWalls("test", [{ ax: 0, az: -10, bx: 0, bz: 10, half: 0.3, base: 2, top: 4 }]);
    const high = { x: 0, z: 0 };
    expect(collideWalls(high, 0.5, 4.5)).toBe(false);
    const low = { x: 0, z: 0 };
    expect(collideWalls(low, 0.5, 0)).toBe(false); // 0 + 1.6 < base 2
    clearWalls();
  });

  test("a doorway gap in a wall line stays passable", () => {
    clearWalls();
    // 12m wall along z=0 with a 2m gap at x in [4, 6]
    setWalls("test", [
      { ax: -6, az: 0, bx: 4, bz: 0, half: 0.3, base: 0, top: 4 },
      { ax: 6, az: 0, bx: 12, bz: 0, half: 0.3, base: 0, top: 4 },
    ]);
    const through = { x: 5, z: 0 };
    expect(collideWalls(through, 0.4, 0)).toBe(false); // walks through the gap untouched
    const intoWall = { x: 0, z: 0.1 };
    expect(collideWalls(intoWall, 0.4, 0)).toBe(true); // but the solid part still blocks
    clearWalls();
  });

  test("every walk-in shop's doorway is actually passable while its walls block", () => {
    clearWalls();
    const walkIns = REGIONAL_SHOPS.filter((s) => shopAccessKind(s.id) === "interior");
    expect(walkIns.length).toBeGreaterThan(0);
    for (const shop of walkIns) {
      clearWalls();
      const walls = storefrontWalls(shop, walkHeight(shop.x, shop.z));
      expect(walls.length).toBeGreaterThan(0);
      setWalls(shop.id, walls);
      // door marker is where the game puts the "[Y] Enter" prompt
      const door = { x: shop.x, z: shop.z + 3 };
      const body = { ...door };
      const blockedAtDoor = collideWalls(body, 0.4, walkHeight(door.x, door.z));
      expect(blockedAtDoor).toBe(false);
      // the middle of a solid wall segment must block
      const w = walls.find((w) => Math.hypot(w.bx - w.ax, w.bz - w.az) > 3)!;
      const mid = { x: (w.ax + w.bx) / 2, z: (w.az + w.bz) / 2 + w.half + 0.2 };
      expect(collideWalls(mid, 0.4, walkHeight(mid.x, mid.z))).toBe(true);
    }
    clearWalls();
  });
});
