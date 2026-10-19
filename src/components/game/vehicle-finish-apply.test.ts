import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { applyVehicleFinish } from "./VehicleFinish";
import { setPerfTier } from "@/game/perf-budget";

const car = () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: "colormap" })); g.add(m); return { g, m }; };

describe("applying the vehicle finish", () => {
  test("applying twice finishes the original once (no colormap:finish:finish)", () => {
    setPerfTier("HIGH");
    const { g, m } = car();
    applyVehicleFinish(g); applyVehicleFinish(g);
    expect((m.material as THREE.Material).name).toBe("colormap:finish");
    expect((m.material as THREE.MeshPhysicalMaterial).clearcoat).toBeGreaterThan(0);
  });
  test("a tier change re-derives from the original: LOW keeps the kit's own material", () => {
    setPerfTier("HIGH");
    const { g, m } = car();
    const original = m.material;
    applyVehicleFinish(g);
    setPerfTier("LOW");
    applyVehicleFinish(g);
    expect(m.material).toBe(original);
    setPerfTier("MEDIUM");
  });
});
