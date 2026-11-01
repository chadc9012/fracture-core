import { useEffect, useState } from "react";
import { cartoBounds, cartoFingerprint, cartoMap, createCartoJob, satelliteFromData, type CartoBounds } from "@/game/carto-maps";

/** The land-cover image of one street map, in the map look or the satellite look: the baked one when it was painted from this
 * exact world (scripts/bake-carto-maps.ts), else painted here a few milliseconds per frame (a quick coarse pass first) and cached
 * for the session. The satellite image is recoloured from the map's data (cover, hill shade, depth: satelliteFromData). */
export type CartoStyle = "map" | "satellite";
type State = { url: string | null; full: boolean; progress: number };
type Baked = { fingerprint: string; maps: Record<string, { url: string; data?: string; size: number }> };
let baked: Promise<Baked | null> | null = null;
function loadBaked(): Promise<Baked | null> {
  return (baked ??= fetch("/maps/carto/manifest.json")
    .then((r) => (r.ok ? (r.json() as Promise<Baked>) : null))
    .then((m) => (m && m.fingerprint === cartoFingerprint() ? m : null))
    .catch(() => null));
}
const states = new Map<string, State>();
const listeners = new Map<string, Set<(s: State) => void>>();
const running = new Set<string>();
/** the painted (unbaked) data per map, so the satellite view can reuse it */
const paintedData = new Map<string, { data: Uint8ClampedArray; size: number }>();
const emit = (key: string, s: State) => { states.set(key, s); listeners.get(key)?.forEach((l) => l(s)); };

function toUrl(px: Uint8ClampedArray, size: number, type: "image/png" | "image/jpeg" = "image/png"): string | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); if (!g) return null;
  g.putImageData(new ImageData(new Uint8ClampedArray(px), size, size), 0, 0);
  return c.toDataURL(type, 0.88);
}
function readImage(url: string): Promise<{ data: Uint8ClampedArray; size: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = img.naturalWidth, c = document.createElement("canvas"); c.width = c.height = size;
      const g = c.getContext("2d", { willReadFrequently: true }); if (!g) { reject(new Error("no 2d context")); return; }
      g.drawImage(img, 0, 0);
      resolve({ data: g.getImageData(0, 0, size, size).data, size });
    };
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}
const satellite = (key: string, d: { data: Uint8ClampedArray; size: number }, bounds: CartoBounds) => {
  // after a frame, so the toggle answers first
  window.setTimeout(() => { running.delete(key); emit(key, { url: toUrl(satelliteFromData(d.data, d.size, bounds), d.size, "image/jpeg"), full: true, progress: 1 }); }, 16);
};

function paint(id: string, style: CartoStyle) {
  const key = `${id}:${style}`, m = cartoMap(id);
  if (!m || running.has(key) || states.get(key)?.full || typeof window === "undefined") return;
  running.add(key);
  const bounds = cartoBounds(m);
  void loadBaked().then((b) => {
    const hit = b?.maps[id];
    if (hit && style === "map") { running.delete(key); emit(key, { url: hit.url, full: true, progress: 1 }); return; }
    if (hit?.data && style === "satellite") {
      emit(key, { url: null, full: false, progress: 0.5 });
      readImage(hit.data).then((d) => satellite(key, d, bounds)).catch((error) => { running.delete(key); console.error("[carto] satellite failed", error); });
      return;
    }
    const done = paintedData.get(id);
    if (style === "satellite" && done) { satellite(key, done, bounds); return; }
    // a fast coarse pass, then the sharp one
    const sizes = [160, 768];
    let k = 0, job = createCartoJob(sizes[0]!, bounds);
    const out = (j: typeof job) => (style === "map" ? toUrl(j.pixels, j.size) : toUrl(satelliteFromData(j.data, j.size, bounds), j.size, "image/jpeg"));
    const tick = () => {
      try {
        if (job.step(10)) {
          const url = out(job);
          if (k === sizes.length - 1) { paintedData.set(id, { data: job.data, size: job.size }); running.delete(key); emit(key, { url, full: true, progress: 1 }); return; }
          emit(key, { url, full: false, progress: 0.1 });
          job = createCartoJob(sizes[++k]!, bounds);
        } else if (k > 0) emit(key, { url: states.get(key)?.url ?? null, full: false, progress: 0.1 + job.progress() * 0.9 });
        window.requestAnimationFrame(tick);
      } catch (error) { running.delete(key); console.error("[carto] map image failed", error); }
    };
    window.requestAnimationFrame(tick);
  });
}

export function useCartoMap(id: string, style: CartoStyle = "map"): State {
  const key = `${id}:${style}`;
  const [s, setS] = useState<State>(states.get(key) ?? { url: null, full: false, progress: 0 });
  useEffect(() => {
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(setS); setS(states.get(key) ?? { url: null, full: false, progress: 0 });
    paint(id, style);
    return () => { set!.delete(setS); };
  }, [id, style, key]);
  return s;
}
