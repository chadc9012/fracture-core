import { useEffect, useState } from "react";
import { grenadeHud } from "@/game/client-input";
import { keyName, normalizeBindings, type Bindings } from "@/game/bindings";

/** The Operator grenade pouch: the equipped grenade, its charges and the recharge, above the dash meter. */
export function GrenadeHud({ bindings }: { bindings?: Bindings | undefined }) {
  const [view, setView] = useState(grenadeHud.current);
  useEffect(() => {
    const t = window.setInterval(() => setView((prev) => {
      const cur = grenadeHud.current;
      if (!cur) return prev === null ? prev : null;
      if (prev && prev.name === cur.name && prev.charges === cur.charges && prev.max === cur.max && Math.round(prev.fill * 50) === Math.round(cur.fill * 50)) return prev;
      return { ...cur };
    }), 100);
    return () => window.clearInterval(t);
  }, []);
  if (!view) return null;
  const keys = normalizeBindings(bindings).keyboard;
  return (
    <div role="status" aria-label={`${view.name}: ${view.charges} of ${view.max} grenades`} className="grenade-hud pointer-events-none fixed bottom-[13.75rem] left-4 z-[35] w-40 font-mono text-[9px] text-foreground">
      <div className="flex items-center justify-between"><span style={{ color: view.color }}>{view.name}</span><span className="text-muted-foreground">[{keyName(keys.grenade)}] · [{keyName(keys.cycleGrenade)}]</span></div>
      <div className="mt-1 flex gap-1">
        {Array.from({ length: view.max }, (_, i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden border bg-background/70" style={{ borderColor: `${view.color}99` }}>
            <div className="h-full" style={{ background: view.color, width: `${i < view.charges ? 100 : i === view.charges ? view.fill * 100 : 0}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
