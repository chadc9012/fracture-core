import { useEffect, useRef, useState } from "react";
import { BOARD_NAME, SITE_STYLE, siteAt, type Site } from "@/game/region-atlas";

/** "Entering Casino Row": a short arrival card each time the player walks or drives into a named district or site
 * (region-atlas.ts). Leaving a site and coming back shows it again; standing still never re-triggers it. */
export function SiteBanner({ x, z, hidden }: { x: number; z: number; hidden?: boolean }) {
  const [shown, setShown] = useState<Site | null>(null);
  const last = useRef<string | null>(null);
  const cell = `${Math.round(x / 6)}:${Math.round(z / 6)}`;
  useEffect(() => {
    if (!x && !z) return;
    const s = siteAt(x, z);
    const id = s?.id ?? null;
    if (id === last.current) return;
    last.current = id;
    if (s) setShown(s);
  }, [cell]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!shown) return; const t = window.setTimeout(() => setShown(null), 3800); return () => window.clearTimeout(t); }, [shown]);
  if (!shown || hidden) return null;
  const st = SITE_STYLE[shown.kind];
  return (
    <div className="wf-site-banner pointer-events-none absolute left-1/2 top-[22%] z-30 -translate-x-1/2 text-center" role="status" aria-live="polite">
      <p className="font-mono text-[10px] uppercase tracking-[0.42em]" style={{ color: st.color }}>{BOARD_NAME[shown.regionId] ?? ""} · {st.label}</p>
      <p className="mt-1 text-2xl font-light uppercase tracking-[0.22em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"><span className="mr-2" style={{ color: st.color }}>{st.glyph}</span>{shown.name}</p>
      <p className="mt-1 text-xs text-white/75 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">{shown.blurb}</p>
    </div>
  );
}
