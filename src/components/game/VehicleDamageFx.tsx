import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VehicleCondition } from "@/game/vehicle-condition";
import { softSprite } from "./softSprite";

/**
 * What the player's vehicle shows of its real condition (vehicle-condition.ts; no second health system):
 * engine damage puts smoke out of the engine bay, light grey and thin at first, thick and black when the engine is
 * failing, then flame near breakdown (additive sprites, no light: a point light is paid for on every lit pixel even at zero); heavy body damage throws the odd spark and scrapes the
 * flanks. Fixed budget: a pool of sprites recycled every frame, no allocations, no physics.
 * Frame: the vehicle group (front toward +z, ground at y 0).
 */
const PUFFS = 14;
const LIFE = 1.6;
const FLAMES = 4;
const SPARKS = 6;
const ENGINE: [number, number, number] = [0, 1.55, 1.9];

type Puff = { age: number; x: number; y: number; z: number; drift: number; size: number };
const LIGHT_SMOKE = new THREE.Color("#9aa0a6");
const BLACK_SMOKE = new THREE.Color("#1a1a1c");
const tone = new THREE.Color();

export function VehicleDamageFx({ condition, speedRef }: { condition: { current: VehicleCondition }; speedRef?: { current: number } }) {
  const dot = useMemo(() => softSprite("dot"), []);
  const ember = useMemo(() => softSprite("ember"), []);
  const smokeMats = useMemo(() => Array.from({ length: PUFFS }, () => new THREE.SpriteMaterial({ map: dot ?? null, color: "#8a9096", transparent: true, depthWrite: false, opacity: 0 })), [dot]);
  const flameMats = useMemo(() => Array.from({ length: FLAMES }, () => new THREE.SpriteMaterial({ map: ember ?? dot ?? null, color: "#ff7a2a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false })), [ember, dot]);
  const sparkMat = useMemo(() => new THREE.SpriteMaterial({ map: dot ?? null, color: "#ffd27a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), [dot]);
  const puffs = useRef<Puff[]>(Array.from({ length: PUFFS }, () => ({ age: LIFE, x: 0, y: 0, z: 0, drift: 0, size: 1 })));
  const sparks = useRef(Array.from({ length: SPARKS }, () => ({ age: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })));
  const smokeG = useRef<THREE.Group>(null);
  const flameG = useRef<THREE.Group>(null);
  const sparkG = useRef<THREE.Group>(null);
  const scratches = useRef<THREE.Group>(null);
  const emit = useRef(0);
  const sparkClock = useRef(0);

  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const c = condition.current;
    const engine = c.engine / 100, body = c.body / 100;
    const speed = Math.abs(speedRef?.current ?? 0);
    // smoke: none until a quarter of the engine is gone, then more, darker and denser toward failure
    const rate = engine < 0.25 ? 0 : 3 + (engine - 0.25) * 22;
    emit.current += rate * dt;
    const list = puffs.current;
    while (emit.current >= 1) {
      emit.current -= 1;
      const p = list.find((q) => q.age >= LIFE);
      if (!p) break;
      p.age = 0; p.x = ENGINE[0] + (Math.random() - 0.5) * 0.8; p.y = ENGINE[1]; p.z = ENGINE[2] + (Math.random() - 0.5) * 0.6;
      p.drift = 0.6 + speed * 0.09; p.size = 0.5 + engine * 0.9 + Math.random() * 0.3;
    }
    tone.lerpColors(LIGHT_SMOKE, BLACK_SMOKE, Math.min(1, Math.max(0, (engine - 0.35) / 0.4)));
    smokeG.current?.children.forEach((child, i) => {
      const p = list[i]!;
      p.age += dt;
      const k = p.age / LIFE;
      child.visible = k < 1;
      if (k >= 1) return;
      // rises, spreads, and streams back behind the vehicle the faster it goes
      child.position.set(p.x + Math.sin(p.age * 2 + i) * 0.15, p.y + k * 2.4, p.z - k * p.drift * 3.2);
      const s = p.size * (0.6 + k * 2.2);
      child.scale.set(s, s, s);
      const m = smokeMats[i]!;
      m.color.copy(tone);
      m.opacity = (0.22 + engine * 0.35) * (1 - k) * Math.min(1, k * 8);
    });
    // fire past three quarters engine damage
    const burning = engine >= 0.75;
    const t = clock.elapsedTime;
    flameG.current?.children.forEach((child, i) => {
      child.visible = burning;
      if (!burning) return;
      const flick = 0.75 + 0.25 * Math.sin(t * (13 + i * 3.1) + i * 1.7);
      child.position.set(ENGINE[0] + (i - 1.5) * 0.22, ENGINE[1] - 0.15 + flick * 0.25, ENGINE[2] + 0.1 * Math.sin(i));
      const s = (0.45 + (engine - 0.75) * 1.6) * flick;
      child.scale.set(s, s * 1.5, s);
      flameMats[i]!.opacity = 0.8 * flick;
    });
    // sparks from a battered body: a short burst every second or two
    const sp = sparks.current;
    if (body >= 0.6) {
      sparkClock.current -= dt;
      if (sparkClock.current <= 0) {
        sparkClock.current = 0.6 + Math.random() * 1.6;
        const side = Math.random() < 0.5 ? -1 : 1, z = (Math.random() - 0.3) * 3;
        for (const s of sp) { s.age = 0; s.x = side * 1.45; s.y = 0.9 + Math.random() * 0.6; s.z = z; s.vx = side * (1 + Math.random() * 2); s.vy = 1.5 + Math.random() * 2.5; s.vz = (Math.random() - 0.5) * 2 - speed * 0.05; }
      }
    }
    sparkG.current?.children.forEach((child, i) => {
      const s = sp[i]!;
      s.age += dt;
      child.visible = s.age < 0.45;
      if (!child.visible) return;
      s.vy -= 9.8 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      child.position.set(s.x, s.y, s.z);
      const k = 0.09 * (1 - s.age / 0.45);
      child.scale.set(k, k, k);
    });
    if (scratches.current) {
      scratches.current.visible = c.body > 5;
      // more of the flank scraped bare as the body takes damage
      scratches.current.children.forEach((m, i) => { m.visible = c.body > 5 + i * 18; });
    }
  });

  return <>
    <group ref={smokeG}>{smokeMats.map((m, i) => <sprite key={i} material={m} visible={false} />)}</group>
    <group ref={flameG}>{flameMats.map((m, i) => <sprite key={i} material={m} visible={false} />)}</group>
    <group ref={sparkG}>{Array.from({ length: SPARKS }, (_, i) => <sprite key={i} material={sparkMat} visible={false} />)}</group>
    <group ref={scratches} visible={false}>
      {[[-1, 1.15, 0.3, 1.4], [1, 1.0, -0.4, 1.1], [-1, 0.85, -0.9, 0.9], [1, 1.25, 0.8, 0.8], [-1, 1.3, 1.1, 0.7]].map(([side, y, z, len], i) => (
        <mesh key={i} position={[side! * 1.53, y!, z!]} rotation={[0, 0, side! * 0.2]}><boxGeometry args={[0.025, 0.04, len!]} /><meshStandardMaterial color="#a3abb0" metalness={0.8} roughness={0.6} /></mesh>
      ))}
    </group>
  </>;
}
