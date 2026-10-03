import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { perfStats } from "@/game/perfStats";

/** Samples the real WebGLRenderer's own counters every frame — draw calls, triangles, and
 * resident geometry/texture counts straight from Three.js, not an estimate. Lives inside the
 * Canvas so it can reach the actual renderer this session is using. */
export function PerfSampler() {
  const acc = useRef({ frames: 0, time: 0 });
  const { gl } = useThree();
  useFrame((_, rawDelta) => {
    const a = acc.current;
    a.frames += 1;
    a.time += rawDelta;
    if (a.time >= 0.5) {
      perfStats.fps = Math.round(a.frames / a.time);
      perfStats.frameMs = Math.round((a.time / a.frames) * 1000 * 10) / 10;
      a.frames = 0;
      a.time = 0;
    }
    const info = gl.info;
    perfStats.calls = info.render.calls;
    perfStats.triangles = info.render.triangles;
    perfStats.geometries = info.memory.geometries;
    perfStats.textures = info.memory.textures;
  });
  return null;
}

/** Dev-facing readout, toggled with the backtick key — a standard "open the console" convention
 * that nothing in bindings.ts already uses. Shows the renderer's own counters so "is instancing
 * really one draw call per species" and "does memory grow over a long session" can be checked
 * directly instead of guessed at from hardware-spec advice that doesn't apply to a browser game. */
export function PerfOverlay() {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState(perfStats);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.code === "Backquote") setVisible((v) => !v); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setStats({ ...perfStats }), 250);
    return () => window.clearInterval(id);
  }, [visible]);
  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed left-3 top-3 z-[300] border border-primary/40 bg-background/85 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-primary backdrop-blur">
      <p className="text-muted-foreground">Perf (` to hide)</p>
      <p>{stats.fps} fps · {stats.frameMs} ms/frame</p>
      <p>{stats.calls} draw calls · {stats.triangles.toLocaleString()} tris</p>
      <p>{stats.geometries} geometries · {stats.textures} textures</p>
    </div>
  );
}
