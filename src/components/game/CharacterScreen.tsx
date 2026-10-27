import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bounds, ContactShadows, useBounds } from "@react-three/drei";
import { useRef } from "react";
import type * as THREE from "three";
import { Operator } from "./Operator";
import { OperatorModel } from "./OperatorModel";
import { DEFAULT_ARSENAL } from "@/game/progression";
import { SLOT_NAME, characterSheet, collections, equipItem, equipOptions, sheetIfEquipped, triumphs, updateAppearance, type AppearancePatch } from "@/game/character-sheet";
import { CUSTOMIZATION_PALETTE, appearanceById } from "@/game/loadout";
import { colorwayFor } from "@/game/operator-colorway";
import { AttributeBars, CompareCards, GearTile, ItemCard } from "./GearUi";
import { classById, operatorByClass, subclassById, type AppearanceDefinition, type ClassId, type SubclassId } from "@/game/loadout";
import type { GearItem, GearSlot } from "@/game/inventory";
import type { PlayerProgression } from "@/game/progression";
import { xpRequiredForLevel } from "@/game/xp";
import { ENDINGS, campaignProgress } from "@/game/campaign";
import { BLADES, FOUNDRIES, equipBlade, ownedBlades, type BladeId } from "@/game/foundries";

export type CharacterTab = "CHARACTER" | "APPEARANCE" | "COLLECTIONS" | "TRIUMPHS" | "CAMPAIGN";

/** Destiny-style character menu (layout reference: docs/ui-references.md). Weapons left, the live operator centre, armor and Power right;
 * hover an item for its card, click a slot to swap. Collections and Triumphs are derived from the save (character-sheet.ts).
 * Inventory and Settings open the existing windows. Esc closes. */
export function CharacterScreen({ progression, onProgression, classId, subclassId, appearance, onAppearance, onClose, onInventory, onSettings, initialTab = "CHARACTER" }: {
  progression: PlayerProgression; onProgression: (next: PlayerProgression) => void; classId: ClassId; subclassId: SubclassId; appearance: AppearanceDefinition;
  /** the live operator's look changed (Appearance tab); the same values are saved on progression.character */
  onAppearance?: (next: AppearanceDefinition) => void;
  onClose: () => void; onInventory: () => void; onSettings: () => void; initialTab?: CharacterTab;
}) {
  const [tab, setTab] = useState<CharacterTab>(initialTab);
  const [hover, setHover] = useState<GearItem | null>(null);
  const [picking, setPicking] = useState<GearSlot | null>(null);
  // one stable listener (live check: re-subscribing on every parent render dropped an Esc press)
  const latest = useRef({ picking, onClose }); latest.current = { picking, onClose };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.preventDefault(); if (latest.current.picking) setPicking(null); else latest.current.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const sheet = characterSheet(progression);
  const op = operatorByClass(classId), sub = subclassById(subclassId), cls = classById(classId);
  const need = xpRequiredForLevel(progression.level);
  const tabs: { id: CharacterTab | "INVENTORY" | "SETTINGS"; label: string }[] = [{ id: "CAMPAIGN", label: "Campaign" }, { id: "COLLECTIONS", label: "Collections" }, { id: "TRIUMPHS", label: "Triumphs" }, { id: "CHARACTER", label: "Character" }, { id: "APPEARANCE", label: "Appearance" }, { id: "INVENTORY", label: "Inventory" }];
  return (
    <div className="wf-op fixed inset-0 z-50 flex flex-col overflow-hidden char-screen" role="dialog" aria-modal="true" aria-label="Character">
      <header className="wf-op-head flex-wrap">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center border border-white/30 bg-black/30 font-mono text-lg" style={{ color: cls.color }}>◈</div>
          <div>
            <p className="font-mono text-lg font-semibold leading-none">{op.callsign}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">// Level {progression.level} / <span className="text-[#7fe0ff]">◆{sheet.power}</span></p>
            <div className="mt-1 h-1 w-40 bg-white/15"><div className="h-1 bg-[#6fcf6a]" style={{ width: `${Math.min(100, (progression.xp / Math.max(1, need)) * 100)}%` }} /></div>
          </div>
        </div>
        <nav className="flex items-center gap-1" aria-label="Character sections">
          {tabs.map((t) => <button key={t.id} type="button" onClick={() => (t.id === "INVENTORY" ? onInventory() : setTab(t.id as CharacterTab))} className="wf-op-tab" aria-selected={tab === t.id}>{t.label}</button>)}
          <button type="button" onClick={onSettings} className="px-2 py-2 text-white/60 hover:text-white" aria-label="Settings"><Settings2 className="size-4" /></button>
        </nav>
      </header>

      <main className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-8">
        {tab === "CHARACTER" && <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
          <section className="flex flex-row flex-wrap items-start gap-3 md:flex-col" aria-label="Subclass and weapons">
            <div className="m-3 grid size-20 shrink-0 rotate-45 place-items-center border-2 bg-black/30" title={`${sub.name} — ${sub.description}`} style={{ borderColor: cls.color, boxShadow: `0 0 24px ${cls.color}66, inset 0 0 18px ${cls.color}44` }}>
              <span className="-rotate-45 text-center text-xs font-bold uppercase leading-tight tracking-[0.1em]" style={{ color: cls.color }}>{sub.name.split(" ")[0]}</span>
            </div>
            <p className="wf-op-kicker mt-2 hidden md:block">Weapons</p>
            {sheet.weapons.map(({ slot, item }) => <GearTile key={slot} size="lg" slot={slot} item={item} equipped={!!item} onHover={setHover} onClick={() => setPicking(slot)} />)}
            <BladePicker progression={progression} onProgression={onProgression} />
          </section>
          <section className="relative" aria-label="Operator">
            <div className="flex items-end justify-between px-2">
              <div><p className="wf-op-kicker">Level</p><p className="text-6xl font-bold leading-none text-white/25">{progression.level}</p></div>
              <div className="text-right"><p className="wf-op-kicker !text-[#7fe0ff]">Power</p><p className="text-6xl font-bold leading-none text-[#7fe0ff]">◆{sheet.power}</p></div>
            </div>
            <div className="wf-op-stage"><CharacterPreview appearance={appearance} classId={classId} progression={progression} /></div>
            <p className="mt-1 text-center text-sm font-semibold uppercase tracking-[0.3em] text-white/55">{op.className} · {sub.name}</p>
          </section>
          <section className="flex flex-col gap-3" aria-label="Power and armor">
            <div className="flex items-center justify-end gap-3 text-sm font-semibold text-white/70">{sheet.currencies.map((c) => <span key={c.name} title={c.name}>◇ {c.amount}</span>)}</div>
            <p className="wf-op-kicker hidden text-right md:block">Armor</p>
            <div className="flex flex-row flex-wrap gap-3 md:flex-col md:items-end">{sheet.armor.map(({ slot, item }) => <GearTile key={slot} size="lg" slot={slot} item={item} equipped={!!item} onHover={setHover} onClick={() => setPicking(slot)} />)}</div>
            <div className="mt-2"><AttributeBars attributes={sheet.attributes} align="right" /></div>
          </section>
        </div>}

        {tab === "APPEARANCE" && <AppearanceTab progression={progression} classId={classId} appearance={appearance} onProgression={onProgression} {...(onAppearance ? { onAppearance } : {})} />}

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

        {tab === "CAMPAIGN" && (() => { const c = campaignProgress(progression); const end = ENDINGS[c.ending]; return <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/60">The Fracture · campaign</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">{c.done} / {c.playable} playable missions done · {c.total - c.playable} planned</p>
          </div>
          {c.acts.map(({ act, done, playable }) => <section key={act.id} className="border border-white/15 bg-black/30 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold">{act.title}</p><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/60">{done}/{playable} · {act.goal}</p></div>
            <ol className="mt-2 grid gap-1 sm:grid-cols-2">{act.missions.map((m) => { const isDone = !!m.playable && progression.completedMissions.includes(m.playable); return <li key={m.n} className={`border px-2 py-1.5 text-xs ${isDone ? "border-[#cdae33]/70 bg-[#cdae33]/10" : m.playable ? "border-white/20" : "border-dashed border-white/15 text-white/45"}`}>
              <span className="font-mono text-white/50">{String(m.n).padStart(2, "0")}</span> {m.title} <span className="text-white/45">· {m.region}</span>
              <span className="float-right font-mono text-[10px] uppercase">{isDone ? "Done" : m.playable ? "Playable" : "Planned"}</span>
              {m.note && <span className="block text-[10px] text-white/45">{m.note}</span>}
            </li>; })}</ol>
          </section>)}
          <section className="border border-white/15 bg-black/30 p-3"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">Your path so far</p><p className="mt-1 text-lg">{end.title}</p><p className="text-xs text-white/60">{end.text}</p></section>
        </div>; })()}

        {hover && !picking && <ItemCard item={hover} equippedLabel className="pointer-events-none fixed bottom-14 left-1/2 z-10 w-[min(92vw,24rem)] -translate-x-1/2" />}
        {picking && <SlotPicker slot={picking} progression={progression} onPick={(id) => { onProgression(equipItem(progression, picking, id)); setPicking(null); }} onClose={() => setPicking(null)} />}
      </main>
      <footer className="flex justify-end gap-4 border-t border-white/10 bg-black/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-white/60 sm:px-8">
        <span>Click a slot to swap gear</span><button type="button" onClick={onClose} className="hover:text-white">[Esc] Dismiss</button>
      </footer>
    </div>
  );
}

/** swap gear in one slot: the options as rarity tiles, the focused one compared against what is worn, with the Power Level and
 * attributes it would give (character-sheet.ts sheetIfEquipped, the same path combat uses) */
function SlotPicker({ slot, progression, onPick, onClose }: { slot: GearSlot; progression: PlayerProgression; onPick: (id: string) => void; onClose: () => void }) {
  const options = equipOptions(progression, slot);
  const [focus, setFocus] = useState<GearItem | null>(options[0] ?? null);
  const sheet = characterSheet(progression);
  const after = focus && progression.equippedGear[slot] !== focus.id ? sheetIfEquipped(progression, focus.id) : null;
  return <div className="fixed inset-0 z-20 grid place-items-center bg-black/65 p-4" onClick={onClose}>
    <div className="wf-op-panel grid max-h-[92vh] w-full max-w-6xl gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]" onClick={(e) => e.stopPropagation()}>
      <div>
        <p className="wf-op-kicker">{SLOT_NAME[slot]}</p>
        {options.length === 0 && <p className="mt-2 text-white/60">Nothing for this slot yet — loot it in the world.</p>}
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">{options.map((i) => <div key={i.id} onMouseEnter={() => setFocus(i)}>
          <GearTile size="lg" slot={slot} item={i} equipped={progression.equippedGear[slot] === i.id} selected={focus?.id === i.id} onHover={(x) => x && setFocus(x)} onClick={() => onPick(i.id)} />
        </div>)}</div>
        <div className="mt-4 border-t border-white/10 pt-3">
          <AttributeBars attributes={sheet.attributes} preview={after?.attributes ?? null} />
          {after && after.power !== sheet.power && <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-white/70">Power ◆{sheet.power} → <b className={after.power > sheet.power ? "text-[#7be08a]" : "text-[#ff6b6b]"}>◆{after.power}</b></p>}
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Click to equip · Esc to close</p>
      </div>
      {focus && <CompareCards item={focus} progression={progression} />}
    </div>
  </div>;
}

/** Appearance: plate, undersuit, accent glow and trim colours plus the callsign, on the live operator. Saved on the confirmed
 * character (character-sheet.ts updateAppearance). The authored bodies take plate + accent through operator-colorway.ts. */
const CHANNELS: { key: "armor" | "visor" | "cloth" | "trim"; label: string; note: string }[] = [
  { key: "armor", label: "Armor plate", note: "Recolours the plating on the body" },
  { key: "visor", label: "Accent glow", note: "Visor and glow lines" },
  { key: "cloth", label: "Undersuit", note: "Shown on the procedural body and fallback" },
  { key: "trim", label: "Trim", note: "Shown on the procedural body and fallback" },
];
function AppearanceTab({ progression, classId, appearance, onProgression, onAppearance }: { progression: PlayerProgression; classId: ClassId; appearance: AppearanceDefinition; onProgression: (p: PlayerProgression) => void; onAppearance?: (a: AppearanceDefinition) => void }) {
  const [callsign, setCallsign] = useState(appearance.callsign);
  const apply = (patch: AppearancePatch) => {
    const next = updateAppearance(progression, patch);
    if (next === progression) return;
    onProgression(next);
    onAppearance?.({ ...appearance, ...next.character!.appearance });
  };
  const preset = appearanceById(operatorByClass(classId).appearanceId);
  const custom = colorwayFor(classId, appearance) !== null;
  if (!progression.character) return <p className="text-white/60">Confirm your operator in the Identity Forge first; appearance is saved on the confirmed character.</p>;
  return <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
    <section className="wf-op-stage" aria-label="Operator preview"><CharacterPreview appearance={appearance} classId={classId} progression={progression} /></section>
    <section className="wf-op-panel space-y-5 p-4" aria-label="Appearance">
      <div className="flex items-center justify-between"><p className="wf-op-kicker">Appearance</p>
        <button type="button" className="wf-op-btn !py-1 !text-xs" disabled={!custom} onClick={() => apply({ armor: preset.armor, visor: preset.visor, cloth: preset.cloth, trim: preset.trim })}>Signature look</button></div>
      {CHANNELS.map(({ key, label, note }) => <div key={key}>
        <div className="flex items-baseline justify-between"><span className="font-semibold uppercase tracking-[0.16em]">{label}</span><span className="text-xs text-white/50">{note}</span></div>
        <div className="mt-2 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1">
          {CUSTOMIZATION_PALETTE.map((color) => <button key={color} type="button" aria-label={`${label} ${color}`} aria-pressed={appearance[key].toLowerCase() === color.toLowerCase()} onClick={() => apply({ [key]: color })}
            className={`aspect-square border ${appearance[key].toLowerCase() === color.toLowerCase() ? "border-white ring-2 ring-[#92e9f5]" : "border-white/20 hover:border-white/70"}`} style={{ backgroundColor: color }} />)}
        </div>
      </div>)}
      <label className="block">
        <span className="font-semibold uppercase tracking-[0.16em]">Callsign</span>
        <div className="mt-2 flex gap-2"><input value={callsign} maxLength={16} onChange={(e) => setCallsign(e.target.value.toUpperCase())} className="min-w-0 flex-1 border border-white/25 bg-black/40 px-3 py-2 font-semibold tracking-[0.12em] outline-none focus:border-[#92e9f5]" />
          <button type="button" className="wf-op-btn" disabled={!callsign.trim() || callsign.trim() === appearance.callsign} onClick={() => apply({ callsign })}>Save</button></div>
      </label>
      <p className="text-xs text-white/50">Colours change appearance only, never stats. Swap armor pieces in the Character tab; Defense, Mobility and Intellect update as you equip.</p>
    </section>
  </div>;
}

/** the operator as they look in the world: the authored body wearing the equipped armor, on a slow turntable (falls back to the procedural body) */
export function CharacterPreview({ appearance, classId, progression }: { appearance: AppearanceDefinition; classId: ClassId; progression: PlayerProgression }) {
  return <div className="relative h-[22rem] sm:h-[28rem]" aria-label={`${appearance.name}, wearing the equipped gear`}>
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.5, 6.2], fov: 32 }} gl={{ alpha: true }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 6, 5]} intensity={2.6} color="#fff1dc" />
      <pointLight position={[-3, 2.5, 2]} intensity={14} color={appearance.visor} />
      {/* live check: fixed framing showed only the legs of the authored body; Bounds frames whatever finally loads (GLB or fallback) */}
      <Bounds fit clip observe margin={1.15}><Turntable><OperatorModel colorway classId={classId} bodyType={progression.character?.bodyType} face={progression.character?.face} skin={progression.character?.skin} eyes={progression.character?.eyes} height={2.75} feetY={-1.55} color={appearance.armor} trim={appearance.visor} cloth={appearance.cloth} gear={progression} held={{ current: { weapon: DEFAULT_ARSENAL[classId].loadouts[0]!.slots[0] } }} pose="showcase"
        fallback={<Operator armor={appearance.armor} cloth={appearance.cloth} visor={appearance.visor} trim={appearance.trim} classId={classId} visualState="ACTIVE" />} /></Turntable><Refit /></Bounds>
      <ContactShadows position={[0, 0.02, 0]} opacity={0.5} scale={5} blur={2.4} />
    </Canvas>
  </div>;
}
function Turntable({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += Math.min(dt, 0.05) * 0.35; });
  return <group ref={g} position-y={1.55}>{children}</group>;
}
/** the GLB streams in after the fallback, so re-frame a few times while it settles */
function Refit() {
  const bounds = useBounds();
  useEffect(() => { const ids = [300, 1200, 3000].map((ms) => window.setTimeout(() => bounds.refresh().clip().fit(), ms)); return () => ids.forEach((id) => window.clearTimeout(id)); }, [bounds]);
  return null;
}

/** foundries.ts monoblades: the blade your melee swing uses (earned in the Wastelands). */
function BladePicker({ progression, onProgression }: { progression: PlayerProgression; onProgression: (p: PlayerProgression) => void }) {
  const owned = ownedBlades(progression);
  const current = progression.blade && owned.includes(progression.blade as BladeId) ? BLADES[progression.blade as BladeId] : null;
  const all = Object.values(BLADES);
  return <div className="w-44 border border-white/15 bg-black/30 p-2" aria-label="Monoblade">
    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">Melee · monoblade</p>
    <p className="mt-1 text-xs font-semibold" style={{ color: current ? FOUNDRIES[current.foundry].color : undefined }}>{current ? current.name : "Fracture Blade (standard)"}</p>
    {current && <p className="text-[10px] text-white/60">{current.perk}: {current.text}</p>}
    <div className="mt-1 flex flex-col gap-1">
      {all.map((b) => { const has = owned.includes(b.id); return <button key={b.id} type="button" disabled={!has} title={has ? b.text : `Earn it: ${b.source}`} onClick={() => onProgression(equipBlade(progression, progression.blade === b.id ? null : b.id))}
        className={`border px-1.5 py-1 text-left text-[10px] ${progression.blade === b.id ? "border-white/80" : "border-white/15"} ${has ? "hover:border-white/60" : "opacity-45"}`}>{has ? b.name : `Locked · ${b.source}`}</button>; })}
    </div>
  </div>;
}

