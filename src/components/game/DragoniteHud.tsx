import { useEffect, useState } from "react";
import { dragoniteHud } from "@/game/client-input";
import { keyName, type Bindings } from "@/game/bindings";

/** Cooldown strip for the bonded Operator's Dragonite abilities. Hidden until the Covenant is claimed. */
export function DragoniteHud(_props: { bindings?: Bindings | undefined }) {
  const [view, setView] = useState(dragoniteHud.current);
  useEffect(() => { const t = window.setInterval(() => setView(dragoniteHud.current ? dragoniteHud.current.map((x) => ({ ...x })) : null), 100); return () => window.clearInterval(t); }, []);
  if (!view) return null;
  return (
    <div role="status" aria-label="Dragonite abilities" className="pointer-events-none fixed bottom-32 left-3 z-[35] w-40 font-mono text-[9px] text-foreground">
      {view.map((a) => (
        <div key={a.name} className="mt-1">
          <div className="flex items-center justify-between"><span>{a.name}</span><span className="text-muted-foreground">[{keyName(a.key)}]</span></div>
          <div className="h-1 overflow-hidden border border-primary/60 bg-background/70"><div className="h-full bg-primary" style={{ width: `${a.max > 0 ? Math.max(0, 1 - a.cd / a.max) * 100 : 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
