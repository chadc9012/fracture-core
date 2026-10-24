import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { heightAt } from "@/game/terrain";
import { DistrictLight } from "./DistrictLight";
import { ruins } from "@/game/weapon-evolution";
import { applyWorldTriplanar, weatheredConcreteTexture } from "@/game/weathered-surface";
import { chippedBlock, flutedColumn, organicRock } from "@/game/organic-geometry";
import { crystalShard } from "@/game/camp-geometry";
import { BOSS_LAIRS, MARKER_COLOR, RESOURCE_SITES } from "@/game/waypoints";

/** In-world beacons for resource sites and boss lairs; depleted sites dim until they respawn. */
const RUIN_GLOW = { THERMAL: "#ff7a2e", CRYO: "#7fd8ff", BIO: "#7dff8a", ARC: "#9b8cff", KINETIC: "#ffb23e" } as const;
/** Ruin site: a ring of broken fluted columns (some fallen) on a cracked flagstone floor that follows the ground,
 * rubble, and a floating crystal core. Presentation only (weapon-evolution.ts owns the rules). Built from the
 * organic-geometry set pieces and weathered stone, so no flat disc floats over slopes. */
const RUIN_GEO = (() => {
  const columns = [0, 1, 2].map((i) => flutedColumn(1, 0.42, 11 + i));
  return { columns, slab: chippedBlock(1.6, 0.28, 1.6, 7), drum: chippedBlock(0.9, 0.7, 0.9, 13), rubble: organicRock(0.45, 21, 1, 0.14), core: crystalShard(9) };
})();
let ruinStone: THREE.MeshStandardMaterial | null = null;
const stone = () => (ruinStone ??= applyWorldTriplanar(new THREE.MeshStandardMaterial({ color: "#8a857c", roughness: 0.95 }), weatheredConcreteTexture(), 3));
const hh = (n: number) => { const v = Math.sin(n * 91.7 + 13.1) * 43758.5; return v - Math.floor(v); };
type RuinPiece = { geo: keyof typeof RUIN_BATCH_KEYS; m: THREE.Matrix4; cast: boolean };
const RUIN_BATCH_KEYS = { col0: 0, col1: 1, col2: 2, drum: 3, slab: 4, rubble: 5 } as const;
const ruinGeo = (k: keyof typeof RUIN_BATCH_KEYS): THREE.BufferGeometry =>
  k === "drum" ? RUIN_GEO.drum : k === "slab" ? RUIN_GEO.slab : k === "rubble" ? RUIN_GEO.rubble : RUIN_GEO.columns[RUIN_BATCH_KEYS[k]]!;

/** every stone piece of every ruin site, in world space (same layout as before: a ring of columns, some fallen, flagstones on a
 * 1.7 m grid with a few missing, rubble). Built once and drawn as one instanced batch per geometry: ~230 separate meshes (each a draw
 * call plus a shadow draw on the owner's Intel GPU) become six draws. */
function ruinPieces(): RuinPiece[] {
  const out: RuinPiece[] = [], o = new THREE.Object3D();
  const put = (geo: RuinPiece["geo"], x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number, cast = true) => {
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix(); out.push({ geo, m: o.matrix.clone(), cast });
  };
  ruins().forEach((r, ri) => {
    const base = heightAt(r.x, r.z);
    const local = (dx: number, dz: number) => heightAt(r.x + dx, r.z + dz) - base;
    const col = (i: number) => (["col0", "col1", "col2"] as const)[i % 3]!;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, x = Math.cos(a) * 5, z = Math.sin(a) * 5, h = 2.4 + ((i * 37) % 5) * 0.9, y = local(x, z);
      if ((i + ri) % 4 === 3) {
        put("drum", r.x + x, base + y + 0.3, r.z + z, 0, a, 0, 1, 1, 1);
        put(col(i), r.x + x + Math.cos(a + 1.4) * 0.6, base + y + 0.4, r.z + z + Math.sin(a + 1.4) * 0.6, 0, a + 1.4, Math.PI / 2 - 0.06, 1, h * 0.8, 1);
      } else put(col(i), r.x + x, base + y - 0.15, r.z + z, (i % 3 - 1) * 0.05, a, (i % 2 ? 1 : -1) * 0.04, 1, h, 1);
    }
    for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) {
      const x = gx * 1.7, z = gz * 1.7;
      if (Math.hypot(x, z) > 5.6 || hh(ri * 97 + gx * 7 + gz) < 0.12) continue;
      const n = hh(ri + gx * 3 + gz * 5);
      put("slab", r.x + x, base + local(x, z) - 0.06, r.z + z, (n - 0.5) * 0.08, n * 3, (0.5 - n) * 0.06, 1, 1, 1, false);
    }
    for (let i = 0; i < 6; i++) {
      const a = hh(ri * 13 + i) * 6.28, d = 3 + hh(ri * 7 + i) * 4, x = Math.cos(a) * d, z = Math.sin(a) * d, sc = 0.6 + hh(i + ri) * 0.9;
      put("rubble", r.x + x, base + local(x, z) + 0.12, r.z + z, i, i * 2, 0, sc, sc, sc);
    }
  });
  return out;
}

function RuinBatch({ geo, pieces }: { geo: keyof typeof RUIN_BATCH_KEYS; pieces: RuinPiece[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    pieces.forEach((p, i) => m.setMatrixAt(i, p.m));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [pieces]);
  if (!pieces.length) return null;
  return <instancedMesh ref={ref} args={[ruinGeo(geo), stone(), pieces.length]} castShadow={pieces[0]!.cast} receiveShadow />;
}

function RuinSites() {
  const batches = useMemo(() => {
    const by = new Map<keyof typeof RUIN_BATCH_KEYS, RuinPiece[]>();
    for (const p of ruinPieces()) by.set(p.geo, [...(by.get(p.geo) ?? []), p]);
    return [...by.entries()];
  }, []);
  return (
    <group>
      {batches.map(([geo, pieces]) => <RuinBatch key={geo} geo={geo} pieces={pieces} />)}
      {ruins().map((r) => {
        const glow = RUIN_GLOW[r.element], base = heightAt(r.x, r.z);
        return (
          <group key={r.id} position={[r.x, base, r.z]}>
            {/* the element's glow pooled on the floor, and the core itself */}
            <DistrictLight position={[0, 2.4, 0]} color={glow} intensity={6} distance={9} decay={2} range={70} />
            <mesh geometry={RUIN_GEO.core} position={[0, 2.4, 0]} scale={[0.55, 1.6, 0.55]}><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.2} roughness={0.2} flatShading /></mesh>
            <mesh position={[0, 20, 0]}><cylinderGeometry args={[0.1, 0.1, 40, 6]} /><meshBasicMaterial color={glow} transparent opacity={0.22} depthWrite={false} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

export function WorldMarkers({ depleted }: { depleted: React.MutableRefObject<Record<string, number>> }) {
  const groups = useRef<Record<string, THREE.Group | null>>({});
  useFrame(({ clock }) => {
    const now = performance.now();
    for (const site of RESOURCE_SITES) {
      const g = groups.current[site.id]; if (!g) continue;
      const empty = (depleted.current[site.id] ?? 0) > now;
      g.scale.setScalar(empty ? 0.5 : 1);
      g.children[0]?.rotateY(0.02);
      g.position.y = heightAt(site.x, site.z) + 1.2 + Math.sin(clock.elapsedTime * 2 + site.x) * 0.2;
    }
  });
  return (
    <group>
      <RuinSites />
      {RESOURCE_SITES.map((site) => (
        <group key={site.id} ref={(g) => { groups.current[site.id] = g; }} position={[site.x, heightAt(site.x, site.z) + 1.2, site.z]}>
          <mesh castShadow><icosahedronGeometry args={[0.8, 0]} /><meshStandardMaterial color={MARKER_COLOR.RESOURCE} emissive={MARKER_COLOR.RESOURCE} emissiveIntensity={1.6} roughness={0.3} /></mesh>
          <mesh position={[0, 14, 0]}><cylinderGeometry args={[0.08, 0.08, 28, 6]} /><meshBasicMaterial color={MARKER_COLOR.RESOURCE} transparent opacity={0.35} /></mesh>
        </group>
      ))}
      {BOSS_LAIRS.map((lair) => (
        <group key={lair.id} position={[lair.x, heightAt(lair.x, lair.z), lair.z]}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.15, 0]}><ringGeometry args={[8.5, 10, 48]} /><meshBasicMaterial color={MARKER_COLOR.BOSS} transparent opacity={0.6} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 25, 0]}><cylinderGeometry args={[0.15, 0.15, 50, 6]} /><meshBasicMaterial color={MARKER_COLOR.BOSS} transparent opacity={0.3} depthWrite={false} /></mesh>
        </group>
      ))}
    </group>
  );
}
