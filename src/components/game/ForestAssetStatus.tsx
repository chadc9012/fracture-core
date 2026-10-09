import { useEffect, useState, useSyncExternalStore } from "react";
import { getAssetSummary, subscribeAssets } from "@/game/forest-assets";

/** Small, non-blocking readout of the Verdant Forest's asset loading: progress while GLBs stream in, and a plain
 * list of anything that failed (the world keeps rendering with procedural fallbacks). Hides itself once everything is
 * in; a failure notice stays for a while so it can actually be read. */
export function ForestAssetStatus() {
  const sum = useSyncExternalStore(subscribeAssets, getAssetSummary, getAssetSummary);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!sum.settled) { setHidden(false); return; }
    const t = window.setTimeout(() => setHidden(true), sum.failed.length ? 14000 : 2500);
    return () => window.clearTimeout(t);
  }, [sum.settled, sum.failed.length]);
  if (!sum.total || hidden) return null;
  const failed = sum.failed.length > 0;
  if (sum.settled && !failed && sum.ok === sum.total) return null;
  return (
    <div role="status" style={{ position: "fixed", left: 12, bottom: 12, zIndex: 20, pointerEvents: "none", padding: "6px 10px", borderRadius: 6, font: "12px/1.3 ui-monospace, monospace", color: failed ? "#ffd2a8" : "#bfe9ff", background: "rgba(8,14,20,0.72)", border: `1px solid ${failed ? "#ff9a4a" : "#39b6ff"}55` }}>
      {sum.settled
        ? `Forest assets missing: ${sum.failed.join(", ")} — using fallback scenery`
        : `Loading forest assets ${sum.ok + sum.failed.length}/${sum.total}…`}
    </div>
  );
}
