import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { BRIDGES, bridgeDeck, bridgeFrame, bridgeLamps, cableHeight, celestialLanes, suspenders, type BridgeSpec } from "@/game/nexus-bridge";
import { registerDeck } from "@/game/district-decks";
import { WATER_LEVEL } from "@/game/terrain";
import { worldLight } from "@/game/world-light";

/** Every sea bridge (nexus-bridge.ts): the Nexus Strait Bridge and the Celestial Bridge between Nexus City and Neon City. */
export function NexusBridge() {
  return <>{BRIDGES.map((b) => <SeaBridge key={b.id} spec={b} />)}</>;
}

/** One suspension bridge: concrete deck with kerbs and railings, two portal pylons rising out of the sea, main cables over the
 * saddles and vertical suspenders, warm deck lamps and red aviation lights on the tower tops at night. The Celestial Bridge
 * adds lane markings, a glass-walled transit route down the median, maintenance walkways under the deck, viewpoint
 * balconies at the towers and a cyan light line along its cables. Built in the span's local frame (+z along the span,
 * centre at the origin, deck at the mid-span height) and tilted by the deck's pitch so it lies on the walked deck. */
function SeaBridge({ spec: B }: { spec: BridgeSpec }) {
  const f = useMemo(() => bridgeFrame(B), [B]);
  useEffect(() => { registerDeck(bridgeDeck(B)); }, [B]);

  const built = useMemo(() => {
    const L = f.length + 6, W = B.width, top = f.midTop, H = B.towerHeight;
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    // deck slab with a darker asphalt top and kerbs; a stiffening girder under each edge
    const concrete: THREE.BufferGeometry[] = [box(W, 1.4, L, 0, top - 0.75, 0), box(0.6, 1.6, L, W / 2 - 0.3, top - 2, 0), box(0.6, 1.6, L, -W / 2 + 0.3, top - 2, 0)];
    const asphalt = [box(W - 2.4, 0.06, L, 0, top + 0.01, 0)];
    const kerb = [box(0.9, 0.35, L, W / 2 - 0.45, top + 0.17, 0), box(0.9, 0.35, L, -W / 2 + 0.45, top + 0.17, 0)];
    // pylons: two legs each side of the deck from below the water to the top, joined by cross beams above the deck
    const steel: THREE.BufferGeometry[] = [];
    const tower: THREE.BufferGeometry[] = [];
    const legX = W / 2 + 1.2, foot = WATER_LEVEL - 6, legH = top + H - foot;
    for (const t of B.towers) {
      const z = (t - 0.5) * f.length;
      for (const s of [-1, 1]) {
        tower.push(box(2.6, legH, 3.2, s * legX, foot + legH / 2, z));
        tower.push(box(3.4, top - foot - 1.5, 4, s * legX, foot + (top - foot - 1.5) / 2, z)); // wider footing under the deck
      }
      for (const y of [top + H * 0.42, top + H * 0.8, top + H - 1]) tower.push(box(legX * 2, 2, 2.2, 0, y, z));
      tower.push(box(legX * 2 + 3.6, 1.8, 4.6, 0, top - 2.3, z)); // the deck sits on a cross beam
    }
    // main cables as segmented runs and vertical suspenders, on both cable planes
    const segs = 96;
    const cable: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const x = s * B.cableOffset;
      for (let i = 0; i < segs; i++) {
        const u0 = i / segs, u1 = (i + 1) / segs;
        const a = new THREE.Vector3(x, top + cableHeight(B, u0), (u0 - 0.5) * f.length), b = new THREE.Vector3(x, top + cableHeight(B, u1), (u1 - 0.5) * f.length);
        const len = a.distanceTo(b), g = new THREE.CylinderGeometry(0.32, 0.32, len, 6, 1);
        g.rotateX(Math.PI / 2); g.lookAt(b.clone().sub(a)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        cable.push(g);
      }
      for (const h of suspenders(B)) cable.push(new THREE.CylinderGeometry(0.07, 0.07, h.height, 4, 1).translate(x, top + h.height / 2, h.along));
      // railing: posts and a top rail along each kerb
      steel.push(box(0.12, 1.1, L, s * (W / 2 - 0.15), top + 0.9, 0));
      for (let z = -L / 2; z <= L / 2; z += 2.5) steel.push(box(0.1, 1.1, 0.1, s * (W / 2 - 0.15), top + 0.55, z));
    }
    // lamps: a pole and an arm over the road, both kerbs, staggered
    const lampPos: THREE.Vector3[] = [];
    bridgeLamps(B).forEach((z, i) => {
      const s = i % 2 ? 1 : -1, x = s * (W / 2 - 0.8);
      steel.push(box(0.18, 7, 0.18, x, top + 3.5, z), box(1.6, 0.14, 0.18, x - s * 0.8, top + 7, z));
      lampPos.push(new THREE.Vector3(x - s * 1.5, top + 6.85, z));
    });
    // the Celestial Bridge: lane lines, a glass-walled transit route down the median with its two rails, maintenance
    // walkways slung under both deck edges, a viewpoint balcony out over the water at each tower, a cyan line on each cable
    const glow: THREE.BufferGeometry[] = [], glass: THREE.BufferGeometry[] = [], paint: THREE.BufferGeometry[] = [];
    if (B.celestial) {
      const lanes = celestialLanes(B);
      for (const x of [-(lanes.driving[1]! + lanes.driving[0]!) / 2 * -1, (lanes.driving[2]! + lanes.driving[3]!) / 2]) for (let z = -L / 2 + 2; z < L / 2 - 2; z += 6) paint.push(box(0.18, 0.03, 3, x, top + 0.05, z));
      for (const x of lanes.transit) { steel.push(box(0.5, 1.0, L, x, top + 0.5, 0)); glass.push(box(0.08, 2.4, L, x, top + 2.2, 0)); }
      for (const x of [-1.1, 1.1]) steel.push(box(0.12, 0.16, L, x, top + 0.09, 0)); // the transit rails
      for (const s of [-1, 1]) {
        steel.push(box(1.4, 0.12, L, s * (W / 2 - 1.2), top - 3.4, 0)); // maintenance walkway under the deck edge
        for (let z = -L / 2; z <= L / 2; z += 3) steel.push(box(0.06, 1, 0.06, s * (W / 2 - 0.5), top - 2.9, z));
      }
      for (const t of B.towers) for (const s of [-1, 1]) {
        const z = (t - 0.5) * f.length + 9;
        concrete.push(box(4, 0.5, 8, s * (W / 2 + 2), top - 0.25, z)); // viewpoint balcony
        steel.push(box(0.1, 1.1, 8, s * (W / 2 + 4), top + 0.55, z), box(4, 1.1, 0.1, s * (W / 2 + 2), top + 0.55, z - 4), box(4, 1.1, 0.1, s * (W / 2 + 2), top + 0.55, z + 4));
      }
      for (const s of [-1, 1]) {
        const x = s * B.cableOffset;
        for (let i = 0; i < segs; i++) {
          const u0 = i / segs, u1 = (i + 1) / segs;
          const a = new THREE.Vector3(x, top + cableHeight(B, u0) + 0.45, (u0 - 0.5) * f.length), b = new THREE.Vector3(x, top + cableHeight(B, u1) + 0.45, (u1 - 0.5) * f.length);
          const len = a.distanceTo(b), g = new THREE.CylinderGeometry(0.12, 0.12, len, 5, 1);
          g.rotateX(Math.PI / 2); g.lookAt(b.clone().sub(a)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
          glow.push(g);
        }
        glow.push(box(0.2, 0.08, L, s * (W / 2 - 0.05), top + 0.36, 0)); // kerb light line
      }
    }
    const merge = (list: THREE.BufferGeometry[]) => { const m = mergeGeometries(list); list.forEach((g) => g.dispose()); return m; };
    const mergeOpt = (list: THREE.BufferGeometry[]) => (list.length ? merge(list) : null);
    return { concrete: merge(concrete), asphalt: merge(asphalt), kerb: merge(kerb), tower: merge(tower), cable: merge(cable), steel: merge(steel), lampPos,
      glow: mergeOpt(glow), glass: mergeOpt(glass), paint: mergeOpt(paint),
      beacons: B.towers.flatMap((t) => [-1, 1].map((s) => new THREE.Vector3(s * legX, top + H + 0.6, (t - 0.5) * f.length))) };
  }, [f, B]);

  const mats = useMemo(() => ({
    concrete: new THREE.MeshStandardMaterial({ color: "#a9a59c", roughness: 0.9 }),
    asphalt: new THREE.MeshStandardMaterial({ color: "#2b2d31", roughness: 0.85 }),
    kerb: new THREE.MeshStandardMaterial({ color: "#c9c4b8", roughness: 0.8 }),
    tower: new THREE.MeshStandardMaterial({ color: "#d9d4ca", roughness: 0.6, metalness: 0.1 }),
    cable: new THREE.MeshStandardMaterial({ color: "#3a4048", roughness: 0.45, metalness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: "#596069", roughness: 0.5, metalness: 0.6 }),
    lamp: new THREE.MeshBasicMaterial({ color: "#ffd9a0", toneMapped: false }),
    beacon: new THREE.MeshBasicMaterial({ color: "#ff3b30", toneMapped: false }),
    glow: new THREE.MeshBasicMaterial({ color: "#54e8ff", toneMapped: false }),
    glass: new THREE.MeshStandardMaterial({ color: "#9fdcf0", roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.28, depthWrite: false }),
    paint: new THREE.MeshStandardMaterial({ color: "#e9e6dc", roughness: 0.7 }),
  }), []);
  const bulb = useMemo(() => new THREE.SphereGeometry(0.28, 8, 6), []);
  useEffect(() => () => { Object.values(built).forEach((g) => (g as THREE.BufferGeometry | null)?.dispose?.()); Object.values(mats).forEach((m) => m.dispose()); bulb.dispose(); }, [built, mats, bulb]);

  // lamps glow at night; tower beacons blink
  useFrame(({ clock }) => {
    const n = worldLight.night;
    mats.lamp.color.setRGB(1, 0.85, 0.63).multiplyScalar(0.25 + 2.2 * n);
    mats.beacon.color.setRGB(1, 0.23, 0.19).multiplyScalar((0.4 + 2.4 * n) * (Math.sin(clock.elapsedTime * 3) > 0.2 ? 1 : 0.15));
    mats.glow.color.setRGB(0.33, 0.91, 1).multiplyScalar(0.35 + 2.6 * n);
  });

  return (
    <group name={`site:${B.id}`} position={[f.cx, 0, f.cz]} rotation-y={f.yaw}>
     <group position={[0, f.midTop, 0]} rotation-x={-f.pitch}>
     <group position={[0, -f.midTop, 0]}>
      <mesh geometry={built.concrete} material={mats.concrete} castShadow receiveShadow />
      <mesh geometry={built.asphalt} material={mats.asphalt} receiveShadow />
      <mesh geometry={built.kerb} material={mats.kerb} receiveShadow />
      <mesh geometry={built.tower} material={mats.tower} castShadow receiveShadow />
      <mesh geometry={built.cable} material={mats.cable} castShadow />
      <mesh geometry={built.steel} material={mats.steel} castShadow />
      {built.lampPos.map((p, i) => <mesh key={i} geometry={bulb} material={mats.lamp} position={p} />)}
      {built.beacons.map((p, i) => <mesh key={`b${i}`} geometry={bulb} material={mats.beacon} position={p} scale={1.6} />)}
      {built.glow && <mesh geometry={built.glow} material={mats.glow} />}
      {built.glass && <mesh geometry={built.glass} material={mats.glass} />}
      {built.paint && <mesh geometry={built.paint} material={mats.paint} receiveShadow />}
     </group>
     </group>
    </group>
  );
}

/** merge plain non-indexed/indexed box and cylinder geometries (same attributes) into one */
function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of parts) n += g.attributes["position"]!.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    const c = g.attributes["position"]!.count;
    pos.set(g.attributes["position"]!.array as Float32Array, o * 3);
    nor.set(g.attributes["normal"]!.array as Float32Array, o * 3);
    uv.set(g.attributes["uv"]!.array as Float32Array, o * 2);
    o += c;
    if (g !== list[parts.indexOf(g)]) g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
