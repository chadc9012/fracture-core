import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { cityStreets } from "@/game/city-streets";
import type { FleetModelId } from "@/game/fleet-models";
import { GROUND_FLEET, assignLoops, findLoops, loopPath, makePath, pathAt, streetGrid, type GroundVehicle, type Path } from "@/game/neon-ground-traffic";
import { neonPlateauLevel } from "@/game/terrain";
import { InstancedFleet, type FleetInstance } from "./InstancedFleet";

/** A little ground traffic in Neon City: supply trucks and a few cars on closed routes round real street blocks, keeping right
 * (routes and lanes: neon-ground-traffic.ts). Visual only. */
export function NeonGroundTraffic() {
  const t = useRef(0);
  const { items, byModel } = useMemo(() => {
    const streets = cityStreets("neon"), grid = streetGrid(streets), loops = findLoops(grid);
    if (!loops.length) return { items: [] as FleetInstance[], byModel: new Map<FleetModelId, { v: GroundVehicle; path: Path }[]>() };
    const assigned = assignLoops(loops, GROUND_FLEET);
    const byModel = new Map<FleetModelId, { v: GroundVehicle; path: Path }[]>();
    GROUND_FLEET.forEach((v, k) => byModel.set(v.model, [...(byModel.get(v.model) ?? []), { v, path: makePath(loopPath(grid, assigned[k]!, v.reverse)) }]));
    return { items: GROUND_FLEET.map((v) => ({ model: v.model, ...(v.paint ? { paint: v.paint } : {}), x: 0, y: 0, z: 0, yaw: 0 })) as FleetInstance[], byModel };
  }, []);
  const y = useMemo(() => neonPlateauLevel() + 0.04, []);
  useFrame((_, raw) => { t.current += Math.min(raw, 0.05); });
  const place = (model: FleetModelId, i: number, o: THREE.Object3D) => {
    const e = byModel.get(model)?.[i];
    if (!e) return;
    const p = pathAt(e.path, e.v.at * e.path.length + t.current * e.v.speed);
    o.position.set(p.x, y, p.z);
    o.rotation.set(0, p.yaw, 0);
  };
  if (!items.length) return null;
  return <InstancedFleet items={items} place={place} />;
}
