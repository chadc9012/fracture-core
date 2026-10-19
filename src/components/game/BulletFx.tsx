import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BULLET_POOL, IMPACT_LOG, type WorldSim } from "@/game/sim";
import { softSprite } from "./softSprite";
import { IMPACT_STYLE, makePuffs, makeSparks, puffAlive, sparkAlive, spawnImpact, stepImpacts, PUFF_POOL, SPARK_POOL } from "@/game/bullet-impacts";

/**
 * Player bullets and what they hit. Presentation only: reads sim.bullets and the sim.impacts ring, never changes combat.
 *
 * Each bullet is a glowing core, a short bright tracer along its velocity, a long faint streak behind it and a soft halo.
 * Every layer is one InstancedMesh over the bullet pool, so a firefight costs four draw calls instead of four per bullet;
 * all layers are additive, so a bullet's fade rides on its instance colour. Bullets fade in over 3..8 m from the camera
 * (one spawning at the player used to fill the screen).
 *
 * Impacts (bullet-impacts.ts): sparks or grit thrown back off the surface plus one puff (dust on ground, a hot flash on
 * cover/vehicles, an energy flash on machines), two more instanced draws.
 */
const LAYERS = [
  { key: "halo", geo: () => new THREE.SphereGeometry(0.22, 10, 8), color: "#7fe8ff", gain: 0.25 },
  { key: "trail", geo: () => new THREE.CylinderGeometry(0.035, 0.14, 1, 6, 1, true), color: "#5fd8ff", gain: 0.3 },
  { key: "tracer", geo: () => new THREE.CylinderGeometry(0.035, 0.035, 1, 6), color: "#bff6ff", gain: 1.6 },
  { key: "core", geo: () => new THREE.SphereGeometry(0.085, 8, 8), color: "#e8fcff", gain: 2.2 },
] as const;

const additive = (extra: Partial<THREE.MeshBasicMaterialParameters> = {}) =>
  new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, ...extra });

export function Bullets({ sim }: { sim: WorldSim }) {
  const meshes = useMemo(() => LAYERS.map((l) => {
    const m = new THREE.InstancedMesh(l.geo(), additive(), BULLET_POOL);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BULLET_POOL * 3), 3);
    m.frustumCulled = false; m.count = 0; m.name = `bullets:${l.key}`;
    return m;
  }), []);
  useEffect(() => () => meshes.forEach((m) => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }), [meshes]);
  const t = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), still: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), d: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), c: new THREE.Color(), base: LAYERS.map((l) => new THREE.Color(l.color)) }), []);

  useFrame(({ camera }) => {
    let n = 0;
    for (const b of sim.bullets) {
      if (!b.alive) continue;
      const near = THREE.MathUtils.clamp((Math.hypot(camera.position.x - b.x, camera.position.y - b.y, camera.position.z - b.z) - 3) / 5, 0, 1);
      if (near <= 0) continue;
      const fade = THREE.MathUtils.clamp(b.life / 1.4, 0, 1);
      const speed = Math.hypot(b.vx, b.vy, b.vz) || 1;
      t.d.set(b.vx / speed, b.vy / speed, b.vz / speed);
      t.q.setFromUnitVectors(t.up, t.d);
      const trailLen = THREE.MathUtils.clamp(speed * 0.09, 2.2, 7);
      LAYERS.forEach((l, k) => {
        const mesh = meshes[k]!;
        let op: number;
        if (l.key === "halo") { t.p.set(b.x, b.y, b.z); t.s.setScalar((1 + (1.4 - b.life) * 0.4) * near); op = Math.max(0.2, fade); }
        else if (l.key === "trail") { t.p.set(b.x - t.d.x * trailLen * 0.5, b.y - t.d.y * trailLen * 0.5, b.z - t.d.z * trailLen * 0.5); t.s.set(near, trailLen * near, near); op = Math.max(0.1, fade); }
        else if (l.key === "tracer") { t.p.set(b.x, b.y, b.z); t.s.set(near, THREE.MathUtils.clamp(speed * 0.035, 0.6, 2.4), near); op = Math.max(0.25, fade) * 0.9; }
        else { t.p.set(b.x, b.y, b.z); t.s.setScalar(near); op = Math.max(0.35, fade); }
        mesh.setMatrixAt(n, t.m.compose(t.p, l.key === "halo" || l.key === "core" ? t.still : t.q, t.s));
        mesh.setColorAt(n, t.c.copy(t.base[k]!).multiplyScalar(op * l.gain * near));
      });
      n++;
    }
    for (const m of meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  });

  return <>{meshes.map((m) => <primitive key={m.name} object={m} />)}</>;
}

export function BulletImpacts({ sim }: { sim: WorldSim }) {
  const pools = useMemo(() => ({ sparks: makeSparks(), puffs: makePuffs() }), []);
  const seen = useRef(sim.nextImpactId - 1);
  const meshes = useMemo(() => {
    const spark = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 1), additive(), SPARK_POOL);
    // puffs are soft round sprites turned to face the camera (a lit sphere read as a solid ball)
    const dot = softSprite("dot") ?? null;
    const puff = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), additive({ map: dot }), PUFF_POOL);
    const dust = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: "#ffffff", map: dot, transparent: true, opacity: 0.55, depthWrite: false }), PUFF_POOL);
    for (const m of [spark, puff, dust]) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3), 3); m.frustumCulled = false; m.count = 0; }
    spark.name = "impacts:sparks"; puff.name = "impacts:flash"; dust.name = "impacts:dust";
    return { spark, puff, dust };
  }, []);
  useEffect(() => () => Object.values(meshes).forEach((m) => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }), [meshes]);
  const t = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), d: new THREE.Vector3(), z: new THREE.Vector3(0, 0, 1), c: new THREE.Color(), col: Object.fromEntries(Object.entries(IMPACT_STYLE).map(([k, v]) => [k, { spark: new THREE.Color(v.spark), puff: new THREE.Color(v.puff) }])) as Record<keyof typeof IMPACT_STYLE, { spark: THREE.Color; puff: THREE.Color }> }), []);

  useFrame(({ camera }, raw) => {
    const dt = Math.min(raw, 0.05);
    // new impacts since last frame (the ring holds the last IMPACT_LOG; older ones in a big burst are simply skipped)
    const last = sim.nextImpactId - 1;
    for (let id = Math.max(seen.current + 1, last - IMPACT_LOG + 1); id <= last; id++) {
      const e = sim.impacts[id % IMPACT_LOG]!;
      if (e.id === id) spawnImpact(pools.sparks, pools.puffs, e);
    }
    seen.current = last;
    stepImpacts(pools.sparks, pools.puffs, dt);
    let n = 0;
    for (const s of pools.sparks) {
      if (!sparkAlive(s)) continue;
      const k = 1 - s.age / s.life, v = Math.hypot(s.vx, s.vy, s.vz) || 1;
      t.d.set(s.vx / v, s.vy / v, s.vz / v);
      t.m.compose(t.p.set(s.x, s.y, s.z), t.q.setFromUnitVectors(t.z, t.d), t.s.set(1, 1, Math.min(0.5, v * 0.03) * (0.4 + 0.6 * k)));
      meshes.spark.setMatrixAt(n, t.m);
      meshes.spark.setColorAt(n, t.c.copy(t.col[s.kind].spark).multiplyScalar((s.kind === "ground" ? 0.5 : 2.4) * k));
      n++;
    }
    meshes.spark.count = n;
    let f = 0, g = 0;
    for (const p of pools.puffs) {
      if (!puffAlive(p)) continue;
      const k = p.age / p.life, st = IMPACT_STYLE[p.kind];
      // dust can't fade by colour (normal blending would darken it), so it billows out then thins away by shrinking
      const thin = st.additivePuff ? 1 : k > 0.65 ? (1 - k) / 0.35 : 1;
      t.m.compose(t.p.set(p.x, p.y, p.z), camera.quaternion, t.s.setScalar(p.size * 2 * (0.35 + k * 0.9) * thin));
      if (st.additivePuff) { meshes.puff.setMatrixAt(f, t.m); meshes.puff.setColorAt(f, t.c.copy(t.col[p.kind].puff).multiplyScalar(1.8 * (1 - k))); f++; }
      else { meshes.dust.setMatrixAt(g, t.m); meshes.dust.setColorAt(g, t.c.copy(t.col[p.kind].puff)); g++; }
    }
    meshes.puff.count = f; meshes.dust.count = g;
    for (const m of Object.values(meshes)) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  });

  return <>{Object.values(meshes).map((m) => <primitive key={m.name} object={m} />)}</>;
}
