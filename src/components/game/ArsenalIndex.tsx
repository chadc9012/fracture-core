import { Button } from "@/components/ui/button";
import { baseWeaponRows, weaponIndex, weaponVault, WEAPON_SLOTS } from "@/game/arsenal-index";
import { VAULT_CAP, fromVault, toVault } from "@/game/stash";
import type { PlayerProgression } from "@/game/progression";
import type { GearItem } from "@/game/inventory";

const SLOT_LABEL: Record<string, string> = { primary: "Primary", secondary: "Secondary", heavy: "Heavy" };
const RARITY_COLOR: Record<string, string> = { LEGENDARY: "#f59e0b", EXOTIC: "#c084fc" };

function Row({ g, equipped, action }: { g: GearItem; equipped: boolean; action: React.ReactNode }) {
  return <li className="flex items-center justify-between gap-2 border border-foreground/10 p-2">
    <span className="min-w-0"><span className="block truncate text-[13px] font-medium" style={g.rarity ? { color: RARITY_COLOR[g.rarity] } : undefined}>{g.name}</span>
      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">{SLOT_LABEL[g.slot]} · power {g.power} · {g.element.toLowerCase()}{g.rarity ? ` · ${g.rarity.toLowerCase()}` : ""}</span></span>
    <span className="flex shrink-0 items-center gap-2">{equipped && <span className="wf-chip wf-chip-owned">Equipped</span>}{action}</span>
  </li>;
}

/** Arsenal index: every weapon you carry, by slot. Store spare weapons in the vault, a separate list. */
export function ArsenalIndex({ progression, onProgression }: { progression: PlayerProgression; onProgression: (p: PlayerProgression) => void }) {
  const items = weaponIndex(progression), equipped = new Set(Object.values(progression.equippedGear));
  const stored = weaponVault(progression).length, base = baseWeaponRows(progression);
  return <section className="mx-auto mt-5 max-w-6xl border border-foreground/15 bg-background/60 p-5" aria-label="Weapon index">
    <p className="ui-kicker">Base weapons · {base.length}</p>
    <ul className="mt-1 grid gap-2 sm:grid-cols-2">{base.map((b) => <li key={b.id} className="flex items-center justify-between gap-2 border border-foreground/10 p-2">
      <span className="min-w-0"><span className="block truncate text-[13px] font-medium">{b.name}</span><span className="block text-[10px] uppercase tracking-widest text-muted-foreground">{b.detail}</span></span>
      {b.slotted && <span className="wf-chip wf-chip-owned">In loadout</span>}
    </li>)}</ul>
    <p className="ui-kicker mt-5">Carried weapons · {items.length}</p>
    {items.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No weapons carried.</p>}
    {WEAPON_SLOTS.map((slot) => { const list = items.filter((g) => g.slot === slot); return list.length > 0 && <div key={slot} className="mt-4">
      <p className="ui-kicker">{SLOT_LABEL[slot]}</p>
      <ul className="mt-1 grid gap-2 sm:grid-cols-2">{list.map((g) => <Row key={g.id} g={g} equipped={equipped.has(g.id)} action={
        <Button size="sm" variant="outline" className="rounded-none" disabled={equipped.has(g.id) || stored >= VAULT_CAP} onClick={() => onProgression(toVault(progression, g.id))}>Store in vault</Button>} />)}</ul>
    </div>; })}
  </section>;
}

/** Arsenal vault: weapons stored off your carried inventory, kept apart from the index. */
export function ArsenalVault({ progression, onProgression }: { progression: PlayerProgression; onProgression: (p: PlayerProgression) => void }) {
  const items = weaponVault(progression);
  return <section className="mx-auto mt-5 max-w-6xl border border-foreground/15 bg-background/60 p-5" aria-label="Weapon vault">
    <p className="ui-kicker">Vault · {items.length} weapon{items.length === 1 ? "" : "s"} (shared {VAULT_CAP} item vault with armor)</p>
    {items.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing stored. Use "Store in vault" on the Index tab.</p>}
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">{items.map((g) => <Row key={g.id} g={g} equipped={false} action={
      <Button size="sm" variant="outline" className="rounded-none" onClick={() => onProgression(fromVault(progression, g.id))}>Take out</Button>} />)}</ul>
  </section>;
}
