import { useState } from "react";
import { CLASS_LABEL, WEAPON_CATALOG, nextCatalogReset, type CatalogClass, type CatalogRarity } from "@/game/weapon-catalog";
import type { PlayerProgression } from "@/game/progression";

/** The weapon catalogue (reference: the weapon & vehicle catalog sheet): every named weapon by class and rarity, where it
 * comes from, and which ones you own. Read-only; the weapons themselves are bought, dropped and equipped through the
 * normal shops, loot and inventory (weapon-catalog.ts). */
const RARITY: Record<CatalogRarity, { label: string; color: string }> = {
  common: { label: "Common", color: "#b8c2cc" }, uncommon: { label: "Uncommon", color: "#5fd36a" }, rare: { label: "Rare", color: "#4aa8ff" }, epic: { label: "Epic", color: "#b46bff" }, exotic: { label: "Exotic", color: "#ffb43a" },
};
const ELEMENT_COLOR: Record<string, string> = { KINETIC: "#d6dde4", PLASMA: "#ff7be0", CRYO: "#8fe6ff", ARC: "#7fb4ff", THERMAL: "#ff8a3c", VOID: "#b98cff" };

export function WeaponCatalogue({ progression }: { progression: PlayerProgression }) {
  const classes = [...new Set(WEAPON_CATALOG.map((w) => w.cls))] as CatalogClass[];
  const [cls, setCls] = useState<CatalogClass | "ALL">("ALL");
  const owned = new Set(progression.inventory.map((g) => g.name));
  const days = Math.max(0, Math.ceil((nextCatalogReset() - Date.now()) / 86_400_000));
  const shown = classes.filter((c) => cls === "ALL" || c === cls);
  return <section className="wf-panel mt-6 p-4 sm:p-5" aria-label="Weapon catalogue">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><p className="ui-kicker">Buy · loot · rewards</p><h2 className="mt-1 text-2xl font-light uppercase tracking-[0.14em]">Weapon catalogue</h2></div>
      <p className="text-[11px] text-muted-foreground">Weapon shops rotate their catalogue stock weekly · next reset in {days} day{days === 1 ? "" : "s"} (Monday 00:00 UTC)</p>
    </div>
    <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest">{(Object.keys(RARITY) as CatalogRarity[]).map((r) => <span key={r} className="flex items-center gap-1"><i className="inline-block size-2" style={{ background: RARITY[r].color }} />{RARITY[r].label}</span>)}</div>
    <div className="wf-tabs mt-3" role="tablist" aria-label="Weapon class">
      <button type="button" role="tab" aria-selected={cls === "ALL"} className="wf-tab" onClick={() => setCls("ALL")}>All</button>
      {classes.map((c) => <button key={c} type="button" role="tab" aria-selected={cls === c} className="wf-tab" onClick={() => setCls(c)}>{CLASS_LABEL[c]}</button>)}
    </div>
    <div className="mt-3 space-y-4">{shown.map((c) => <div key={c}>
      <p className="ui-kicker">{CLASS_LABEL[c]}</p>
      <ul className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">{WEAPON_CATALOG.filter((w) => w.cls === c).map((w) => { const r = RARITY[w.rarity], have = owned.has(w.name); return <li key={w.id} className="border p-2" style={{ borderColor: `${r.color}88`, background: `linear-gradient(160deg, ${r.color}22, rgba(5,12,22,0.9) 70%)` }}>
        <p className="flex items-center justify-between gap-1"><span className="text-[13px] font-medium">{w.name}</span>{have && <span className="wf-chip wf-chip-owned">Owned</span>}</p>
        <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: r.color }}>{r.label}</p>
        <p className="mt-1 text-[10px]" style={{ color: ELEMENT_COLOR[w.element] }}>{w.element.toLowerCase()}</p>
        <p className="text-[10px] text-muted-foreground">{w.source}</p>
      </li>; })}</ul>
    </div>)}</div>
  </section>;
}
