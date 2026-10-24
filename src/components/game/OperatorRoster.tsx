import { useEffect, useState } from "react";
import { ArrowLeft, Play, Plus, Shield, Sparkles } from "lucide-react";
import { activeSlot, currentUserId, listSlots, SLOT_COUNT, switchSlot, type SlotSummary } from "@/game/save-slots";
import { launchDestination } from "@/game/launch-flow";
import { operatorByClass } from "@/game/loadout";
import { rookieSetForClass } from "@/game/rookie-armor";
import { OperatorStage } from "./OperatorStage";
import type { PlayerProgression } from "@/game/progression";

/** Character-first launch screen (Stage 47): the selected Operator stands full-body in the centre of the screen in their
 * rookie armor; their set, tier and colour variation sit beside them; the three independent save slots run along the
 * bottom. Picking a slot previews it, Select loads it. Colour variations can be changed on the active save here. */
export function OperatorRoster({ progression, onSelect, onBack, onProgression }: {
  progression: PlayerProgression;
  onSelect: (save: PlayerProgression, route: ReturnType<typeof launchDestination>) => void;
  onBack: () => void;
  /** apply a change to the active save (the rookie colour variation) */
  onProgression?: (next: PlayerProgression) => void;
}) {
  const [slots, setSlots] = useState<SlotSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<number>(activeSlot());
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
  const record = slots.find((s) => s.slot === picked);
  const isActive = picked === activeSlot();
  // the active slot always shows the live save (so a variant change shows at once); other slots their saved summary
  const character = isActive ? progression.character ?? record?.character : record?.character;
  const empty = !character && (record?.empty ?? !isActive);
  const set = character ? rookieSetForClass(character.classId) : null;
  const op = character ? operatorByClass(character.classId) : null;

  return (
    <main className="operator-roster-scene fixed inset-0 overflow-hidden bg-background text-foreground" aria-label="Select operator">
      {/* the Operator: full height behind the panels */}
      <div className="absolute inset-0 md:left-[8%] md:right-[30%]" aria-hidden={!character}>
        {character ? <OperatorStage key={`${picked}-${character.classId}`} character={character} />
          : <div className="flex h-full items-center justify-center"><Sparkles size={96} strokeWidth={0.8} className="text-primary/40" /></div>}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(4,6,10,0.85))]" />

      <div className="relative z-10 flex h-full flex-col px-4 py-5 sm:px-10 sm:py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button type="button" onClick={onBack} className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary"><ArrowLeft size={16} /> Main menu</button>
            <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-primary">World Fracture / Operator archive</p>
            <h1 className="mt-2 font-mono text-2xl font-bold uppercase tracking-widest sm:text-4xl">Choose your operator</h1>
          </div>
        </div>

        {/* set panel: right side on desktop, under the title on phones */}
        <section className="pointer-events-auto mt-4 w-full max-w-sm self-end border border-foreground/15 bg-background/70 p-5 backdrop-blur-md md:absolute md:right-10 md:top-28" aria-label="Operator armor">
          {character && set && op ? <>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Operator {String(picked).padStart(2, "0")} · {op.className}</p>
            <h2 className="mt-1 font-mono text-4xl font-bold uppercase tracking-wider" style={{ color: character.appearance.visor }}>{op.name}</h2>
            <p className="font-mono text-xs uppercase tracking-widest text-foreground/70">{character.appearance.callsign}</p>
            <div className="mt-4 border-t border-foreground/10 pt-4">
              <div className="flex items-center justify-between"><h3 className="font-mono text-lg font-semibold uppercase">{set.name}</h3><span className="border border-foreground/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-foreground/80">Common</span></div>
              <p className="mt-1 font-mono text-xs uppercase tracking-widest" style={{ color: character.appearance.visor }}>{set.tagline}</p>
              <p className="mt-2 text-sm text-muted-foreground">{set.description}</p>
              <ul className="mt-3 space-y-1 text-xs text-foreground/80">{set.pieces.map((p) => <li key={p} className="flex gap-2"><span className="text-primary">▸</span>{p}</li>)}</ul>
            </div>
            <div className="mt-4 border-t border-foreground/10 pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Colourways · found or bought in the world</p>
              <p className="mt-2 text-[11px] text-muted-foreground">You start in {set.variants[0]!.name.toLowerCase()} colours. {set.variants.slice(1).map((v) => v.name).join(" and ")} {set.variants.length > 2 ? "are" : "is"} unlocked later as shaders from shops, contracts and hidden encounters, and can be applied to any piece.</p>
              <p className="mt-3 text-[11px] text-muted-foreground">Higher-tier armor found in the world replaces rookie pieces as you equip it.</p>
            </div>
          </> : <>
            <h2 className="font-mono text-2xl font-bold uppercase">{empty ? "New operator" : `Operator ${picked}`}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{empty ? "An empty save slot. Create an operator: they start in their own Common-tier rookie armor." : record?.summary}</p>
          </>}
          <button type="button" disabled={busy || slots.length === 0} onClick={() => void select(picked)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 bg-primary font-mono text-sm font-semibold uppercase tracking-[0.25em] text-primary-foreground transition hover:brightness-110 disabled:opacity-50">
            <Play size={16} /> {empty ? "Create" : "Deploy"}
          </button>
        </section>

        <div className="mt-auto" />
        {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
        {/* the three independent saves */}
        <div className="pointer-events-auto grid grid-cols-3 gap-2 sm:gap-3 md:max-w-3xl" aria-label="Independent operator save slots">
          {Array.from({ length: SLOT_COUNT }, (_, i) => {
            const slot = i + 1;
            const r = slots.find((s) => s.slot === slot);
            const isEmpty = r?.empty ?? (slot !== activeSlot());
            const current = slot === activeSlot();
            const ch = current ? progression.character ?? r?.character : r?.character;
            const name = isEmpty ? "Create operator" : ch?.appearance.callsign || ch?.displayName || r?.label || `Operator ${slot}`;
            const accent = ch?.appearance.visor;
            return <div key={slot} className={`operator-roster-card relative flex flex-col border bg-background/70 backdrop-blur-md transition ${picked === slot ? "border-primary bg-primary/10" : "border-foreground/20 hover:border-primary/60"}`}>
              <button type="button" onClick={() => setPicked(slot)} aria-pressed={picked === slot} className="flex flex-1 flex-col gap-1 p-3 text-left sm:p-4">
                <span className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-primary">Operator {String(slot).padStart(2, "0")}{isEmpty ? <Plus size={16} /> : <Shield size={16} style={accent ? { color: accent } : undefined} />}</span>
                <span className="truncate font-mono text-sm font-semibold uppercase sm:text-base">{name}</span>
                <span className="line-clamp-2 text-[11px] text-muted-foreground">{isEmpty ? "Fresh mission / separate save" : ch ? `${operatorByClass(ch.classId).name} · ${rookieSetForClass(ch.classId).name}` : r?.summary}</span>
              </button>
              <button type="button" disabled={busy || slots.length === 0} onClick={() => void select(slot)} className="flex min-h-10 items-center justify-between border-t border-foreground/15 px-3 font-mono text-[10px] uppercase tracking-widest hover:bg-primary/15 disabled:opacity-50 sm:px-4">
                <span className="hidden sm:inline">{current ? "Active save" : `Save slot ${slot}`}</span><span className="flex items-center gap-1 text-primary"><Play size={12} /> {isEmpty ? "Create" : "Select"}</span>
              </button>
            </div>;
          })}
        </div>
      </div>
    </main>
  );
}
