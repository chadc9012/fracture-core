import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { BRIDGE, bridgeDeck, bridgeFrame, bridgeLamps, cableHeight, suspenders } from "@/game/nexus-bridge";
import { registerDeck } from "@/game/district-decks";
import { WATER_LEVEL } from "@/game/terrain";
import { worldLight } from "@/game/world-light";

/** The Nexus Strait Bridge (nexus-bridge.ts): concrete deck with kerbs and railings, two portal pylons rising out of the strait,
 * main cables over the saddles and vertical suspenders, warm deck lamps and red aviation lights on the tower tops at night.
 * Built in the span's local frame (+z along the span, centre at the origin) and placed once. */
export function NexusBridge() {
  const f = useMemo(() => bridgeFrame(), []);
  useEffect(() => { registerDeck(bridgeDeck()); }, []);

  const built = useMemo(() => {
    const L = f.length, W = BRIDGE.width, top = BRIDGE.top, H = BRIDGE.towerHeight;
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    // deck slab with a darker asphalt top and kerbs; a stiffening girder under each edge
    const concrete: THREE.BufferGeometry[] = [box(W, 1.4, L, 0, top - 0.75, 0), box(0.6, 1.6, L, W / 2 - 0.3, top - 2, 0), box(0.6, 1.6, L, -W / 2 + 0.3, top - 2, 0)];
    const asphalt = [box(W - 2.4, 0.06, L, 0, top + 0.01, 0)];
    const kerb = [box(0.9, 0.35, L, W / 2 - 0.45, top + 0.17, 0), box(0.9, 0.35, L, -W / 2 + 0.45, top + 0.17, 0)];
    // pylons: two legs each side of the deck from below the water to the top, joined by cross beams above the deck
    const steel: THREE.BufferGeometry[] = [];
    const tower: THREE.BufferGeometry[] = [];
    const legX = W / 2 + 1.2, foot = WATER_LEVEL - 6, legH = top + H - foot;
    for (const t of BRIDGE.towers) {
      const z = (t - 0.5) * L;
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
      const x = s * BRIDGE.cableOffset;
      for (let i = 0; i < segs; i++) {
        const u0 = i / segs, u1 = (i + 1) / segs;
        const a = new THREE.Vector3(x, top + cableHeight(u0), (u0 - 0.5) * L), b = new THREE.Vector3(x, top + cableHeight(u1), (u1 - 0.5) * L);
        const len = a.distanceTo(b), g = new THREE.CylinderGeometry(0.32, 0.32, len, 6, 1);
        g.rotateX(Math.PI / 2); g.lookAt(b.clone().sub(a)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        cable.push(g);
      }
      for (const h of suspenders()) cable.push(new THREE.CylinderGeometry(0.07, 0.07, h.height, 4, 1).translate(x, top + h.height / 2, h.along));
      // railing: posts and a top rail along each kerb
      steel.push(box(0.12, 1.1, L, s * (W / 2 - 0.15), top + 0.9, 0));
      for (let z = -L / 2; z <= L / 2; z += 2.5) steel.push(box(0.1, 1.1, 0.1, s * (W / 2 - 0.15), top + 0.55, z));
    }
    // lamps: a pole and an arm over the road, both kerbs, staggered
    const lampPos: THREE.Vector3[] = [];
    bridgeLamps().forEach((z, i) => {
      const s = i % 2 ? 1 : -1, x = s * (W / 2 - 0.8);
      steel.push(box(0.18, 7, 0.18, x, top + 3.5, z), box(1.6, 0.14, 0.18, x - s * 0.8, top + 7, z));
      lampPos.push(new THREE.Vector3(x - s * 1.5, top + 6.85, z));
    });
    const merge = (list: THREE.BufferGeometry[]) => { const m = mergeGeometries(list); list.forEach((g) => g.dispose()); return m; };
    return { concrete: merge(concrete), asphalt: merge(asphalt), kerb: merge(kerb), tower: merge(tower), cable: merge(cable), steel: merge(steel), lampPos,
      beacons: BRIDGE.towers.flatMap((t) => [-1, 1].map((s) => new THREE.Vector3(s * legX, top + H + 0.6, (t - 0.5) * L))) };
  }, [f]);

  const mats = useMemo(() => ({
    concrete: new THREE.MeshStandardMaterial({ color: "#a9a59c", roughness: 0.9 }),
    asphalt: new THREE.MeshStandardMaterial({ color: "#2b2d31", roughness: 0.85 }),
    kerb: new THREE.MeshStandardMaterial({ color: "#c9c4b8", roughness: 0.8 }),
    tower: new THREE.MeshStandardMaterial({ color: "#d9d4ca", roughness: 0.6, metalness: 0.1 }),
    cable: new THREE.MeshStandardMaterial({ color: "#3a4048", roughness: 0.45, metalness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: "#596069", roughness: 0.5, metalness: 0.6 }),
    lamp: new THREE.MeshBasicMaterial({ color: "#ffd9a0", toneMapped: false }),
    beacon: new THREE.MeshBasicMaterial({ color: "#ff3b30", toneMapped: false }),
  }), []);
  const bulb = useMemo(() => new THREE.SphereGeometry(0.28, 8, 6), []);
  useEffect(() => () => { Object.values(built).forEach((g) => (g as THREE.BufferGeometry).dispose?.()); Object.values(mats).forEach((m) => m.dispose()); bulb.dispose(); }, [built, mats, bulb]);

  // lamps glow at night; tower beacons blink
  useFrame(({ clock }) => {
    const n = worldLight.night;
    mats.lamp.color.setRGB(1, 0.85, 0.63).multiplyScalar(0.25 + 2.2 * n);
    mats.beacon.color.setRGB(1, 0.23, 0.19).multiplyScalar((0.4 + 2.4 * n) * (Math.sin(clock.elapsedTime * 3) > 0.2 ? 1 : 0.15));
  });

  return (
    <group name="site:nexus-strait-bridge" position={[f.cx, 0, f.cz]} rotation-y={f.yaw}>
      <mesh geometry={built.concrete} material={mats.concrete} castShadow receiveShadow />
      <mesh geometry={built.asphalt} material={mats.asphalt} receiveShadow />
      <mesh geometry={built.kerb} material={mats.kerb} receiveShadow />
      <mesh geometry={built.tower} material={mats.tower} castShadow receiveShadow />
      <mesh geometry={built.cable} material={mats.cable} castShadow />
      <mesh geometry={built.steel} material={mats.steel} castShadow />
      {built.lampPos.map((p, i) => <mesh key={i} geometry={bulb} material={mats.lamp} position={p} />)}
      {built.beacons.map((p, i) => <mesh key={`b${i}`} geometry={bulb} material={mats.beacon} position={p} scale={1.6} />)}
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
