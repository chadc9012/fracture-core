import type { ThreeElements } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getPerfTier, LIGHT_CAP, pickLights, type LightCandidate } from "@/game/perf-budget";

/**
 * A point light that only exists for the renderer while the camera is near it. Every visible light is
 * evaluated for every lit pixel, so district lights that are far away cost a lot and show nothing.
 * All DistrictLights share one evaluation (a few times a second): lights inside their `range` (hysteresis: an
 * "on" light stays until range * 1.25) compete nearest-first for the tier's light cap (perf-budget.ts LIGHT_CAP),
 * so the lit-pixel cost is bounded however many districts overlap. The light count only changes -- and shaders
 * only recompile -- when you actually enter or leave a district.
 */
type Entry = { id: number; light: THREE.PointLight; range: number };
const registry = new Map<number, Entry>();
let nextId = 1;
let lastEval = 0;
const world = new THREE.Vector3();

function evaluate(camera: THREE.Camera) {
  const candidates: LightCandidate[] = [];
  for (const e of registry.values()) { e.light.getWorldPosition(world); candidates.push({ id: e.id, d: world.distanceTo(camera.position), range: e.range, on: e.light.visible }); }
  const allowed = pickLights(candidates, LIGHT_CAP[getPerfTier()]);
  for (const e of registry.values()) { const on = allowed.has(e.id); if (e.light.visible !== on) e.light.visible = on; }
}

export function DistrictLight({ range = 90, ...props }: { range?: number } & ThreeElements["pointLight"]) {
  const light = useRef<THREE.PointLight>(null);
  const camera = useThree((s) => s.camera);
  const id = useRef(nextId++).current;
  useEffect(() => {
    const l = light.current;
    if (l) registry.set(id, { id, light: l, range });
    return () => { registry.delete(id); };
  }, [id, range]);
  useFrame(() => {
    const now = performance.now();
    if (now - lastEval < 400) return;
    lastEval = now;
    evaluate(camera);
  });
  return <pointLight ref={light} visible={false} {...props} />;
}
