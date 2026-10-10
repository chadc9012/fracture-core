import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { heightAt, slopeAt } from "@/game/terrain";
import { CRATES, HULL, PUDDLES, SCOUT, rutLines } from "@/game/crash-layout";
import { TRAIL_HALF_WIDTH } from "@/game/verdant";
import { hullDamageTexture, rutTexture } from "./forest-textures";

/* The crashed transport and the set dressing around it, built from real (deformed) geometry rather than boxes.
 * No spacecraft GLB ships with the project and none could be verified from the build environment, so the hull is
 * generated: a lathe fuselage with a crumpled, buried nose, dents, an ejected-section tear that exposes ribs and
 * beams, engine nacelles, bent wings and hanging cable. If a verified GLB is added later it can replace <Hull>.
 * Layout (positions, collision, crates, ruts, puddles) is pure data in game/crash-layout.ts. */

const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return hash(ix, iy) * (1 - u) * (1 - v) + hash(ix + 1, iy) * u * (1 - v) + hash(ix, iy + 1) * (1 - u) * v + hash(ix + 1, iy + 1) * u * v;
};

/** Fuselage along +X (nose at x = 0). `tear` removes a wedge of skin so the structure inside shows. */
export function fuselageGeometry(length: number, radius: number, seed: number, tear: { from: number; to: number; arc: number; centre: number } | null): THREE.BufferGeometry {
  const rings = 30, sides = 28;
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const nose = Math.sin(Math.min(1, t / 0.24) * Math.PI / 2) ** 0.75; // rounded nose
    const tail = 1 - 0.28 * Math.max(0, (t - 0.82) / 0.18) ** 1.5;
    prof.push(new THREE.Vector2(Math.max(0.04, radius * nose * tail), t * length));
  }
  const geo = new THREE.LatheGeometry(prof, sides);
  geo.rotateZ(-Math.PI / 2); // lathe axis Y → X
  const p = geo.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, y);
    let k = 1 + (noise(x * 0.8 + seed, a * 1.6) - 0.5) * 0.16;                         // dents and warping
    const crumple = Math.max(0, 1 - x / (length * 0.24));                                // nose folds in on itself
    k *= 1 - crumple * (0.2 + 0.35 * noise(x * 2.4 + seed * 3, a * 3));
    const belly = a > 2.2 || a < -2.2 ? 1 : 0;                                           // the underside is flattened by the impact
    k *= 1 - belly * 0.1 * Math.min(1, x / (length * 0.5));
    p.setXYZ(i, x, y * k * (1 - crumple * 0.12), z * k + crumple * (noise(x * 3, seed) - 0.5) * 0.5);
  }
  geo.computeVertexNormals();
  if (!tear) return geo;
  const idx = geo.getIndex()!;
  const keep: number[] = [];
  for (let f = 0; f < idx.count; f += 3) {
    const ia = idx.getX(f), ib = idx.getX(f + 1), ic = idx.getX(f + 2);
    const cx = (p.getX(ia) + p.getX(ib) + p.getX(ic)) / 3, cy = (p.getY(ia) + p.getY(ib) + p.getY(ic)) / 3, cz = (p.getZ(ia) + p.getZ(ib) + p.getZ(ic)) / 3;
    const ca = Math.atan2(cz, cy);
    const edge = 0.35 * noise(cx * 1.7, ca * 2.1 + seed); // ragged edge
    const inTear = cx > tear.from + edge && cx < tear.to - edge && Math.abs(Math.atan2(Math.sin(ca - tear.centre), Math.cos(ca - tear.centre))) < tear.arc * (0.75 + edge);
    if (!inTear) keep.push(ia, ib, ic);
  }
  geo.setIndex(keep);
  return geo;
}

function wingGeometry(span: number, chord: number, bend: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(chord, 0); shape.lineTo(chord * 0.55, span); shape.lineTo(chord * 0.25, span * 0.92); shape.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
  const p = g.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const s = p.getY(i) / span; // 0 root … 1 tip
    p.setXYZ(i, p.getX(i) - s * s * chord * 0.2, p.getY(i), p.getZ(i) + s * s * bend);
  }
  g.rotateX(Math.PI / 2); // lay flat: span along +Z, positive `bend` droops
  g.computeVertexNormals();
  return g;
}

const TEAR = { from: 4.2, to: 8.6, arc: 0.95, centre: 0.45 };

export function Hull() {
  const mats = useMemo(() => {
    const tex = hullDamageTexture();
    return {
      skin: new THREE.MeshStandardMaterial({ color: "#c9ced8", map: tex, metalness: 0.7, roughness: 0.6, side: THREE.DoubleSide }),
      inner: new THREE.MeshStandardMaterial({ color: "#2b2f37", metalness: 0.5, roughness: 0.8 }),
      burnt: new THREE.MeshStandardMaterial({ color: "#1d1b1a", metalness: 0.4, roughness: 0.9 }),
      cable: new THREE.MeshStandardMaterial({ color: "#111418", roughness: 0.7 }),
      lamp: new THREE.MeshStandardMaterial({ color: "#1a6fae", emissive: "#39b6ff", emissiveIntensity: 2.2, roughness: 0.3 }),
    };
  }, []);
  const parts = useMemo(() => {
    const L = HULL.length, R = HULL.radius;
    const body = fuselageGeometry(L, R, 5, TEAR);
    const ribs = [4.6, 5.6, 6.6, 7.6, 8.4].map((x) => ({ x, r: R * (0.9 - 0.0 * x) }));
    const engine = new THREE.CylinderGeometry(0.75, 0.9, 3.2, 14, 1, true);
    const wing = wingGeometry(5.5, 4.2, -1.2);
    const cable = (pts: [number, number, number][]) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))), 14, 0.05, 5, false);
    return {
      body, ribs, engine, wing,
      cables: [
        cable([[5.4, 0.5, 1.4], [5.9, -0.6, 2.4], [6.2, -1.7, 2.7]]),
        cable([[6.8, 1.0, 1.7], [7.1, -0.2, 2.9], [7.0, -1.5, 3.2]]),
        cable([[7.9, 1.3, 1.2], [8.4, 0.1, 2.0], [8.5, -1.1, 2.3]]),
      ],
    };
  }, []);
  useEffect(() => () => { parts.body.dispose(); parts.engine.dispose(); parts.wing.dispose(); parts.cables.forEach((c) => c.dispose()); (Object.values(mats) as THREE.Material[]).forEach((m) => m.dispose()); }, [parts, mats]);
  const L = HULL.length;
  return (
    <group>
      <mesh geometry={parts.body} material={mats.skin} castShadow receiveShadow />
      {parts.ribs.map((r, i) => (
        <mesh key={i} position={[r.x, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.inner} castShadow>
          <torusGeometry args={[r.r, 0.07, 6, 24, Math.PI * 1.45]} />
        </mesh>
      ))}
      {[-0.5, 0.2, 0.9].map((a, i) => (
        <mesh key={i} position={[6.4, Math.cos(a) * 1.3, Math.sin(a) * 1.3]} rotation={[0, 0, Math.PI / 2 + (i - 1) * 0.04]} material={mats.inner}>
          <cylinderGeometry args={[0.06, 0.06, 4.4, 6]} />
        </mesh>
      ))}
      {parts.cables.map((c, i) => <mesh key={i} geometry={c} material={mats.cable} />)}
      {/* engine nacelles: one still hung on its pylon, burnt open at the intake, one torn off and lying in the dirt */}
      <mesh geometry={parts.engine} material={mats.burnt} position={[L - 2.2, -0.2, 2.5]} rotation={[0, 0, Math.PI / 2 + 0.1]} castShadow />
      <mesh geometry={parts.engine} material={mats.skin} position={[L + 1.6, -1.1, -3.8]} rotation={[0.3, 0.9, Math.PI / 2 + 0.5]} castShadow />
      <mesh geometry={parts.wing} material={mats.skin} position={[L - 4.2, -0.3, 1.5]} rotation={[0.18, 0, 0]} castShadow receiveShadow />
      <mesh geometry={parts.wing} material={mats.skin} position={[L - 4.6, -0.7, -1.6]} rotation={[Math.PI + 0.4, 0.2, 0]} castShadow receiveShadow />
      {/* a few surviving running lights; the rest are dead */}
      {[[L - 0.3, 0.9, 0.7], [L * 0.62, 1.6, -0.3]].map(([x, y, z], i) => (
        <mesh key={i} position={[x!, y!, z!]} material={mats.lamp}><sphereGeometry args={[0.09, 8, 6]} /></mesh>
      ))}
    </group>
  );
}

/** the whole crashed transport, placed at the pit: nose buried, tail raised, resting on the terrain */
export function CrashedTransport() {
  const y = useMemo(() => heightAt(HULL.x, HULL.z) - HULL.sink, []);
  return (
    <group position={[HULL.x, y, HULL.z]} rotation={[0, HULL.yaw, 0]}>
      <group rotation={[0, 0, HULL.pitch]}><Hull /></group>
    </group>
  );
}

/** a smaller scout craft on its belly beside the road, same construction at scale */
export function ScoutWreck() {
  const geo = useMemo(() => (SCOUT ? fuselageGeometry(SCOUT.length, SCOUT.radius, 11, { from: 1.8, to: 3.4, arc: 0.8, centre: 1.0 }) : null), []);
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: "#b9bec8", map: hullDamageTexture(), metalness: 0.65, roughness: 0.68, side: THREE.DoubleSide }), []);
  useEffect(() => () => { geo?.dispose(); skin.dispose(); }, [geo, skin]);
  if (!SCOUT || !geo) return null;
  const y = heightAt(SCOUT.x, SCOUT.z) + SCOUT.radius * 0.55;
  return (
    <group position={[SCOUT.x, y, SCOUT.z]} rotation={[0, SCOUT.yaw, 0.12]}>
      <mesh geometry={geo} material={skin} castShadow receiveShadow rotation={[0.05, 0, 0.1]} />
    </group>
  );
}

/** supply crates: tilted on the ground, half of them burst open (lid off, dark interior) */
export function Crates() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const lids = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current, l = lids.current;
    if (!m || !l) return;
    const o = new THREE.Object3D(), col = new THREE.Color();
    let nl = 0;
    CRATES.forEach((c, i) => {
      const y = heightAt(c.x, c.z) + c.h * 0.42;
      o.position.set(c.x, y, c.z); o.rotation.set(c.tilt, c.yaw, c.tilt * 0.6); o.scale.set(c.w, c.h, c.d); o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.set(c.open ? "#4a5240" : "#586047").offsetHSL(0, 0, (i % 3) * 0.02));
      if (c.open) {
        // the lid, thrown a metre away and lying skewed
        o.position.set(c.x + Math.cos(c.yaw) * 1.1, heightAt(c.x + Math.cos(c.yaw) * 1.1, c.z - Math.sin(c.yaw) * 1.1) + 0.05, c.z - Math.sin(c.yaw) * 1.1);
        o.rotation.set(0.15, c.yaw + 0.6, -0.1); o.scale.set(c.w, 0.08, c.d); o.updateMatrix(); l.setMatrixAt(nl++, o.matrix);
      }
    });
    m.count = CRATES.length; l.count = nl;
    m.instanceMatrix.needsUpdate = true; l.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  const open = CRATES.filter((c) => c.open).length;
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, CRATES.length]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.85} metalness={0.25} />
      </instancedMesh>
      {open > 0 && (
        <instancedMesh ref={lids} args={[undefined, undefined, open]} castShadow frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#454b3b" roughness={0.85} metalness={0.25} />
        </instancedMesh>
      )}
    </group>
  );
}

/** a strip of geometry that follows the terrain along a polyline (wheel ruts) */
function conformingStrip(pts: { x: number; z: number }[], width: number, lift: number): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let run = 0;
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len;
    if (i) run += Math.hypot(p.x - pts[i - 1]!.x, p.z - pts[i - 1]!.z);
    for (const s of [-1, 1]) { const x = p.x + nx * width * 0.5 * s, z = p.z + nz * width * 0.5 * s; pos.push(x, heightAt(x, z) + lift, z); uv.push(run / 3, s < 0 ? 0 : 1); }
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** wheel ruts along the whole trail and standing water in the level low spots */
export function TrailWear() {
  const tex = useMemo(() => { const t = rutTexture(); if (t) { t.wrapS = THREE.RepeatWrapping; } return t; }, []);
  const ruts = useMemo(() => rutLines(0.85).map((l) => conformingStrip(l, 0.55, 0.045)), []);
  const puddles = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = puddles.current;
    if (!m) return;
    const o = new THREE.Object3D();
    PUDDLES.forEach((p, i) => {
      // lowest ground under the puddle, so a tilted patch of water never floats on one side
      let low = Infinity;
      for (const [dx, dz] of [[0, 0], [p.r, 0], [-p.r, 0], [0, p.r], [0, -p.r]]) low = Math.min(low, heightAt(p.x + dx!, p.z + dz!));
      o.position.set(p.x, low + 0.035, p.z); o.rotation.set(-Math.PI / 2, 0, p.yaw); o.scale.set(p.r * p.stretch, p.r, 1); o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = PUDDLES.length; m.instanceMatrix.needsUpdate = true;
  }, []);
  useEffect(() => () => ruts.forEach((g) => g.dispose()), [ruts]);
  void slopeAt; void TRAIL_HALF_WIDTH;
  return (
    <group>
      {tex && ruts.map((g, i) => (
        <mesh key={i} geometry={g} renderOrder={2} receiveShadow>
          <meshStandardMaterial map={tex} transparent depthWrite={false} roughness={1} polygonOffset polygonOffsetFactor={-5} polygonOffsetUnits={-5} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <instancedMesh ref={puddles} args={[undefined, undefined, Math.max(1, PUDDLES.length)]} frustumCulled={false} renderOrder={3}>
        <circleGeometry args={[1, 20]} />
        <meshStandardMaterial color="#1a2326" roughness={0.04} metalness={0.2} transparent opacity={0.62} depthWrite={false} polygonOffset polygonOffsetFactor={-6} polygonOffsetUnits={-6} />
      </instancedMesh>
    </group>
  );
}
