import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { softSprite } from "./softSprite";

/** The flash at a vehicle barrel when its hardpoint fires (Scene sets the ref; presentation only). A hot additive core —
 * no point light, since an always-mounted light costs every lit pixel all game. Cannons and rockets flash bigger. */
export type MuzzleFlashState = { x: number; y: number; z: number; t: number; big: boolean };
const LIFE = 0.06;

export function MuzzleFlash({ flash }: { flash: React.MutableRefObject<MuzzleFlashState | null> }) {
  const parts = useMemo(() => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite("ember") ?? null, color: "#ffd890", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    sprite.visible = false;
    return { sprite };
  }, []);
  useFrame(() => {
    const f = flash.current, now = performance.now() / 1000;
    const k = f ? 1 - (now - f.t) / (f.big ? LIFE * 2 : LIFE) : 0;
    const on = k > 0;
    parts.sprite.visible = on;
    if (!on || !f) return;
    parts.sprite.position.set(f.x, f.y, f.z);
    parts.sprite.scale.setScalar((f.big ? 2.6 : 1.1) * (0.6 + 0.4 * k));
  });
  return <primitive object={parts.sprite} />;
}
