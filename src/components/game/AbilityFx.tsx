import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import { walkHeight } from "@/game/terrain";
import { fxFrame, fxStyle, type FxStyle } from "@/game/spell-fx";

const SLOTS = 6;
type Slot = { id: number; start: number; x: number; z: number; r: number; style: FxStyle };

/** Presentation for class-ability casts: a ring, dome, light pillar and burst tinted by the effect, sized to the REAL radius. It reads
 * sim.abilityEvents (CAST only) and never applies anything. Pooled meshes toggled by visibility; no per-cast allocation. */
export function AbilityFx({ sim, reducedMotion }: { sim: WorldSim; reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null);
  const slots = useRef<(Slot | null)[]>(Array.from({ length: SLOTS }, () => null));
  const seen = useRef(0);
  const next = useRef(0);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const now = performance.now() / 1000;
    for (const e of sim.abilityEvents) {
      if (e.id <= seen.current) continue;
      seen.current = e.id;
      if (e.kind !== "CAST") continue;
      slots.current[next.current % SLOTS] = { id: e.id, start: now, x: e.x, z: e.z, r: e.radius, style: fxStyle(e.effect) };
      next.current++;
    }
    slots.current.forEach((slot, i) => {
      const node = g.children[i] as THREE.Group | undefined;
      if (!node) return;
      const f = slot ? fxFrame(now - slot.start, slot.style, slot.r, reducedMotion) : null;
      node.visible = !!f?.active;
      if (!slot || !f?.active) { if (slot && f && !f.active) slots.current[i] = null; return; }
      node.position.set(slot.x, walkHeight(slot.x, slot.z) + 0.2, slot.z);
      const [ring, dome, pillar, burst] = node.children as THREE.Mesh[];
      const tint = (m: THREE.Mesh | undefined, c: string, o: number) => { const mat = m?.material as THREE.MeshBasicMaterial | undefined; if (mat) { mat.color.copy(color.set(c)); mat.opacity = o; } };
      const shapes = slot.style.shapes;
      ring!.visible = shapes.includes("ring"); dome!.visible = shapes.includes("dome"); pillar!.visible = shapes.includes("pillar") && f.pillarHeight > 0; burst!.visible = shapes.includes("burst");
      ring!.scale.set(f.ringScale, f.ringScale, 1); tint(ring, slot.style.color, f.opacity);
      dome!.scale.setScalar(f.domeScale); tint(dome, slot.style.color, f.opacity * 0.28);
      pillar!.scale.set(1.2 * (1 - f.t * 0.6), f.pillarHeight, 1.2 * (1 - f.t * 0.6)); pillar!.position.y = f.pillarHeight / 2; tint(pillar, slot.style.core, f.opacity * 0.7);
      burst!.scale.setScalar(Math.max(0.2, f.ringScale * 0.45 * (0.4 + f.t))); burst!.position.y = 0.8; tint(burst, slot.style.core, f.opacity * 0.6);
    });
  });

  const mat = <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} fog={false} />;
  return (
    <group ref={root}>
      {Array.from({ length: SLOTS }, (_, i) => (
        <group key={i} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.9, 1, 64]} />{mat}</mesh>
          <mesh><sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />{mat}</mesh>
          <mesh><cylinderGeometry args={[0.5, 0.5, 1, 14, 1, true]} />{mat}</mesh>
          <mesh><sphereGeometry args={[1, 14, 10]} />{mat}</mesh>
        </group>
      ))}
    </group>
  );
}
