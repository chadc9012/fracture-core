import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { RootState } from "@react-three/fiber";
import { detectGraphicsSupport, type GraphicsSupport } from "@/game/webgl-support";
import { GraphicsError } from "./GraphicsError";

/** Probes WebGL before the world canvas mounts, watches for context loss, and flags a canvas that
 * never draws a frame — each case shows GraphicsError instead of leaving a black screen. */
export function GraphicsGuard({ children }: { children: (caps: GraphicsSupport, onCreated: (state: RootState) => void) => ReactNode }) {
  const [caps, setCaps] = useState<GraphicsSupport | null>(null);
  const [lost, setLost] = useState(false);
  const [stalled, setStalled] = useState(false);

  useEffect(() => setCaps(detectGraphicsSupport()), []);

  const onCreated = useCallback((state: RootState) => {
    // three checks every shader for errors right after compiling it, which makes the browser finish each compile before the
    // next frame can go on (play-test Nov 2: ~5 s of a phone-speed world load waiting on shader logs, 130+ programs). Off
    // outside ?dev=1, so compiles overlap (KHR_parallel_shader_compile where the GPU has it); dev runs keep the error reports.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("dev") !== "1") state.gl.debug.checkShaderErrors = false;
    const canvas = state.gl.domElement;
    canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); setLost(true); });
    canvas.addEventListener("webglcontextrestored", () => setLost(false));
    let drew = false;
    const check = () => { drew = true; };
    requestAnimationFrame(() => requestAnimationFrame(check));
    window.setTimeout(() => { if (document.visibilityState === "visible" && (!drew || state.gl.getContext().isContextLost())) setStalled(true); }, 15000);
  }, []);

  if (!caps) return null;
  if (!caps.ok) return <GraphicsError title="3D graphics unavailable" message={caps.reason ?? "WebGL could not start."} safari={caps.safari} />;
  return (
    <>
      {children(caps, onCreated)}
      {lost && <GraphicsError title="Graphics connection lost" message="The browser reset 3D graphics, usually from memory pressure. Reloading restarts the world from your last save." safari={caps.safari} />}
      {stalled && !lost && <GraphicsError title="The world isn't drawing" message="3D graphics started but no frames are rendering on this device." safari={caps.safari} />}
    </>
  );
}
