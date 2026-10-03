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
