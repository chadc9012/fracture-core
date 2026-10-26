// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import { barCounter, bed, bulkhead, cabinShell, desk, monitor, overheadBins, pedestalTable, seatParts, seatedFigure, sofa, swivelChair, wallX, windowFrame } from "./cabin-geometry";
import { FUSE_Y, PHANTOM_DIMS, phantomExterior } from "./phantom-geometry";
import { AVAILABLE_STYLES, SEAT_THEMES, cabinSpec } from "./passenger-cabin";

const box = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!; };
const finite = (g: THREE.BufferGeometry) => Array.from(g.attributes["position"]!.array as Float32Array).every(Number.isFinite);

describe("cabin geometry", () => {
  it("the shell is a closed cross-section the length of the cabin, with real curvature (many vertices, not a box)", () => {
    for (const mode of ["air", "sea"] as const) {
      const c = cabinSpec(mode), g = cabinShell(c.width, c.height, c.length), b = box(g);
      expect(finite(g)).toBe(true);
      expect(b.max.z - b.min.z).toBeCloseTo(c.length, 3);
      expect(b.max.y).toBeGreaterThan(c.height);
      expect(b.min.y).toBeLessThan(0);
      expect(g.attributes["position"]!.count).toBeGreaterThan(200);
      expect(wallX(c.width, c.height, 0.5)).toBeCloseTo(c.width / 2, 5);
      expect(wallX(c.width, c.height, c.height)).toBeLessThan(0.01);
      expect(finite(bulkhead(c.width, c.height)) && finite(overheadBins(c.width, c.height, c.length))).toBe(true);
    }
    expect(finite(windowFrame(0.28, 0.38))).toBe(true);
  });
  it("every seat style builds finite, rounded parts that stay inside its footprint", () => {
    for (const style of new Set([...AVAILABLE_STYLES.air, ...AVAILABLE_STYLES.sea])) {
      const t = SEAT_THEMES[style], p = seatParts(t, t.pitch);
      for (const g of [p.fabric, p.frame, p.trim, p.back, p.shell, p.canopy]) if (g) expect(finite(g)).toBe(true);
      const b = box(p.fabric);
      expect(b.max.x - b.min.x).toBeLessThanOrEqual(t.width + 0.01);
      expect(b.max.y).toBeLessThan(1.8);
      expect(p.fabric.attributes["position"]!.count).toBeGreaterThan(100); // bevelled, not 24-vertex boxes
      expect(p.shell !== null).toBe(t.shell !== "none");
    }
  });
  it("furniture and figures are finite and sit on the floor", () => {
    const f = seatedFigure(), s = sofa(), b = bed(), bar = barCounter(), d = desk(), m = monitor();
    for (const g of [f.clothes, f.skin, f.hair, s.body, s.cushions, b.body, b.linen, b.duvet, bar.body, bar.top, d.top, d.body, m.body, m.glass, swivelChair(true), pedestalTable()]) {
      expect(finite(g)).toBe(true);
      expect(box(g).min.y).toBeGreaterThan(-0.02);
    }
  });
});

describe("Phantom exterior geometry", () => {
  it("builds every wing style on the ground, wings wider than the fuselage, nav lights at the tips", () => {
    for (const wing of ["swept", "delta", "split"] as const) {
      const e = phantomExterior(wing), b = box(e.paint);
      for (const g of [e.paint, e.trim, e.glass, e.windows, e.metal, e.tyres, e.strip, e.exhaust]) expect(finite(g)).toBe(true);
      expect(b.max.z - b.min.z).toBeGreaterThan(PHANTOM_DIMS.length - 0.5);
      expect(b.max.x).toBeGreaterThan(8);
      expect(box(e.tyres).min.y).toBeGreaterThan(-0.05);
      expect(box(e.tyres).min.y).toBeLessThan(0.1);
      expect(Math.abs(e.navLeft.x)).toBeCloseTo(e.navRight.x, 5);
      expect(e.navRight.z).toBeGreaterThan(b.min.z);
      expect(e.navRight.z).toBeLessThan(b.max.z);
      expect(FUSE_Y).toBeGreaterThan(PHANTOM_DIMS.clearance);
    }
  });
});
