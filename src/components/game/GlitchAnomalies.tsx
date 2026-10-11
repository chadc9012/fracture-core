import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { glitchAnomalies, leafHover, ripples } from "@/game/glitch-anomalies";

/** a five-lobed maple-ish leaf outline, 0.5 m across */
function leafShape(): THREE.Shape {
  const s = new THREE.Shape();
  const lobes = 5, pts: [number, number][] = [];
  for (let i = 0; i <= lobes * 2; i++) {
    const a = Math.PI / 2 + (i / (lobes * 2)) * Math.PI * 2 * 0.86 - Math.PI * 0.86;
    const r = i % 2 ? 0.1 : 0.25 + (i === lobes ? 0.04 : 0);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  s.moveTo(0, -0.22); pts.forEach(([x, y]) => s.lineTo(x, y)); s.lineTo(0, -0.22);
  return s;
}

/** Time-glitch anomalies beside the Verdant trail (layout/timing: glitch-anomalies.ts): a leaf frozen mid-fall, rings of distortion rippling
 * out from it, and a faint cyan stutter flash when the simulation "skips". Presentation only. */
export function GlitchAnomalies() {
  const list = useMemo(() => glitchAnomalies(), []);
  const geo = useMemo(() => new THREE.ShapeGeometry(leafShape()), []);
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    list.forEach((a, i) => {
      const g = groups.current[i]; if (!g) return;
      if (Math.hypot(camera.position.x - a.x, camera.position.z - a.z) > 70) { g.visible = false; return; }
      g.visible = true;
      g.lookAt(camera.position.x, a.y, camera.position.z);
      const h = leafHover(t, a.phase);
      const leaf = g.children[0]!; leaf.position.y = h.dy; leaf.rotation.z = h.spin;
      const rs = ripples(t + a.phase);
      rs.forEach((r, k) => { const m = g.children[1 + k] as THREE.Mesh; m.scale.setScalar(r.r); (m.material as THREE.MeshBasicMaterial).opacity = r.o * (h.skip ? 1.6 : 1); });
      const flash = g.children[4] as THREE.Mesh; (flash.material as THREE.MeshBasicMaterial).opacity = h.skip ? 0.35 : 0;
    });
  });
  return <group>{list.map((a, i) => (
    <group key={i} ref={(n) => { groups.current[i] = n; }} position={[a.x, a.y, a.z]}>
      <mesh geometry={geo} rotation-x={-0.2}><meshStandardMaterial color="#e08a2c" emissive="#7a3a08" emissiveIntensity={0.35} side={THREE.DoubleSide} roughness={0.7} /></mesh>
      {[0, 1, 2].map((k) => <mesh key={k}><ringGeometry args={[0.96, 1, 48]} /><meshBasicMaterial color="#cfefff" transparent opacity={0} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} /></mesh>)}
      <mesh><circleGeometry args={[0.9, 24]} /><meshBasicMaterial color="#7fe8ff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
    </group>
  ))}</group>;
}
