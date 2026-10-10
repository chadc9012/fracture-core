import { useEffect, useState } from "react";
import { createMapJob, pixelsToDataUrl, terrainMapPixels, type MapJob } from "@/game/terrain-map";

/** The painted terrain image, delivered progressively: a coarse preview within ~100 ms, then the full-resolution map painted a few
 * milliseconds per frame (so opening the map never freezes the game), shared and cached across every map screen. */
const FULL = 512, PREVIEW = 96, FRAME_BUDGET_MS = 12;
type State = { url: string | null; full: boolean; progress: number };
let state: State = { url: null, full: false, progress: 0 };
const listeners = new Set<(s: State) => void>();
let job: MapJob | null = null, running = false;
const emit = (next: State) => { state = next; listeners.forEach((l) => l(next)); };

function start() {
  if (running || state.full || typeof window === "undefined") return;
  running = true;
  if (!state.url) {
    try { const url = pixelsToDataUrl(terrainMapPixels(PREVIEW), PREVIEW); if (url) emit({ url, full: false, progress: 0 }); } catch { /* the full pass below still runs */ }
  }
  job = createMapJob(FULL);
  let lastReport = -1, frame = 0;
  const tick = () => {
    try {
      const done = job!.step(FRAME_BUDGET_MS);
      if (done) {
        const url = pixelsToDataUrl(job!.pixels, FULL);
        running = false;
        if (url) emit({ url, full: true, progress: 1 }); else emit({ ...state, full: true, progress: 1 });
        return;
      }
      if (++frame % 6 === 0) { const p = Math.round(job!.progress() * 100); if (p !== lastReport) { lastReport = p; emit({ ...state, progress: p / 100 }); } }
      window.requestAnimationFrame(tick);
    } catch (error) {
      running = false; // leave whatever preview we have; never take the map screen down
      console.error("[map] terrain image failed", error);
    }
  };
  window.requestAnimationFrame(tick);
}

export function useTerrainMap(): State {
  const [s, setS] = useState(state);
  useEffect(() => { listeners.add(setS); setS(state); start(); return () => { listeners.delete(setS); }; }, []);
  return s;
}
