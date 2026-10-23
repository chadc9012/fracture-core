import { useMemo } from "react";
import type * as THREE from "three";

import { FLEET_MODELS, type FleetModelId } from "@/game/fleet-models";
import { InstancedGlb } from "./InstancedGlb";

/**
 * Parked cars and city traffic from the authored fleet models: one InstancedGlb batch per model (InstancedGlb.tsx), with
 * per-instance paint. `place` moves traffic every frame; parked cars are placed once.
 */
export type FleetInstance = { model: FleetModelId; x: number; y: number; z: number; yaw: number; paint?: string };

export function InstancedFleet({ items, place, shadows = true }: { items: FleetInstance[]; place?: (model: FleetModelId, i: number, o: THREE.Object3D) => void; shadows?: boolean }) {
  const groups = useMemo(() => {
    const m = new Map<FleetModelId, FleetInstance[]>();
    for (const it of items) m.set(it.model, [...(m.get(it.model) ?? []), it]);
    return [...m.entries()];
  }, [items]);
  return <group>{groups.map(([model, list]) => {
    const def = FLEET_MODELS[model];
    const placed = list.map((it) => ({ ...it, scale: def.scale }));
    return <InstancedGlb key={model} url={def.url} items={placed} shadows={shadows} {...(place ? { place: (i: number, o: THREE.Object3D) => { place(model, i, o); o.scale.setScalar(def.scale); } } : {})} />;
  })}</group>;
}
