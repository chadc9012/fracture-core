import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SHARD_FX, shardAlpha, shardCount, shardFlights, shardGain, type ShardFlight } from "@/game/shard-gain";

/** a glass shard: an irregular elongated bipyramid (6 sides), so it catches light on its facets as it tumbles */
function shardGeometry(): THREE.BufferGeometry {
  const ring = 6, pos: number[] = [], top = [0, 1.25, 0.05], bottom = [0.03, -0.9, 0];
  const pts: number[][] = [];
  for (let i = 0; i < ring; i++) { const a = (i / ring) * Math.PI * 2, r = 0.32 + ((i * 37) % 7) / 40; pts.push([Math.cos(a) * r, ((i * 13) % 5) / 30, Math.sin(a) * r * 0.6]); }
  for (let i = 0; i < ring; i++) {
    const a = pts[i]!, b = pts[(i + 1) % ring]!;
    pos.push(...top, ...b, ...a, ...bottom, ...a, ...b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const GRAVITY = -2.6;
const UP = new THREE.Vector3(0, 1, 0);

/** Presentation only (shard-gain.ts): when the save's fractureShards go up, glass shards burst from the operator, tumble upward and
 * fade, each trailing a light streak along its flight. A pool of SHARD_FX.maxShards meshes, never re-rendered by React. */
export function ShardGainFx({ shards, playerRef }: { shards: number | undefined; playerRef: React.RefObject<THREE.Object3D | null> }) {
  const geometry = useMemo(() => shardGeometry(), []);
  const streakGeo = useMemo(() => new THREE.CylinderGeometry(0.012, 0.0, 1, 5, 1, true).translate(0, -0.5, 0), []);
  const mats = useMemo(() => Array.from({ length: SHARD_FX.maxShards }, () => ({
    glass: new THREE.MeshStandardMaterial({ color: "#d9ecff", emissive: "#7c5cff", emissiveIntensity: 1.4, metalness: 0.15, roughness: 0.08, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    streak: new THREE.MeshBasicMaterial({ color: "#bfa8ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  })), []);
  useEffect(() => () => { geometry.dispose(); streakGeo.dispose(); for (const m of mats) { m.glass.dispose(); m.streak.dispose(); } }, [geometry, streakGeo, mats]);

  const shardRefs = useRef<(THREE.Mesh | null)[]>([]), streakRefs = useRef<(THREE.Mesh | null)[]>([]);
  const burst = useRef<{ start: number; origin: THREE.Vector3; flights: ShardFlight[] } | null>(null);
  const last = useRef<number | undefined>(undefined);
  const pending = useRef(0);
  const clock = useRef(0);

  useEffect(() => {
    const gain = shardGain(last.current, shards);
    last.current = shards;
    if (gain > 0) pending.current = gain;
  }, [shards]);

  const tmpQ = useMemo(() => new THREE.Quaternion(), []), axis = useMemo(() => new THREE.Vector3(), []), vel = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    clock.current += Math.min(dt, 0.05);
    const now = clock.current;
    if (pending.current > 0) {
      const p = playerRef.current?.position;
      if (p) burst.current = { start: now, origin: new THREE.Vector3(p.x, p.y + 1.3, p.z), flights: shardFlights(shardCount(pending.current), Math.floor(now * 1000)) };
      pending.current = 0;
    }
    const b = burst.current;
    for (let i = 0; i < SHARD_FX.maxShards; i++) {
      const m = shardRefs.current[i], s = streakRefs.current[i], f = b?.flights[i];
      if (!m || !s) continue;
      const t = f && b ? now - b.start - f.delay : -1;
      const alpha = f ? shardAlpha(t) : 0;
      m.visible = s.visible = alpha > 0.01;
      if (!m.visible || !f || !b) continue;
      const drag = Math.exp(-0.6 * t);
      m.position.set(b.origin.x + f.vx * t * drag, b.origin.y + f.vy * t * drag + 0.5 * GRAVITY * t * t, b.origin.z + f.vz * t * drag);
      m.quaternion.setFromAxisAngle(axis.set(f.ax, f.ay, f.az), f.spin * t);
      m.scale.setScalar(f.scale * (0.6 + 0.4 * Math.min(1, t * 6)));
      mats[i]!.glass.opacity = 0.85 * alpha;
      // the streak points back along the shard's current velocity, longer while it is fast
      vel.set(f.vx * drag, f.vy * drag + GRAVITY * t, f.vz * drag);
      const speed = vel.length();
      s.position.copy(m.position);
      s.quaternion.copy(tmpQ.setFromUnitVectors(UP, vel.normalize()));
      s.scale.set(f.scale * 4, Math.min(2.2, speed * 0.35), f.scale * 4);
      mats[i]!.streak.opacity = 0.7 * alpha;
    }
    if (b && now - b.start > SHARD_FX.life + SHARD_FX.maxShards * 0.05) burst.current = null;
  });

  return (
    <group name="fx:shard-gain">
      {mats.map((m, i) => (
        <group key={i}>
          <mesh ref={(el) => { shardRefs.current[i] = el; }} geometry={geometry} material={m.glass} visible={false} frustumCulled={false} />
          <mesh ref={(el) => { streakRefs.current[i] = el; }} geometry={streakGeo} material={m.streak} visible={false} frustumCulled={false} />
        </group>
      ))}
    </group>
  );
}
