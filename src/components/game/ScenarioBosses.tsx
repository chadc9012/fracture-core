import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { UNIQUE_SCENARIOS, type UniqueScenario } from "@/game/unique-scenarios";
import { walkHeight } from "@/game/terrain";
import type { WorldSim } from "@/game/sim";

/** Scenario ids whose authored model is mounted and drawing. WarMachines keeps the procedural boss body visible until
 * the id is in here, so a slow download or a failed GLB never leaves an invisible boss (and never suspends the world). */
export const scenarioModelReady = new Set<string>();

class Quiet extends Component<{ id: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: unknown) { console.warn(`[boss] model for "${this.props.id}" failed, using the procedural body:`, error); }
  override render() { return this.state.failed ? null : this.props.children; }
}

function BossModel({ scenario, sim }: { scenario: UniqueScenario; sim: WorldSim }) {
  const model = scenario.model!;
  const { scene } = useGLTF(model.url);
  const built = useMemo(() => {
    const object = cloneSkinned(scene);
    object.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.castShadow = true; m.frustumCulled = false;
      const mat = m.material as THREE.MeshStandardMaterial;
      // the glowing parts are baked into the colour map; lifting it as emissive keeps them lit in shadow
      if (mat.map) { mat.emissiveMap = mat.map; mat.emissive = new THREE.Color("#ffffff"); mat.emissiveIntensity = model.glow; }
    });
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const scale = model.height / Math.max(size.y, 0.001);
    return { object, scale, offset: new THREE.Vector3(-centre.x * scale, -box.min.y * scale, -centre.z * scale) };
  }, [scene, model.height, model.glow]);
  useEffect(() => { scenarioModelReady.add(scenario.id); return () => { scenarioModelReady.delete(scenario.id); }; }, [scenario.id]);

  const group = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const m = sim.machines.find((e) => e.alive && e.scenarioId === scenario.id);
    g.visible = Boolean(m);
    if (!m) return;
    const t = clock.elapsedTime;
    g.position.set(m.x, walkHeight(m.x, m.z), m.z);
    g.rotation.set(Math.sin(t * 1.6) * 0.02, m.rot, Math.sin(t * 0.9) * 0.03);
    // wind-up telegraph: a quick swell while it charges an attack
    g.scale.setScalar((m.aim ?? 0) > 0 ? 1 + Math.abs(Math.sin(t * 28)) * 0.05 : 1);
  });
  return <group ref={group} visible={false}>
    <group position={built.offset} scale={built.scale}><primitive object={built.object} /></group>
  </group>;
}

/** Authored GLB bodies for Unique Scenario bosses. Each model is downloaded only once its boss has actually been summoned. */
export function ScenarioBosses({ sim }: { sim: WorldSim }) {
  const [wanted, setWanted] = useState<string[]>([]);
  useFrame(() => {
    for (const m of sim.machines) {
      if (m.alive && m.scenarioId && !wanted.includes(m.scenarioId)) {
        const id = m.scenarioId;
        if (UNIQUE_SCENARIOS.find((s) => s.id === id)?.model) setWanted((list) => (list.includes(id) ? list : [...list, id]));
      }
    }
  });
  return <>{UNIQUE_SCENARIOS.filter((s) => s.model && wanted.includes(s.id)).map((s) => (
    <Quiet key={s.id} id={s.id}><Suspense fallback={null}><BossModel scenario={s} sim={sim} /></Suspense></Quiet>
  ))}</>;
}
