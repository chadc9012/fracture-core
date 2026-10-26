import { useEffect, useState } from "react";
import { createMapJob, mapFingerprint, pixelsToDataUrl, terrainMapPixels, type MapBounds, type MapJob } from "@/game/terrain-map";

/** The painted terrain image, delivered progressively: a coarse preview within ~100 ms, then the full-resolution map painted a few
 * milliseconds per frame (so opening the map never freezes the game), shared and cached across every map screen. */
const FULL = 512, PREVIEW = 96, FRAME_BUDGET_MS = 12;
type State = { url: string | null; full: boolean; progress: number };
let state: State = { url: null, full: false, progress: 0 };
const listeners = new Set<(s: State) => void>();
let job: MapJob | null = null, running = false;
const emit = (next: State) => { state = next; listeners.forEach((l) => l(next)); };

/** The baked images (scripts/bake-terrain-maps.ts): used at once when they were painted from this exact terrain. Painting the full
 * map on a phone took 20-60 s, so the map showed its blocky preview (owner's shots, Oct 26). */
type Baked = { fingerprint: string; world: { url: string; size: number }; details: Record<string, { url: string; bounds: MapBounds }> };
let baked: Promise<Baked | null> | null = null;
function loadBaked(): Promise<Baked | null> {
  return (baked ??= fetch("/maps/terrain/manifest.json")
    .then((r) => (r.ok ? r.json() as Promise<Baked> : null)) // a dev server's index.html for a missing file fails to parse: caught below
    .then((m) => (m && m.fingerprint === mapFingerprint() ? m : null))
    .catch(() => null));
}

function start() {
  if (running || state.full || typeof window === "undefined") return;
  running = true;
  void loadBaked().then((m) => {
    if (m) { running = false; emit({ url: m.world.url, full: true, progress: 1 }); return; }
    paintWorld();
  });
}

function paintWorld() {
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

/** A sharp close-up of one destination (a city, a region), painted the same way as the world map but over a small
 * square, so zooming into Neon City shows its streets' ground instead of a few blurred pixels of the world image.
 * Painted progressively a few ms per frame and cached per destination for the session. */
const DETAIL = 640;
type Detail = { url: string | null; bounds: MapBounds; full: boolean };
const details = new Map<string, Detail>();
const detailListeners = new Map<string, Set<(d: Detail) => void>>();
const painting = new Set<string>();
function paintDetail(key: string, bounds: MapBounds) {
  if (painting.has(key) || details.get(key)?.full || typeof window === "undefined") return;
  painting.add(key);
  void loadBaked().then((m) => {
    const hit = m?.details[key];
    if (hit) { painting.delete(key); const d = { url: hit.url, bounds: hit.bounds, full: true }; details.set(key, d); detailListeners.get(key)?.forEach((l) => l(d)); return; }
    paintDetailNow(key, bounds);
  });
}
function paintDetailNow(key: string, bounds: MapBounds) {
  const job = createMapJob(DETAIL, bounds);
  const emit = (d: Detail) => { details.set(key, d); detailListeners.get(key)?.forEach((l) => l(d)); };
  const tick = () => {
    try {
      if (job.step(FRAME_BUDGET_MS)) { painting.delete(key); emit({ url: pixelsToDataUrl(job.pixels, DETAIL), bounds, full: true }); return; }
      window.requestAnimationFrame(tick);
    } catch (error) { painting.delete(key); console.error("[map] detail image failed", error); }
  };
  window.requestAnimationFrame(tick);
}
export function useDetailMap(key: string | null, bounds: MapBounds | null): Detail | null {
  const [d, setD] = useState<Detail | null>(key ? details.get(key) ?? null : null);
  useEffect(() => {
    if (!key || !bounds) { setD(null); return; }
    let set = detailListeners.get(key);
    if (!set) detailListeners.set(key, (set = new Set()));
    set.add(setD); setD(details.get(key) ?? null);
    paintDetail(key, bounds);
    return () => { set!.delete(setD); };
    // bounds follow the key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return d;
}
