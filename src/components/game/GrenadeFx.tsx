import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import { GRENADE } from "@/game/enemy-tactics";
import { walkHeight } from "@/game/terrain";

/**
 * Enemy grenades on screen (presentation only; sim.grenades decides everything): a small dark frag with a blinking
 * light, and once it is down a red danger ring on the ground the exact size of the blast, pulsing faster as the fuse runs
 * out. The ring is the telegraph: anything inside it gets hurt.
 */
const SLOTS = 3;
export function GrenadeFx({ sim }: { sim: WorldSim }) {
  const parts = useMemo(() => {
    const root = new THREE.Group(); root.name = "enemy-grenades";
    const body = new THREE.MeshStandardMaterial({ color: "#2f342c", roughness: 0.7, metalness: 0.5 });
    const slots = Array.from({ length: SLOTS }, () => {
      const g = new THREE.Group();
      const frag = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 9), body); frag.scale.set(1, 1.25, 1);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.05, 8), body); cap.position.y = 0.1;
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), new THREE.MeshBasicMaterial({ color: "#ff2a1a", toneMapped: false }));
      led.position.set(0.05, 0.06, 0);
      g.add(frag, cap, led); g.visible = false;
      const ringMat = new THREE.MeshBasicMaterial({ color: "#ff3a22", transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(GRENADE.radius - 0.18, GRENADE.radius, 48), ringMat);
      ring.rotation.x = -Math.PI / 2; ring.visible = false;
      const fill = new THREE.Mesh(new THREE.CircleGeometry(GRENADE.radius, 48), new THREE.MeshBasicMaterial({ color: "#ff2a1a", transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
      fill.rotation.x = -Math.PI / 2; fill.visible = false;
      root.add(g, ring, fill);
      return { g, led: led.material as THREE.MeshBasicMaterial, ring, ringMat, fill, fillMat: fill.material as THREE.MeshBasicMaterial };
    });
    return { root, slots };
  }, []);
  useFrame(() => {
    const now = performance.now() / 1000;
    parts.slots.forEach((s, i) => {
      const gr = sim.grenades[i];
      s.g.visible = !!gr; s.ring.visible = !!gr; s.fill.visible = !!gr;
      if (!gr) return;
      s.g.position.set(gr.x, gr.y, gr.z);
      if (!gr.rest) { s.g.rotation.x += 0.3; s.g.rotation.z += 0.21; }
      const rate = 2 + (1 - Math.max(0, gr.fuse) / GRENADE.fuse) * 10;
      const blink = (now * rate) % 1 < 0.45;
      s.led.color.set(blink ? "#ff2a1a" : "#3a0705");
      const gy = walkHeight(gr.x, gr.z) + 0.06;
      s.ring.position.set(gr.x, gy, gr.z); s.fill.position.set(gr.x, gy - 0.01, gr.z);
      s.ringMat.opacity = (gr.rest ? 0.45 : 0.25) + (blink ? 0.3 : 0);
      s.fillMat.opacity = gr.rest ? 0.06 + (blink ? 0.06 : 0) : 0.03;
    });
  });
  return <primitive object={parts.root} />;
}
