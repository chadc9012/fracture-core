import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
    const out = FLOORS.flatMap((f) => mergeByMat(floorBoxes(f.id).map((b) => ({ b, at: { x: f.origin.x, z: f.origin.z, floor: INTERIOR_ALTITUDE, rot: 0 } })), `residences-tower:${f.id}`));
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
      <Sign text="NEXUS CITY RESIDENCES" sub="Welcome home" at={[FLOORS[0]!.origin.x + 2, INTERIOR_ALTITUDE + 1.85, FLOORS[0]!.origin.z - 6.56]} w={4.4} />
      <Sign text="1204" sub="Your apartment" at={[FLOORS[1]!.origin.x + 0, INTERIOR_ALTITUDE + 2.9, FLOORS[1]!.origin.z + 5.83]} w={1.4} turn={Math.PI} />
    </group>
  );
}

/** a lit-window facade: a grid of rooms, a share lit warm or cool (canvas, made once) */
let windowsTex: THREE.CanvasTexture | null = null;
function windowsTexture(): THREE.CanvasTexture | null {
  if (windowsTex) return windowsTex;
  if (typeof document === "undefined") return null;
  const n = 256, c = document.createElement("canvas"); c.width = c.height = n;
  const g = c.getContext("2d"); if (!g) return null;
  let seed = 1204; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  g.fillStyle = "#07090f"; g.fillRect(0, 0, n, n);
  const cols = 16, rows = 32, cw = n / cols, rh = n / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const r = rnd();
    g.fillStyle = r < 0.24 ? "#ffd49a" : r < 0.32 ? "#bfe4ff" : r < 0.35 ? "#d9a6ff" : "#0e1219";
    g.fillRect(i * cw + 1.5, j * rh + 1.2, cw - 3, rh - 2.4);
  }
  windowsTex = new THREE.CanvasTexture(c);
  windowsTex.wrapS = windowsTex.wrapT = THREE.RepeatWrapping;
  windowsTex.colorSpace = THREE.SRGBColorSpace;
  return windowsTex;
}

/** the night skyline outside a floor's north glass: a few dozen towers 30-170 m out, from far below the floor to well above,
 * one merged mesh whose faces wear the lit-window texture at a scale that follows each tower's size */
function Skyline({ floor }: { floor: ResidenceFloor }) {
  const mesh = useMemo(() => {
    let seed = floor.origin.z + 77; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 46; k++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * (floor.open ? 2 : 0.95), d = 70 + rnd() * 180;
      const w = 16 + rnd() * 26, top = (floor.open ? -14 : -24) + rnd() * 100, h = top + 160;
      const box = new THREE.BoxGeometry(w, h, w), g = box.toNonIndexed(); box.dispose();
      const uv = g.getAttribute("uv") as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 40), uv.getY(i) * (h / 100)); // a 2.5 m window bay, a 3.1 m storey
      g.translate(Math.cos(a) * d, top - h / 2, Math.sin(a) * d);
      parts.push(g);
    }
    const geo = mergeGeometries(parts)!; parts.forEach((p) => p.dispose());
    const tex = windowsTexture();
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: "#9aa1b2", fog: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(floor.origin.x, INTERIOR_ALTITUDE, floor.origin.z);
    m.matrixAutoUpdate = false; m.updateMatrix();
    return m;
  }, [floor]);
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }, [mesh]);
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
