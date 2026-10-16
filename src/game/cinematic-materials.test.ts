import { expect, test } from "bun:test";
import * as THREE from "three";
import { cinematicImported, createCinematicMaterial } from "./cinematic-materials";
test("armor and fabric have distinct physical response without changing equipment stats", () => {
 const armor = createCinematicMaterial("paintedArmor", "#123456"), fabric = createCinematicMaterial("fabric", "#123456");
 expect(armor.clearcoat).toBe(0.18); expect(fabric.clearcoat).toBe(0); expect(fabric.sheen).toBe(0.25);
 expect(fabric.roughness).toBeGreaterThan(armor.roughness); expect(fabric.normalMap?.colorSpace).toBe(THREE.NoColorSpace);
 armor.dispose(); fabric.dispose();
});
test("imported operator maps and signature colors survive tuning without mutating the cached model", () => {
 const texture = new THREE.Texture(), source = new THREE.MeshStandardMaterial({ color: "#123456", map: texture, roughness: 0.01 });
 const tuned = cinematicImported(source) as THREE.MeshStandardMaterial;
 expect(tuned).not.toBe(source); expect(tuned.map).toBe(texture); expect(tuned.color.getHex()).toBe(source.color.getHex());
 expect(tuned.roughness).toBe(0.18); expect(source.roughness).toBe(0.01); source.dispose(); tuned.dispose(); texture.dispose();
});
