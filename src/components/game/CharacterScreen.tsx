import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { OperatorPreview } from "./OperatorPreview";
import { SLOT_NAME, characterSheet, collections, equipItem, equipOptions, itemTooltip, tierOf, TIER_COLOR, triumphs } from "@/game/character-sheet";
import { classById, operatorByClass, subclassById, type AppearanceDefinition, type ClassId, type SubclassId } from "@/game/loadout";
import type { GearItem, GearSlot } from "@/game/inventory";
import type { PlayerProgression } from "@/game/progression";
import { xpRequiredForLevel } from "@/game/xp";

export type CharacterTab = "CHARACTER" | "COLLECTIONS" | "TRIUMPHS";

/** Destiny-style character menu (layout reference: docs/ui-references.md). Weapons left, the live operator centre, armor and Power right;
 * hover an item for its card, click a slot to swap. Collections and Triumphs are derived from the save (character-sheet.ts).
 * Inventory and Settings open the existing windows. Esc closes. */
export function CharacterScreen({ progression, onProgression, classId, subclassId, appearance, onClose, onInventory, onSettings, initialTab = "CHARACTER" }: {
  progression: PlayerProgression; onProgression: (next: PlayerProgression) => void; classId: ClassId; subclassId: SubclassId; appearance: AppearanceDefinition;
  onClose: () => void; onInventory: () => void; onSettings: () => void; initialTab?: CharacterTab;
}) {
  const [tab, setTab] = useState<CharacterTab>(initialTab);
  const [hover, setHover] = useState<GearItem | null>(null);
  const [picking, setPicking] = useState<GearSlot | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); if (picking) setPicking(null); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking, onClose]);
  const sheet = characterSheet(progression);
  const op = operatorByClass(classId), sub = subclassById(subclassId), cls = classById(classId);
  const need = xpRequiredForLevel(progression.level);
  const tabs: { id: CharacterTab | "INVENTORY" | "SETTINGS"; label: string }[] = [{ id: "COLLECTIONS", label: "Collections" }, { id: "TRIUMPHS", label: "Triumphs" }, { id: "CHARACTER", label: "Character" }, { id: "INVENTORY", label: "Inventory" }];
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden text-foreground char-screen" role="dialog" aria-modal="true" aria-label="Character">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#2c4a57]/70 px-4 py-2 backdrop-blur-sm sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center border border-white/30 bg-black/30 font-mono text-lg" style={{ color: cls.color }}>◈</div>
          <div>
            <p className="font-mono text-lg font-semibold leading-none">{op.callsign}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">// Level {progression.level} / <span className="text-[#7fe0ff]">◆{sheet.power}</span></p>
            <div className="mt-1 h-1 w-40 bg-white/15"><div className="h-1 bg-[#6fcf6a]" style={{ width: `${Math.min(100, (progression.xp / Math.max(1, need)) * 100)}%` }} /></div>
          </div>
        </div>
        <nav className="flex items-center gap-1" aria-label="Character sections">
          {tabs.map((t) => <button key={t.id} type="button" onClick={() => (t.id === "INVENTORY" ? onInventory() : setTab(t.id as CharacterTab))} className={`border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] ${tab === t.id ? "border-white text-white" : "border-transparent text-white/50 hover:text-white/80"}`}>{t.label}</button>)}
          <button type="button" onClick={onSettings} className="px-2 py-2 text-white/60 hover:text-white" aria-label="Settings"><Settings2 className="size-4" /></button>
        </nav>
      </header>

      <main className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-8">
        {tab === "CHARACTER" && <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
          <section className="flex flex-row gap-3 md:flex-col" aria-label="Subclass and weapons">
            <div className="grid size-20 rotate-45 place-items-center border-2 border-white/60 bg-white/10" title={`${sub.name} — ${sub.description}`} style={{ boxShadow: `0 0 18px ${cls.color}55` }}>
              <span className="-rotate-45 text-center font-mono text-[9px] uppercase leading-tight tracking-[0.1em]" style={{ color: cls.color }}>{sub.name.split(" ")[0]}</span>
            </div>
            {sheet.weapons.map(({ slot, item }) => <Slot key={slot} slot={slot} item={item} onHover={setHover} onPick={setPicking} />)}
          </section>
          <section className="relative min-h-[18rem]" aria-label="Operator">
            <OperatorPreview appearance={appearance} classId={classId} />
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">{op.className} · {sub.name}</p>
          </section>
          <section className="flex flex-col gap-3" aria-label="Power and armor">
            <div className="flex items-center justify-end gap-3 font-mono text-xs text-white/70">{sheet.currencies.map((c) => <span key={c.name} title={c.name}>◇ {c.amount}</span>)}</div>
            <div className="text-right"><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#7fe0ff]">Power</p><p className="font-mono text-4xl font-semibold text-[#7fe0ff]">◆{sheet.power}</p></div>
            <div className="flex flex-row flex-wrap gap-3 md:flex-col md:items-end">{sheet.armor.map(({ slot, item }) => <Slot key={slot} slot={slot} item={item} onHover={setHover} onPick={setPicking} />)}</div>
            <div className="mt-1 space-y-1">{sheet.attributes.map((a) => <div key={a.label} className="flex items-center justify-end gap-2 font-mono text-[11px]"><span className="text-white/60">{a.label}</span><span className="w-8 text-right">{a.value}</span><div className="h-1.5 w-24 bg-white/10"><div className="h-1.5 bg-white/80" style={{ width: `${Math.min(100, (a.value / 60) * 100)}%` }} /></div></div>)}</div>
          </section>
        </div>}

        {tab === "COLLECTIONS" && <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-3">
          {collections(progression).map((c) => <div key={c.id} className="border border-white/15 bg-black/30 p-4 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/70">{c.label}</p>
            <p className="mt-3 font-mono text-2xl">{c.owned}{c.total ? <span className="text-white/40"> / {c.total}</span> : null}</p>
            {c.total > 0 && <div className="mt-3 h-1 bg-white/10"><div className="h-1 bg-[#cdae33]" style={{ width: `${(c.owned / c.total) * 100}%` }} /></div>}
          </div>)}
        </div>}

        {tab === "TRIUMPHS" && (() => { const t = triumphs(progression); return <div className="mx-auto max-w-4xl">
          <div className="mb-4 flex items-end justify-between border-b border-white/10 pb-2"><p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/60">Triumphs</p><p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Total score <span className="ml-2 text-2xl text-white">{t.score}</span></p></div>
          <div className="grid gap-2 sm:grid-cols-2">{t.list.map((x) => { const done = x.done >= x.goal; return <div key={x.id} className={`border p-3 ${done ? "border-[#cdae33]/70 bg-[#cdae33]/10" : "border-white/15 bg-black/30"}`}>
            <div className="flex justify-between"><p className="font-semibold">{x.title}</p><p className="font-mono text-[11px] text-white/60">{x.score}</p></div>
            <p className="mt-1 text-xs text-white/60">{x.detail}</p>
            <div className="mt-2 flex items-center gap-2"><div className="h-1 flex-1 bg-white/10"><div className="h-1 bg-white/80" style={{ width: `${(x.done / Math.max(1, x.goal)) * 100}%` }} /></div><span className="font-mono text-[10px] text-white/60">{x.done}/{x.goal}</span></div>
          </div>; })}</div>
        </div>; })()}

        {hover && !picking && <ItemCard item={hover} className="pointer-events-none fixed bottom-14 left-1/2 z-10 w-[min(92vw,22rem)] -translate-x-1/2" />}
        {picking && <SlotPicker slot={picking} progression={progression} onPick={(id) => { onProgression(equipItem(progression, picking, id)); setPicking(null); }} onClose={() => setPicking(null)} />}
      </main>
      <footer className="flex justify-end gap-4 border-t border-white/10 bg-black/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-white/60 sm:px-8">
        <span>Click a slot to swap gear</span><button type="button" onClick={onClose} className="hover:text-white">[Esc] Dismiss</button>
      </footer>
    </div>
  );
}

function Slot({ slot, item, onHover, onPick }: { slot: GearSlot; item: GearItem | null; onHover: (i: GearItem | null) => void; onPick: (s: GearSlot) => void }) {
  const color = item ? TIER_COLOR[tierOf(item)] : "#ffffff22";
  return <button type="button" onClick={() => onPick(slot)} onMouseEnter={() => onHover(item)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(item)} onBlur={() => onHover(null)}
    className="relative size-16 shrink-0 border-2 bg-black/40 text-left transition hover:brightness-125 focus:outline focus:outline-2 focus:outline-white sm:size-[4.5rem]" style={{ borderColor: color, background: item ? `linear-gradient(160deg, ${color}aa, #0b0f14 85%)` : undefined }} aria-label={`${SLOT_NAME[slot]}: ${item ? `${item.name}, power ${item.power}` : "empty"}`}>
    <span className="absolute left-1 top-1 font-mono text-[8px] uppercase tracking-[0.1em] text-white/70">{SLOT_NAME[slot].split(" ")[0]}</span>
    {item && <span className="absolute bottom-1 right-1 font-mono text-[11px] text-white">{item.power}</span>}
    {!item && <span className="absolute inset-0 grid place-items-center text-white/30">+</span>}
  </button>;
}

export function ItemCard({ item, className = "" }: { item: GearItem; className?: string }) {
  const t = itemTooltip(item);
  return <div className={`border border-white/10 bg-[#0d1116]/95 shadow-2xl ${className}`} role="tooltip">
    <div className="px-3 py-2" style={{ background: t.color }}><p className="font-mono text-base font-semibold uppercase tracking-[0.06em] text-white">{t.title}</p><p className="text-[11px] text-white/80">{t.type}</p></div>
    <div className="flex items-baseline gap-2 border-b border-white/10 px-3 py-2"><span className="font-mono text-3xl">{t.power}</span><span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">Power</span></div>
    <p className="px-3 pt-2 text-[11px] italic text-white/60">Source: {t.source}</p>
    <div className="space-y-1 px-3 py-2">{t.stats.map((s) => <div key={s.label} className="flex items-center gap-2 text-[11px]"><span className="w-16 text-right text-white/60">{s.label}</span><div className="h-1.5 flex-1 bg-white/10"><div className="h-1.5 bg-white/85" style={{ width: `${Math.min(100, (s.value / s.max) * 100)}%` }} /></div><span className="w-8 font-mono">{s.value}</span></div>)}</div>
    {t.perks.length > 0 && <div className="flex flex-wrap gap-1 border-t border-white/10 px-3 py-2">{t.perks.map((p) => <span key={p} className="border border-white/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white/80">{p}</span>)}</div>}
  </div>;
}

function SlotPicker({ slot, progression, onPick, onClose }: { slot: GearSlot; progression: PlayerProgression; onPick: (id: string) => void; onClose: () => void }) {
  const options = equipOptions(progression, slot);
  const [focus, setFocus] = useState<GearItem | null>(options[0] ?? null);
  return <div className="fixed inset-0 z-20 grid place-items-center bg-black/60 p-4" onClick={onClose}>
    <div className="grid w-full max-w-3xl gap-3 border border-white/15 bg-[#11171d]/95 p-4 sm:grid-cols-[minmax(0,1fr)_22rem]" onClick={(e) => e.stopPropagation()}>
      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.3em] text-white/70">{SLOT_NAME[slot]}</p>
        {options.length === 0 && <p className="text-sm text-white/60">Nothing for this slot yet — loot it in the world.</p>}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">{options.map((i) => { const on = progression.equippedGear[slot] === i.id; return <button key={i.id} type="button" onMouseEnter={() => setFocus(i)} onFocus={() => setFocus(i)} onClick={() => onPick(i.id)}
          className={`relative aspect-square border-2 ${on ? "outline outline-2 outline-white" : ""}`} style={{ borderColor: TIER_COLOR[tierOf(i)], background: `linear-gradient(160deg, ${TIER_COLOR[tierOf(i)]}aa, #0b0f14 85%)` }} aria-label={`${i.name}, power ${i.power}${on ? ", equipped" : ""}`}>
          <span className="absolute bottom-1 right-1 font-mono text-[11px]">{i.power}</span>{on && <span className="absolute left-1 top-1 font-mono text-[8px] uppercase">Equipped</span>}
        </button>; })}</div>
      </div>
      {focus && <ItemCard item={focus} />}
    </div>
  </div>;
}

