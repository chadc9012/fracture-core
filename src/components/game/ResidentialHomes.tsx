import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DESIGNS, homeBoxes, homeDecks, homeWalls, residences, type Box, type Mat, type Residence } from "@/game/residences";
import { DistrictLight } from "./DistrictLight";
import { setWalls, clearWalls } from "@/game/walls";
import { registerDeck } from "@/game/district-decks";

/**
 * Walk-in residences (layout and geometry in residences.ts): every home in a city merged into one mesh per material —
 * painted surfaces, glazing, ceiling lights — so twelve furnished houses cost three draw calls, not the thousand-odd a
 * mesh per wall and table would. Colours ride on vertex colours. Walls go to the wall collider, floors to the decks.
 * Each home also has one warm ceiling light over the living room, managed by DistrictLight: it only exists for the
 * renderer when you're close (a short range) and counts against the tier's light cap like every other world light.
 */
const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);

/** a gable roof: a triangular prism, ridge along local z */
function prism(): THREE.BufferGeometry {
  const s = new THREE.Shape([new THREE.Vector2(-0.5, -0.5), new THREE.Vector2(0.5, -0.5), new THREE.Vector2(0, 0.5)]);
  // ExtrudeGeometry is already non-indexed, like the boxes below once converted, so they merge
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  g.clearGroups();
  return g;
}

function piece(b: Box, home: Residence): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  if (b.prism) g = prism();
  else { const box = new THREE.BoxGeometry(1, 1, 1); g = box.toNonIndexed(); box.dispose(); g.clearGroups(); }
  g.deleteAttribute("uv");
  g.scale(b.sx, b.sy, b.sz).translate(b.x, b.y, b.z);
  g.applyMatrix4(tmp.compose(new THREE.Vector3(home.x, home.floor, home.z), q.setFromAxisAngle(up, home.rot), new THREE.Vector3(1, 1, 1)));
  const c = new THREE.Color(b.color), n = g.getAttribute("position").count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

export function ResidentialHomes({ city }: { city: "nexus" | "neon" }) {
  const homes = useMemo(() => residences().filter((r) => r.city === city), [city]);
  const meshes = useMemo(() => {
    const by: Record<Mat, THREE.BufferGeometry[]> = { solid: [], glass: [], lamp: [] };
    for (const h of homes) for (const b of homeBoxes(h.style, h.floor - h.base)) by[b.mat].push(piece(b, h));
    const mats: Record<Mat, THREE.Material> = {
      solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 }),
      glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.35, envMapIntensity: 1.4 }),
      lamp: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(1.6, 1.5, 1.35) }),
    };
    const out: THREE.Mesh[] = [];
    for (const k of ["solid", "glass", "lamp"] as Mat[]) {
      if (!by[k].length) continue;
      const g = mergeGeometries(by[k]);
      by[k].forEach((p) => p.dispose());
      if (!g) continue;
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mats[k]);
      m.name = `residences:${city}:${k}`;
      m.castShadow = k === "solid"; m.receiveShadow = k !== "lamp";
      m.matrixAutoUpdate = false;
      out.push(m);
    }
    return out;
  }, [homes, city]);
  useEffect(() => () => { for (const m of meshes) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }, [meshes]);
  useEffect(() => {
    for (const h of homes) { setWalls(h.id, homeWalls(h)); for (const d of homeDecks(h)) registerDeck(d); }
    return () => { for (const h of homes) clearWalls(h.id); };
  }, [homes]);
  const lamps = useMemo(() => homes.map((h) => {
    const d = DESIGNS[h.style], z = d.d * 0.16; // living-room centre, between the partition and the front wall
    return { id: h.id, x: h.x + z * Math.sin(h.rot), y: h.floor + d.h - 0.5, z: h.z + z * Math.cos(h.rot), reach: Math.max(d.w, d.d) };
  }), [homes]);
  if (!homes.length) return null;
  return <group name={`residences-${city}`}>
    {meshes.map((m) => <primitive key={m.name} object={m} />)}
    {lamps.map((l) => <DistrictLight key={l.id} range={l.reach + 10} position={[l.x, l.y, l.z]} color="#ffd9a8" intensity={9} distance={l.reach} decay={1.6} castShadow={false} />)}
  </group>;
}
