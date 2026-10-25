import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { wyrmlingOffset } from "@/game/dragon-covenant";
import { WYRMLING_MOODS, wyrmlingMood, type WyrmlingMood } from "@/game/dragon-look";
import { getCombatLevel } from "@/game/audio";
import { DragonModel } from "./DragonModel";

type Held = { current: { x: number; y: number; z: number; yaw: number; inVehicle?: boolean } };

/** Vyrak's bonded form (dragon-covenant.ts): the small chibi Wyrmling from the owner's reference sheet, floating at the
 * Operator's shoulder. Presentation only — the bond itself lives in progression.earnedRewards; hidden while driving.
 * It perches on the shoulder when you stand still and lifts off otherwise. Its mood (dragon-look.ts wyrmlingMood)
 * follows what the Operator is doing: idle = happy, sprinting or just hit (1.5 s) = alert, in a fight = aggressive, and drives the eyes, brows, jaw and wing-beat speed. */
export function Wyrmling({ held, hurtAt }: { held: Held; /** performance.now() of the Operator's last hit (Scene's audioSeen.hurtAt) */ hurtAt?: { current: { hurtAt: number } } }) {
  const root = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const pos = useRef<THREE.Vector3 | null>(null);
  const last = useRef<{ x: number; z: number } | null>(null);
  const speed = useRef(0);
  const perch = useRef(0);
  const moodRef = useRef<WyrmlingMood>("neutral");
  const [mood, setMood] = useState<WyrmlingMood>("neutral");
  useFrame(({ clock }, delta) => {
    const s = held.current, g = root.current;
    if (!g) return;
    g.visible = !s.inVehicle;
    if (s.inVehicle) { last.current = null; return; }
    const t = clock.elapsedTime;
    if (last.current && delta > 0) speed.current += (Math.hypot(s.x - last.current.x, s.z - last.current.z) / delta - speed.current) * Math.min(1, delta * 6);
    last.current = { x: s.x, z: s.z };
    const next = wyrmlingMood({ speed: speed.current, inCombat: getCombatLevel() >= 0.25, hurt: !!hurtAt && performance.now() - hurtAt.current.hurtAt < 1500 });
    if (next !== moodRef.current) { moodRef.current = next; setMood(next); }
    const m = WYRMLING_MOODS[next];
    perch.current += ((next === "happy" ? 1 : 0) - perch.current) * Math.min(1, delta * 2.5);
    const [ox, oy, oz] = wyrmlingOffset(t, s.yaw, perch.current);
    const target = new THREE.Vector3(s.x + ox, s.y + oy, s.z + oz);
    if (!pos.current) pos.current = target.clone();
    pos.current.lerp(target, Math.min(1, delta * 4));
    g.position.copy(pos.current);
    g.rotation.y = s.yaw + Math.sin(t * 0.9) * 0.2;
    const flap = m.wing + Math.sin(t * 5 * m.flap) * 0.55;
    if (wingL.current) wingL.current.rotation.z = flap;
    if (wingR.current) wingR.current.rotation.z = -flap;
  });
  return (
    <group ref={root} scale={0.55}>
      <DragonModel variant="wyrmling" mood={mood} refs={{ wingL, wingR }} ember={1.3} />
      <pointLight position={[0, 0.4, 0.6]} color="#ff7a2e" intensity={2} distance={4} />
    </group>
  );
}
