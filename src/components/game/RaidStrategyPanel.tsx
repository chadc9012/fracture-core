import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DUNGEONS } from "@/game/dungeons";
import { getRaidStrategy } from "@/lib/raid-strategy.functions";

export function RaidStrategyPanel({ onClose }: { onClose: () => void }) {
  const requestStrategy = useServerFn(getRaidStrategy);
  const [dungeon, setDungeon] = useState(DUNGEONS[0]?.name ?? "Sunken Arcology Vaults");
  const [playerClass, setPlayerClass] = useState("Titan");
  const [weapons, setWeapons] = useState("Standard pulse rifle");
  const [fireteam, setFireteam] = useState("Titan, Hunter, Warlock");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!weapons.trim() || !fireteam.trim()) { setError("Enter your weapons and team composition."); return; }
    setLoading(true); setError("");
    try {
      const response = await requestStrategy({ data: { dungeon, playerClass, weapons, fireteam } });
      setResult(response.recommendation); setError(response.error);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Strategy planning is unavailable."); }
    finally { setLoading(false); }
  };

  return <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-md">
    <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto border border-border bg-card p-5 shadow-2xl sm:p-7" aria-label="Fireteam Strategy">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-4"><div><p className="font-mono text-[9px] uppercase tracking-[0.32em] text-primary">Raid intelligence</p><h2 className="mt-1 text-2xl font-semibold">Fireteam Strategy</h2></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close strategy panel"><X /></Button></header>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Dungeon<select value={dungeon} onChange={(event) => setDungeon(event.target.value)} className="mt-1 h-10 w-full border border-input bg-background px-3 text-foreground">{DUNGEONS.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Class<select value={playerClass} onChange={(event) => setPlayerClass(event.target.value)} className="mt-1 h-10 w-full border border-input bg-background px-3 text-foreground"><option>Titan</option><option>Hunter</option><option>Warlock</option></select></label>
        <label className="text-xs text-muted-foreground">Equipped weapons<input value={weapons} onChange={(event) => setWeapons(event.target.value)} maxLength={600} className="mt-1 h-10 w-full border border-input bg-background px-3 text-foreground" /></label>
        <label className="text-xs text-muted-foreground">Team composition<input value={fireteam} onChange={(event) => setFireteam(event.target.value)} maxLength={600} className="mt-1 h-10 w-full border border-input bg-background px-3 text-foreground" /></label>
      </div>
      {error && <p className="mt-3 border-l-2 border-destructive pl-3 text-xs text-destructive">{error}</p>}
      {result && <pre className="mt-4 whitespace-pre-wrap border border-border bg-background/70 p-4 font-mono text-xs leading-relaxed text-foreground">{result}</pre>}
      <footer className="mt-5 flex justify-end"><Button onClick={analyze} disabled={loading}>{loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{loading ? "Planning" : result ? "Plan again" : "Generate strategy"}</Button></footer>
    </section>
  </div>;
}