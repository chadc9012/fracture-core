import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { cloudPuffTexture } from "@/game/sky-clouds";
import { cloudPuffs, COVER_GROWTH } from "@/game/cloud-layout";

/** Written once a frame by Scene.tsx's day/weather block and read here — same imperative shared-ref
 * pattern as Weather.tsx's fxRef, so updating ~18 sprites a frame never triggers a React re-render. */
export type SkyEnv = { cloud: number; tint: THREE.Color; /** region the player is in (sky mood), if any */ region?: string | undefined };

/** A high, far-out ring of soft billboard cloud puffs, invisible in clear weather and building up
 * with the region's live weather-cycle cloud cover. Sits past the ground fog's far distance but inside the camera far plane
 * (fog is disabled on the sprite material) since these are a sky-layer effect, not ground haze. */
export function CloudLayer({ envRef, playerRef }: { envRef: React.RefObject<SkyEnv>; playerRef?: React.RefObject<THREE.Object3D | null> }) {
  const texture = useMemo(() => cloudPuffTexture(), []);
  const group = useRef<THREE.Group>(null!);
  const puffs = useMemo(() => cloudPuffs(), []);
  const refs = useRef<(THREE.Sprite | null)[]>([]);

  useFrame((state) => {
    const env = envRef.current;
    if (!env || !group.current) return;
    const cover = Math.max(env.cloud, 0.14); // thin high cirrus even on clear days
    const visible = true;
    group.current.visible = visible;
    if (!visible) return;
    const t = state.clock.elapsedTime;
    // the ring follows the player (the puffs sit inside the camera far plane, see cloud-layout.ts)
    const pp = playerRef?.current?.position;
    if (pp) group.current.position.set(pp.x, 0, pp.z);
    puffs.forEach((p, i) => {
      const s = refs.current[i];
      if (!s) return;
      const angle = p.a + t * 0.004 * p.speed;
      s.position.set(Math.cos(angle) * p.r, p.y + Math.sin(t * 0.05 + p.drift) * 8, Math.sin(angle) * p.r);
      const sc = p.scale * (1 + cover * COVER_GROWTH);
      s.scale.set(sc, sc * 0.55, 1);
      const mat = s.material as THREE.SpriteMaterial;
      mat.opacity = p.baseOpacity * Math.min(1, cover * 1.6 + 0.08);
      mat.color.copy(env.tint);
    });
  });

  return (
    <group ref={group} name="iso:clouds">
      {puffs.map((p, i) => (
        <sprite key={i} ref={(el) => { refs.current[i] = el; }}>
          <spriteMaterial map={texture} transparent depthWrite={false} fog={false} />
        </sprite>
      ))}
    </group>
  );
}
