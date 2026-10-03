import { useEffect } from "react";
import { AWAKENING_OBJECTIVE, type AwakeningEvent, type AwakeningRun } from "@/game/missions/awakening";
import { Button } from "@/components/ui/button";
import { useVoiceLine } from "./useVoiceLine";

export function AwakeningOverlay({ run, onEvent }: { run: AwakeningRun; onEvent: (e: AwakeningEvent) => void }) {
  useVoiceLine(`awakening-${run.state}`, "NOVA", run.line, "critical");
  useEffect(() => {
    if (run.state !== "LOOT") return;
    const onKey = (e: KeyboardEvent) => { if (e.code === "KeyE" || e.code === "Enter") onEvent({ type: "ACK" }); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run.state, onEvent]);
  return (
    <div className="pointer-events-none fixed left-1/2 top-16 z-30 w-[min(92vw,460px)] -translate-x-1/2 text-center">
      {run.alert && <p className="mb-2 animate-pulse font-mono text-[10px] uppercase tracking-[0.3em] text-destructive">{run.alert}</p>}
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Neon Core · Awakening</p>
      <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-foreground">{AWAKENING_OBJECTIVE[run.state]}</p>
      {run.line && <p className="mt-1 text-xs italic text-muted-foreground">NOVA: “{run.line}”</p>}
      {run.state === "HOLD" && <div className="mx-auto mt-2 h-1 w-48 bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${run.hold}%` }} /></div>}
      {run.state === "LOOT" && <Button size="sm" className="pointer-events-auto mt-3" onClick={() => onEvent({ type: "ACK" })}>Collect gear (E)</Button>}
    </div>
  );
}
