import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AREAS, type ActivityDef, type Payout, type Run } from "@/game/activities";

/** In-world tracker for the running activity: objective, progress and the stage clock. */
export function ActivityTracker({ def, run, onAbandon }: { def: ActivityDef; run: Run; onAbandon: () => void }) {
  const [, setNow] = useState(0);
  useEffect(() => { const t = setInterval(() => setNow((n) => n + 1), 500); return () => clearInterval(t); }, []);
  const o = def.stages[run.stage]!;
  const limit = "timeLimit" in o ? o.timeLimit : 0;
  const left = limit ? Math.max(0, Math.ceil(limit - (Date.now() - run.stageStartedAt) / 1000)) : null;
  const need = o.kind === "deliver" ? 1 : run.need;
  return <div className="pointer-events-auto absolute left-3 top-28 z-30 w-64 border border-primary/60 bg-background/80 p-3 font-mono text-[10px] backdrop-blur" role="status" aria-label="Active activity">
    <p className="text-[9px] uppercase tracking-[0.25em] text-primary">{AREAS[def.area]?.name} · {def.kind}</p>
    <p className="mt-1 text-sm font-semibold">{def.name}</p>
    <p className="mt-1 text-muted-foreground">Stage {run.stage + 1}/{def.stages.length} · {o.label}</p>
    <p className="mt-1">{o.kind === "deliver" ? (run.carrying ? "Cargo picked up — deliver it" : "Go to the pickup") : `${Math.min(run.progress, need)} / ${need}`}{left !== null && <span className={`ml-2 ${left < 15 ? "text-destructive" : "text-primary"}`}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}</p>
    {def.challenge && <p className="mt-1 text-[9px] text-primary/80">Bonus: {def.challenge.label}</p>}
    <Button size="sm" variant="outline" className="mt-2 h-6 text-[9px]" onClick={onAbandon}>Abandon (attempt is not refunded)</Button>
  </div>;
}

export type ActivityResult = { def: ActivityDef; ok: boolean; reason?: string; payout?: Payout };
export function ActivityResultPanel({ result, onDone }: { result: ActivityResult; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 9000); return () => clearTimeout(t); }, [onDone]);
  const p = result.payout;
  return <div className="pointer-events-auto absolute left-1/2 top-24 z-40 w-80 -translate-x-1/2 border border-primary bg-background/90 p-4 font-mono text-xs backdrop-blur" role="alert">
    <p className="text-[9px] uppercase tracking-[0.3em] text-primary">{result.ok ? "Activity complete" : "Activity failed"}</p>
    <p className="mt-1 text-base font-semibold">{result.def.name}</p>
    {result.ok && p ? <ul className="mt-2 space-y-1">
      <li>+{p.nex} Nex · +{p.xp} XP · +{p.rep} reputation</li>
      {Object.entries(p.materials).map(([k, v]) => <li key={k}>+{v} {k}</li>)}
      {p.shader && <li className="text-primary">Shader unlocked: {p.shader}</li>}
      {p.bonus ? <li className="text-primary">Bonus challenge met (+25%)</li> : result.def.challenge && <li className="text-muted-foreground">Bonus missed: {result.def.challenge.label}</li>}
      <li className="text-muted-foreground">Cooldown started — see the Activity Board.</li>
    </ul> : <p className="mt-2 text-muted-foreground">{result.reason}. The attempt was spent and is not refunded; other activities stay available.</p>}
    <Button size="sm" className="mt-3" onClick={onDone}>Close</Button>
  </div>;
}
