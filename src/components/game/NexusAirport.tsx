import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AIRPORT, AIRPORT_BUILDINGS, PARKED, airportDeck, airportPoint, runwayLights } from "@/game/nexus-airport";
import { registerDeck } from "@/game/district-decks";
import { heightAt } from "@/game/terrain";
import { phantomExterior } from "@/game/phantom-geometry";
import { worldLight } from "@/game/world-light";

/** Nexus Airport (nexus-airport.ts): the raised airfield on its piers, runway markings, the glass terminal, the control tower
 * with its lit cab, a hangar, parked jets (the Phantom exterior from phantom-geometry.ts) and runway edge lights that come up
 * at dusk. Built in the field's local frame (+z along the runway) and placed once. */
export function NexusAirport() {
  const deck = useMemo(() => airportDeck(heightAt), []);
  useEffect(() => { registerDeck(deck); }, [deck]);
  const yaw = Math.atan2(AIRPORT.dirX, AIRPORT.dirZ), top = deck.top;

  const geo = useMemo(() => {
    const L = AIRPORT.length, W = AIRPORT.width, flat = L - AIRPORT.ramp * 2;
    // the slab: flat top plus the two ramps, as one side profile extruded across the width
    const shape = new THREE.Shape();
    const h = top - deck.base;
    shape.moveTo(-L / 2, -0.8); shape.lineTo(-L / 2, 0); shape.lineTo(-flat / 2, h); shape.lineTo(flat / 2, h); shape.lineTo(L / 2, 0); shape.lineTo(L / 2, -0.8);
    shape.lineTo(flat / 2, h - 1.6); shape.lineTo(-flat / 2, h - 1.6); shape.closePath();
    const slab = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false }).translate(0, 0, -W / 2).rotateY(-Math.PI / 2).translate(0, deck.base, 0);
    // piers under the flat top, down to the ground
    const piers: THREE.BufferGeometry[] = [];
    for (let s = -flat / 2 + 6; s <= flat / 2 - 6; s += 18) for (const t of [-W / 2 + 3, 0, W / 2 - 3]) {
      const p = airportPoint(s, t), g = heightAt(p.x, p.z), ph = top - 1.6 - g + 1;
      if (ph > 0.8) piers.push(new THREE.CylinderGeometry(1.1, 1.4, ph, 10).translate(-t, g - 1 + ph / 2, s));
    }
    const runway = new THREE.PlaneGeometry(AIRPORT.runwayWidth, flat - 4).rotateX(-Math.PI / 2).translate(-AIRPORT.runwayOffset, top + 0.03, 0);
    const b = AIRPORT_BUILDINGS;
    const terminal = new THREE.BoxGeometry(b.terminal.depth, b.terminal.height, b.terminal.length).translate(-b.terminal.across, top + b.terminal.height / 2, b.terminal.along);
    const roof = new THREE.BoxGeometry(b.terminal.depth + 4, 0.6, b.terminal.length + 4).translate(-b.terminal.across, top + b.terminal.height + 0.3, b.terminal.along);
    const hangar = new THREE.CylinderGeometry(b.hangar.depth / 2, b.hangar.depth / 2, b.hangar.length, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(-b.hangar.across, top, b.hangar.along);
    const tower = new THREE.CylinderGeometry(b.tower.radius * 0.8, b.tower.radius, b.tower.height, 16).translate(-b.tower.across, top + b.tower.height / 2, b.tower.along);
    const cab = new THREE.CylinderGeometry(b.tower.cab * 1.1, b.tower.cab * 0.8, 3.4, 16).translate(-b.tower.across, top + b.tower.height + 1.7, b.tower.along);
    const cabRoof = new THREE.CylinderGeometry(b.tower.cab * 0.3, b.tower.cab * 1.2, 1.2, 16).translate(-b.tower.across, top + b.tower.height + 4, b.tower.along);
    const light = new THREE.SphereGeometry(0.22, 6, 4);
    return { slab, piers: merge(piers), runway, terminal, roof, hangar, tower, cab, cabRoof, light, jet: phantomExterior("swept") };
  }, [deck, top]);

  const mats = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 512;
    const x = c.getContext("2d")!;
    x.fillStyle = "#2c2f33"; x.fillRect(0, 0, 64, 512);
    x.fillStyle = "#e9e6dc";
    for (let y = 30; y < 482; y += 34) x.fillRect(30, y, 4, 18); // centre-line dashes
    for (let i = 0; i < 6; i++) { x.fillRect(4 + i * 10, 4, 6, 18); x.fillRect(4 + i * 10, 490, 6, 18); } // threshold piano keys
    x.fillRect(1, 0, 2, 512); x.fillRect(61, 0, 2, 512); // edge stripes
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return {
      slab: new THREE.MeshStandardMaterial({ color: "#a6a39b", roughness: 0.9 }),
      runway: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#8fb6c9", roughness: 0.08, metalness: 0.5, emissive: "#ffd9a0", emissiveIntensity: 0 }),
      roof: new THREE.MeshStandardMaterial({ color: "#e6e2d8", roughness: 0.5, metalness: 0.2 }),
      hangar: new THREE.MeshStandardMaterial({ color: "#8b9298", roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }),
      edge: new THREE.MeshBasicMaterial({ color: "#ffe2a8", toneMapped: false }),
      jet: new THREE.MeshPhysicalMaterial({ color: "#e9edf2", metalness: 0.5, roughness: 0.25, clearcoat: 1 }),
      trim: new THREE.MeshStandardMaterial({ color: "#1b1d21", roughness: 0.7 }),
      jetGlass: new THREE.MeshPhysicalMaterial({ color: "#0b1016", roughness: 0.04, metalness: 0.6 }),
      metal: new THREE.MeshStandardMaterial({ color: "#b9bec4", roughness: 0.25, metalness: 0.95 }),
    };
  }, []);
  useEffect(() => () => {
    for (const g of Object.values(geo)) if ((g as THREE.BufferGeometry).isBufferGeometry) (g as THREE.BufferGeometry).dispose();
    for (const g of Object.values(geo.jet)) if ((g as THREE.BufferGeometry).isBufferGeometry) (g as THREE.BufferGeometry).dispose();
    Object.values(mats).forEach((m) => { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose(); });
  }, [geo, mats]);

  useFrame(() => {
    const n = worldLight.night;
    mats.edge.color.setRGB(1, 0.89, 0.66).multiplyScalar(0.2 + 2.4 * n);
    mats.glass.emissiveIntensity = 0.05 + 0.9 * n;
  });

  const lights = useMemo(() => runwayLights().flatMap((s) => [-1, 1].map((k) => new THREE.Vector3(-AIRPORT.runwayOffset - k * (AIRPORT.runwayWidth / 2 + 0.6), top + 0.25, s))), [top]);
  return (
    <group name="site:nexus-airport" position={[AIRPORT.x, 0, AIRPORT.z]} rotation-y={yaw}>
      <mesh geometry={geo.slab} material={mats.slab} castShadow receiveShadow />
      <mesh geometry={geo.piers} material={mats.slab} castShadow />
      <mesh geometry={geo.runway} material={mats.runway} receiveShadow />
      <mesh geometry={geo.terminal} material={mats.glass} castShadow />
      <mesh geometry={geo.roof} material={mats.roof} castShadow />
      <mesh geometry={geo.hangar} material={mats.hangar} castShadow receiveShadow />
      <mesh geometry={geo.tower} material={mats.roof} castShadow />
      <mesh geometry={geo.cab} material={mats.glass} />
      <mesh geometry={geo.cabRoof} material={mats.roof} />
      {lights.map((p, i) => <mesh key={i} geometry={geo.light} material={mats.edge} position={p} />)}
      {PARKED.map((pk, i) => (
        <group key={`j${i}`} position={[-pk.across, top, pk.along]} rotation-y={pk.yaw} scale={0.55}>
          <mesh geometry={geo.jet.paint} material={mats.jet} castShadow />
          <mesh geometry={geo.jet.trim} material={mats.trim} />
          <mesh geometry={geo.jet.glass} material={mats.jetGlass} />
          <mesh geometry={geo.jet.metal} material={mats.metal} />
          <mesh geometry={geo.jet.tyres} material={mats.trim} />
        </group>
      ))}
    </group>
  );
}

function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of parts) n += g.attributes["position"]!.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes["position"]!.array as Float32Array, o * 3); nor.set(g.attributes["normal"]!.array as Float32Array, o * 3); o += g.attributes["position"]!.count; }
  list.forEach((g) => g.dispose()); parts.forEach((g) => g.dispose());
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return out;
}
