import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getRaidStrategy } from "@/lib/raid-strategy.functions";

export function RaidStrategyPanel({ onClose }: { onClose: () => void }) {
  const requestStrategy = useServerFn(getRaidStrategy);
  const [encounter, setEncounter] = useState("The Core Breach");
  const [fireteam, setFireteam] = useState("Titan, Hunter, Warlock");
  const [combatLog, setCombatLog] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (combatLog.trim().length < 20) { setError("Add at least a few combat events before analysis."); return; }
    setLoading(true); setError("");
    try {
      const response = await requestStrategy({ data: { encounter, fireteam, combatLog } });
      setResult(response.recommendation); setError(response.error);
    } catch { setError("The strategy uplink could not process this log."); }
    finally { setLoading(false); }
  };

  return <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-md">
    <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto border border-border bg-card p-5 shadow-2xl sm:p-7" aria-label="Fireteam Strategy">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div><p className="font-mono text-[9px] uppercase tracking-[0.32em] text-primary">Raid intelligence</p><h2 className="mt-1 text-2xl font-semibold">Fireteam Strategy</h2></div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close strategy panel"><X /></Button>
      </header>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Encounter<input value={encounter} onChange={(e) => setEncounter(e.target.value)} className="mt-1 h-10 w-full border border-input bg-background px-3 text-foreground outline-none focus:border-primary" /></label>
        <label className="text-xs text-muted-foreground">Fireteam composition<input value={fireteam} onChange={(e) => setFireteam(e.target.value)} className="mt-1 h-10 w-full border border-input bg-background px-3 text-foreground outline-none focus:border-primary" /></label>
      </div>
      <label className="mt-4 block text-xs text-muted-foreground">Combat log<textarea value={combatLog} onChange={(e) => setCombatLog(e.target.value)} maxLength={12000} placeholder="Paste damage, deaths, phase timing, positioning, and ability-use events…" className="mt-1 min-h-44 w-full resize-y border border-input bg-background p-3 font-mono text-xs text-foreground outline-none focus:border-primary" /></label>
      {error && <p className="mt-3 border-l-2 border-destructive pl-3 text-xs text-destructive">{error}</p>}
      {result && <pre className="mt-4 whitespace-pre-wrap border border-border bg-background/70 p-4 font-mono text-xs leading-relaxed text-foreground">{result}</pre>}
      <footer className="mt-5 flex justify-end"><Button onClick={analyze} disabled={loading}>{loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{loading ? "Analyzing" : result ? "Analyze again" : "Generate strategy"}</Button></footer>
    </section>
  </div>;
}
