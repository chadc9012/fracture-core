import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

/** Top-level Suspense fallback for the world canvas. Every model and HDRI has its own isolated boundary (so one missing file never blanks the scene), which means this
 * only shows while the scene's own code is still resolving. It says what is happening and, if that takes unusually long, offers a reload instead of an endless blank. */
function LoadingContent() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setSlow(true), 15000); return () => window.clearTimeout(t); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div role="status" className="pointer-events-auto w-64 border border-primary/40 bg-card/90 p-4 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        <p>Loading world</p>
        {slow && (
          <>
            <p className="mt-2 normal-case tracking-normal text-muted-foreground">This is taking longer than usual. Your progress is saved.</p>
            <Button className="mt-2" variant="outline" onClick={() => window.location.reload()}>Reload</Button>
          </>
        )}
      </div>
    </div>
  );
}

export function WorldLoading() {
  useEffect(() => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(<LoadingContent />);
    return () => { queueMicrotask(() => { root.unmount(); host.remove(); }); };
  }, []);
  return null;
}
