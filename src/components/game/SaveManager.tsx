import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Cloud, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { PlayerProgression } from "@/game/progression";
import { listSlots, renameSlot, switchSlot, type SlotSummary } from "@/game/save-slots";

/** Multi-slot save manager on top of the existing cloud save: the active slot is the live synced save. */
export function SaveManager({ progression, onProgression, onBack }: { progression: PlayerProgression; onProgression: (p: PlayerProgression) => void; onBack: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotSummary[] | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (uid: string | null) => {
    try { setSlots(await listSlots(uid, progression)); } catch { setNote("Couldn't load save slots."); }
  }, [progression]);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { const id = data.session?.user.id ?? null; setUserId(id); void refresh(id); }); }, [refresh]);

  const load = async (slot: number) => {
    setBusy(true); setNote("");
    try { const next = await switchSlot(userId, progression, slot); onProgression(next); setConfirm(null); setNote(`Slot ${slot} loaded.`); }
    catch { setNote("Switch failed — your current game was not changed."); }
    setBusy(false);
  };

  return (
    <div className="deployment-field fixed inset-0 z-[55] overflow-y-auto p-4 text-foreground lg:p-6" role="dialog" aria-modal="true" aria-label="Save manager">
      <header className="flex items-center justify-between border-b border-foreground/15 pb-3">
        <div className="flex items-center gap-3"><Button variant="ghost" size="sm" onClick={onBack} className="ui-focus"><ArrowLeft /> Back</Button><h1 className="font-mono text-xl uppercase tracking-[0.25em]">Save slots</h1></div>
        <p className="ui-kicker flex items-center gap-2">{userId ? <><Cloud className="size-3" /> Cloud synced</> : <><HardDrive className="size-3" /> This device only — sign in to sync</>}</p>
      </header>
      <p className="mx-auto mt-4 max-w-4xl text-xs text-muted-foreground">Your game auto-saves continuously. The active slot is the one that syncs; switching parks your current game safely in its slot.</p>
      <div className="mx-auto mt-4 grid max-w-4xl gap-3 sm:grid-cols-3">
        {(slots ?? []).map((s) => (
          <section key={s.slot} className={`flex min-h-48 flex-col justify-between border p-4 ${s.active ? "border-primary bg-primary/5" : "border-foreground/15 bg-background/60"}`}>
            <div>
              <p className="ui-kicker">Slot {s.slot}{s.active ? " · Active" : ""}</p>
              <input aria-label={`Slot ${s.slot} name`} defaultValue={s.label} maxLength={32} onBlur={(e) => { if (e.target.value !== s.label) void renameSlot(userId, s.slot, e.target.value, progression).then(() => refresh(userId)); }} className="mt-1 w-full bg-transparent font-mono text-lg uppercase outline-none focus:text-primary" />
              <p className="mt-1 text-xs text-muted-foreground">{s.summary}</p>
              {s.updatedAt && !s.active && <p className="text-[11px] text-muted-foreground">Saved {new Date(s.updatedAt).toLocaleString()}</p>}
            </div>
            {!s.active && (confirm === s.slot
              ? <Button className="mt-3 rounded-none" disabled={busy} onClick={() => load(s.slot)}>{s.empty ? "Start new game here" : "Confirm load"}</Button>
              : <Button variant="outline" className="mt-3 rounded-none" onClick={() => setConfirm(s.slot)}>{s.empty ? "New game" : "Load"}</Button>)}
          </section>
        ))}
      </div>
      {note && <p className="mx-auto mt-3 max-w-4xl text-xs text-primary">{note}</p>}
    </div>
  );
}
