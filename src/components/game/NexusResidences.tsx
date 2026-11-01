import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { INTERIOR_ALTITUDE } from "@/game/interiors";
import { FLOORS, floorBoxes, floorWalls, type ResidenceFloor } from "@/game/nexus-residences";
import { clearWalls, setWalls } from "@/game/walls";
import { mergeByMat } from "./ResidentialHomes";

/**
 * Nexus City Residences (layout in nexus-residences.ts): the lobby, the player's Apartment 1204, the Floor 11 lounge, the
 * Floor 12 fitness and pool floor and the rooftop sky deck. Each floor's boxes merge into one mesh per surface (a handful of
 * draw calls a floor); partitions and furniture go to the wall collider; floors with glass get a lit night skyline outside,
 * towers rising from below the room like the view from the twelfth floor. Lift pads, people and the lobby's exit are drawn
 * by Interiors.tsx with every other interior.
 */
export function NexusResidences() {
  const meshes = useMemo(() => {
    const out = FLOORS.flatMap((f) => mergeByMat(floorBoxes(f.id)
      // Replace only the original living-room sofa/table render meshes. Their
      // collider boxes remain in floorWalls() so gameplay is unaffected.
      .filter((b) => f.id !== "nexus-res-1204" || !isReplacedLivingRoomFurniture(b) && !isReplacedBedroomBed(b) && !isReplacedKitchenIsland(b))
      .map((b) => ({ b, at: { x: f.origin.x, z: f.origin.z, floor: INTERIOR_ALTITUDE, rot: 0 } })), `residences-tower:${f.id}`));
    // the tower's glass is see-through (the city outside, the shower, the balustrades), unlike a house's window panes
    for (const m of out) if (m.name.endsWith(":glass")) { const g = m.material as THREE.MeshStandardMaterial; g.transparent = true; g.opacity = 0.22; g.depthWrite = false; m.castShadow = false; m.renderOrder = 2; }
    return out;
  }, []);
  useEffect(() => () => { for (const m of meshes) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }, [meshes]);
  useEffect(() => {
    for (const f of FLOORS) setWalls(`residences-tower:${f.id}`, floorWalls(f.id).map((w) => ({ ...w, ax: w.ax + f.origin.x, bx: w.bx + f.origin.x, az: w.az + f.origin.z, bz: w.bz + f.origin.z, base: w.base + INTERIOR_ALTITUDE, top: w.top + INTERIOR_ALTITUDE })));
    return () => { for (const f of FLOORS) clearWalls(`residences-tower:${f.id}`); };
  }, []);
  return (
    <group name="nexus-residences">
      {meshes.map((m) => <primitive key={m.name} object={m} />)}
      {FLOORS.filter((f) => f.skyline).map((f) => <Skyline key={f.id} floor={f} />)}
      {/* Apartment 12-04: non-colliding finish details, separate from the original
          furniture and collision graph so the opening mission remains unchanged. */}
      <ApartmentFinishDetails />

      <Sign text="NEXUS CITY RESIDENCES" sub="Welcome home" at={[FLOORS[0]!.origin.x + 2, INTERIOR_ALTITUDE + 1.85, FLOORS[0]!.origin.z - 6.56]} w={4.4} />
      <Sign text="1204" sub="Your apartment" at={[FLOORS[1]!.origin.x + 0, INTERIOR_ALTITUDE + 2.9, FLOORS[1]!.origin.z + 5.83]} w={1.4} turn={Math.PI} />
    </group>
  );
}


/** Identifies the six original low-detail furniture boxes by footprint, not
 * material; used ONLY in the render pipeline, never in collision generation. */
function isReplacedLivingRoomFurniture(b: { x: number; y: number; z: number; sx: number; sy: number; sz: number }): boolean {
  const near = (a: number, v: number) => Math.abs(a - v) < 0.015;
  return (near(b.x, 4.3) && near(b.z, -2.7) && (near(b.sx, 1.0) || near(b.sx, 0.22)))
    || (near(b.x, 4.85) && near(b.z, -2.7) && near(b.sx, 0.22))
    || (near(b.x, 3.4) && (near(b.z, -0.85) || near(b.z, -0.42)) && near(b.sx, 2.0))
    || (near(b.x, 2.0) && near(b.z, -2.6) && (near(b.sx, 1.6) || near(b.sx, 0.5)));
}

/** Render-only replacement for the kitchen island cabinet and stone top. */
function isReplacedKitchenIsland(b: { x: number; z: number; sx: number }): boolean {
  const near = (a: number, v: number) => Math.abs(a - v) < 0.015;
  return near(b.x, 3.8) && near(b.z, 2.5) &&
    (near(b.sx, 2.8) || near(b.sx, 2.9) || near(b.sx, 2.76));
}

/** Render-only substitution for the original bed, duvet and pillows. The
 * underlying floorBoxes data remains intact for collision and interactions. */
function isReplacedBedroomBed(b: { x: number; z: number; sx: number }): boolean {
  const near = (a: number, v: number) => Math.abs(a - v) < 0.015;
  return (near(b.x, -5.6) && near(b.z, -3.4) &&
    (near(b.sx, 2.2) || near(b.sx, 2.0) || near(b.sx, 1.88) || near(b.sx, 1.84))) ||
    ((near(b.x, -6.17) || near(b.x, -5.03)) && near(b.z, -2.75) && near(b.sx, 0.56));
}

/** Load authored models independently: one broken GLB must not blank the whole room. */
class FurnitureAssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: Error) { console.error("World Fracture furniture asset failed to load", error); }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

type FurnitureModelProps = {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number] | undefined;
};
function LoadedFurnitureModel({ url, position, rotation }: FurnitureModelProps) {
  const gltf = useGLTF(url);
  // GLTFLoader does not enable shadow flags by default. Apply them once to
  // the per-instance scene clone, leaving the cached source GLB untouched.
  const model = useMemo(() => {
    const instance = gltf.scene.clone(true);
    instance.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return instance;
  }, [gltf.scene]);
  return <primitive object={model} position={position} rotation={rotation} />;
}
function FurnitureSlot({ url, position, rotation, footprint }: FurnitureModelProps & { footprint: [number, number, number] }) {
  const fallback = (
    <mesh position={[position[0], position[1] + footprint[1] / 2, position[2]]} rotation={rotation}>
      <boxGeometry args={footprint} />
      <meshStandardMaterial color="#706c68" roughness={0.85} />
    </mesh>
  );
  return (
    <FurnitureAssetBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedFurnitureModel url={url} position={position} rotation={rotation} />
      </Suspense>
    </FurnitureAssetBoundary>
  );
}

/** GLB furniture is visual only; the original collision walls remain data-owned. */
function PremiumApartmentFurniture() {
  return (
    <group name="apartment-1204-authored-furniture">
      <FurnitureSlot url="/assets/world-fracture/furniture/nexus-sectional.glb" position={[4.3, 0, -2.7]} footprint={[1.1, 1.18, 3.22]} />
      <FurnitureSlot url="/assets/world-fracture/furniture/nexus-coffee-table.glb" position={[2, 0, -2.6]} footprint={[1.68, 0.48, 0.93]} />
      <FurnitureSlot url="/assets/world-fracture/furniture/nexus-upholstered-bed.glb" position={[-5.6, 0, -3.4]} rotation={[0, -Math.PI / 2, 0]} footprint={[2.16, 1.77, 2.31]} />
      <FurnitureSlot url="/assets/world-fracture/furniture/nexus-kitchen-island.glb" position={[3.8, 0, 2.5]} footprint={[2.9, 1.5, 1.2]} />
    </group>
  );
}

/** Lightweight finish layer: architectural trim, a framed wall panel, and warm
 * indirect light accents. Decorative geometry has no collision or interaction. */
function ApartmentFinishDetails() {
  const f = FLOORS.find((floor) => floor.id === "nexus-res-1204");
  if (!f) return null;
  return (
    <group position={[f.origin.x, INTERIOR_ALTITUDE, f.origin.z]} name="apartment-1204-finishes">
      {/* Recessed-looking floor-edge skirting, kept just off the walls. */}
      {[-7.85, 7.85].map((x) => (
        <mesh key={`skirt-x-${x}`} position={[x, 0.11, 0]} receiveShadow>
          <boxGeometry args={[0.07, 0.22, 11.7]} />
          <meshStandardMaterial color="#736b64" roughness={0.7} />
        </mesh>
      ))}
      {[5.85].map((z) => (
        <mesh key={`skirt-z-${z}`} position={[0, 0.11, z]} receiveShadow>
          <boxGeometry args={[15.5, 0.22, 0.07]} />
          <meshStandardMaterial color="#736b64" roughness={0.7} />
        </mesh>
      ))}
      {/* Brushed-metal kitchen backsplash, physically behind the existing counter. */}
      <mesh position={[7.83, 1.42, 3.55]} receiveShadow>
        <boxGeometry args={[0.035, 0.82, 3.5]} />
        <meshStandardMaterial color="#9b9fa3" metalness={0.78} roughness={0.33} />
      </mesh>
      {/* Bedroom wall panel with shallow depth and a thin contrasting reveal. */}
      <mesh position={[-7.76, 1.85, -3.3]} receiveShadow>
        <boxGeometry args={[0.055, 1.6, 2.8]} />
        <meshStandardMaterial color="#514b4a" roughness={0.82} />
      </mesh>
      <mesh position={[-7.71, 1.85, -3.3]}>
        <boxGeometry args={[0.025, 1.47, 2.64]} />
        <meshStandardMaterial color="#393c43" roughness={0.62} metalness={0.14} />
      </mesh>
      {/* Living-room feature wall: alternating timber slats, shallow and non-interactive. */}
      <TimberFeatureWall />
      {/* Fabric weave on the existing inset lounge rug; decorative only. */}
      <LoungeRugWeave />
      {/* Shared procedural stone finish for the kitchen counter and island. */}
      <KitchenStoneSurfaces />
      {/* Authored GLB furniture: original collision boxes remain in floorWalls(). */}
      <PremiumApartmentFurniture />
      {/* Wardrobe and bedside fixtures stay; authored bed supplies its own headboard. */}
      <ApartmentBedroomDetails />
      {/* Kitchen splash zone with tile joints modeled as thin strips. */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={`backsplash-joint-${i}`} position={[7.80, 1.04 + i * 0.19, 3.55]}>
          <boxGeometry args={[0.012, 0.008, 3.35]} />
          <meshStandardMaterial color="#555b61" roughness={0.9} />
        </mesh>
      ))}
      {/* Thin framed art above the lounge console; matte material avoids extra lights. */}
      <mesh position={[2.9, 2.15, 5.78]} receiveShadow>
        <boxGeometry args={[1.85, 1.08, 0.065]} />
        <meshStandardMaterial color="#252b32" roughness={0.6} metalness={0.15} />
      </mesh>
      <mesh position={[2.9, 2.15, 5.725]}>
        <boxGeometry args={[1.65, 0.89, 0.015]} />
        <meshStandardMaterial color="#777a74" roughness={0.94} />
      </mesh>
      {/* Ceiling-mounted practical fixture: opaque housing and translucent-looking
          diffuser. One localized light below provides illumination without shadows. */}
      <group position={[-2.0, 3.36, -2.7]} name="apartment-1204-ceiling-fixture">
        <mesh receiveShadow>
          <cylinderGeometry args={[0.46, 0.46, 0.10, 24]} />
          <meshStandardMaterial color="#3b3c3d" metalness={0.72} roughness={0.38} />
        </mesh>
        <mesh position={[0, -0.075, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.06, 24]} />
          <meshStandardMaterial color="#fff0d5" roughness={0.9} emissive="#ffd6a2" emissiveIntensity={0.35} />
        </mesh>
      </group>
      {/* One localized warm light for believable furniture shading. Deliberately
          no shadow map: global scene lighting remains authoritative. */}
      <pointLight position={[-2.0, 2.85, -2.7]} color="#ffe0b5" intensity={0.55} distance={7.5} decay={2} castShadow={false} />
      {/* A low-gloss ceramic trim inset, using the renderer's existing PBR pipeline. */}
      <mesh position={[0.2, 0.06, 5.73]} receiveShadow>
        <boxGeometry args={[3.5, 0.12, 0.12]} />
        <meshStandardMaterial color="#a69f92" roughness={0.84} metalness={0.0} />
      </mesh>
      {/* Small cove-light diffusers: emissive, not extra dynamic lights. */}
      {[-5.9, 2.4].map((x) => (
        <mesh key={`cove-${x}`} position={[x, 3.42, -5.79]}>
          <boxGeometry args={[2.4, 0.045, 0.07]} />
          <meshStandardMaterial color="#ffdfb3" emissive="#ffc88c" emissiveIntensity={0.65} toneMapped />
        </mesh>
      ))}
    </group>
  );
}

/** Bedroom finish pass: padded headboard, bedside luminaires and wardrobe
 * hardware. All positions are local to Apartment 12-04 and purely visual. */
function ApartmentBedroomDetails() {
  return (
    <group name="apartment-1204-bedroom-details">
      {/* Matte wardrobe door faces with a slim dark reveal and metal pulls. */}
      {[-3.33, -2.67].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.16, -5.245]} receiveShadow>
            <boxGeometry args={[0.60, 1.95, 0.035]} />
            <meshStandardMaterial color="#514b47" roughness={0.77} metalness={0.03} />
          </mesh>
          <mesh position={[x + (x < -3 ? 0.23 : -0.23), 1.2, -5.217]}>
            <boxGeometry args={[0.023, 0.33, 0.027]} />
            <meshStandardMaterial color="#b2aaa0" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* Bedside fixtures use emissive materials, not additional shadow maps. */}
      {[-4.85, -1.95].map((z) => (
        <group key={z} position={[-7.5, 0.89, z]}>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.10, 0.12, 0.22, 12]} />
            <meshStandardMaterial color="#b9a18b" roughness={0.72} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.16, 0.10, 0.15, 16]} />
            <meshStandardMaterial color="#ffdfba" emissive="#ffbd77" emissiveIntensity={0.42} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Fine textile surface on the already-existing lounge rug. This plane sits just
 * above the inset rug top (y=0.034) and adds no collision geometry or lights. */
function LoungeRugWeave() {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#aaa29a";
    ctx.fillRect(0, 0, 256, 256);
    let seed = 120416;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 256; i += 4) {
      ctx.fillStyle = i % 8 ? "rgba(54,49,46,0.12)" : "rgba(245,235,220,0.14)";
      ctx.fillRect(i, 0, 1, 256);
      ctx.fillRect(0, i, 256, 1);
    }
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = random() > 0.5 ? "rgba(255,248,232,0.14)" : "rgba(38,35,32,0.12)";
      ctx.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(3, 2);
    map.anisotropy = 4;
    return map;
  }, []);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <mesh position={[1.0, 0.037, -2.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[3.10, 2.10]} />
      <meshStandardMaterial color="#c4b9ac" map={texture} roughness={0.96} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Decorative stone surface overlays. Both counters share one PBR texture and
 * one material; the original counter meshes and gameplay collision stay intact. */
function KitchenStoneSurfaces() {
  const stone = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#d7d0c4";
    ctx.fillRect(0, 0, 256, 256);
    let seed = 120417;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 1800; i++) {
      const shade = Math.floor(90 + random() * 95);
      ctx.fillStyle = `rgba(${shade},${shade - 4},${shade - 10},${0.025 + random() * 0.07})`;
      ctx.fillRect(random() * 256, random() * 256, 1 + random() * 4, 1 + random() * 2);
    }
    for (let i = 0; i < 12; i++) {
      let x = random() * 256, y = random() * 256;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 7; j++) { x += (random() - 0.5) * 28; y += 9 + random() * 12; ctx.lineTo(x, y); }
      ctx.strokeStyle = `rgba(94,88,83,${0.09 + random() * 0.08})`;
      ctx.lineWidth = 0.4 + random() * 0.65;
      ctx.stroke();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    return map;
  }, []);
  useEffect(() => () => stone?.dispose(), [stone]);
  return (
    <group name="apartment-1204-kitchen-stone">
      <mesh position={[7.6, 0.978, 3.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[0.70, 4.14]} />
        <meshStandardMaterial map={stone} color="#f0eae1" metalness={0} roughness={0.38} />
      </mesh>
      {/* Island stone is now part of the authored GLB asset. */}
    </group>
  );
}

/** One merged mesh instead of 15 separate timber-slat draw calls. */
function TimberFeatureWall() {
  const mesh = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 15; i++) {
      const g = new THREE.BoxGeometry(0.105, 2.65, 0.055);
      g.translate(-3.25 + i * 0.16, 1.65, 5.78);
      parts.push(g);
    }
    const geometry = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    if (!geometry) throw new Error("Apartment 12-04: timber geometry merge failed");
    // Deterministic wood-grain map: texture detail without external downloads.
    // Keep an untextured fallback for server-side rendering.
    const grain = createTimberGrainTexture();
    const grainBump = createTimberBumpTexture();
    const material = new THREE.MeshStandardMaterial({
      color: "#b39a7d", map: grain, bumpMap: grainBump,
      bumpScale: 0.018, roughness: 0.82, metalness: 0,
    });
    return new THREE.Mesh(geometry, material);
  }, []);
  useEffect(() => () => {
    mesh.geometry.dispose();
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.map?.dispose();
    material.bumpMap?.dispose();
    material.dispose();
  }, [mesh]);
  return <primitive object={mesh} />;
}

/** Procedural timber surface variation; intentionally subtle rather than cartoon stripes. */
function createTimberGrainTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#b4a08c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let seed = 1204;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 110; i++) {
    const x = random() * canvas.width;
    const width = 0.2 + random() * 1.7;
    ctx.strokeStyle = random() > 0.4 ? "rgba(72,52,37,0.12)" : "rgba(248,226,192,0.19)";
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 16; y <= canvas.height; y += 16) {
      ctx.lineTo(x + Math.sin(y * 0.017 + x * 0.2) * (0.4 + random() * 1.2), y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Deterministic grayscale micro-relief. Kept shallow so it reads as wood grain,
 * not as grooves carved into the slats. No extra meshes or draw calls. */
function createTimberBumpTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let seed = 451204;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 140; i++) {
    const x = random() * canvas.width;
    ctx.strokeStyle = random() > 0.5 ? "rgba(205,205,205,0.32)" : "rgba(48,48,48,0.26)";
    ctx.lineWidth = 0.35 + random() * 1.3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 12; y <= canvas.height; y += 12) {
      ctx.lineTo(x + Math.sin(y * 0.022 + x * 0.15) * 0.8, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** a lit-window facade: a grid of rooms, a share lit warm or cool (canvas, made once) */
function windowsTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const n = 256, c = document.createElement("canvas"); c.width = c.height = n;
  const g = c.getContext("2d"); if (!g) return null;
  let seed = 1204; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  g.fillStyle = "#07090f"; g.fillRect(0, 0, n, n);
  const cols = 16, rows = 32, cw = n / cols, rh = n / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const r = rnd();
    // Dark glass, individual mullions, and muted interior light instead of
    // full-bright rectangles. Deterministic for stable skyline appearance.
    const x = i * cw, y = j * rh;
    g.fillStyle = r < 0.16 ? "#ad8b65" : r < 0.24 ? "#698da1" : r < 0.27 ? "#90768e" : "#101a25";
    g.fillRect(x + 1.4, y + 1.1, cw - 2.8, rh - 2.1);
    g.fillStyle = "#242f3b";
    g.fillRect(x + cw * 0.49, y + 1, 0.65, rh - 2);
    g.fillStyle = "#303843";
    g.fillRect(x, y + rh - 0.8, cw, 0.8);
    if (r < 0.12) {
      g.fillStyle = "rgba(245,214,165,0.13)";
      g.fillRect(x + 2, y + 1.5, cw - 4, rh * 0.26);
    }
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/** the night skyline outside a floor's north glass: a few dozen towers 30-170 m out, from far below the floor to well above,
 * one merged mesh whose faces wear the lit-window texture at a scale that follows each tower's size */
// Skyline density can be tuned without touching the underlying city or missions.
// The distant skyline is decorative and has no gameplay collision.
const RESIDENCE_SKYLINE_TOWER_COUNT = 32;
const RESIDENCE_SKYLINE_PENTHOUSE_RATE = 3;
function Skyline({ floor }: { floor: ResidenceFloor }) {
  const mesh = useMemo(() => {
    let seed = floor.origin.z + 77; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const parts: THREE.BufferGeometry[] = [];
    const farParts: THREE.BufferGeometry[] = [];
    const rooftopParts: THREE.BufferGeometry[] = [];
    const facadeTrimParts: THREE.BufferGeometry[] = [];
    const farFacadeTrimParts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < RESIDENCE_SKYLINE_TOWER_COUNT; k++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * (floor.open ? 2 : 0.95);
      const d = 70 + rnd() * 180;
      const w = 16 + rnd() * 26;
      const top = (floor.open ? -14 : -24) + rnd() * 100;
      const h = top + 160;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const box = new THREE.BoxGeometry(w, h, w);
      const g = box.toNonIndexed(); box.dispose();
      const uv = g.getAttribute("uv") as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) * (w / 40), uv.getY(i) * (h / 100));
      }
      g.translate(x, top - h / 2, z);
      // Two depth layers create a more readable skyline silhouette. Distant
      // buildings receive a cooler, lower-contrast facade, without fog shaders.
      (d > 158 ? farParts : parts).push(g);
      // Distant architectural articulation: shallow vertical facade mullions and
      // floor-belt courses. Batched into one shared mesh, not individual objects.
      // Only selected buildings get extra detail to cap geometry cost.
      if (k % 3 === 0) {
        const frontZ = z + w / 2 + 0.055;
        for (const offset of [-0.25, 0, 0.25]) {
          const mullion = new THREE.BoxGeometry(0.14, h, 0.12);
          mullion.translate(x + offset * w, top - h / 2, frontZ);
          (d > 158 ? farFacadeTrimParts : facadeTrimParts).push(mullion);
        }
        for (let level = 1; level <= 7; level++) {
          const belt = new THREE.BoxGeometry(w + 0.12, 0.16, 0.13);
          belt.translate(x, -160 + h * level / 8, frontZ);
          (d > 158 ? farFacadeTrimParts : facadeTrimParts).push(belt);
        }
      }
      let roofHeight = top;
      let roofWidth = w;
      // Setback upper tower adds a second silhouette and varied window planes.
      // It shares the skyline material and is merged with the main tower mesh.
      if (k % 4 === 0) {
        const upperW = w * 0.64;
        const upperH = 10 + rnd() * 24;
        const upper = new THREE.BoxGeometry(upperW, upperH, upperW).toNonIndexed();
        const upperUV = upper.getAttribute("uv") as THREE.BufferAttribute;
        for (let i = 0; i < upperUV.count; i++) {
          upperUV.setXY(i, upperUV.getX(i) * (upperW / 40), upperUV.getY(i) * (upperH / 100));
        }
        upper.translate(x, top + upperH / 2, z);
        (d > 158 ? farParts : parts).push(upper);
        roofHeight = top + upperH;
        roofWidth = upperW;
      }

      // Architectural silhouette: low mechanical penthouse + perimeter cap.
      // These are distant visual meshes, not walkable geometry or colliders.
      const cap = new THREE.BoxGeometry(roofWidth + 0.5, 0.45, roofWidth + 0.5);
      cap.translate(x, roofHeight + 0.22, z);
      rooftopParts.push(cap);
      // Sparse skyline masts: no colliders, no per-building draw calls.
      if (k % 9 === 0) {
        const mast = new THREE.CylinderGeometry(0.11, 0.17, 5.8, 5);
        mast.translate(x, roofHeight + 3.3, z);
        rooftopParts.push(mast);
      }
      if (k % RESIDENCE_SKYLINE_PENTHOUSE_RATE !== 0 && k % 4 !== 0) {
        const pw = w * (0.25 + rnd() * 0.12);
        const ph = 2.0 + rnd() * 3.0;
        const plant = new THREE.BoxGeometry(pw, ph, roofWidth * 0.3);
        plant.translate(x + roofWidth * 0.16, roofHeight + 0.45 + ph / 2, z - roofWidth * 0.13);
        rooftopParts.push(plant);
      }
    }
    // Keep two large facade batches rather than a material per skyscraper.
    const geo = parts.length ? mergeGeometries(parts) : null;
    if (parts.length && !geo) throw new Error("Nexus skyline: near tower merge failed");
    parts.forEach((part) => part.dispose());
    const farGeo = farParts.length ? mergeGeometries(farParts) : null;
    if (farParts.length && !farGeo) throw new Error("Nexus skyline: distant tower merge failed");
    farParts.forEach((part) => part.dispose());
    const roofGeo = mergeGeometries(rooftopParts);
    if (!roofGeo) throw new Error("Nexus skyline: roof geometry merge failed");
    rooftopParts.forEach((part) => part.dispose());
    const tex = windowsTexture();
    // Physically shaded facades retain depth in changing light; a restrained
    // emissive map keeps scattered occupied windows legible after dark.
    // One shared facade material per skyline, without per-window lights.
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: "#8b7965",
      emissiveIntensity: 0.24,
      color: "#a8b0bb",
      metalness: 0.22,
      roughness: 0.72,
    });
    const farMat = mat.clone();
    farMat.color.set("#778899");
    farMat.roughness = 0.86;
    farMat.metalness = 0.08;
    farMat.emissiveIntensity = 0.12;
    const roofMat = new THREE.MeshStandardMaterial({
      color: "#38414b", metalness: 0.38, roughness: 0.7,
    });
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    const group = new THREE.Group();
    if (geo) group.add(new THREE.Mesh(geo, mat)); else mat.dispose();
    if (farGeo) group.add(new THREE.Mesh(farGeo, farMat)); else farMat.dispose();
    group.add(roofMesh);
    // Match structural detail to each depth layer, so far towers do not
    // retain overly dark high-contrast outlines through atmospheric distance.
    for (const [trimParts, trimColor] of [
      [facadeTrimParts, "#626c78"],
      [farFacadeTrimParts, "#707e8d"],
    ] as const) {
      if (!trimParts.length) continue;
      const trimGeo = mergeGeometries(trimParts);
      trimParts.forEach((part) => part.dispose());
      if (!trimGeo) throw new Error("Nexus skyline: facade trim merge failed");
      const trimMat = new THREE.MeshStandardMaterial({
        color: trimColor, metalness: 0.22, roughness: 0.78,
      });
      group.add(new THREE.Mesh(trimGeo, trimMat));
    }
    group.position.set(floor.origin.x, INTERIOR_ALTITUDE, floor.origin.z);
    group.matrixAutoUpdate = false; group.updateMatrix();
    return group;
  }, [floor]);
  useEffect(() => () => {
    const textures = new Set<THREE.Texture>();
    mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const material = obj.material as THREE.Material;
        if (material instanceof THREE.MeshStandardMaterial && material.map) {
          // Near/far facades share one map; release it exactly once after
          // all materials have been disposed.
          textures.add(material.map);
          if (material.emissiveMap) textures.add(material.emissiveMap);
        }
        material.dispose();
      }
    });
    textures.forEach((texture) => texture.dispose());
  }, [mesh]);
  return <primitive object={mesh} />;
}

/** a lit sign drawn on a canvas (no font download) */
function Sign({ text, sub, at, w, turn = 0 }: { text: string; sub: string; at: [number, number, number]; w: number; turn?: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 256;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "rgba(0,0,0,0)"; g.fillRect(0, 0, 1024, 256);
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#f2ecff"; g.shadowColor = "#b06bff"; g.shadowBlur = 24;
      g.font = "600 92px sans-serif"; g.fillText(text, 512, 104, 980);
      g.shadowBlur = 0; g.fillStyle = "#c9b8ff"; g.font = "40px sans-serif"; g.fillText(sub, 512, 196, 900);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [text, sub]);
  useEffect(() => () => tex.dispose(), [tex]);
  return <mesh position={at} rotation-y={turn}><planeGeometry args={[w, w / 4]} /><meshBasicMaterial map={tex} transparent toneMapped={false} /></mesh>;
}
