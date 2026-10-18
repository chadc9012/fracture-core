import { journalFor } from "@/game/encounter-journal";
import type { PlayerProgression } from "@/game/progression";

/** Unique-encounter journal: what the Operator has found. Undiscovered encounters stay hidden; clues show "???" until found. Vyrak has its own section. */
export function EncounterJournal({ progression }: { progression: PlayerProgression }) {
  const entries = journalFor(progression, progression.identityClass ?? null);
  const special = entries.filter((e) => e.special), rest = entries.filter((e) => !e.special);
  const card = (e: (typeof entries)[number]) => <div key={e.id} className={`border p-3 ${e.special ? "border-primary/70" : "border-border"}`}>
    <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{e.name}</p><span className="font-mono text-[9px] uppercase text-muted-foreground">{e.completed ? "Cleared" : e.discovered ? "Found" : "Rumour"}</span></div>
    <ul className="mt-2 space-y-1 font-mono text-[10px] text-muted-foreground">{e.clues.map((c, i) => <li key={i} className={c.known ? "text-foreground" : ""}>{c.known ? "• " : "◦ "}{c.text}</li>)}</ul>
    {e.hint && <p className="mt-2 font-mono text-[10px] text-primary">{e.hint}</p>}
    {e.mastery > 0 && <p className="mt-1 font-mono text-[10px] text-primary/80">Mastery records: {e.mastery}</p>}
  </div>;
  return <section className="mt-6 border border-border p-4" aria-label="Encounter journal">
    <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Encounter journal</p>
    {entries.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Nothing recorded yet. Rumours, scarred ground and strange signals will appear here as you find them.</p> : <>
      {special.length > 0 && <div className="mt-3"><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">Special unique encounter</p><div className="mt-2 grid gap-3">{special.map(card)}</div></div>}
      {rest.length > 0 && <div className="mt-3 grid gap-3 md:grid-cols-2">{rest.map(card)}</div>}
    </>}
  </section>;
}
