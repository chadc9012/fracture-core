import { useEffect, useState } from "react";
import { dashHud } from "@/game/client-input";
import { keyName, normalizeBindings, type Bindings } from "@/game/bindings";

/** Dash charges and recharge bar for the Operator dash. */
export function DashHud({ bindings }: { bindings?: Bindings | undefined }) {
  const [view, setView] = useState(dashHud.current);
  // poll the live dash state, but only re-render when it actually changed (fill is rounded to the bar's visible resolution)
  useEffect(() => {
    const t = window.setInterval(() => setView((prev) => {
      const cur = dashHud.current;
      if (!cur) return prev === null ? prev : null;
      if (prev && prev.name === cur.name && prev.charges === cur.charges && prev.max === cur.max && Math.round(prev.fill * 50) === Math.round(cur.fill * 50)) return prev;
      return { ...cur };
    }), 100);
    return () => window.clearInterval(t);
  }, []);
  if (!view) return null;
  const key = keyName(normalizeBindings(bindings).keyboard.dash);
  return (
    <div role="status" aria-label={`${view.name}: ${view.charges} of ${view.max} charges`} className="pointer-events-none fixed bottom-[11.5rem] left-4 z-[35] w-40 font-mono text-[9px] text-foreground">
      <div className="flex items-center justify-between"><span>{view.name}</span><span className="text-muted-foreground">[{key}]</span></div>
      <div className="mt-1 flex gap-1">
        {Array.from({ length: view.max }, (_, i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden border border-primary/60 bg-background/70">
            <div className="h-full bg-primary" style={{ width: `${i < view.charges ? 100 : i === view.charges ? view.fill * 100 : 0}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
