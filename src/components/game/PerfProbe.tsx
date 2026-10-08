import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/** F3 (or ?perf=1) toggles a plain-DOM readout: fps, worst frame, draw calls, triangles, lights,
 * geometries and textures. Updates a div directly, so it never re-renders React. */
export function PerfProbe() {
  const { gl, scene } = useThree();
  const el = useRef<HTMLDivElement | null>(null);
  const shown = useRef(false);
  const acc = useRef({ t: 0, frames: 0, worst: 0, lights: 0, lightT: 0, heavy: "" });
  const v = useRef(new THREE.Vector3()).current;

  useEffect(() => {
    const div = document.createElement("div");
    div.style.cssText = "position:fixed;right:8px;top:8px;z-index:9999;padding:6px 8px;font:11px/1.35 ui-monospace,monospace;color:#9df;background:rgba(0,0,0,.72);border:1px solid #3a6;pointer-events:none;white-space:pre;display:none";
    document.body.appendChild(div);
    el.current = div;
    const toggle = () => { shown.current = !shown.current; div.style.display = shown.current ? "block" : "none"; };
    const onKey = (e: KeyboardEvent) => { if (e.code === "F3") { e.preventDefault(); toggle(); } };
    window.addEventListener("keydown", onKey);
    try { if (new URLSearchParams(window.location.search).get("perf") === "1") toggle(); } catch { /* ignore */ }
    return () => { window.removeEventListener("keydown", onKey); div.remove(); };
  }, []);

  useFrame((_, dt) => {
    const a = acc.current;
    a.t += dt; a.frames++; a.worst = Math.max(a.worst, dt);
    if (a.t < 0.5) return;
    if (shown.current && el.current) {
      a.lightT += a.t;
      if (a.lightT > 2) {
        a.lightT = 0;
        // Walk only what the renderer would draw (an invisible parent hides its whole subtree).
        let n = 0; const heavy: { tris: number; label: string }[] = [];
        const walk = (o: THREE.Object3D) => {
          if (!o.visible) return;
          if ((o as THREE.Light).isLight) n++;
          const m = o as THREE.Mesh;
          if (m.isMesh && m.geometry) {
            const g = m.geometry;
            const per = (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3;
            const tris = per * ((o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).count : 1);
            if (tris > 20000) heavy.push({ tris, label: `${g.type}${(o as THREE.InstancedMesh).isInstancedMesh ? " x" + (o as THREE.InstancedMesh).count : ""} @${o.getWorldPosition(v).toArray().map((c) => Math.round(c)).join(",")}` });
          }
          for (const c of o.children) walk(c);
        };
        walk(scene);
        a.lights = n;
        heavy.sort((x, y) => y.tris - x.tris);
        a.heavy = heavy.slice(0, 4).map((h) => `  ${(h.tris / 1000).toFixed(0)}k ${h.label}`).join("\n");
      }
      const i = gl.info;
      el.current.textContent = `FPS ${(a.frames / a.t).toFixed(0)}   worst ${(a.worst * 1000).toFixed(0)} ms\ncalls ${i.render.calls}   tris ${(i.render.triangles / 1000).toFixed(0)}k\nlights ${a.lights}   geo ${i.memory.geometries}   tex ${i.memory.textures}\ndpr ${gl.getPixelRatio().toFixed(2)}   ${gl.domElement.width}x${gl.domElement.height}${a.heavy ? "\nheaviest meshes:\n" + a.heavy : ""}`;
    }
    a.t = 0; a.frames = 0; a.worst = 0;
  });
  return null;
}
