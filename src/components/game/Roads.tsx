import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { allRoadRibbons } from "@/game/road-ribbon";

/**
 * Supply-road surfaces (road-ribbon.ts): one draped strip per road with a procedural canvas texture — packed dirt, two
 * darker tyre ruts, a sparse grassy crown, gravel speckle and soft feathered edges that melt into the ground tint
 * terrain.ts already paints along the corridor. Four draw calls for every road in the world. If a canvas isn't
 * available the roads simply keep the ground tint.
 */
function roadTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const W = 128, H = 256;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(W, H);
  let seed = 1337;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // cheap tileable value noise along v so the ruts wander a little and wet patches come and go
  const wob = (v: number, f: number, ph: number) => Math.sin((v * f + ph) * Math.PI * 2) * 0.5 + Math.sin((v * f * 2 + ph * 1.7) * Math.PI * 2) * 0.25;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / (W - 1), v = y / H;
    let r = 92, gg = 82, b = 70; // packed, darker than loose sand or soil so the road reads in every region
    // tyre ruts: two worn tracks, darker and smoother, drifting slightly along the road
    for (const centre of [0.3, 0.7]) {
      const d = Math.abs(u - centre - wob(v, 1, centre * 3) * 0.02);
      const k = Math.max(0, 1 - d / 0.07);
      r -= 30 * k; gg -= 26 * k; b -= 20 * k;
    }
    // crown between the ruts and both shoulders carry sparse grass
    const crown = Math.max(0, 1 - Math.abs(u - 0.5) / 0.08), shoulder = Math.max(0, (Math.abs(u - 0.5) - 0.36) / 0.14);
    const grass = Math.max(crown * 0.55, shoulder) * (rnd() < 0.5 ? 1 : 0.3);
    r += (78 - r) * grass * 0.6; gg += (98 - gg) * grass * 0.6; b += (54 - b) * grass * 0.6;
    // gravel speckle and grain
    const n = rnd();
    if (n > 0.93) { r += 34; gg += 32; b += 28; } else if (n < 0.06) { r -= 22; gg -= 20; b -= 16; }
    const grain = (rnd() - 0.5) * 14;
    // a damp patch every so often
    const damp = Math.max(0, wob(v, 1, 0.3) - 0.45) * 0.6;
    const o = (y * W + x) * 4;
    img.data[o] = Math.max(0, Math.min(255, (r + grain) * (1 - damp * 0.35)));
    img.data[o + 1] = Math.max(0, Math.min(255, (gg + grain) * (1 - damp * 0.35)));
    img.data[o + 2] = Math.max(0, Math.min(255, (b + grain) * (1 - damp * 0.3)));
    // feathered edges, ragged so the verge doesn't read as a ruler line
    const edge = Math.min(u, 1 - u), rag = 0.07 + wob(v, 3, u < 0.5 ? 0.1 : 0.6) * 0.03;
    img.data[o + 3] = Math.round(255 * Math.min(1, Math.max(0, (edge - 0.01) / rag)));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function Roads() {
  const built = useMemo(() => {
    const map = roadTexture();
    if (!map) return null;
    const material = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const meshes = allRoadRibbons().filter((r) => r.indices.length).map((r, i) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(r.positions, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(r.uvs, 2));
      g.setIndex(new THREE.BufferAttribute(r.indices, 1));
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, material);
      m.name = `road:${i}`; m.receiveShadow = true; m.renderOrder = 1; m.matrixAutoUpdate = false;
      return m;
    });
    return { map, material, meshes };
  }, []);
  useEffect(() => () => { if (!built) return; built.meshes.forEach((m) => m.geometry.dispose()); built.material.dispose(); built.map.dispose(); }, [built]);
  if (!built) return null;
  return <group name="roads">{built.meshes.map((m) => <primitive key={m.name} object={m} />)}</group>;
}
