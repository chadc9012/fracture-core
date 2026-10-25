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

/** enemy muzzle flashes (Scene pushes one per enemy shot fired from a held gun): a small ring of additive sprites */
const ENEMY_FLASHES = 8;
const enemyFlashRing: MuzzleFlashState[] = [];
let enemyFlashNext = 0;
export function flashEnemyMuzzle(x: number, y: number, z: number, big = false) {
  enemyFlashRing[enemyFlashNext++ % ENEMY_FLASHES] = { x, y, z, t: performance.now() / 1000, big };
}
export function EnemyMuzzleFlashes() {
  const sprites = useMemo(() => Array.from({ length: ENEMY_FLASHES }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite("ember") ?? null, color: "#ffcf86", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.visible = false; return s;
  }), []);
  useFrame(() => {
    const now = performance.now() / 1000;
    sprites.forEach((sp, i) => {
      const f = enemyFlashRing[i];
      const k = f ? 1 - (now - f.t) / (f.big ? LIFE * 2.5 : LIFE * 1.5) : 0;
      sp.visible = k > 0;
      if (k <= 0 || !f) return;
      sp.position.set(f.x, f.y, f.z);
      sp.scale.setScalar((f.big ? 1.8 : 0.9) * (0.6 + 0.4 * k));
    });
  });
  return <>{sprites.map((sp, i) => <primitive key={i} object={sp} />)}</>;
}
