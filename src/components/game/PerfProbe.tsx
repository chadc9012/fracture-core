import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { renderCounts } from "@/game/perf-counters";
import * as THREE from "three";

const prevCounts = { scene: 0, canvas: 0 };

/** F3 (or ?perf=1) toggles a plain-DOM readout: fps, worst frame, draw calls, triangles, lights,
 * geometries and textures. Updates a div directly, so it never re-renders React. */
export function PerfProbe() {
  const { gl, scene } = useThree();
  const el = useRef<HTMLDivElement | null>(null);
  const shown = useRef(false);
  const acc = useRef({ t: 0, frames: 0, worst: 0, lights: 0, lightT: 0, heavy: "", operators: "", renderMs: 0, gpu: "", busyMs: 0, gpuMs: 0, gpuSamples: 0, lightInfo: "", bench: 0, benchTick: 0, isoLabel: "all on" });
  const timer = useRef<{ ctx: WebGL2RenderingContext; ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }; open: WebGLQuery | null; pending: WebGLQuery[] } | null>(null);
  const frameStart = useRef(0);
  const v = useRef(new THREE.Vector3()).current;

  // F4 cycles an isolation mode so one screenshot per mode shows what each layer costs (gpu busy / other ms).
  const iso = useRef({ mode: 0, hidden: [] as THREE.Object3D[], lights: [] as THREE.Light[], ui: [] as HTMLElement[] });
  useEffect(() => {
    const MODES: { label: string; hide?: string[]; ui?: boolean; shadows?: boolean }[] = [
      { label: "all on" }, { label: "UI overlays hidden", ui: true }, { label: "sky off", hide: ["iso:sky"] }, { label: "water off", hide: ["iso:water"] },
      { label: "weather+wildlife off", hide: ["iso:weather", "iso:life"] }, { label: "forest+ground cover off", hide: ["iso:forest", "ground-cover"] },
      { label: "cities off", hide: ["city:nexus", "city:neon", "city:thalassia"] }, { label: "shadows off", shadows: true },
    ];
    const apply = (mode: number) => {
      const st = iso.current;
      st.hidden.forEach((o) => { o.visible = true; }); st.hidden = [];
      st.lights.forEach((l) => { l.castShadow = true; }); st.lights = [];
      st.ui.forEach((e) => { e.style.visibility = ""; }); st.ui = [];
      const m = MODES[mode]!;
      if (m.hide) scene.traverse((o) => { if (m.hide!.includes(o.name)) { o.visible = false; st.hidden.push(o); } });
      if (m.shadows) scene.traverse((o) => { const l = o as THREE.Light; if (l.isLight && l.castShadow) { l.castShadow = false; st.lights.push(l); } });
      if (m.ui) { const root = gl.domElement.closest(".fixed"); if (root) for (const c of Array.from(root.children) as HTMLElement[]) if (!c.contains(gl.domElement)) { c.style.visibility = "hidden"; st.ui.push(c); } }
      st.mode = mode; acc.current.isoLabel = m.label;
    };
    const onKey = (e: KeyboardEvent) => { if (e.code === "F4" && shown.current) { e.preventDefault(); apply((iso.current.mode + 1) % MODES.length); } };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); apply(0); };
  }, [gl, scene]);

  useEffect(() => {
    const div = document.createElement("div");
    div.style.cssText = "position:fixed;right:8px;top:8px;z-index:9999;padding:6px 8px;font:11px/1.35 ui-monospace,monospace;color:#9df;background:rgba(0,0,0,.72);border:1px solid #3a6;pointer-events:none;white-space:pre-wrap;overflow-wrap:anywhere;max-width:min(60ch,48vw);max-height:calc(100vh - 16px);overflow:hidden;display:none";
    document.body.appendChild(div);
    el.current = div;
    const toggle = () => { shown.current = !shown.current; div.style.display = shown.current ? "block" : "none"; };
    const onKey = (e: KeyboardEvent) => { if (e.code === "F3") { e.preventDefault(); toggle(); } };
    window.addEventListener("keydown", onKey);
    try { if (new URLSearchParams(window.location.search).get("perf") === "1") toggle(); } catch { /* ignore */ }
    return () => { window.removeEventListener("keydown", onKey); div.remove(); };
  }, []);

  // Time the renderer's CPU-side submit, and name the GPU: a software renderer (SwiftShader/llvmpipe) explains a slow empty scene.
  useEffect(() => {
    const ctx = gl.getContext();
    const info = ctx.getExtension("WEBGL_debug_renderer_info");
    acc.current.gpu = info ? String(ctx.getParameter(info.UNMASKED_RENDERER_WEBGL)).slice(0, 44) : "unknown (no debug info)";
    const c2 = ctx as WebGL2RenderingContext;
    const ext = typeof c2.createQuery === "function" ? (c2.getExtension("EXT_disjoint_timer_query_webgl2") as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null) : null;
    timer.current = ext ? { ctx: c2, ext, open: null, pending: [] } : null;
    const original = gl.render;
    gl.render = (s: THREE.Object3D, c: THREE.Camera) => { const t0 = performance.now(); original.call(gl, s, c); acc.current.renderMs += performance.now() - t0; };
    return () => { gl.render = original; timer.current = null; };
  }, [gl]);

  // Frame start (before any other work): open a GPU timer query, and after the frame's JS finishes (a message
  // posted now runs once the rAF callbacks return) close it and record how long the main thread was busy.
  const channel = useRef<MessageChannel | null>(null);
  useFrame(() => {
    if (!shown.current) return;
    frameStart.current = performance.now();
    const tm = timer.current;
    if (tm && !tm.open && tm.pending.length < 6) { tm.open = tm.ctx.createQuery(); tm.ctx.beginQuery(tm.ext.TIME_ELAPSED_EXT, tm.open!); }
    if (!channel.current) {
      const mc = new MessageChannel();
      mc.port1.onmessage = () => {
        acc.current.busyMs += performance.now() - frameStart.current;
        const t2 = timer.current;
        if (t2?.open) { t2.ctx.endQuery(t2.ext.TIME_ELAPSED_EXT); t2.pending.push(t2.open); t2.open = null; }
      };
      channel.current = mc;
    }
    channel.current.port2.postMessage(0);
  }, -1000);

  useFrame((_, dt) => {
    const a = acc.current;
    a.t += dt; a.frames++; a.worst = Math.max(a.worst, dt);
    const tm = timer.current;
    if (tm) {
      const disjoint = tm.ctx.getParameter(tm.ext.GPU_DISJOINT_EXT);
      while (tm.pending.length && tm.ctx.getQueryParameter(tm.pending[0]!, tm.ctx.QUERY_RESULT_AVAILABLE)) {
        const q = tm.pending.shift()!;
        if (!disjoint) { a.gpuMs += Number(tm.ctx.getQueryParameter(q, tm.ctx.QUERY_RESULT)) / 1e6; a.gpuSamples++; }
        tm.ctx.deleteQuery(q);
      }
    }
    if (a.t < 0.5) return;
    if (shown.current && el.current) {
      a.lightT += a.t;
      if (a.lightT > 2) {
        a.lightT = 0;
        // Walk only what the renderer would draw (an invisible parent hides its whole subtree).
        const operators: string[] = []; let n = 0; let total = 0; const kinds: Record<string, number> = {}; const names: string[] = []; const groups = new Map<string, { tris: number; count: number; type: string; label: string }>();
        const walk = (o: THREE.Object3D, label = "") => {
          if (o.name) label = o.name;
          const od = o.userData?.["operatorDiag"] as Record<string, unknown> | undefined;
          if (od) operators.push(`  ${String(od["url"]).split("/").pop()} paint:${od["texturePaint"] ? `texture ${od["textureSize"]}px covered ${od["textureCovered"]} visor ${od["visorTexels"]}` : od["vertexColorMaterial"] ? "vertex-colour" : "NONE(GLB default)"} mats:${od["materials"]} verts:${od["vertices"]} chest:${od["chest"]} suit:${od["suit"]} bones:${JSON.stringify(od["bonesByRegion"])}`);
          if (!o.visible) return;
          if ((o as THREE.Light).isLight) { n++; kinds[o.type] = (kinds[o.type] ?? 0) + 1; if (o.type === "PointLight" || o.type === "SpotLight") { let p: THREE.Object3D | null = o; let path = ""; for (let d = 0; p && d < 4; d++, p = p.parent) path = (p.name || p.type) + (path ? ">" + path : ""); names.push(path); } }
          const m = o as THREE.Mesh;
          if (m.isMesh && m.geometry) {
            const g = m.geometry;
            const per = (g.index ? g.index.count : g.attributes["position"]?.count ?? 0) / 3;
            const tris = per * ((o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).count : 1);
            total += tris;
            const gk = g.uuid; const gg = groups.get(gk) ?? { tris: 0, count: 0, type: g.type, label: label || "(unnamed)" }; gg.tris += tris; gg.count++; groups.set(gk, gg);
          }
          for (const c of o.children) walk(c, label);
        };
        walk(scene);
        a.lights = n;
        const top = [...groups.values()].sort((x, y) => y.tris - x.tris).slice(0, 4);
        a.lightInfo = Object.entries(kinds).map(([k, v]) => `${v} ${k.replace("Light", "")}`).join(", ") + (names.length ? "\n  " + names.slice(0, 6).join("\n  ") : "");
        a.operators = operators.join("\n");
        a.heavy = `  scene ${(total / 1000).toFixed(0)}k tris\n` + top.map((h) => `  ${(h.tris / 1000).toFixed(0)}k = ${h.count} x ${h.label}`).join("\n");
      }
      // Fixed-size CPU benchmark (~constant work): a slow number here means the machine itself is throttled
      // (Low Power Mode, thermal limits, other apps), not the game.
      if (++a.benchTick % 4 === 1) { const b0 = performance.now(); let x = 0; for (let k = 0; k < 3e6; k++) x += Math.sqrt(k); a.bench = performance.now() - b0 + (x < 0 ? 1 : 0); }
      const i = gl.info;
      const rate = { scene: (renderCounts.scene - prevCounts.scene) / a.t, canvas: (renderCounts.canvas - prevCounts.canvas) / a.t }; prevCounts.scene = renderCounts.scene; prevCounts.canvas = renderCounts.canvas;
      const frameMs = (a.t / a.frames) * 1000; const renderMs = a.renderMs / a.frames;
      el.current.textContent = `isolate [F4]: ${a.isoLabel}\ngpu ${a.gpu}\nframe ${frameMs.toFixed(0)} ms = render ${renderMs.toFixed(0)} + other ${Math.max(0, frameMs - renderMs).toFixed(0)}\njs busy ${(a.busyMs / a.frames).toFixed(0)} ms   gpu busy ${a.gpuSamples ? (a.gpuMs / a.gpuSamples).toFixed(0) + " ms" : "n/a"}\nreact renders/s: Scene ${rate.scene.toFixed(1)}  GameCanvas ${rate.canvas.toFixed(1)}\nFPS ${(a.frames / a.t).toFixed(0)}   worst ${(a.worst * 1000).toFixed(0)} ms\ncalls ${i.render.calls}   tris ${(i.render.triangles / 1000).toFixed(0)}k\nlights ${a.lights}   geo ${i.memory.geometries}   tex ${i.memory.textures}\ncpu bench ${a.bench.toFixed(0)} ms (3M sqrt)   cores ${navigator.hardwareConcurrency}\ndpr ${gl.getPixelRatio().toFixed(2)}   ${gl.domElement.width}x${gl.domElement.height}${a.lightInfo ? "\nlight types: " + a.lightInfo : ""}${a.heavy ? "\nheaviest meshes:\n" + a.heavy : ""}${a.operators ? "\noperator paint:\n" + a.operators : ""}`;
    }
    a.t = 0; a.frames = 0; a.worst = 0; a.renderMs = 0; a.busyMs = 0; a.gpuMs = 0; a.gpuSamples = 0;
  });
  return null;
}
