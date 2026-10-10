import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { cloudPuffTexture } from "@/game/sky-clouds";

/** Written once a frame by Scene.tsx's day/weather block and read here — same imperative shared-ref
 * pattern as Weather.tsx's fxRef, so updating ~18 sprites a frame never triggers a React re-render. */
export type SkyEnv = { cloud: number; tint: THREE.Color };

const COUNT = 18;
function mulberry(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** A high, far-out ring of soft billboard cloud puffs, invisible in clear weather and building up
 * with the region's live weather-cycle cloud cover. Sits well past the ground fog's far distance
 * (fog is disabled on the sprite material) since these are a sky-layer effect, not ground haze. */
export function CloudLayer({ envRef }: { envRef: React.RefObject<SkyEnv> }) {
  const texture = useMemo(() => cloudPuffTexture(), []);
  const group = useRef<THREE.Group>(null!);
  const puffs = useMemo(() => {
    const rnd = mulberry(4471);
    return Array.from({ length: COUNT }, () => ({
      a: rnd() * Math.PI * 2,
      r: 900 + rnd() * 1400,
      y: 260 + rnd() * 160,
      scale: 220 + rnd() * 340,
      speed: 1.4 + rnd() * 2.2,
      baseOpacity: 0.35 + rnd() * 0.4,
      drift: rnd() * Math.PI * 2,
    }));
  }, []);
  const refs = useRef<(THREE.Sprite | null)[]>([]);

  useFrame((state) => {
    const env = envRef.current;
    if (!env || !group.current) return;
    const cover = Math.max(env.cloud, 0.14); // thin high cirrus even on clear days
    const visible = true;
    group.current.visible = visible;
    if (!visible) return;
    const t = state.clock.elapsedTime;
    puffs.forEach((p, i) => {
      const s = refs.current[i];
      if (!s) return;
      const angle = p.a + t * 0.004 * p.speed;
      s.position.set(Math.cos(angle) * p.r, p.y + Math.sin(t * 0.05 + p.drift) * 8, Math.sin(angle) * p.r);
      const sc = p.scale * (1 + cover * 0.25);
      s.scale.set(sc, sc * 0.55, 1);
      const mat = s.material as THREE.SpriteMaterial;
      mat.opacity = p.baseOpacity * Math.min(1, cover * 1.6 + 0.08);
      mat.color.copy(env.tint);
    });
  });

  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <sprite key={i} ref={(el) => { refs.current[i] = el; }}>
          <spriteMaterial map={texture} transparent depthWrite={false} fog={false} />
        </sprite>
      ))}
    </group>
  );
}
