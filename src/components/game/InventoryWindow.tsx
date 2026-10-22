import { useEffect, useMemo, useRef, useState } from "react";
import { Anvil, Diamond, Heart, Shield, Trash2, X } from "lucide-react";
import { MATERIALS, gearCost, infuseGear, upgradeGear, type GearItem, type GearSlot } from "@/game/inventory";
import type { PlayerProgression } from "@/game/progression";
import { SLOT_NAME, characterSheet, equipItem, sheetIfEquipped, tierOf } from "@/game/character-sheet";
import type { AppearanceDefinition, ClassId } from "@/game/loadout";
import { StashCrafting, StashItemActions, StashVault } from "./StashPanels";
import { dismantle as dismantleForParts, inVault } from "@/game/stash";
import { AttributeBars, CompareCards, GearTile } from "./GearUi";
import { CharacterPreview } from "./CharacterScreen";

/** Inventory manager in the shared operator-menu look (owner's Destiny / WF inventory references): the operator in the
 * middle wearing the equipped gear with weapons left and armor right, the armory grid by category, and the selected item
 * compared against what is worn with Equip / Favorite / Dismantle. Every number comes from the save. */
const WEAPONS: GearSlot[] = ["primary", "secondary", "heavy"];
const ARMOR: GearSlot[] = ["helmet", "gauntlets", "chest", "legs", "classItem"];
type Tab = "ARMORY" | "VAULT" | "MATERIALS" | "CRAFTING";
type Filter = "ALL" | "WEAPONS" | "ARMOR" | "VEHICLES";
const FILTER_SLOTS: Record<Filter, GearSlot[] | null> = { ALL: null, WEAPONS: WEAPONS, ARMOR: ARMOR, VEHICLES: ["vehicle"] };
const TIER_RANK = { EXOTIC: 0, LEGENDARY: 1, RARE: 2, COMMON: 3 } as const;

export function InventoryWindow({ progression, onProgression, onClose, classId, appearance }: {
  progression: PlayerProgression; onProgression: (next: PlayerProgression) => void; onClose: () => void;
  /** the live operator (shown wearing the equipped gear); omitted = no 3D preview */
  classId?: ClassId; appearance?: AppearanceDefinition;
}) {
  const [selectedId, setSelectedId] = useState(progression.equippedGear.primary ?? progression.inventory[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("ARMORY");
  const [filter, setFilter] = useState<Filter>("ALL");
  const selected = progression.inventory.find((item) => item.id === selectedId);
  const cost = selected ? gearCost(selected) : null;
  const equipped = (item: GearItem) => progression.equippedGear[item.slot] === item.id;
  const sheet = characterSheet(progression);
  const preview = selected && !equipped(selected) ? sheetIfEquipped(progression, selected.id) : null;
  const latest = useRef(onClose); latest.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); latest.current(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const armory = useMemo(() => {
    const slots = FILTER_SLOTS[filter];
    return progression.inventory.filter((g) => !inVault(progression, g.id) && (!slots || slots.includes(g.slot)))
      .sort((a, b) => TIER_RANK[tierOf(a)] - TIER_RANK[tierOf(b)] || b.power - a.power);
  }, [progression, filter]);
  const storedCount = progression.inventory.filter((g) => !inVault(progression, g.id)).length;

  const toggleFavorite = (item: GearItem) => onProgression({ ...progression, inventory: progression.inventory.map((entry) => entry.id === item.id ? { ...entry, favorite: !entry.favorite } : entry) });
  const canDismantle = (item: GearItem) => !(item.favorite || equipped(item) || item.source === "Starting loadout");
  const dismantle = (item: GearItem) => {
    if (!canDismantle(item)) return;
    onProgression(dismantleForParts(progression, item.id));
    setSelectedId(progression.inventory.find((entry) => entry.id !== item.id)?.id ?? "");
  };
  const equip = (item: GearItem) => onProgression(equipItem(progression, item.slot, item.id));
  const worn = (slot: GearSlot) => progression.inventory.find((g) => g.id === progression.equippedGear[slot]) ?? null;
  const callsign = progression.character?.appearance.callsign ?? progression.character?.displayName ?? "Operator";

  return (
    <div className="wf-op fixed inset-0 z-50 flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label="Inventory">
      <header className="wf-op-head">
        <div className="flex items-baseline gap-3">
          <h2 className="text-3xl font-bold uppercase tracking-[0.12em] text-[#f1e3c0]">Inventory</h2>
          <span className="text-2xl font-semibold uppercase tracking-[0.1em] text-[#9fd8e8]">// {callsign}</span>
        </div>
        <nav className="flex items-center" role="tablist" aria-label="Inventory sections">
          {(["ARMORY", "VAULT", "MATERIALS", "CRAFTING"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className="wf-op-tab" onClick={() => setTab(name)}>{name}</button>)}
        </nav>
        <div className="flex items-center gap-4">
          <div className="text-right"><p className="wf-op-kicker !text-[10px]">Power</p><p className="text-3xl font-bold leading-none text-[#7fe0ff]">◆{sheet.power}</p></div>
          <button type="button" className="wf-op-btn !px-2.5" onClick={onClose} aria-label="Close inventory"><X className="size-5" /></button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.25fr)_minmax(20rem,0.95fr)] lg:overflow-hidden">
        {/* ---------------- loadout: weapons | operator | armor ---------------- */}
        <section className="wf-op-panel flex min-h-0 flex-col p-3" aria-label="Loadout">
          <p className="wf-op-kicker">Loadout</p>
          <div className="mt-2 grid flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
            <div className="flex flex-col gap-2">
              {WEAPONS.map((s) => { const it = worn(s); return <GearTile key={s} slot={s} item={it} equipped selected={!!it && it.id === selectedId} onClick={() => { if (it) setSelectedId(it.id); else { setFilter("WEAPONS"); setTab("ARMORY"); } }} />; })}
              <GearTile slot="vehicle" item={worn("vehicle")} equipped size="sm" selected={worn("vehicle")?.id === selectedId} onClick={() => { const it = worn("vehicle"); if (it) setSelectedId(it.id); else setFilter("VEHICLES"); }} />
            </div>
            <div className="wf-op-stage min-h-[16rem] self-stretch">
              {classId && appearance ? <CharacterPreview appearance={appearance} classId={classId} progression={progression} /> : <div className="grid h-full place-items-center text-white/30"><Shield className="size-16" strokeWidth={1} /></div>}
            </div>
            <div className="flex flex-col gap-2">
              {ARMOR.map((s) => { const it = worn(s); return <GearTile key={s} slot={s} item={it} equipped selected={!!it && it.id === selectedId} onClick={() => { if (it) setSelectedId(it.id); else { setFilter("ARMOR"); setTab("ARMORY"); } }} />; })}
            </div>
          </div>
          <div className="mt-3 border-t border-white/10 pt-3">
            <AttributeBars attributes={sheet.attributes} preview={preview?.attributes ?? null} />
            {preview && preview.power !== sheet.power && <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-white/70">Power if equipped <b className={preview.power > sheet.power ? "text-[#7be08a]" : "text-[#ff6b6b]"}>◆{preview.power}</b></p>}
          </div>
        </section>

        {/* ---------------- armory / vault / materials / crafting ---------------- */}
        <section className="wf-op-panel flex min-h-0 flex-col p-3" aria-label={tab.toLowerCase()}>
          {tab === "ARMORY" && <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="wf-op-kicker">Armory // {storedCount} / 120</p>
              <div className="flex" role="group" aria-label="Category">{(["ALL", "WEAPONS", "ARMOR", "VEHICLES"] as const).map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${filter === f ? "border-[#92e9f5] bg-[#92e9f5]/15 text-white" : "border-white/15 text-white/60 hover:text-white"}`}>{f}</button>)}</div>
            </div>
            <div className="mt-3 grid min-h-0 flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 overflow-y-auto pr-1">
              {armory.map((item) => <div key={item.id} className="flex flex-col items-center gap-1">
                <GearTile slot={item.slot} item={item} equipped={equipped(item)} selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} />
                <span className="line-clamp-1 w-full text-center text-[11px] leading-tight text-white/70">{item.name}</span>
              </div>)}
              {armory.length === 0 && <p className="col-span-full text-sm text-white/50">Nothing here yet. Loot drops from kills, bosses and caches.</p>}
            </div>
          </>}
          {tab === "VAULT" && <><p className="wf-op-kicker">Vault</p><div className="mt-2 min-h-0 flex-1 overflow-y-auto font-sans"><StashVault progression={progression} onProgression={onProgression} onSelect={setSelectedId} /></div></>}
          {tab === "MATERIALS" && <><p className="wf-op-kicker">Materials</p><div className="mt-3 grid min-h-0 flex-1 auto-rows-max grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">{Object.entries(MATERIALS).map(([id, material]) => { const n = progression.materials[id as keyof typeof MATERIALS] ?? 0; return (
            <div key={id} className={`border p-3 ${n ? "border-white/20 bg-white/[0.03]" : "border-white/10 opacity-50"}`}>
              <div className="flex items-center justify-between"><Diamond className="size-4 text-[#92e9f5]" /><b className="text-xl">{n}</b></div>
              <p className="mt-1 font-semibold">{material.name}</p><p className="text-xs text-white/55">{material.source}</p>
            </div>); })}</div></>}
          {tab === "CRAFTING" && <><p className="wf-op-kicker">Crafting</p><div className="mt-2 min-h-0 flex-1 overflow-y-auto font-sans"><StashCrafting progression={progression} onProgression={onProgression} />
            <p className="mt-3 text-sm text-white/60">Select gear to upgrade its power or infuse an element in the panel on the right. Materials come from regional troops, bosses and salvage.</p></div></>}
        </section>

        {/* ---------------- selected item: compare + actions ---------------- */}
        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto" aria-label="Selected item">
          {selected ? <>
            <CompareCards item={selected} progression={progression} />
            <div className="grid grid-cols-3 gap-2">
              <button type="button" className="wf-op-btn wf-op-btn-primary" disabled={equipped(selected) || inVault(progression, selected.id)} onClick={() => equip(selected)}><Shield className="size-4" />{equipped(selected) ? "Equipped" : "Equip"}</button>
              <button type="button" className="wf-op-btn" onClick={() => toggleFavorite(selected)}><Heart className={`size-4 ${selected.favorite ? "fill-current" : ""}`} />{selected.favorite ? "Fav'd" : "Favorite"}</button>
              <button type="button" className="wf-op-btn" disabled={!canDismantle(selected)} title={canDismantle(selected) ? "Break down for parts" : "Equipped, favorited or starting gear can't be dismantled"} onClick={() => dismantle(selected)}><Trash2 className="size-4" />Dismantle</button>
            </div>
            <div className="wf-op-panel p-3 font-sans text-sm">
              <StashItemActions progression={progression} item={selected} onProgression={onProgression} onRemoved={() => setSelectedId(progression.inventory.find((e) => e.id !== selected.id)?.id ?? "")} />
              <p className="wf-op-kicker mt-3">Upgrade & infusion</p>
              <button type="button" className="wf-op-btn mt-2 w-full" disabled={!cost || (progression.materials[cost.material] ?? 0) < cost.amount} onClick={() => onProgression(upgradeGear(progression, selected.id))}><Anvil className="size-4" />Upgrade · {cost ? `${cost.amount} ${MATERIALS[cost.material].name}` : ""}</button>
              <div className="mt-2 grid grid-cols-4 gap-1">{(["THERMAL", "CRYO", "ARC", "BIO"] as const).map((element) => { const material = element === "THERMAL" ? "thermalShards" : element === "CRYO" ? "cryoCrystal" : element === "BIO" ? "bioCatalyst" : "microCircuits"; return <button key={element} type="button" className="wf-op-btn !px-1 !text-[11px]" disabled={selected.element === element || (progression.materials[material] ?? 0) < 3} onClick={() => onProgression(infuseGear(progression, selected.id, element))}>{element}</button>; })}</div>
              <p className="mt-1 text-xs text-white/50">Infusion costs 3 matching materials. {SLOT_NAME[selected.slot]} · level {selected.level}</p>
            </div>
          </> : <p className="text-white/50">Select an item.</p>}
        </aside>
      </div>
      <footer className="flex flex-wrap justify-center gap-6 border-t border-white/10 bg-black/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
        <span>Select: mouse / stick</span><span>Equip: button</span><span>[Esc] Close</span>
      </footer>
    </div>
  );
}
