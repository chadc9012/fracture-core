import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { NEON_PALETTE, NEXUS_PALETTE, benchGeometry, binGeometry, bollardGeometry, hydrantGeometry, planterFoliageGeometry, planterGeometry, shelterGeometry, signPostGeometry, signalHeadGeometry, signalPoleGeometry } from "./street-prop-geometry";
import { PROP_HALF, type PropKind } from "./city-streets";

const size = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!.getSize(new THREE.Vector3()); };

describe("street furniture geometry", () => {
  const kinds: [PropKind, (p: typeof NEXUS_PALETTE) => THREE.BufferGeometry][] = [["bench", benchGeometry], ["bin", binGeometry], ["bollard", bollardGeometry], ["planter", planterGeometry], ["hydrant", hydrantGeometry], ["shelter", shelterGeometry], ["signal", signalPoleGeometry], ["sign", signPostGeometry]];
  for (const [kind, make] of kinds) test(`${kind} is a detailed, vertex-coloured piece that fits its layout footprint`, () => {
    for (const pal of [NEXUS_PALETTE, NEON_PALETTE]) {
      const g = make(pal);
      expect(g.attributes["color"]).toBeDefined();
      expect(g.attributes["normal"]).toBeDefined();
      const tris = g.attributes["position"]!.count / 3;
      expect(tris).toBeGreaterThan(60);      // never a bare 6-segment primitive
      expect(tris).toBeLessThan(kind === "shelter" || kind === "signal" ? 3000 : 1600); // cheap enough to instance by the hundred
      const s = size(g), [a, b] = PROP_HALF[kind];
      expect(s.x / 2).toBeLessThanOrEqual(a + 0.05);
      // the shelter's timetable post and the signal's pedestrian head poke a little toward the street
      expect(s.z / 2).toBeLessThanOrEqual(b + (kind === "shelter" ? 0.3 : kind === "signal" ? 0.05 : 0.05));
      g.dispose();
    }
  });
  test("signal head and planter shrubs build", () => {
    expect(signalHeadGeometry(NEON_PALETTE).attributes["position"]!.count).toBeGreaterThan(100);
    expect(planterFoliageGeometry().attributes["position"]!.count).toBeGreaterThan(300);
  });
});
