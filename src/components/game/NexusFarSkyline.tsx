import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildings } from "@/game/nexus-districts";
import { BUILDING_MODELS, nexusHubTowers } from "@/game/building-models";
import { REGIONS } from "@/game/world";
import { walkHeight } from "@/game/terrain";
import { NEAR_SCALE } from "@/game/perf-budget";
import type { RenderTier } from "@/game/performance";
import { lampLevel, worldLight } from "@/game/world-light";
import { facadeTexture } from "./InstancedGlb";

const NEXUS = REGIONS.find((r) => r.id === "nexus")!;
/** the full city mounts inside this radius (Scene's city:nexus NearOnly); the stand-in shows outside it */
export const CITY_MOUNT_R = 330;

/** Nexus from afar (owner's overlook frame: the skyline over the water from the hills). The full city only mounts near it, so
 * from a lookout or across the strait there was no city at all on LOW/MEDIUM. This stands in for it beyond the mount radius:
 * one instanced box per district building and hub tower, at their real footprints and heights, with the facade window texture
 * lit at night. A single draw; hidden as soon as the real city mounts. */
export function NexusFarSkyline({ tier }: { tier: RenderTier }) {
  const camera = useThree((s) => s.camera);
  const list = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; base: number; top: number; yaw: number }[] = [];
    // a tall block reads as a tower, not a crate: a setback crown on the top fifth, and a mast on the tallest
    const add = (x: number, z: number, w: number, d: number, base: number, top: number, yaw: number, crown: boolean) => {
      const h = top - base;
      if (crown && h > 24) {
        const cut = base + h * 0.8;
        out.push({ x, z, w, d, base, top: cut, yaw }, { x, z, w: w * 0.66, d: d * 0.66, base: cut, top, yaw });
      } else out.push({ x, z, w, d, base, top, yaw });
      if (h > 45) out.push({ x, z, w: 0.7, d: 0.7, base: top, top: top + h * 0.18, yaw });
    };
    for (const b of buildings()) add(b.x, b.z, b.w, b.d, b.base, b.top, b.yaw, b.crown);
    for (const t of nexusHubTowers(NEXUS)) { const m = BUILDING_MODELS[t.model], y = walkHeight(t.x, t.z) - 0.2; add(t.x, t.z, m.w, m.d, y, y + m.height, t.rot, m.height > 30); }
    return out;
  }, []);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#4a5868", roughness: 0.35, metalness: 0.55, emissive: "#ffffff", emissiveIntensity: 0.15 });
    const tex = facadeTexture();
    if (tex) m.emissiveMap = tex;
    return m;
  }, []);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  useEffect(() => () => { mat.dispose(); geo.dispose(); }, [mat, geo]);
  useLayoutEffect(() => {
    const m = mesh.current; if (!m) return;
    const o = new THREE.Object3D();
    list.forEach((b, i) => { o.position.set(b.x, b.base, b.z); o.rotation.set(0, b.yaw, 0); o.scale.set(b.w, Math.max(3, b.top - b.base), b.d); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  }, [list]);
  useFrame(() => {
    const m = mesh.current; if (!m) return;
    const d = Math.hypot(camera.position.x - NEXUS.x, camera.position.z - NEXUS.z);
    // the same hysteresis as Scene's NearOnly (mounts inside R, unmounts past 1.15 R), mirrored, so the two never overlap
    const R = CITY_MOUNT_R * NEAR_SCALE[tier];
    m.visible = m.visible ? d > R : d > R * 1.15;
    mat.emissiveIntensity = 0.12 + 1.5 * lampLevel(worldLight.night);
  });
  return <instancedMesh ref={mesh} args={[geo, mat, list.length]} name="nexus-far-skyline" frustumCulled={false} castShadow={false} receiveShadow={false} />;
}
