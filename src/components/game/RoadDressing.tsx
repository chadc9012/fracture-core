import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { worldRoadDressing, type Bridge, type Sign } from "@/game/road-dressing";

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
    const galv = new THREE.MeshStandardMaterial({ color: "#b3b9bd", metalness: 0.6, roughness: 0.4 });
    const pole = new THREE.MeshStandardMaterial({ color: "#3a3f45", metalness: 0.7, roughness: 0.45 });
    const bulb = new THREE.MeshStandardMaterial({ color: "#fff2d0", emissive: "#ffd79a", emissiveIntensity: 2.4, toneMapped: false });
    const geos: THREE.BufferGeometry[] = [];
    const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
    const meshes: THREE.Object3D[] = [
      // reflector posts: 1.1 m white post, orange reflector band near the top facing traffic both ways
      instanced(g(new THREE.BoxGeometry(0.12, 1.1, 0.12).translate(0, 0.55, 0)), white, posts, "road-posts"),
      instanced(g(new THREE.BoxGeometry(0.13, 0.16, 0.13).translate(0, 0.9, 0)), reflector, posts, "road-reflectors", false),
      // guard rail: a W-beam (two stacked strips) on a post every segment, stretched to each segment's length
      instanced(g(new THREE.BoxGeometry(0.06, 0.32, 1).translate(0, 0.62, 0)), galv, rails.map((r) => ({ ...r, sz: r.length + 0.1 })), "road-rails"),
      instanced(g(new THREE.BoxGeometry(0.1, 0.06, 1).translate(0.03, 0.8, 0)), galv, rails.map((r) => ({ ...r, sz: r.length + 0.1 })), "road-rail-lips", false),
      instanced(g(new THREE.BoxGeometry(0.12, 0.85, 0.12).translate(-0.08, 0.42, 0)), pole, rails, "road-rail-posts"),
      // lamps: 8 m pole, 2.2 m arm over the road (local +Z), a lit head
      instanced(g(new THREE.CylinderGeometry(0.09, 0.14, 8, 8).translate(0, 4, 0)), pole, lamps, "road-lamp-poles"),
      instanced(g(new THREE.BoxGeometry(0.1, 0.1, 2.2).translate(0, 7.9, 1.05)), pole, lamps, "road-lamp-arms", false),
      instanced(g(new THREE.BoxGeometry(0.34, 0.12, 0.7).translate(0, 7.8, 2.05)), bulb, lamps, "road-lamp-heads", false),
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
      {[-1.3, 1.3].map((x) => <mesh key={x} position={[x, 1.6, 0]} castShadow><boxGeometry args={[0.12, 3.2, 0.12]} /><meshStandardMaterial color={post} metalness={paved ? 0.7 : 0} roughness={paved ? 0.45 : 0.9} /></mesh>)}
      <mesh position={[0, 2.6, 0.08]} castShadow><boxGeometry args={[3.3, 1.45, 0.06]} /><meshStandardMaterial color={post} roughness={0.8} /></mesh>
      <mesh position={[0, 2.6, 0.115]}><planeGeometry args={[3.2, 1.4]} />{map ? <meshStandardMaterial map={map} roughness={0.55} /> : <meshStandardMaterial color={paved ? "#0d6a3c" : "#6b4a2a"} />}</mesh>
    </group>
  );
}

/** a bridge on exactly the deck the player walks on (terrain.ts deckAt): slab + surfacing, kerbs, parapets, piers to the bed */
function BridgeModel({ b }: { b: Bridge }) {
  const concrete = b.kind === "asphalt";
  const deckTop = b.deck, half = b.width / 2, L = b.length;
  const slab = concrete ? "#9a9890" : "#6e4a2c", rail = concrete ? "#b4bbc0" : "#5c3b20", pier = concrete ? "#8a8880" : "#4f3520";
  const railPosts = Math.max(2, Math.round(L / 2.5));
  return (
    <group name="road-bridge" position={[b.x, 0, b.z]} rotation={[0, b.yaw, 0]}>
      {/* deck slab; its top is the walkable deck */}
      <mesh position={[0, deckTop - 0.35, 0]} castShadow receiveShadow><boxGeometry args={[b.width, 0.7, L]} /><meshStandardMaterial color={slab} roughness={0.85} /></mesh>
      {concrete
        ? <mesh position={[0, deckTop + 0.012, 0]} receiveShadow><boxGeometry args={[b.width - 1.2, 0.02, L]} /><meshStandardMaterial color="#3a3c40" roughness={0.8} /></mesh>
        : Array.from({ length: Math.round(L / 0.6) }, (_, i) => <mesh key={i} position={[0, deckTop + 0.02, -L / 2 + 0.3 + i * 0.6]} receiveShadow><boxGeometry args={[b.width - 0.2, 0.05, 0.52]} /><meshStandardMaterial color={i % 3 ? "#7a5534" : "#6a472a"} roughness={0.95} /></mesh>)}
      {/* kerbs */}
      {[-1, 1].map((s) => <mesh key={`k${s}`} position={[s * (half - 0.3), deckTop + 0.12, 0]} castShadow><boxGeometry args={[0.6, 0.25, L]} /><meshStandardMaterial color={concrete ? "#b5b2a8" : "#5c3b20"} roughness={0.85} /></mesh>)}
      {/* parapets: posts and two rails */}
      {[-1, 1].map((s) => (
        <group key={`p${s}`} position={[s * (half - 0.25), deckTop + 0.25, 0]}>
          {Array.from({ length: railPosts + 1 }, (_, i) => <mesh key={i} position={[0, 0.5, -L / 2 + (i * L) / railPosts]} castShadow><boxGeometry args={[0.12, 1, 0.12]} /><meshStandardMaterial color={rail} metalness={concrete ? 0.8 : 0} roughness={concrete ? 0.4 : 0.9} /></mesh>)}
          {[0.95, 0.5].map((y) => <mesh key={y} position={[0, y, 0]} castShadow><boxGeometry args={[concrete ? 0.08 : 0.14, concrete ? 0.08 : 0.16, L]} /><meshStandardMaterial color={rail} metalness={concrete ? 0.8 : 0} roughness={concrete ? 0.4 : 0.9} /></mesh>)}
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
      {[-1, 1].map((s) => <mesh key={`a${s}`} position={[0, deckTop - 1.4, s * (L / 2 - 0.6)]} castShadow receiveShadow><boxGeometry args={[b.width + 0.6, 2.2, 1.4]} /><meshStandardMaterial color={concrete ? "#86847c" : "#6d6a62"} roughness={0.95} /></mesh>)}
    </group>
  );
}

export function RoadDressing() {
  const { dressing, bridges } = useMemo(() => worldRoadDressing(), []);
  return (
    <group name="road-dressing">
      <Furniture />
      {dressing.signs.map((s, i) => <RoadSign key={i} s={s} />)}
      {bridges.map((b, i) => <BridgeModel key={i} b={b} />)}
    </group>
  );
}
