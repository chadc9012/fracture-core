import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SKYRAIL, deckAt, legs, linePoint, piers, railLines, trainAt } from "@/game/nexus-skyrail";
import { addObstacle } from "@/game/obstacles";
import { chippedBlock } from "@/game/organic-geometry";
import { lampLevel, worldLight } from "@/game/world-light";

/** The Nexus sky-rail (nexus-skyrail.ts): concrete guideway decks on portal frames over two street lines, an LED strip under each
 * deck edge that glows at night, and a three-car train with lit windows shuttling along each line. Six instanced draws for the
 * structure, one small group per train. Legs are solid. */
const SPAN = 24; // a deck segment is built per pier gap; geometry is a unit length stretched to the gap
export function NexusSkyRail() {
  const lines = useMemo(() => railLines().map((l) => ({ l, ps: piers(l) })), []);
  useEffect(() => {
    const added = lines.flatMap(({ ps }) => ps.flatMap((p) => legs(p).map((g) => addObstacle("tower", g.x, g.z, 0.55, 1e9, 1))));
    return () => { for (const o of added) o.broken = true; };
  }, [lines]);

  const geo = useMemo(() => ({
    deck: chippedBlock(SKYRAIL.width, SKYRAIL.depth, SPAN, 31),
    beam: new THREE.BoxGeometry(0.5, 0.35, 1),        // twin running beams on the deck, stretched per span
    leg: chippedBlock(0.9, 1, 0.9, 33),               // unit-height leg, scaled to the deck
    cap: chippedBlock(SKYRAIL.legOff * 2 + 1.4, 1.2, 1.4, 35),
    led: new THREE.BoxGeometry(0.08, 0.08, 1),
    car: new THREE.BoxGeometry(2.8, 2.6, SKYRAIL.carLen - 0.6),
    band: new THREE.BoxGeometry(2.84, 0.7, SKYRAIL.carLen - 1.4),
  }), []);
  const mats = useMemo(() => ({
    concrete: new THREE.MeshStandardMaterial({ color: "#6d727c", roughness: 0.75, metalness: 0.1 }),
    steel: new THREE.MeshStandardMaterial({ color: "#3a3f48", roughness: 0.4, metalness: 0.75 }),
    led: new THREE.MeshStandardMaterial({ color: "#9ff6ff", emissive: "#38e8ff", emissiveIntensity: 0.4, toneMapped: false }),
    body: new THREE.MeshStandardMaterial({ color: "#d9dde3", roughness: 0.3, metalness: 0.55 }),
    windows: new THREE.MeshStandardMaterial({ color: "#10151d", emissive: "#ffe4b8", emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.4, toneMapped: false }),
  }), []);
  useEffect(() => () => { Object.values(geo).forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); }, [geo, mats]);

  // structure matrices: one deck, two beams and two LED strips per span; two legs and a cap beam per pier
  const built = useMemo(() => {
    const o = new THREE.Object3D(), deck: THREE.Matrix4[] = [], beam: THREE.Matrix4[] = [], led: THREE.Matrix4[] = [], leg: THREE.Matrix4[] = [], cap: THREE.Matrix4[] = [];
    for (const { l, ps } of lines) {
      const yaw = Math.atan2(l.bx - l.ax, l.bz - l.az);
      for (let i = 1; i < ps.length; i++) {
        const a = ps[i - 1]!, b = ps[i]!, len = Math.hypot(b.x - a.x, b.z - a.z), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, y = (a.deck + b.deck) / 2;
        const pitch = Math.atan2(b.deck - a.deck, len);
        o.position.set(mx, y + SKYRAIL.depth / 2, mz); o.rotation.set(0, yaw, 0, "YXZ"); o.rotateX(-pitch); o.scale.set(1, 1, len / SPAN); o.updateMatrix(); deck.push(o.matrix.clone());
        for (const k of [-1, 1]) {
          const ox = Math.cos(yaw) * k, oz = -Math.sin(yaw) * k;
          o.position.set(mx + ox * 0.85, y + SKYRAIL.depth + 0.17, mz + oz * 0.85); o.scale.set(1, 1, len); o.updateMatrix(); beam.push(o.matrix.clone());
          o.position.set(mx + ox * (SKYRAIL.width / 2 - 0.05), y + 0.05, mz + oz * (SKYRAIL.width / 2 - 0.05)); o.scale.set(1, 1, len); o.updateMatrix(); led.push(o.matrix.clone());
        }
      }
      for (const p of ps) {
        for (const g of legs(p)) { const h = p.deck - p.ground + 0.4; o.position.set(g.x, p.ground - 0.4 + h / 2, g.z); o.rotation.set(0, yaw, 0); o.scale.set(1, h, 1); o.updateMatrix(); leg.push(o.matrix.clone()); }
        o.position.set(p.x, p.deck - 0.6, p.z); o.rotation.set(0, yaw + Math.PI / 2, 0); o.scale.set(1, 1, 1); o.updateMatrix(); cap.push(o.matrix.clone());
      }
    }
    return { deck, beam, led, leg, cap };
  }, [lines]);

  useFrame(({ clock }) => {
    const k = lampLevel(worldLight.night);
    mats.led.emissiveIntensity = 0.4 + 2.6 * k;
    mats.windows.emissiveIntensity = 0.3 + 1.8 * k;
    const t = clock.elapsedTime;
    lines.forEach(({ l, ps }, li) => {
      const g = trains.current[li]; if (!g) return;
      const nose = trainAt(l, t, li * 23);
      g.children.forEach((car, ci) => {
        const s = nose - (ci + 0.5) * SKYRAIL.carLen, p = linePoint(l, s);
        car.position.set(p.x, deckAt(l, ps, s) + SKYRAIL.depth + 0.35 + 1.4, p.z);
        car.rotation.set(0, Math.atan2(p.dx, p.dz), 0);
      });
    });
  });
  const trains = useRef<(THREE.Group | null)[]>([]);

  return (
    <group name="nexus-skyrail">
      <Batch geo={geo.deck} mat={mats.concrete} ms={built.deck} />
      <Batch geo={geo.beam} mat={mats.steel} ms={built.beam} />
      <Batch geo={geo.leg} mat={mats.concrete} ms={built.leg} />
      <Batch geo={geo.cap} mat={mats.concrete} ms={built.cap} />
      <Batch geo={geo.led} mat={mats.led} ms={built.led} shadow={false} />
      {lines.map((_, li) => (
        <group key={li} ref={(g) => { trains.current[li] = g; }}>
          {Array.from({ length: SKYRAIL.cars }, (_, ci) => (
            <group key={ci}>
              <mesh geometry={geo.car} material={mats.body} castShadow />
              <mesh geometry={geo.band} material={mats.windows} position={[0, 0.35, 0]} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

function Batch({ geo, mat, ms, shadow = true }: { geo: THREE.BufferGeometry; mat: THREE.Material; ms: THREE.Matrix4[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    ms.forEach((x, i) => m.setMatrixAt(i, x));
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  }, [ms]);
  if (!ms.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, ms.length]} castShadow={shadow} receiveShadow />;
}
