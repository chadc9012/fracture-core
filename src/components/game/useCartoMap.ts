import { useEffect, useState } from "react";
import { cartoBounds, cartoFingerprint, cartoMap, createCartoJob } from "@/game/carto-maps";

/** The land-cover image of one street map: the baked one when it was painted from this exact world (scripts/bake-carto-maps.ts),
 * else painted here a few milliseconds per frame (a quick coarse pass first) and cached for the session. */
type State = { url: string | null; full: boolean; progress: number };
type Baked = { fingerprint: string; maps: Record<string, { url: string; size: number }> };
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
const emit = (id: string, s: State) => { states.set(id, s); listeners.get(id)?.forEach((l) => l(s)); };

function toUrl(px: Uint8ClampedArray, size: number): string | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); if (!g) return null;
  g.putImageData(new ImageData(new Uint8ClampedArray(px), size, size), 0, 0);
  return c.toDataURL("image/png");
}

function paint(id: string) {
  const m = cartoMap(id);
  if (!m || running.has(id) || states.get(id)?.full || typeof window === "undefined") return;
  running.add(id);
  void loadBaked().then((b) => {
    const hit = b?.maps[id];
    if (hit) { running.delete(id); emit(id, { url: hit.url, full: true, progress: 1 }); return; }
    const bounds = cartoBounds(m);
    // a fast coarse pass, then the sharp one
    const sizes = [160, 768];
    let k = 0, job = createCartoJob(sizes[0]!, bounds);
    const tick = () => {
      try {
        if (job.step(10)) {
          const url = toUrl(job.pixels, job.size);
          if (k === sizes.length - 1) { running.delete(id); emit(id, { url, full: true, progress: 1 }); return; }
          emit(id, { url, full: false, progress: 0.1 });
          job = createCartoJob(sizes[++k]!, bounds);
        } else if (k > 0) emit(id, { url: states.get(id)?.url ?? null, full: false, progress: 0.1 + job.progress() * 0.9 });
        window.requestAnimationFrame(tick);
      } catch (error) { running.delete(id); console.error("[carto] map image failed", error); }
    };
    window.requestAnimationFrame(tick);
  });
}

export function useCartoMap(id: string): State {
  const [s, setS] = useState<State>(states.get(id) ?? { url: null, full: false, progress: 0 });
  useEffect(() => {
    let set = listeners.get(id);
    if (!set) listeners.set(id, (set = new Set()));
    set.add(setS); setS(states.get(id) ?? { url: null, full: false, progress: 0 });
    paint(id);
    return () => { set!.delete(setS); };
  }, [id]);
  return s;
}
