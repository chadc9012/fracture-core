import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cityStreets } from "@/game/city-streets";
import { MODELS, type ModelKey } from "@/game/models";
import { assignWalkers, pavementWalks, walkerPose, type Walker } from "@/game/neon-pedestrians";
import { neonPlateauLevel } from "@/game/terrain";
import { QuietModel, useModel } from "./Vehicle";

const NPC_KEYS: ModelKey[] = ["npc_a", "npc_b", "npc_c"];
const WALKERS = 12;

function Walk({ w }: { w: Walker }) {
  const group = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const model = useModel(NPC_KEYS[w.model % NPC_KEYS.length]!);
  const norm = useMemo(() => { const s = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()); return s.y > 0.01 ? 1.72 / s.y : 1; }, [model]);
  const y = useMemo(() => neonPlateauLevel() + 0.04, []);
  const t = useRef(0);
  useFrame((_, raw) => {
    t.current += Math.min(raw, 0.05);
    const g = group.current; if (!g) return;
    const p = walkerPose(w, t.current);
    g.position.set(p.x, y, p.z);
    g.rotation.y = p.yaw; // yaw is atan2(dx, dz): the model's forward axis is +Z
    const gait = t.current * 6.2 * (0.6 + w.speed * 0.15) + w.phase * 6;
    if (body.current) { body.current.position.y = Math.abs(Math.sin(gait)) * 0.05; body.current.rotation.z = Math.sin(gait) * 0.035; }
  });
  return <group ref={group} scale={w.height * norm}><group ref={body}><primitive object={model} /></group></group>;
}

/** A few civilians on Neon City's pavements (routes: neon-pedestrians.ts). Visual only. */
export function NeonPedestrians() {
  const walkers = useMemo(() => assignWalkers(pavementWalks(cityStreets("neon")), WALKERS), []);
  return (
    <group>
      {walkers.map((w, i) => (
        <QuietModel key={i} url={MODELS[NPC_KEYS[w.model % NPC_KEYS.length]!]} fallback={null}><Suspense fallback={null}><Walk w={w} /></Suspense></QuietModel>
      ))}
    </group>
  );
}
