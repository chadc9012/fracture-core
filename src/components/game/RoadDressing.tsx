import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { canopyCluster, chippedBlock, organicRock } from "@/game/organic-geometry";
import { regionAt } from "@/game/world";
import { delineator, lampHead, lampLens, lampPole, railPost, wBeam } from "@/game/street-geometry";
import { VERGE_SCATTER, vergeGround, worldRoadDressing, worldVerge, type Bridge, type Sign, type VergeItem } from "@/game/road-dressing";

/**
 * Roadside furniture and bridges for the supply roads (placement in src/game/road-dressing.ts):
 * reflector posts, W-beam guard rails, street lamps on the hub approaches, destination signs, and a bridge on every
 * resolved river crossing — concrete with steel parapets on paved roads, timber trestle on gravel and dirt ones.
 * Posts, rail segments and lamps are instanced (a handful of draw calls for the whole world); each sign and bridge is
 * its own small group.
 */
const tmp = new THREE.Object3D();
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, list: { x: number; y: number; z: number; yaw: number; sx?: number; sy?: number; sz?: number; dy?: number }[], name: string, shadows = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.name = name; m.count = list.length; m.castShadow = shadows; m.receiveShadow = true;
  list.forEach((p, i) => { tmp.position.set(p.x, p.y + (p.dy ?? 0), p.z); tmp.rotation.set(0, p.yaw, 0); tmp.scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); });
  m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  return m;
}

function Furniture() {
  const built = useMemo(() => {
    const { posts, rails, lamps } = worldRoadDressing().dressing;
    const white = new THREE.MeshStandardMaterial({ color: "#e6e6e0", roughness: 0.6 });
    const reflector = new THREE.MeshStandardMaterial({ color: "#ff8a1a", emissive: "#ff6a00", emissiveIntensity: 0.9, roughness: 0.3 });
    const galv = new THREE.MeshStandardMaterial({ color: "#9ea4a7", metalness: 0.55, roughness: 0.58 });
    const pole = new THREE.MeshStandardMaterial({ color: "#3a3f45", metalness: 0.7, roughness: 0.45 });
    const bulb = new THREE.MeshStandardMaterial({ color: "#fff2d0", emissive: "#ffd79a", emissiveIntensity: 2.4, toneMapped: false });
    const geos: THREE.BufferGeometry[] = [];
    const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
    const meshes: THREE.Object3D[] = [
      // reflector posts: 1.1 m flexible delineator, orange reflector band near the top facing traffic both ways
      instanced(g(delineator()), white, posts, "road-posts"),
      instanced(g(new THREE.CylinderGeometry(0.068, 0.068, 0.16, 8).translate(0, 0.9, 0)), reflector, posts, "road-reflectors", false),
      // guard rail: a pressed W-beam on a C-channel post every segment, stretched to each segment's length
      instanced(g(wBeam()), galv, rails.map((r) => ({ ...r, sz: r.length + 0.1 })), "road-rails"),
      instanced(g(railPost()), pole, rails, "road-rail-posts"),
      // lamps: tapered 8 m pole on a plinth, curved outreach arm over the road (local +Z), a cobra head with a lit lens
      instanced(g(lampPole()), pole, lamps, "road-lamp-poles"),
      instanced(g(lampHead()), pole, lamps, "road-lamp-heads", false),
      instanced(g(lampLens()), bulb, lamps, "road-lamp-lens", false),
    ];
    return { meshes, geos, mats: [white, reflector, galv, pole, bulb] };
  }, []);
  useEffect(() => () => { built.geos.forEach((x) => x.dispose()); built.mats.forEach((x) => x.dispose()); }, [built]);
  return <group name="road-furniture">{built.meshes.map((m) => <primitive key={m.name} object={m} />)}</group>;
}

function signTexture(s: Sign): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 512; c.height = 224;
  const g = c.getContext("2d"); if (!g) return null;
  const paved = s.kind === "asphalt";
  g.fillStyle = paved ? "#0d6a3c" : "#6b4a2a"; g.fillRect(0, 0, 512, 224);
  g.strokeStyle = paved ? "#f2f2ec" : "#e9dcc0"; g.lineWidth = 8; g.strokeRect(10, 10, 492, 204);
  g.fillStyle = paved ? "#ffffff" : "#f1e6cc";
  g.font = "bold 62px system-ui, sans-serif"; g.textBaseline = "middle";
  g.fillText(s.to.replace(/^The /, ""), 34, 84, 360);
  g.font = "48px system-ui, sans-serif"; g.fillText(`${s.km.toFixed(1)} km`, 34, 160);
  // arrow
  g.beginPath(); g.moveTo(400, 90); g.lineTo(470, 90); g.lineTo(470, 64); g.lineTo(500, 112); g.lineTo(470, 160); g.lineTo(470, 134); g.lineTo(400, 134); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function RoadSign({ s }: { s: Sign }) {
  const map = useMemo(() => signTexture(s), [s]);
  useEffect(() => () => map?.dispose(), [map]);
  const paved = s.kind === "asphalt", post = paved ? "#8d949a" : "#5a3d22";
  return (
    <group position={[s.x, s.y, s.z]} rotation={[0, s.yaw, 0]}>
      {[-1.3, 1.3].map((x) => <mesh key={x} position={[x, 1.6, 0]} castShadow>{paved ? <cylinderGeometry args={[0.06, 0.07, 3.2, 8]} /> : <boxGeometry args={[0.14, 3.2, 0.14]} />}<meshStandardMaterial color={post} metalness={paved ? 0.7 : 0} roughness={paved ? 0.45 : 0.9} /></mesh>)}
      <mesh position={[0, 2.6, 0.08]} castShadow><boxGeometry args={[3.3, 1.45, 0.06]} /><meshStandardMaterial color={post} roughness={0.8} /></mesh>
      <mesh position={[0, 2.6, 0.115]}><planeGeometry args={[3.2, 1.4]} />{map ? <meshStandardMaterial map={map} roughness={0.55} /> : <meshStandardMaterial color={paved ? "#0d6a3c" : "#6b4a2a"} />}</mesh>
    </group>
  );
}

/** worked-concrete bridge parts, cached by size (a handful of bridges share a few sizes) */
const bridgeCache = new Map<string, THREE.BufferGeometry>();
const bridgeGeo = (key: string, make: () => THREE.BufferGeometry) => { let g = bridgeCache.get(key); if (!g) { g = make(); bridgeCache.set(key, g); } return g; };

/** a bridge on exactly the deck the player walks on (terrain.ts deckAt): slab + surfacing, kerbs, parapets, piers to the bed */
function BridgeModel({ b }: { b: Bridge }) {
  const concrete = b.kind === "asphalt";
  const deckTop = b.deck, half = b.width / 2, L = b.length;
  const slab = concrete ? "#9a9890" : "#6e4a2c", rail = concrete ? "#b4bbc0" : "#5c3b20", pier = concrete ? "#8a8880" : "#4f3520";
  const railPosts = Math.max(2, Math.round(L / 2.5));
  return (
    <group name="road-bridge" position={[b.x, 0, b.z]} rotation={[0, b.yaw, 0]}>
      {/* deck slab; its top is the walkable deck */}
      <mesh position={[0, deckTop - 0.35, 0]} castShadow receiveShadow geometry={bridgeGeo(`s${b.width}x${L}`, () => chippedBlock(b.width, 0.7, L, 3))}><meshStandardMaterial color={slab} roughness={0.85} /></mesh>
      {concrete
        ? <mesh position={[0, deckTop + 0.012, 0]} receiveShadow><boxGeometry args={[b.width - 1.2, 0.02, L]} /><meshStandardMaterial color="#3a3c40" roughness={0.8} /></mesh>
        : Array.from({ length: Math.round(L / 0.6) }, (_, i) => <mesh key={i} position={[0, deckTop + 0.02, -L / 2 + 0.3 + i * 0.6]} receiveShadow><boxGeometry args={[b.width - 0.2, 0.05, 0.52]} /><meshStandardMaterial color={i % 3 ? "#7a5534" : "#6a472a"} roughness={0.95} /></mesh>)}
      {/* kerbs */}
      {[-1, 1].map((s) => <mesh key={`k${s}`} position={[s * (half - 0.3), deckTop + 0.12, 0]} castShadow geometry={bridgeGeo(`k${L}`, () => chippedBlock(0.6, 0.25, L, 7))}><meshStandardMaterial color={concrete ? "#b5b2a8" : "#5c3b20"} roughness={0.85} /></mesh>)}
      {/* parapets: posts and two rails */}
      {[-1, 1].map((s) => (
        <group key={`p${s}`} position={[s * (half - 0.25), deckTop + 0.25, 0]}>
          {Array.from({ length: railPosts + 1 }, (_, i) => <mesh key={i} position={[0, 0.5, -L / 2 + (i * L) / railPosts]} castShadow><boxGeometry args={[0.12, 1, 0.12]} /><meshStandardMaterial color={rail} metalness={concrete ? 0.8 : 0} roughness={concrete ? 0.4 : 0.9} /></mesh>)}
          {[0.95, 0.5].map((y) => <mesh key={y} position={[0, y, 0]} rotation-x={concrete ? Math.PI / 2 : 0} castShadow>{concrete ? <cylinderGeometry args={[0.045, 0.045, L, 10]} /> : <boxGeometry args={[0.14, 0.16, L]} />}<meshStandardMaterial color={rail} metalness={concrete ? 0.8 : 0} roughness={concrete ? 0.4 : 0.9} /></mesh>)}
        </group>
      ))}
      {/* piers down to the river bed */}
      {b.piers.map((p, i) => {
        const top = deckTop - 0.7, h = Math.max(0.5, top - p.bed + 0.6);
        return <mesh key={i} position={[p.side * (half - 0.8), top - h / 2, p.along]} castShadow>
          {concrete ? <cylinderGeometry args={[0.45, 0.55, h, 12]} /> : <boxGeometry args={[0.34, h, 0.34]} />}
          <meshStandardMaterial color={pier} roughness={0.9} />
        </mesh>;
      })}
      {/* abutments where the deck meets the bank */}
      {[-1, 1].map((s) => <mesh key={`a${s}`} position={[0, deckTop - 1.4, s * (L / 2 - 0.6)]} castShadow receiveShadow geometry={bridgeGeo(`a${b.width}`, () => chippedBlock(b.width + 0.6, 2.2, 1.4, 11))}><meshStandardMaterial color={concrete ? "#86847c" : "#6d6a62"} roughness={0.95} /></mesh>)}
    </group>
  );
}

export function RoadDressing() {
  const { dressing, bridges } = useMemo(() => worldRoadDressing(), []);
  return (
    <group name="road-dressing">
      <Furniture />
      <Verge />
      {dressing.signs.map((s, i) => <RoadSign key={i} s={s} />)}
      {bridges.map((b, i) => <BridgeModel key={i} b={b} />)}
    </group>
  );
}

/* rocks and dry scrub crowding the road edges (owner's target frame "wilds by day"); only the items near the camera are drawn,
 * reselected twice a second, so the world-wide scatter costs two instanced draws */
const ROCK_TINT: Record<string, string> = { wastelands: "#9b8564", solara: "#c4a582", ember: "#3e3639", frostspire: "#9aa3ad", swamps: "#5e6656", veridan: "#7c7a6c" };
const SCRUB_TINT: Record<string, string> = { wastelands: "#86794e", solara: "#968758", ember: "#4a4030", frostspire: "#56665c", swamps: "#4d5e3a", veridan: "#55703a" };
const CAP = 900;
function Verge() {
  const [items, setItems] = useState<VergeItem[] | null>(null);
  // placement takes ~0.2 s: done after the world is up rather than inside the first frame
  useEffect(() => { const id = setTimeout(() => setItems(worldVerge((x, z) => regionAt(x, z)?.id)), 1500); return () => clearTimeout(id); }, []);
  const geo = useMemo(() => ({ rock: organicRock(0.6, 91, 1, 0.18), scrub: canopyCluster(93) }), []);
  const mats = useMemo(() => ({ rock: new THREE.MeshStandardMaterial({ roughness: 0.95 }), scrub: new THREE.MeshStandardMaterial({ roughness: 1 }) }), []);
  useEffect(() => () => { Object.values(geo).forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); }, [geo, mats]);
  const rock = useRef<THREE.InstancedMesh>(null), scrub = useRef<THREE.InstancedMesh>(null);
  const next = useRef(0), o = useMemo(() => new THREE.Object3D(), []), col = useMemo(() => new THREE.Color(), []);
  useFrame(({ camera, clock }) => {
    if (!items || clock.elapsedTime < next.current) return;
    next.current = clock.elapsedTime + 0.5;
    const r = rock.current, s = scrub.current; if (!r || !s) return;
    const R2 = VERGE_SCATTER.drawRadius ** 2, cx = camera.position.x, cz = camera.position.z;
    let nr = 0, ns = 0;
    for (const it of items) {
      const dx = it.x - cx, dz = it.z - cz; if (dx * dx + dz * dz > R2) continue;
      const y = vergeGround(it); if (y === null) continue;
      if (it.kind === "rock") {
        if (nr >= CAP) continue;
        o.position.set(it.x, y + it.s * 0.12, it.z); o.rotation.set(it.r * 0.3, it.r, it.r * 0.2); o.scale.set(it.s * 1.2, it.s * 0.7, it.s);
        o.updateMatrix(); r.setMatrixAt(nr, o.matrix); r.setColorAt(nr, col.set(ROCK_TINT[it.region] ?? "#8a8478").multiplyScalar(0.85 + (it.r % 1) * 0.3)); nr++;
      } else {
        if (ns >= CAP) continue;
        o.position.set(it.x, y + it.s * 0.4, it.z); o.rotation.set(0, it.r, 0); o.scale.set(it.s * 0.72, it.s * 0.95, it.s * 0.72); // upright dry bushes (they read as flat pancakes at 0.6)
        o.updateMatrix(); s.setMatrixAt(ns, o.matrix); s.setColorAt(ns, col.set(SCRUB_TINT[it.region] ?? "#6a6a3c").multiplyScalar(0.8 + (it.r % 1) * 0.35)); ns++;
      }
    }
    r.count = nr; s.count = ns;
    for (const m of [r, s]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); }
  });
  return <group name="road-verge">
    <instancedMesh ref={(m) => { rock.current = m; if (m && !items) m.count = 0; }} args={[geo.rock, mats.rock, CAP]} castShadow receiveShadow frustumCulled={false} />
    <instancedMesh ref={(m) => { scrub.current = m; if (m && !items) m.count = 0; }} args={[geo.scrub, mats.scrub, CAP]} castShadow frustumCulled={false} />
  </group>;
}
