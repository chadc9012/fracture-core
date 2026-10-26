import { useEffect } from "react";

/** Rendered inside the world's Suspense boundary, so it only mounts once the scene has resolved (never while the "Loading world"
 *  fallback is showing). After a short settle delay it reports `true`, and `false` again if the world unmounts. The opening
 *  cinematics start their clocks from this: before, they began the instant the player deployed, so on a phone (where the world
 *  takes many seconds to load) the whole intro played over the loading screen and was over before the world appeared. */
export const WORLD_SETTLE_MS = 1500;
export function WorldMountedSignal({ onChange }: { onChange: (mounted: boolean) => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => onChange(true), WORLD_SETTLE_MS);
    return () => { window.clearTimeout(t); onChange(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
