import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import { walkHeight } from "@/game/terrain";
import { fxFrame, fxStyle, type FxStyle } from "@/game/spell-fx";
import { AFTERIMAGE_COUNT, afterimages, shieldShell, shockwave, streak, vortex } from "@/game/ability-trails";
import type { EffectKind } from "@/game/combat-engine";

/** Phase Dash reads violet whatever the class tint; strikes keep their own colour */
const TRAIL_COLOR: Partial<Record<EffectKind, string>> = { DASH: "#a46bff", STRIKE: "#ff5a4a" };

const SLOTS = 6;
type Slot = { id: number; start: number; x: number; z: number; fx: number; fz: number; r: number; dur: number; effect: EffectKind | "NONE"; style: FxStyle };

/** Presentation for class-ability casts: a ring, dome, light pillar and burst tinted by the effect, sized to the REAL radius. It reads
 * sim.abilityEvents (CAST only) and never applies anything. Pooled meshes toggled by visibility; no per-cast allocation. */
export function AbilityFx({ sim, reducedMotion }: { sim: WorldSim; reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null);
  const slots = useRef<(Slot | null)[]>(Array.from({ length: SLOTS }, () => null));
  const seen = useRef(0);
  const next = useRef(0);
  const color = useMemo(() => new THREE.Color(), []);

  const sig = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const now = performance.now() / 1000;
    for (const e of sim.abilityEvents) {
      if (e.id <= seen.current) continue;
      seen.current = e.id;
      if (e.kind !== "CAST") continue;
      slots.current[next.current % SLOTS] = { id: e.id, start: now, x: e.x, z: e.z, fx: e.fromX ?? e.x, fz: e.fromZ ?? e.z, r: e.radius, dur: e.duration, effect: e.effect, style: fxStyle(e.effect) };
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
    // Update after expiration, so pooled signature meshes cannot persist beyond the cast.
    drawSignature(sig.current, slots.current, now, reducedMotion, color);
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
      <group ref={sig}>
        {Array.from({ length: SLOTS }, (_, i) => (
          <group key={i} visible={false}>
            {/* 0..AFTERIMAGE_COUNT-1: ghost silhouettes */}
            {Array.from({ length: AFTERIMAGE_COUNT }, (_, j) => (
              <group key={j}>
                <mesh position={[0, 1.0, 0]}><capsuleGeometry args={[0.3, 0.9, 4, 10]} />{mat}</mesh>
                <mesh position={[0, 1.85, 0]}><sphereGeometry args={[0.2, 10, 8]} />{mat}</mesh>
              </group>
            ))}
            {/* streak */}
            <mesh><boxGeometry args={[1, 1, 1]} />{mat}</mesh>
            {/* vortex rings x3 */}
            {[0, 1, 2].map((k) => <mesh key={k} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.86, 1, 48, 1, 0, Math.PI * 1.6]} />{mat}</mesh>)}
            {/* shield shell */}
            <mesh><icosahedronGeometry args={[1, 2]} /><meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} wireframe fog={false} /></mesh>
            {/* shockwave rings x2 */}
            {[0, 1].map((k) => <mesh key={k} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.92, 1, 64]} />{mat}</mesh>)}
          </group>
        ))}
      </group>
    </group>
  );
}

/** The spec's signature looks layered on top of the generic flourish, all sampled from ability-trails.ts. */
function drawSignature(root: THREE.Group | null, slots: readonly (Slot | null)[], now: number, reducedMotion: boolean, color: THREE.Color) {
  if (!root) return;
  const tint = (m: THREE.Object3D | undefined, c: string, o: number) => {
    const mat = (m as THREE.Mesh | undefined)?.material as THREE.MeshBasicMaterial | undefined;
    if (mat) { mat.color.copy(color.set(c)); mat.opacity = Math.max(0, o); }
  };
  slots.forEach((slot, i) => {
    const node = root.children[i] as THREE.Group | undefined;
    if (!node) return;
    node.visible = !!slot;
    if (!slot) return;
    const age = now - slot.start;
    const kids = node.children;
    const G = AFTERIMAGE_COUNT;
    // afterimages + streak (Phase Dash / Shadow Strike)
    const trailColor = TRAIL_COLOR[slot.effect as EffectKind];
    const ghosts = trailColor ? afterimages(slot.fx, slot.fz, slot.x, slot.z, age, reducedMotion) : [];
    const yaw = Math.atan2(slot.x - slot.fx, slot.z - slot.fz);
    for (let j = 0; j < G; j++) {
      const ghost = kids[j] as THREE.Group, gh = ghosts[j];
      ghost.visible = !!gh;
      if (!gh) continue;
      ghost.position.set(gh.x, walkHeight(gh.x, gh.z), gh.z);
      ghost.rotation.y = yaw; ghost.scale.setScalar(gh.scale);
      tint(ghost.children[0], trailColor!, gh.opacity * 0.55); tint(ghost.children[1], trailColor!, gh.opacity * 0.7);
    }
    const st = kids[G] as THREE.Mesh, sk = trailColor && ghosts.length ? streak(age) : { width: 0, opacity: 0 };
    st.visible = sk.opacity > 0;
    if (st.visible) {
      const len = Math.hypot(slot.x - slot.fx, slot.z - slot.fz);
      const mx = (slot.x + slot.fx) / 2, mz = (slot.z + slot.fz) / 2;
      st.position.set(mx, walkHeight(mx, mz) + 1.1, mz); st.rotation.set(0, yaw, 0); st.scale.set(sk.width, sk.width * 1.6, len);
      tint(st, "#e9dcff", sk.opacity);
    }
    // Gravity Rift vortex (Disruption)
    const vx = slot.effect === "SILENCE" ? vortex(age, slot.r, slot.dur) : [];
    for (let k = 0; k < 3; k++) {
      const ring = kids[G + 1 + k] as THREE.Mesh, v = vx[k];
      ring.visible = !!v;
      if (!v) continue;
      ring.position.set(slot.x, walkHeight(slot.x, slot.z) + 0.3 + k * 0.15, slot.z);
      ring.scale.set(v.r, v.r, 1); ring.rotation.z = v.spin;
      tint(ring, k === 1 ? "#f0e4ff" : "#b07cff", v.opacity);
    }
    // Resonance Shield shell
    const shell = kids[G + 4] as THREE.Mesh;
    const sh = slot.effect === "DOME" || slot.effect === "BLOCK" ? shieldShell(age, slot.dur || 1) : { visible: false, scale: 0, opacity: 0 };
    shell.visible = sh.visible;
    if (sh.visible) {
      const r = Math.max(2.2, Math.min(14, slot.r || 3));
      shell.position.set(slot.x, walkHeight(slot.x, slot.z), slot.z);
      shell.scale.setScalar(r * sh.scale); shell.rotation.y = age * 0.3;
      tint(shell, "#7fe6ff", sh.opacity);
    }
    // Fracture Surge shockwave
    const sw = slot.effect === "DAMAGE" || slot.effect === "SIEGE" ? shockwave(age, Math.max(2, slot.r)) : [];
    for (let k = 0; k < 2; k++) {
      const ring = kids[G + 5 + k] as THREE.Mesh, w = sw[k];
      ring.visible = !!w;
      if (!w) continue;
      ring.position.set(slot.x, walkHeight(slot.x, slot.z) + 0.15, slot.z);
      ring.scale.set(w.r, w.r, 1);
      tint(ring, k ? "#fff0cf" : "#ff9a3a", w.opacity);
    }
  });
}
