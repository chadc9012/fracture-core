import { useState } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WEAPONS, WEAPON_ORDER, type WeaponId } from "@/game/weapons";
import { classById } from "@/game/loadout";
import type { ClassId, PlayerProgression, WeaponLoadout } from "@/game/progression";

const CLASSES: ClassId[] = ["TITAN", "HUNTER", "WARLOCK"];
const SLOT_NAMES = ["Primary", "Secondary", "Power"] as const;
const MAX_LOADOUTS = 4;

/** Per-class weapon setups (layout adapted from the uploaded ArsenalLoadout). The active loadout of the
 * current class drives weapon keys 1-3, cycling and the ammo HUD in the world. */
export function ArsenalLoadouts({ progression, onProgression, onBack }: { progression: PlayerProgression; onProgression: (p: PlayerProgression) => void; onBack: () => void }) {
  const [cls, setCls] = useState<ClassId>(progression.identityClass ?? "TITAN");
  const arsenal = progression.arsenal[cls];
  const [editing, setEditing] = useState(arsenal.active);
  const loadout = arsenal.loadouts[editing] ?? arsenal.loadouts[0]!;

  const write = (loadouts: WeaponLoadout[], active = arsenal.active) =>
    onProgression({ ...progression, arsenal: { ...progression.arsenal, [cls]: { loadouts, active } } });
  const setSlot = (slot: number, id: WeaponId) => {
    const slots = [...loadout.slots] as WeaponLoadout["slots"];
    const clash = slots.indexOf(id);
    if (clash >= 0) slots[clash] = slots[slot]!; // swap so a weapon is never in two slots
    slots[slot] = id;
    write(arsenal.loadouts.map((l, i) => (i === editing ? { ...l, slots } : l)));
  };
  const add = () => {
    if (arsenal.loadouts.length >= MAX_LOADOUTS) return;
    write([...arsenal.loadouts, { name: `Loadout ${arsenal.loadouts.length + 1}`, slots: [...loadout.slots] as WeaponLoadout["slots"] }]);
    setEditing(arsenal.loadouts.length);
  };

  return (
    <div className="deployment-field fixed inset-0 z-50 overflow-y-auto p-4 text-foreground lg:p-6" role="dialog" aria-modal="true" aria-label="Arsenal loadouts">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/15 pb-3">
        <div className="flex items-center gap-3"><Button variant="ghost" size="sm" onClick={onBack} className="ui-focus"><ArrowLeft /> Back</Button><h1 className="font-mono text-xl uppercase tracking-[0.25em]">Arsenal</h1></div>
        <nav className="flex gap-1">{CLASSES.map((c) => <Button key={c} size="sm" variant="ghost" onClick={() => { setCls(c); setEditing(progression.arsenal[c].active); }} className={`rounded-none border-b-2 font-mono ${cls === c ? "border-primary text-primary" : "border-transparent"}`}>{classById(c).name}{progression.identityClass === c ? " ·" : ""}</Button>)}</nav>
      </header>

      <div className="mx-auto mt-5 grid max-w-6xl gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside>
          <p className="ui-kicker">{classById(cls).name} loadouts</p>
          <ul className="mt-2 space-y-1">
            {arsenal.loadouts.map((l, i) => (
              <li key={i}><button onClick={() => setEditing(i)} className={`ui-focus flex w-full items-center justify-between border p-3 text-left ${editing === i ? "border-primary bg-primary/5" : "border-foreground/15"}`}>
                <span><span className="block font-mono text-sm uppercase">{l.name}</span><span className="text-[11px] text-muted-foreground">{l.slots.map((s) => WEAPONS[s].name).join(" / ")}</span></span>
                {arsenal.active === i && <Check className="size-4 text-primary" aria-label="Equipped" />}
              </button></li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-2 w-full rounded-none" disabled={arsenal.loadouts.length >= MAX_LOADOUTS} onClick={add}><Plus /> New loadout</Button>
        </aside>

        <section className="border border-foreground/15 bg-background/60 p-5">
          <input aria-label="Loadout name" value={loadout.name} maxLength={24} onChange={(e) => write(arsenal.loadouts.map((l, i) => (i === editing ? { ...l, name: e.target.value } : l)))} className="w-full border-b border-foreground/20 bg-transparent pb-1 font-mono text-2xl uppercase outline-none focus:border-primary" />
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {SLOT_NAMES.map((name, slot) => (
              <div key={name}>
                <p className="ui-kicker">Key {slot + 1} · {name}</p>
                <div className="mt-2 space-y-1">{WEAPON_ORDER.map((id) => {
                  const w = WEAPONS[id], on = loadout.slots[slot] === id;
                  return <button key={id} onClick={() => setSlot(slot, id)} className={`ui-focus w-full border p-2 text-left text-xs ${on ? "border-primary text-primary" : "border-foreground/10 text-muted-foreground hover:border-foreground/30"}`}>
                    <span className="block font-mono uppercase">{w.name}</span>
                    <span>{w.kind === "sword" ? "Melee" : `${w.mag} rounds · ${(1 / w.fireRate).toFixed(1)}/s`} · dmg ×{w.damage}{w.kind === "launcher" ? " · splash" : ""}{w.element && w.element !== "KINETIC" ? ` · ${w.element.toLowerCase()}` : ""}</span>
                  </button>;
                })}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <Button className="rounded-none" disabled={arsenal.active === editing} onClick={() => write(arsenal.loadouts, editing)}>{arsenal.active === editing ? "Equipped" : "Equip loadout"}</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
