import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { heightAt } from "@/game/terrain";
import { mulberry32 } from "@/game/rng";
import { SPECIES_PROFILE, stepCritter, type Alarms, type Critter } from "@/game/wildlife";
import { buildPopulation, HABITAT, lakeSurfaceAt } from "@/game/wildlife-habitat";

/**
 * Ambient wildlife: deer herds, foxes and rabbits in the forest, deer on the Frostspire slopes, songbirds
 * that feed on the ground and take off, vultures circling the deserts, fish schools in the lakes, snakes,
 * and dogs and cats in Nexus. Rules live in wildlife.ts (behaviour) and wildlife-habitat.ts (placement).
 *
 * Bodies are jointed procedural rigs posed every frame from the live critter (gait phase driven by distance
 * travelled, so feet don't skate; head pose for grazing and looking at the player; wing beats; tail flicks),
 * plus the fox, which is a real rigged GLB (public/models/animals/fox.glb) with Survey/Walk/Run clips and the
 * procedural fox as its fallback. Animals further than VIEW_RANGE are hidden and not posed.
 */

const VIEW_RANGE = 130;
const SKY_RANGE = 420;
const euler = new THREE.Euler(0, 0, 0, "YXZ");

/* ---------- shared geometry (built once) ---------- */
const SPHERE = new THREE.SphereGeometry(1, 18, 14);
const LIMB = (() => { const g = new THREE.CylinderGeometry(1, 0.72, 1, 10); g.translate(0, -0.5, 0); return g; })(); // pivot at the top, hangs down
const NECK = (() => { const g = new THREE.CylinderGeometry(0.7, 1, 1, 10); g.translate(0, 0.5, 0); return g; })(); // pivot at the base, points up
const CONE = new THREE.ConeGeometry(1, 1, 10);
const WING = (() => {
  // a tapered wing with a swept trailing edge, pivot at the shoulder, spanning +x
  const s = new THREE.Shape();
  s.moveTo(0, 0.5); s.quadraticCurveTo(0.55, 0.42, 1, 0.08); s.lineTo(0.92, -0.12); s.quadraticCurveTo(0.5, -0.55, 0, -0.5); s.closePath();
  const g = new THREE.ShapeGeometry(s, 8); g.rotateX(-Math.PI / 2);
  return g;
})();
const FIN = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-0.5, 1); s.lineTo(0.5, 1); s.closePath(); const g = new THREE.ShapeGeometry(s); g.rotateX(Math.PI / 2); return g; })();

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, rough = 0.92, side: THREE.Side = THREE.FrontSide) {
  const key = `${color}|${rough}|${side}`;
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, side }); matCache.set(key, m); }
  return m;
}

type V3 = [number, number, number];
function Part({ geo, color, at, scale, rot, rough, double }: { geo: THREE.BufferGeometry; color: string; at?: V3; scale: V3; rot?: V3; rough?: number; double?: boolean }) {
  return <mesh geometry={geo} material={mat(color, rough, double ? THREE.DoubleSide : THREE.FrontSide)} position={at} scale={scale} rotation={rot} castShadow />;
}

/* ---------- quadruped rig: deer, dog, cat, fox fallback ---------- */
type Coat = { coat: string; belly: string; dark: string; muzzle: string; tailTip?: string };
type QuadSpec = {
  shoulder: number; length: number; girth: number; neck: number; head: number;
  legUpper: number; legLower: number; legR: number; tail: number; tailUp: number; ears: number;
  coat: Coat; antlers?: boolean; earSharp?: boolean;
};

const DEER: QuadSpec = { shoulder: 1.0, length: 1.5, girth: 0.33, neck: 0.62, head: 0.2, legUpper: 0.31, legLower: 0.39, legR: 0.055, tail: 0.18, tailUp: 0.4, ears: 0.15, coat: { coat: "#8b5d3b", belly: "#e2d2b6", dark: "#2b211a", muzzle: "#3a2c22", tailTip: "#f2ece0" } };
const DOG: QuadSpec = { shoulder: 0.55, length: 0.85, girth: 0.2, neck: 0.28, head: 0.13, legUpper: 0.18, legLower: 0.2, legR: 0.04, tail: 0.32, tailUp: 0.9, ears: 0.08, coat: { coat: "#7a5a3a", belly: "#c9ab86", dark: "#2a201a", muzzle: "#4a3a2e" } };
const CAT: QuadSpec = { shoulder: 0.27, length: 0.48, girth: 0.1, neck: 0.12, head: 0.075, legUpper: 0.085, legLower: 0.095, legR: 0.022, tail: 0.32, tailUp: 2.4, ears: 0.05, earSharp: true, coat: { coat: "#3b3836", belly: "#6a6460", dark: "#141212", muzzle: "#2a2726" } };
const FOX: QuadSpec = { shoulder: 0.4, length: 0.68, girth: 0.13, neck: 0.18, head: 0.1, legUpper: 0.13, legLower: 0.15, legR: 0.026, tail: 0.42, tailUp: 1.1, ears: 0.075, earSharp: true, coat: { coat: "#c0622a", belly: "#efe2cf", dark: "#2a1c14", muzzle: "#efe2cf", tailTip: "#f4ece0" } };

type Joints = { body: THREE.Group; neck: THREE.Group; head: THREE.Group; tail: THREE.Group; ears: THREE.Group[]; hips: THREE.Group[]; knees: THREE.Group[] };

function Quadruped({ c, spec }: { c: Critter; spec: QuadSpec }) {
  const j = useRef<Joints>({ body: null!, neck: null!, head: null!, tail: null!, ears: [], hips: [], knees: [] });
  const { shoulder: S, length: L, girth: G, coat } = spec;
  // shoulder height is the top of the back: the torso centre sits one girth below it, the legs hang from there
  const legTop = S - G * 0.9;
  const legs: { x: number; z: number; front: boolean; offset: number; gallop: number }[] = [
    { x: -G * 0.62, z: L * 0.33, front: true, offset: 0.25, gallop: 0.0 },
    { x: G * 0.62, z: L * 0.33, front: true, offset: 0.75, gallop: 0.12 },
    { x: -G * 0.6, z: -L * 0.33, front: false, offset: 0.0, gallop: 0.5 },
    { x: G * 0.6, z: -L * 0.33, front: false, offset: 0.5, gallop: 0.62 },
  ];
  useFrame(() => {
    const k = j.current;
    if (!k.body || !k.body.parent?.parent?.visible) return;
    const p = SPECIES_PROFILE[c.species];
    const running = c.speed > p.walk * 1.6;
    const moveK = Math.min(1, c.speed / Math.max(0.1, p.walk));
    const cyc = c.phase / (Math.PI * 2);
    legs.forEach((leg, i) => {
      const t = (cyc + (running ? leg.gallop : leg.offset)) % 1;
      const sw = Math.sin(t * Math.PI * 2);
      const lift = Math.max(0, Math.cos(t * Math.PI * 2)); // knee folds while the foot swings forward
      const amp = (running ? 0.85 : 0.42) * moveK;
      k.hips[i]!.rotation.x = sw * amp;
      k.knees[i]!.rotation.x = (leg.front ? 1 : -1) * lift * (running ? 1.2 : 0.6) * moveK;
    });
    // body: bound when galloping, gentle bob when walking, slow breathing when still
    const bound = running ? Math.sin(c.phase) * 0.06 * S : Math.abs(Math.sin(c.phase)) * 0.015 * S * moveK;
    k.body.position.y = bound + Math.sin(performance.now() / 700) * 0.004 * S;
    k.body.rotation.x = running ? Math.sin(c.phase) * 0.07 : 0;
    // neck/head: grazing lowers the neck to the ground, alert raises it and turns toward the threat
    const alert = c.state === "ALERT" ? 1 : 0;
    const neckPitch = 0.55 - alert * 0.35 + c.headDown * 2.0 + (running ? 0.45 : 0);
    k.neck.rotation.set(neckPitch, c.look * 0.55, 0);
    // the head keeps the muzzle near level whatever the neck does, tipping down to graze
    k.head.rotation.set(-neckPitch + 0.25 + c.headDown * 1.0 - alert * 0.15, c.look * 0.45, 0);
    // ears flick, tail flicks (and lifts on deer when alarmed)
    const now = performance.now() / 1000;
    k.ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * (0.35 + (Math.sin(now * 0.7 + i * 2 + c.size * 9) > 0.96 ? 0.4 : 0)); });
    k.tail.rotation.x = spec.tailUp + (c.state === "FLEE" ? 0.8 : 0) + Math.sin(now * 3 + c.size * 5) * 0.12;
    k.tail.rotation.z = c.species === "DOG" ? Math.sin(now * 9) * 0.5 : Math.sin(now * 1.3) * 0.1;
  });
  const bodyY = S - G;
  return (
    <group ref={(g) => { if (g) j.current.body = g; }}>
      {/* torso: rump, barrel and chest with a lighter belly */}
      <Part geo={SPHERE} color={coat.coat} at={[0, bodyY, 0]} scale={[G, G * 1.08, L * 0.5]} />
      <Part geo={SPHERE} color={coat.coat} at={[0, bodyY + G * 0.08, L * 0.28]} scale={[G * 0.95, G * 1.12, G * 1.05]} />
      <Part geo={SPHERE} color={coat.coat} at={[0, bodyY + G * 0.05, -L * 0.3]} scale={[G * 0.98, G * 1.05, G * 1.0]} />
      <Part geo={SPHERE} color={coat.belly} at={[0, bodyY - G * 0.55, 0.02]} scale={[G * 0.72, G * 0.45, L * 0.42]} />
      {/* neck + head */}
      <group ref={(g) => { if (g) j.current.neck = g; }} position={[0, bodyY + G * 0.45, L * 0.38]}>
        <mesh geometry={NECK} material={mat(coat.coat)} scale={[G * 0.36, spec.neck, G * 0.42]} castShadow />
        <Part geo={SPHERE} color={coat.belly} at={[0, spec.neck * 0.45, G * 0.18]} scale={[G * 0.22, spec.neck * 0.42, G * 0.18]} />
        <group ref={(g) => { if (g) j.current.head = g; }} position={[0, spec.neck, 0]}>
          <Part geo={SPHERE} color={coat.coat} scale={[spec.head * 0.62, spec.head * 0.68, spec.head]} at={[0, 0, spec.head * 0.25]} />
          <Part geo={SPHERE} color={coat.muzzle} scale={[spec.head * 0.38, spec.head * 0.4, spec.head * 0.62]} at={[0, -spec.head * 0.15, spec.head * 1.0]} />
          <Part geo={SPHERE} color="#0c0a09" rough={0.4} scale={[spec.head * 0.14, spec.head * 0.11, spec.head * 0.1]} at={[0, -spec.head * 0.06, spec.head * 1.55]} />
          <Part geo={SPHERE} color="#080706" rough={0.2} scale={[spec.head * 0.1, spec.head * 0.12, spec.head * 0.1]} at={[-spec.head * 0.42, spec.head * 0.18, spec.head * 0.6]} />
          <Part geo={SPHERE} color="#080706" rough={0.2} scale={[spec.head * 0.1, spec.head * 0.12, spec.head * 0.1]} at={[spec.head * 0.42, spec.head * 0.18, spec.head * 0.6]} />
          {[-1, 1].map((sx, i) => (
            <group key={i} ref={(g) => { if (g) j.current.ears[i] = g; }} position={[sx * spec.head * 0.45, spec.head * 0.55, spec.head * 0.05]}>
              <Part geo={spec.earSharp ? CONE : SPHERE} color={coat.coat} at={[sx * spec.ears * 0.25, spec.ears * 0.5, 0]} scale={spec.earSharp ? [spec.ears * 0.42, spec.ears, spec.ears * 0.18] : [spec.ears * 0.32, spec.ears * 0.7, spec.ears * 0.12]} />
            </group>
          ))}
          {spec.antlers && c.variant === 0 && <Antlers size={spec.head * 3.2} />}
        </group>
      </group>
      {/* tail */}
      <group ref={(g) => { if (g) j.current.tail = g; }} position={[0, bodyY + G * 0.55, -L * 0.48]}>
        <Part geo={SPHERE} color={coat.coat} at={[0, -spec.tail * 0.5, 0]} scale={[G * 0.16, spec.tail * 0.55, G * 0.14]} />
        {coat.tailTip && <Part geo={SPHERE} color={coat.tailTip} at={[0, -spec.tail * 0.9, -G * 0.04]} scale={[G * 0.14, spec.tail * 0.25, G * 0.12]} />}
      </group>
      {/* legs: hip/shoulder pivot, upper limb, knee/hock pivot, lower limb, hoof/paw */}
      {legs.map((leg, i) => (
        <group key={i} position={[leg.x, legTop, leg.z]} ref={(g) => { if (g) j.current.hips[i] = g; }}>
          <mesh geometry={LIMB} material={mat(coat.coat)} scale={[spec.legR * (leg.front ? 1.5 : 2.0), spec.legUpper, spec.legR * (leg.front ? 1.6 : 2.4)]} castShadow />
          <group position={[0, -spec.legUpper, 0]} ref={(g) => { if (g) j.current.knees[i] = g; }}>
            <mesh geometry={LIMB} material={mat(coat.coat)} scale={[spec.legR, spec.legLower, spec.legR]} castShadow />
            <Part geo={SPHERE} color={coat.dark} at={[0, -spec.legLower, spec.legR * 0.4]} scale={[spec.legR * 1.1, spec.legR * 0.9, spec.legR * 1.5]} rough={0.6} />
          </group>
        </group>
      ))}
    </group>
  );
}

function Antlers({ size }: { size: number }) {
  const tine = (x: number, y: number, z: number, len: number, rx: number, rz: number, key: string) => (
    <mesh key={key} geometry={CONE} material={mat("#d8c9a8", 0.7)} position={[x, y, z]} rotation={[rx, 0, rz]} scale={[0.012 * size * 4, len, 0.012 * size * 4]} castShadow />
  );
  return <group position={[0, size * 0.18, 0]}>
    {[-1, 1].map((s) => [
      tine(s * size * 0.12, size * 0.18, -size * 0.04, size * 0.42, -0.35, -s * 0.5, `b${s}`),
      tine(s * size * 0.24, size * 0.36, size * 0.02, size * 0.24, 0.5, -s * 0.2, `t1${s}`),
      tine(s * size * 0.2, size * 0.42, -size * 0.12, size * 0.2, -0.6, -s * 0.3, `t2${s}`),
      tine(s * size * 0.3, size * 0.5, -size * 0.04, size * 0.16, 0.2, -s * 0.7, `t3${s}`),
    ])}
  </group>;
}

/* ---------- rabbit: crouched body that hops ---------- */
function Rabbit({ c }: { c: Critter }) {
  const body = useRef<THREE.Group>(null!);
  const ears = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (!body.current) return;
    const hop = c.speed > 0.05 ? Math.abs(Math.sin(c.phase * 0.5)) : 0;
    body.current.position.y = hop * (c.state === "FLEE" ? 0.28 : 0.1);
    body.current.rotation.x = c.speed > 0.05 ? Math.cos(c.phase * 0.5) * 0.25 : 0;
    ears.current.rotation.x = c.state === "ALERT" ? -0.2 : c.state === "FLEE" ? 0.9 : 0.25 + Math.sin(performance.now() / 900) * 0.05;
  });
  const fur = "#8d7a63", light = "#d9cdb9";
  return <group ref={body}>
    <Part geo={SPHERE} color={fur} at={[0, 0.13, -0.02]} scale={[0.1, 0.11, 0.15]} />
    <Part geo={SPHERE} color={light} at={[0, 0.08, 0.02]} scale={[0.07, 0.06, 0.11]} />
    <Part geo={SPHERE} color={fur} at={[0, 0.22, 0.12]} scale={[0.065, 0.07, 0.08]} />
    <Part geo={SPHERE} color="#080706" rough={0.2} at={[-0.05, 0.24, 0.15]} scale={[0.011, 0.013, 0.011]} />
    <Part geo={SPHERE} color="#080706" rough={0.2} at={[0.05, 0.24, 0.15]} scale={[0.011, 0.013, 0.011]} />
    <group ref={ears} position={[0, 0.28, 0.1]}>
      <Part geo={SPHERE} color={fur} at={[-0.025, 0.07, -0.02]} scale={[0.016, 0.075, 0.01]} rot={[0, 0, 0.15]} />
      <Part geo={SPHERE} color={fur} at={[0.025, 0.07, -0.02]} scale={[0.016, 0.075, 0.01]} rot={[0, 0, -0.15]} />
    </group>
    <Part geo={SPHERE} color="#f4efe6" at={[0, 0.15, -0.17]} scale={[0.035, 0.035, 0.03]} />
    <Part geo={SPHERE} color={fur} at={[-0.07, 0.05, -0.06]} scale={[0.035, 0.05, 0.09]} />
    <Part geo={SPHERE} color={fur} at={[0.07, 0.05, -0.06]} scale={[0.035, 0.05, 0.09]} />
  </group>;
}

/* ---------- birds ---------- */
function Songbird({ c }: { c: Critter }) {
  const lw = useRef<THREE.Group>(null!), rw = useRef<THREE.Group>(null!), head = useRef<THREE.Group>(null!);
  const tint = ["#6b4a33", "#5a5f66", "#7b6a3e"][c.variant] ?? "#6b4a33";
  const breast = ["#c8653a", "#d9d2c4", "#e2c25a"][c.variant] ?? "#c8653a";
  useFrame(() => {
    if (!lw.current) return;
    const flying = c.state === "FLY";
    const glide = flying && Math.sin(c.phase * 0.07) > 0.6; // short glides between beat bursts
    const flap = flying && !glide ? Math.sin(c.phase) * 1.1 : flying ? 0.05 : 1.35; // folded on the ground
    lw.current.rotation.z = flying ? flap : 1.35; rw.current.rotation.z = flying ? -flap : -1.35;
    head.current.rotation.x = c.headDown * 0.9;
  });
  return <group scale={1.4}>
    <Part geo={SPHERE} color={tint} at={[0, 0.06, 0]} scale={[0.035, 0.035, 0.065]} />
    <Part geo={SPHERE} color={breast} at={[0, 0.05, 0.02]} scale={[0.03, 0.03, 0.045]} />
    <group ref={head} position={[0, 0.085, 0.05]}>
      <Part geo={SPHERE} color={tint} scale={[0.024, 0.024, 0.026]} />
      <mesh geometry={CONE} material={mat("#3a2f22", 0.6)} position={[0, -0.003, 0.03]} rotation={[Math.PI / 2, 0, 0]} scale={[0.007, 0.02, 0.007]} />
    </group>
    <mesh geometry={FIN} material={mat(tint, 0.9, THREE.DoubleSide)} position={[0, 0.065, -0.05]} rotation={[0, Math.PI, 0]} scale={[0.04, 1, 0.06]} />
    <group ref={lw} position={[-0.02, 0.07, 0.005]} rotation={[0, Math.PI, 0]}><mesh geometry={WING} material={mat(tint, 0.9, THREE.DoubleSide)} scale={[0.11, 1, 0.07]} /></group>
    <group ref={rw} position={[0.02, 0.07, 0.005]}><mesh geometry={WING} material={mat(tint, 0.9, THREE.DoubleSide)} scale={[0.11, 1, 0.07]} /></group>
  </group>;
}

function Vulture({ c }: { c: Critter }) {
  const lw = useRef<THREE.Group>(null!), rw = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (!lw.current) return;
    // mostly soaring with a slight dihedral; an occasional slow flap
    const beat = Math.sin(c.phase * 0.35) > 0.85 ? Math.sin(c.phase * 5) * 0.35 : 0;
    lw.current.rotation.z = -0.12 + beat; rw.current.rotation.z = 0.12 - beat;
  });
  const feather = "#1e1a17", pale = "#6a5f55";
  return <group>
    <Part geo={SPHERE} color={feather} scale={[0.16, 0.14, 0.42]} />
    <Part geo={SPHERE} color="#c98a7a" at={[0, 0.04, 0.45]} scale={[0.06, 0.06, 0.08]} />
    <mesh geometry={CONE} material={mat("#d8cbb0", 0.5)} position={[0, 0.03, 0.55]} rotation={[Math.PI / 2, 0, 0]} scale={[0.025, 0.07, 0.025]} />
    <mesh geometry={FIN} material={mat(feather, 0.9, THREE.DoubleSide)} position={[0, 0, -0.38]} rotation={[0, Math.PI, 0]} scale={[0.32, 1, 0.3]} />
    <group ref={lw} position={[-0.12, 0.02, 0.05]} rotation={[0, Math.PI, 0]}>
      <mesh geometry={WING} material={mat(feather, 0.95, THREE.DoubleSide)} scale={[1.15, 1, 0.55]} />
      <mesh geometry={WING} material={mat(pale, 0.95, THREE.DoubleSide)} position={[0.1, -0.005, -0.08]} scale={[0.95, 1, 0.2]} />
    </group>
    <group ref={rw} position={[0.12, 0.02, 0.05]}>
      <mesh geometry={WING} material={mat(feather, 0.95, THREE.DoubleSide)} scale={[1.15, 1, 0.55]} />
      <mesh geometry={WING} material={mat(pale, 0.95, THREE.DoubleSide)} position={[0.1, -0.005, -0.08]} scale={[0.95, 1, 0.2]} />
    </group>
  </group>;
}

/* ---------- fish ---------- */
function Fish({ c }: { c: Critter }) {
  const tail = useRef<THREE.Group>(null!), body = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (!tail.current) return;
    tail.current.rotation.y = Math.sin(c.phase) * 0.6;
    body.current.rotation.y = Math.sin(c.phase - 0.8) * 0.12;
  });
  const back = ["#4f6b52", "#5b6f7c", "#6b6248"][c.variant] ?? "#4f6b52";
  return <group ref={body} scale={c.size}>
    <Part geo={SPHERE} color={back} rough={0.35} scale={[0.045, 0.07, 0.19]} />
    <Part geo={SPHERE} color="#d6dcd8" rough={0.3} at={[0, -0.025, 0.01]} scale={[0.038, 0.045, 0.16]} />
    <mesh geometry={FIN} material={mat(back, 0.6, THREE.DoubleSide)} position={[0, 0.06, -0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[0.07, 1, 0.05]} />
    <group ref={tail} position={[0, 0, -0.17]}>
      <mesh geometry={FIN} material={mat(back, 0.6, THREE.DoubleSide)} rotation={[0, 0, Math.PI / 2]} scale={[0.12, 1, 0.09]} />
    </group>
  </group>;
}

/* ---------- snake: a tapered body that slithers in a travelling wave ---------- */
const SNAKE_SEGMENTS = 16;
function Snake({ c }: { c: Critter }) {
  const segs = useRef<THREE.Mesh[]>([]);
  useFrame(() => {
    const moving = c.speed > 0.05;
    for (let i = 0; i < SNAKE_SEGMENTS; i++) {
      const m = segs.current[i];
      if (!m) continue;
      const t = i / (SNAKE_SEGMENTS - 1);
      const amp = (moving ? 0.09 : 0.05) * Math.min(1, t * 3);
      m.position.x = Math.sin(c.phase * 2.2 - i * 0.55) * amp;
      m.position.y = 0.035 * (1 - t * 0.5) + (i === 0 && c.state === "ALERT" ? 0.08 : 0);
    }
  });
  const pattern = c.species === "SNAKE" && c.variant === 1 ? ["#6a5a3a", "#3d3122"] : ["#7a7a42", "#4a5228"];
  return <group scale={c.size}>
    {Array.from({ length: SNAKE_SEGMENTS }, (_, i) => {
      const t = i / (SNAKE_SEGMENTS - 1);
      const r = 0.045 * (i === 0 ? 0.95 : 1 - t * 0.75);
      return <mesh key={i} ref={(m) => { if (m) segs.current[i] = m; }} geometry={SPHERE} material={mat(pattern[i % 3 === 0 ? 1 : 0]!, 0.55)} position={[0, r, -i * 0.07]} scale={[r, r * 0.8, r * (i === 0 ? 1.5 : 1.1)]} castShadow />;
    })}
  </group>;
}

/* ---------- fox: real rigged GLB with clips, procedural fox while it loads or if it fails ---------- */
const FOX_URL = "/models/animals/fox.glb";
class Quiet extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: unknown) { console.warn("[wildlife] fox model failed, using the procedural fox:", error); }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function FoxModel({ c }: { c: Critter }) {
  const { scene, animations } = useGLTF(FOX_URL);
  const { object, mixer, actions } = useMemo(() => {
    const object = cloneSkinned(scene);
    object.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(object);
    const s = 0.55 / Math.max(0.001, box.max.y - box.min.y); // a red fox stands ~0.55 m to the ear tips
    object.scale.setScalar(s);
    object.position.y = -box.min.y * s;
    const mixer = new THREE.AnimationMixer(object);
    const actions = Object.fromEntries(animations.map((a) => [a.name, mixer.clipAction(a)])) as Record<string, THREE.AnimationAction>;
    return { object, mixer, actions };
  }, [scene, animations]);
  const current = useRef<string>("");
  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);
  useFrame((_, dt) => {
    const p = SPECIES_PROFILE.FOX;
    const want = c.speed > p.walk * 1.6 ? "Run" : c.speed > 0.08 ? "Walk" : "Survey";
    if (want !== current.current && actions[want]) {
      const next = actions[want]!.reset().play();
      if (current.current && actions[current.current]) actions[current.current]!.crossFadeTo(next, 0.25, false);
      current.current = want;
    }
    // match clip speed to ground speed so paws don't slide
    if (actions[want]) actions[want]!.timeScale = want === "Run" ? Math.max(0.6, c.speed / 6) : want === "Walk" ? Math.max(0.5, c.speed / 1.1) : 1;
    mixer.update(Math.min(dt, 0.1));
  });
  return <primitive object={object} />;
}

/* ---------- one animal: position, heading, slope pitch, culling ---------- */
function CritterView({ c, camera }: { c: Critter; camera: React.RefObject<THREE.Vector3> }) {
  const group = useRef<THREE.Group>(null!);
  const lastHeading = useRef(c.heading);
  const bank = useRef(0);
  const loco = SPECIES_PROFILE[c.species].locomotion;
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const cam = camera.current;
    const range = loco === "soar" ? SKY_RANGE : VIEW_RANGE;
    const visible = !cam || Math.hypot(c.x - cam.x, c.z - cam.z) < range;
    g.visible = visible;
    if (!visible) return;
    let y = heightAt(c.x, c.z);
    let pitch = 0, roll = 0;
    if (loco === "fish") {
      const surface = lakeSurfaceAt(c.x, c.z);
      if (surface === null) { g.visible = false; return; }
      y = Math.min(surface - 0.15, Math.max(y + 0.15, surface + c.alt));
    } else if (loco === "bird" || loco === "soar") {
      y += c.alt;
      const turn = Math.atan2(Math.sin(c.heading - lastHeading.current), Math.cos(c.heading - lastHeading.current)) / Math.max(dt, 1e-3);
      bank.current += (Math.max(-0.7, Math.min(0.7, -turn * 0.6)) - bank.current) * Math.min(1, dt * 3);
      roll = c.state === "GROUND" ? 0 : bank.current;
      pitch = loco === "bird" && c.state === "FLY" ? -0.1 : 0;
    } else {
      // follow the slope: sample the ground ahead and behind along the heading
      const len = c.species === "DEER" ? 0.75 : 0.3;
      const fx = Math.sin(c.heading) * len, fz = Math.cos(c.heading) * len;
      pitch = Math.atan2(heightAt(c.x - fx, c.z - fz) - heightAt(c.x + fx, c.z + fz), len * 2);
    }
    lastHeading.current = c.heading;
    g.position.set(c.x, y, c.z);
    euler.set(pitch, c.heading, roll);
    g.quaternion.setFromEuler(euler);
  });
  const procFox = <group scale={c.size}><Quadruped c={c} spec={FOX} /></group>;
  return (
    <group ref={group} visible={false}>
      {c.species === "DEER" && <group scale={c.size * (c.variant === 0 ? 1.08 : 0.94)}><Quadruped c={c} spec={{ ...DEER, antlers: true }} /></group>}
      {c.species === "DOG" && <group scale={c.size}><Quadruped c={c} spec={DOG} /></group>}
      {c.species === "CAT" && <group scale={c.size}><Quadruped c={c} spec={CAT} /></group>}
      {c.species === "FOX" && <Quiet fallback={procFox}><Suspense fallback={procFox}><FoxModel c={c} /></Suspense></Quiet>}
      {c.species === "RABBIT" && <group scale={c.size}><Rabbit c={c} /></group>}
      {c.species === "SONGBIRD" && <Songbird c={c} />}
      {c.species === "VULTURE" && <group scale={c.size}><Vulture c={c} /></group>}
      {c.species === "FISH" && <Fish c={c} />}
      {c.species === "SNAKE" && <Snake c={c} />}
    </group>
  );
}

export function Wildlife({ playerRef }: { playerRef: React.RefObject<THREE.Object3D> }) {
  const critters = useMemo(() => buildPopulation(), []);
  const rnd = useRef(mulberry32(909));
  const alarms = useRef<Alarms>(new Map());
  const last = useRef<{ x: number; z: number } | null>(null);
  const camera = useRef(new THREE.Vector3());
  const clock = useRef(0);

  useFrame(({ camera: cam }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.08);
    clock.current += dt;
    camera.current.copy(cam.position);
    const p = playerRef.current;
    if (!p) return;
    const prev = last.current ?? { x: p.position.x, z: p.position.z };
    const speed = Math.hypot(p.position.x - prev.x, p.position.z - prev.z) / Math.max(dt, 1e-3);
    last.current = { x: p.position.x, z: p.position.z };
    // teleports (fast travel, respawn) are not running
    const threat = { x: p.position.x, z: p.position.z, speed: speed > 60 ? 0 : speed, sprinting: speed > 5.5 && speed <= 60 };
    for (const c of critters) {
      const range = SPECIES_PROFILE[c.species].locomotion === "soar" ? SKY_RANGE : VIEW_RANGE + 40;
      if (Math.hypot(c.x - p.position.x, c.z - p.position.z) > range) continue;
      stepCritter(c, dt, threat, rnd.current, HABITAT, alarms.current, clock.current);
    }
  });

  return <group>{critters.map((c) => <CritterView key={c.id} c={c} camera={camera} />)}</group>;
}

