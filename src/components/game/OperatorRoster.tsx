import { useEffect, useState } from "react";
import { ArrowLeft, Play, Plus, Shield, Compass, Sparkles } from "lucide-react";
import { activeSlot, currentUserId, listSlots, SLOT_COUNT, switchSlot, type SlotSummary } from "@/game/save-slots";
import { launchDestination } from "@/game/launch-flow";
import type { PlayerProgression } from "@/game/progression";

/** Character-first launch screen: slots are isolated saves, not shared character skins. */
export function OperatorRoster({ progression, onSelect, onBack }: {
  progression: PlayerProgression;
  onSelect: (save: PlayerProgression, route: ReturnType<typeof launchDestination>) => void;
  onBack: () => void;
}) {
  const [slots, setSlots] = useState<SlotSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    currentUserId().then((user) => listSlots(user, progression)).then((rows) => { if (alive) setSlots(rows); })
      .catch(() => { if (alive) setError("Save slots could not be loaded. Check your connection or storage permissions."); });
    return () => { alive = false; };
  }, [progression]);
  async function select(slot: number) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const save = slot === activeSlot() ? progression : await switchSlot(await currentUserId(), progression, slot);
      onSelect(save, launchDestination(save));
    } catch { setError("Unable to switch operators. Your current save has not been discarded."); setBusy(false); }
  }
  return (
    <main className="operator-roster-scene fixed inset-0 overflow-y-auto bg-background text-foreground" aria-label="Select operator">
      <div className="relative z-10 mx-auto flex min-h-full max-w-6xl flex-col px-6 py-10 sm:px-12">
        <button type="button" onClick={onBack} className="mb-12 flex items-center gap-2 self-start font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary"><ArrowLeft size={16} /> Main menu</button>
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-primary">World Fracture / Operator archive</p>
        <h1 className="mt-3 font-mono text-3xl font-bold uppercase tracking-widest sm:text-5xl">Choose your operator</h1>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">Each operator has an independent save, gear, mission progress and world state. Finish First Resonance once to unlock the Destination Director for that operator.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Independent operator save slots">
          {Array.from({ length: SLOT_COUNT }, (_, i) => {
            const slot = i + 1;
            const record = slots.find((s) => s.slot === slot);
            const empty = record?.empty ?? (slot !== activeSlot());
            const current = slot === activeSlot();
            return <button key={slot} type="button" disabled={busy || slots.length === 0} onClick={() => void select(slot)} className="operator-roster-card group relative flex min-h-80 flex-col justify-between overflow-hidden border border-foreground/20 bg-background/65 p-6 text-left backdrop-blur-md transition duration-200 hover:-translate-y-1 hover:border-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
              <div><div className="flex items-center justify-between"><span className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Operator {String(slot).padStart(2, "0")}</span>{empty ? <Plus size={22} /> : <Shield size={22} />}</div>
                <div className="mt-8 flex h-24 items-center justify-center border-y border-foreground/10 bg-gradient-to-r from-transparent via-primary/10 to-transparent"><span className="font-mono text-5xl font-light tracking-[0.2em] text-primary/60">{empty ? <Sparkles size={48} strokeWidth={1} /> : <Shield size={54} strokeWidth={1} />}</span></div><h2 className="mt-6 font-mono text-xl font-semibold uppercase">{empty ? "Create operator" : record?.label || `Operator ${slot}`}</h2>
                <p className="mt-2 text-xs text-muted-foreground">{empty ? "Fresh mission / separate save" : record?.summary}</p><p className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary/80"><Compass size={12}/>{empty ? "First Resonance · New Journey" : current ? "Current operator · Resume or Director" : "Load this operator’s journey"}</p>
              </div>
              <div className="mt-8 flex items-center justify-between border-t border-foreground/15 pt-4 font-mono text-[11px] uppercase tracking-widest"><span>{current ? "Active save" : `Save slot ${slot}`}</span><span className="flex items-center gap-2 text-primary"><Play size={14} /> {empty ? "Create" : "Select"}</span></div>
            </button>;
          })}
        </div>
        {error && <p role="alert" className="mt-6 text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
