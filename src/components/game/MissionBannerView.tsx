import { useEffect } from "react";
import type { MissionBanner } from "@/game/mission-banner";

/** Destiny-style mission banners (rules: mission-banner.ts). NEW: a slanted crimson ribbon top-left with the mission name, and the place
 * name in wide-spaced capitals lower-left. COMPLETE: a centred card. Presentation only; dismisses itself. */
export function MissionBannerView({ banner, onDone }: { banner: MissionBanner; onDone: () => void }) {
  useEffect(() => { const t = window.setTimeout(onDone, banner.kind === "NEW" ? 4800 : 4000); return () => window.clearTimeout(t); }, [banner, onDone]);
  if (banner.kind === "COMPLETE") return <div className="pointer-events-none fixed inset-x-0 top-1/3 z-[60] grid place-items-center ui-enter" role="status">
    <div className="border-y border-[#cdae33]/70 bg-black/55 px-10 py-4 text-center backdrop-blur-sm">
      <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-[#cdae33]">{banner.subtitle}</p>
      <p className="mt-1 text-2xl font-semibold uppercase tracking-[0.12em] text-white">{banner.title}</p>
    </div>
  </div>;
  return <div className="pointer-events-none fixed inset-0 z-[60]" role="status">
    <div className="mission-ribbon absolute left-0 top-20 flex items-center gap-3 py-2 pl-4 pr-16">
      <span className="grid size-8 place-items-center border border-white/70 font-mono text-sm text-white">◈</span>
      <span className="font-mono text-lg uppercase tracking-[0.35em] text-white">New mission</span>
    </div>
    <p className="absolute left-5 top-[7.6rem] bg-black/40 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/85">{banner.title}</p>
    <p className="mission-place absolute bottom-40 left-5 font-mono text-xl uppercase text-white/90">{banner.subtitle}</p>
  </div>;
}
