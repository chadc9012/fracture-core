import { Html } from "@react-three/drei";
import { useEffect, useState } from "react";

/** Top-level Suspense fallback for the world canvas. Every model and HDRI has its own isolated boundary (so one missing file never blanks the scene), which means this
 * only shows while the scene's own code is still resolving. It says what is happening and, if that takes unusually long, offers a reload instead of an endless blank. */
export function WorldLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setSlow(true), 15000); return () => window.clearTimeout(t); }, []);
  return (
    <Html center>
      <div role="status" className="pointer-events-auto w-64 border border-primary/40 bg-card/90 p-4 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        <p>Loading world</p>
        {slow && (
          <>
            <p className="mt-2 normal-case tracking-normal text-muted-foreground">This is taking longer than usual. Your progress is saved.</p>
            <button className="mt-2 border border-primary/60 px-3 py-1 text-primary hover:bg-primary/10" onClick={() => window.location.reload()}>Reload</button>
          </>
        )}
      </div>
    </Html>
  );
}
