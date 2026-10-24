import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import {
  addCorpse, addDecal, corpsePose, DECAL_POOL, GORE_LOG, DROP_POOL, GIB_POOL, GORE_LOOK, GORE_TUNE, makeCorpses, makeGorePools, MIST_POOL,
  severBone, spawnSpray, sprayFor, SPARK_POOL_GORE, stepCorpses, stepGore, type BloodType, type Corpse, type GoreLevel, type SeverPart,
} from "@/game/gore";
import { walkHeight } from "@/game/terrain";
import { FactionEnemy, type DriveRef } from "./EnemyModel";
import { softSprite } from "./softSprite";

/**
 * Gore (gore.ts): blood spray, mist, machine sparks/oil/coolant, ground decals and pools, severed parts and gibs, and the
 * bodies left where enemies fell. Presentation only — it reads the sim.gore ring (logGore) and never changes combat.
 *
 * Every particle layer is one InstancedMesh over a fixed pool (a firefight is a handful of draw calls). Decals and droplets
 * use a small shader that fades by a per-instance alpha. Bodies are a pool of CORPSE_POOL slots, each mounting the faction
 * model it needs the first time (like WarMachines), frozen in the pose they died in and tipped over along the hit.
 */

const COLORS: Record<BloodType, { drop: THREE.Color; mist: THREE.Color; decal: THREE.Color; glow: number }> = Object.fromEntries(
  Object.entries(GORE_LOOK).map(([k, v]) => [k, { drop: new THREE.Color(v.drop), mist: new THREE.Color(v.mist), decal: new THREE.Color(v.decal), glow: v.glow }]),
) as never;
const SPARK_COLOR = new THREE.Color(GORE_LOOK.MACHINE.spark);
const VAPOUR_COLOR = new THREE.Color(GORE_LOOK.MACHINE.vapour);

/** a splat drawn once: an irregular wet core with satellite drops, white so instance colour tints it */
let splatTex: THREE.CanvasTexture | null = null;
function splat(): THREE.CanvasTexture | null {
  if (splatTex || typeof document === "undefined") return splatTex;
  const S = 128, cv = document.createElement("canvas"); cv.width = cv.height = S;
  const g = cv.getContext("2d");
  if (!g) return null;
  let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const blob = (x: number, y: number, rad: number, a: number) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.7, `rgba(255,255,255,${a * 0.85})`); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  };
  for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, d = r() * 14; blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 18 + r() * 16, 0.9); }
  for (let i = 0; i < 16; i++) { const a = r() * Math.PI * 2, d = 26 + r() * 30; blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2 + r() * 6, 0.85); }
  splatTex = new THREE.CanvasTexture(cv);
  splatTex.colorSpace = THREE.SRGBColorSpace;
  return splatTex;
}

/** unlit, normal-blended, fades by a per-instance alpha; `wet` adds a faint sheen so pools read as liquid */
function fadeMaterial(map: THREE.Texture | null, opts: { wet?: boolean; additiveGlow?: boolean } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, useMap: { value: map ? 1 : 0 } },
    vertexShader: `
      attribute float aAlpha; attribute vec3 aColor; attribute float aGlow;
      varying vec2 vUv; varying float vAlpha; varying vec3 vColor; varying float vGlow;
      void main() {
        vUv = uv; vAlpha = aAlpha; vColor = aColor; vGlow = aGlow;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float useMap;
      varying vec2 vUv; varying float vAlpha; varying vec3 vColor; varying float vGlow;
      void main() {
        float m = useMap > 0.5 ? texture2D(map, vUv).a : 1.0;
        float a = m * vAlpha;
        if (a < 0.02) discard;
        vec3 c = vColor * (1.0 + vGlow * 1.6);
        ${opts.wet ? "c += vec3(0.05) * smoothstep(0.75, 1.0, m);" : ""}
        gl_FragColor = vec4(c, a);
      }`,
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  if (opts.additiveGlow) mat.blending = THREE.AdditiveBlending;
  return mat;
}
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, count: number, name: string, extra = true) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  if (extra) {
    geo.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
    geo.setAttribute("aColor", new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("aGlow", new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
  }
  m.frustumCulled = false; m.count = 0; m.name = name;
  return m;
}
const setFade = (m: THREE.InstancedMesh, i: number, c: THREE.Color, a: number, glow = 0) => {
  const g = m.geometry;
  (g.getAttribute("aAlpha") as THREE.InstancedBufferAttribute).setX(i, a);
  (g.getAttribute("aColor") as THREE.InstancedBufferAttribute).setXYZ(i, c.r, c.g, c.b);
  (g.getAttribute("aGlow") as THREE.InstancedBufferAttribute).setX(i, glow);
};
const flagFade = (m: THREE.InstancedMesh) => { for (const k of ["aAlpha", "aColor", "aGlow"]) (m.geometry.getAttribute(k) as THREE.InstancedBufferAttribute).needsUpdate = true; m.instanceMatrix.needsUpdate = true; };

/** gib shapes: a rounded chunk, a limb, a head, a torn armour plate (never 6-segment primitives) */
function gibGeometries() {
  const chunk = new THREE.IcosahedronGeometry(0.16, 2);
  const p = chunk.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const k = 0.75 + 0.5 * Math.abs(Math.sin(p.getX(i) * 31 + p.getY(i) * 17 + p.getZ(i) * 23)); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); }
  chunk.computeVertexNormals();
  const limb = new THREE.CapsuleGeometry(0.065, 0.55, 6, 12);
  const head = new THREE.SphereGeometry(0.12, 18, 14); head.scale(0.9, 1.1, 1);
  const plate = new THREE.BoxGeometry(0.34, 0.035, 0.22, 3, 1, 3);
  const pp = plate.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) pp.setY(i, pp.getY(i) + Math.sin(pp.getX(i) * 9) * 0.02 + Math.cos(pp.getZ(i) * 11) * 0.015);
  plate.computeVertexNormals();
  return { CHUNK: chunk, LIMB: limb, HEAD: head, PLATE: plate };
}

export function GoreFx({ sim, level }: { sim: WorldSim; level: GoreLevel }) {
  const pools = useMemo(() => makeGorePools(), []);
  const corpses = useMemo(() => makeCorpses(), []);
  const seen = useRef(sim.nextGoreId - 1);
  const levelRef = useRef(level); levelRef.current = level;

  const fx = useMemo(() => {
    const dot = softSprite("dot") ?? null;
    const drops = instanced(new THREE.SphereGeometry(1, 8, 6), fadeMaterial(null), DROP_POOL, "gore:drops");
    const mists = instanced(new THREE.PlaneGeometry(1, 1), fadeMaterial(dot), MIST_POOL, "gore:mist");
    const sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.025, 1), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }), SPARK_POOL_GORE);
    sparks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SPARK_POOL_GORE * 3), 3); sparks.frustumCulled = false; sparks.count = 0; sparks.name = "gore:sparks";
    const decalGeo = new THREE.PlaneGeometry(1, 1); decalGeo.rotateX(-Math.PI / 2);
    const decals = instanced(decalGeo, fadeMaterial(splat(), { wet: true }), DECAL_POOL, "gore:decals");
    decals.renderOrder = 1;
    const geos = gibGeometries();
    const gibMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.45, metalness: 0.05 });
    const plateMat = new THREE.MeshStandardMaterial({ color: "#3a3d42", roughness: 0.55, metalness: 0.75 });
    const gibs = Object.fromEntries(Object.entries(geos).map(([k, g]) => {
      const m = new THREE.InstancedMesh(g, k === "PLATE" ? plateMat : gibMat, GIB_POOL);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GIB_POOL * 3), 3); m.castShadow = true; m.frustumCulled = false; m.count = 0; m.name = `gore:gib-${k}`;
      return [k, m];
    })) as unknown as Record<keyof typeof geos, THREE.InstancedMesh>;
    return { drops, mists, sparks, decals, gibs };
  }, []);
  useEffect(() => () => {
    for (const m of [fx.drops, fx.mists, fx.sparks, fx.decals, ...Object.values(fx.gibs)]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
  }, [fx]);

  // corpse slots: which faction models each slot has mounted (mounted on first need, kept)
  const [mounted, setMounted] = useState<string[][]>(() => corpses.map(() => []));
  const mountedRef = useRef(mounted);
  const slotGroups = useRef<(THREE.Group | null)[]>([]);
  const rigs = useRef<Map<string, THREE.Object3D>[]>(corpses.map(() => new Map()));
  const severed = useRef<({ bone: THREE.Object3D; scale: THREE.Vector3 } | null)[]>(corpses.map(() => null));
  const drives = useMemo<DriveRef[]>(() => corpses.map(() => ({ current: { speed: 0, aiming: false, frozen: true } })), [corpses]);
  const builtCbs = useMemo(() => corpses.map((_, i) => new Map<string, (o: THREE.Object3D) => void>()), [corpses]);
  const onBuilt = useCallback((i: number, key: string) => {
    let cb = builtCbs[i]!.get(key);
    if (!cb) { cb = (o: THREE.Object3D) => { rigs.current[i]!.set(key, o); }; builtCbs[i]!.set(key, cb); }
    return cb;
  }, [builtCbs]);

  const t = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), d: new THREE.Vector3(), z: new THREE.Vector3(0, 0, 1), c: new THREE.Color(), w: new THREE.Vector3() }), []);
  const ground = useCallback((x: number, z: number) => walkHeight(x, z), []);

  const sever = (i: number, c: Corpse, part: SeverPart | null) => {
    // restore the previous occupant's limb, then take this one's
    const prev = severed.current[i];
    if (prev) { prev.bone.scale.copy(prev.scale); severed.current[i] = null; }
    if (!part) return;
    const rig = rigs.current[i]!.get(`${c.kind}:${c.role}`);
    if (!rig) return;
    const names: string[] = []; const byName = new Map<string, THREE.Object3D>();
    rig.traverse((o) => { if ((o as THREE.Bone).isBone) { names.push(o.name); byName.set(o.name, o); } });
    const name = severBone(names, part);
    const bone = name ? byName.get(name) : undefined;
    if (!bone) return;
    severed.current[i] = { bone, scale: bone.scale.clone() };
    bone.scale.setScalar(0.001);
  };

  useFrame(({ camera }, raw) => {
    const dt = Math.min(raw, 0.05);
    const lvl = levelRef.current;
    // new gore events since last frame
    const last = sim.nextGoreId - 1;
    for (let id = Math.max(seen.current + 1, last - GORE_LOG + 1); id <= last; id++) {
      const e = sim.gore[id % GORE_LOG]!;
      if (e.id !== id) continue;
      // only what the player could see: skip far-away fights
      if (Math.hypot(e.x - camera.position.x, e.z - camera.position.z) > 140) continue;
      const spray = sprayFor(e, lvl);
      spawnSpray(pools, spray, e.blood, lvl);
      if (e.kind === "KILL" && e.body) {
        const c = addCorpse(corpses, e, lvl, spray);
        if (c) {
          const i = corpses.indexOf(c), key = `${c.kind}:${c.role}`;
          if (!mountedRef.current[i]!.includes(key)) { const next = mountedRef.current.map((l, k) => (k === i ? [...l, key] : l)); mountedRef.current = next; setMounted(next); }
          sever(i, c, spray.sever);
          // the body bleeds out into a slowly spreading pool where its chest lands
          if (GORE_TUNE[lvl].pool && c.blood !== "MACHINE") { const h = 1.1 * c.scale; addDecal(pools, c.x + c.fx * h, ground(c.x + c.fx * h, c.z + c.fz * h), c.z + c.fz * h, 0.5 * c.scale, c.blood, lvl, Math.random, 1.4 * c.scale); }
          if (c.blood === "MACHINE" && lvl !== "OFF") { const h = 1.1 * c.scale; addDecal(pools, c.x + c.fx * h, ground(c.x + c.fx * h, c.z + c.fz * h), c.z + c.fz * h, 0.4 * c.scale, "MACHINE", lvl, Math.random, 0.8 * c.scale); }
        } else if (e.body && spray.gib) {
          // gibbed: the gibs are the body; a wide splash marks where it stood
          if (lvl !== "OFF") addDecal(pools, e.x, ground(e.x, e.z), e.z, 1.6 * e.size, e.blood, lvl);
        }
      }
    }
    seen.current = last;

    stepGore(pools, dt, ground, lvl);
    stepCorpses(corpses, dt);

    // stumps keep spurting for a moment
    corpses.forEach((c, i) => {
      const sv = severed.current[i];
      if (!c.alive || c.spurt <= 0 || !sv || lvl === "OFF") return;
      if (Math.random() > dt * 40) return;
      sv.bone.parent?.getWorldPosition(t.w);
      const k = c.spurt;
      spawnSpray(pools, { drops: [{ x: t.w.x, y: t.w.y, z: t.w.z, vx: c.fx * 1.5 + (Math.random() - 0.5), vy: 1.2 + Math.random() * 2 * k, vz: c.fz * 1.5 + (Math.random() - 0.5), size: 0.035, life: 1.4 }], mists: [], sparks: c.blood === "MACHINE" ? [{ x: t.w.x, y: t.w.y, z: t.w.z, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 4, life: 0.4 }] : [], gibs: [], sever: null, gib: false, stumpSpurt: 0 }, c.blood, lvl);
    });

    // ---- draw: droplets
    let n = 0;
    for (const d of pools.drops) {
      if (!d.alive) continue;
      const col = COLORS[d.blood];
      const v = Math.hypot(d.vx, d.vy, d.vz) || 1;
      t.d.set(d.vx / v, d.vy / v, d.vz / v);
      // streak along travel when fast (reads as a jet, not a bead)
      t.q.setFromUnitVectors(t.z, t.d);
      t.m.compose(t.p.set(d.x, d.y, d.z), t.q, t.s.set(d.size, d.size, d.size * (1 + Math.min(4, v * 0.35))));
      fx.drops.setMatrixAt(n, t.m);
      setFade(fx.drops, n, d.blood === "MACHINE" ? t.c.set("#0d0c0b") : col.drop, 0.92, col.glow);
      n++;
    }
    fx.drops.count = n; flagFade(fx.drops);
    // ---- mist / vapour (camera-facing, fades out)
    n = 0;
    for (const m of pools.mists) {
      if (!m.alive) continue;
      const k = m.age / m.life;
      t.m.compose(t.p.set(m.x, m.y, m.z), camera.quaternion, t.s.setScalar(m.size * (0.6 + k * 1.4)));
      fx.mists.setMatrixAt(n, t.m);
      setFade(fx.mists, n, m.vapour ? VAPOUR_COLOR : COLORS[m.blood].mist, (m.vapour ? 0.45 : 0.6) * (1 - k), m.vapour ? 0.2 : COLORS[m.blood].glow * 0.5);
      n++;
    }
    fx.mists.count = n; flagFade(fx.mists);
    // ---- sparks
    n = 0;
    for (const s of pools.sparks) {
      if (!s.alive) continue;
      const k = 1 - s.age / s.life, v = Math.hypot(s.vx, s.vy, s.vz) || 1;
      t.d.set(s.vx / v, s.vy / v, s.vz / v);
      t.m.compose(t.p.set(s.x, s.y, s.z), t.q.setFromUnitVectors(t.z, t.d), t.s.set(1, 1, Math.min(0.45, v * 0.03) * (0.4 + 0.6 * k)));
      fx.sparks.setMatrixAt(n, t.m);
      fx.sparks.setColorAt(n, t.c.copy(SPARK_COLOR).multiplyScalar(2.6 * k));
      n++;
    }
    fx.sparks.count = n; fx.sparks.instanceMatrix.needsUpdate = true; if (fx.sparks.instanceColor) fx.sparks.instanceColor.needsUpdate = true;
    // ---- decals (fade over the last fifth of their life)
    n = 0;
    for (const c of pools.decals) {
      if (!c.alive) continue;
      const k = c.age / c.life, a = (k > 0.8 ? (1 - k) / 0.2 : 1) * (c.blood === "MACHINE" ? 0.9 : 0.85);
      // a fresh splat spreads out in its first instant
      const grow = Math.min(1, c.age / 0.12);
      t.e.set(0, c.rot, 0); t.q.setFromEuler(t.e);
      t.m.compose(t.p.set(c.x, c.y, c.z), t.q, t.s.set(c.size * (0.6 + 0.4 * grow), 1, c.size * (0.6 + 0.4 * grow)));
      fx.decals.setMatrixAt(n, t.m);
      setFade(fx.decals, n, COLORS[c.blood].decal, a, COLORS[c.blood].glow * 0.25);
      n++;
    }
    fx.decals.count = n; flagFade(fx.decals);
    // ---- gibs
    const counts: Record<string, number> = { CHUNK: 0, LIMB: 0, HEAD: 0, PLATE: 0 };
    for (const g of pools.gibs) {
      if (!g.alive) continue;
      const mesh = fx.gibs[g.shape]!, i = counts[g.shape]!++;
      const sink = g.age > g.life - 1.5 ? (g.age - (g.life - 1.5)) / 1.5 * 0.25 * g.size : 0;
      t.e.set(g.rx, g.ry, g.rz); t.q.setFromEuler(t.e);
      t.m.compose(t.p.set(g.x, g.y - sink, g.z), t.q, t.s.setScalar(g.size));
      mesh.setMatrixAt(i, t.m);
      // flesh takes its blood colour (darkened); plates stay steel and the material colours them
      mesh.setColorAt(i, g.shape === "PLATE" ? t.c.set("#ffffff") : t.c.copy(COLORS[g.blood].drop).lerp(g.blood === "RED" ? new THREE.Color("#5a2a22") : COLORS[g.blood].decal, 0.4).multiplyScalar(1.4));
    }
    for (const [k, mesh] of Object.entries(fx.gibs)) { mesh.count = counts[k]!; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }

    // ---- bodies: topple along the hit, lie still, sink away
    corpses.forEach((c, i) => {
      const node = slotGroups.current[i];
      if (!node) return;
      node.visible = c.alive;
      if (!c.alive) return;
      const { tip, sink } = corpsePose(c);
      const fallYaw = Math.atan2(c.fx, c.fz);
      node.position.set(c.x, c.groundY + 0.14 * c.scale * Math.min(1, tip) - sink * 0.5 * c.scale, c.z);
      node.rotation.set(0, fallYaw, 0);
      const pivot = node.children[0] as THREE.Group;
      pivot.rotation.set(tip * (Math.PI / 2) * 0.97, 0, 0);
      const inner = pivot.children[0] as THREE.Group;
      // the body keeps facing the way it stood (rot), relative to the fall direction
      inner.rotation.set(0, c.rot - fallYaw, 0);
      inner.scale.setScalar(c.scale);
      for (const child of inner.children) child.visible = child.name === `${c.kind}:${c.role}`;
    });
  });

  return (
    <group name="gore">
      <primitive object={fx.decals} />
      <primitive object={fx.drops} />
      <primitive object={fx.mists} />
      <primitive object={fx.sparks} />
      {Object.values(fx.gibs).map((m) => <primitive key={m.name} object={m} />)}
      {corpses.map((_, i) => (
        <group key={i} name="gore:corpse" visible={false} ref={(g) => { slotGroups.current[i] = g; }}>
          <group>
            <group>
              {mounted[i]!.map((key) => {
                const [kind, role] = key.split(":") as [Corpse["kind"], Corpse["role"]];
                return <group key={key} name={key} visible={false}><FactionEnemy kind={kind} role={role} drive={drives[i]!} onBuilt={onBuilt(i, key)} /></group>;
              })}
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}
