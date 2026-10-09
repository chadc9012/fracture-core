import { Button } from "@/components/ui/button";
import { ATTRIBUTES, hasFlexibility, loadoutAttributes, loadoutWarnings, SOFT_CAP } from "@/game/armor-attributes";
import { perkFor, perkScale } from "@/game/armor-perks";
import { ARMOR_LEVEL_MAX, SET_SLOTS, equipPiece, setPieceId, setStatuses } from "@/game/armor-sets";
import { gearCost, upgradeGear } from "@/game/inventory";
import type { PlayerProgression } from "@/game/progression";

/** Regional armor sets: owned pieces, 2/4-piece bonuses, equip and level-up (rules live in armor-sets.ts). */
export function ArmorSetsPanel({ progression, onProgression }: { progression: PlayerProgression; onProgression: (next: PlayerProgression) => void }) {
  const statuses = setStatuses(progression);
  const worn = new Set(Object.values(progression.equippedGear).filter((id): id is string => typeof id === "string"));
  return (
    <section className="pb-8">
      <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Regional armor sets</p>
      <h3 className="mt-1 text-xl font-semibold">Set loot & armor levels</h3>
      <p className="mt-1 text-xs text-muted-foreground">Region enemies and bosses drop set pieces. Duplicates level a piece (max {ARMOR_LEVEL_MAX}); bonuses scale with the average level of what you wear.</p>
      <LoadoutAttributes progression={progression} />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {statuses.map(({ set, owned, equipped, averageLevel, twoActive, fourActive }) => (
          <div key={set.id} className="border border-border p-3" style={{ borderColor: owned ? set.color : undefined }}>
            <div className="flex items-center justify-between"><b className="text-sm" style={{ color: set.color }}>{set.name}</b><span className="font-mono text-[9px] text-muted-foreground">{equipped}/5 worn · {owned}/5 owned · {set.regionId}</span></div>
            <p className="text-[10px] text-muted-foreground">{set.tagline}</p>
            <p className={`mt-2 text-[10px] ${twoActive ? "text-primary" : "text-muted-foreground"}`}>2pc · {set.two.name}: {set.two.description}</p>
            <p className={`text-[10px] ${fourActive ? "text-primary" : "text-muted-foreground"}`}>4pc · {set.four.name}: {set.four.description}</p>
            {equipped > 0 && <p className="mt-1 font-mono text-[9px]">AVG LV {averageLevel.toFixed(1)}</p>}
            <div className="mt-2 space-y-1">
              {SET_SLOTS.map((slot) => {
                const item = progression.inventory.find((entry) => entry.id === setPieceId(set.id, slot));
                if (!item) return <div key={slot} className="flex justify-between border border-dashed border-border/60 px-2 py-1 text-[10px] text-muted-foreground"><span>{set.pieces[slot] ?? slot}</span><span>not found</span></div>;
                const isWorn = worn.has(item.id);
                const cost = gearCost(item);
                const maxed = item.level >= ARMOR_LEVEL_MAX;
                return (
                  <div key={slot} className="flex items-center justify-between gap-2 border border-border/60 px-2 py-1">
                    <span className="text-[10px]">{item.name} <span className="text-muted-foreground">· LV {item.level}</span>{(() => { const perk = perkFor(item.setId, item.slot); return perk ? <span className="block text-[9px]" style={{ color: set.color }}>{perk.name}: {perk.description}{item.level > 1 ? ` (x${perkScale(item.level).toFixed(2)})` : ""}</span> : null; })()}</span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" disabled={isWorn} onClick={() => onProgression(equipPiece(progression, item.id))}>{isWorn ? "Worn" : "Wear"}</Button>
                      <Button size="sm" variant="ghost" disabled={maxed || (progression.materials[cost.material] ?? 0) < cost.amount} onClick={() => onProgression(upgradeGear(progression, item.id))}>{maxed ? "Max" : `Lv up · ${cost.amount} ${cost.material}`}</Button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const ATTRIBUTE_INFO = { intellect: ["INTELLECT", "faster ability recharge"], mobility: ["MOBILITY", "move speed and slides"], defense: ["DEFENSE", "damage resistance"] } as const;

/** Live attribute totals for whatever is worn: any mix of pieces works, a matching set is a bonus, never a requirement. */
function LoadoutAttributes({ progression }: { progression: PlayerProgression }) {
  const { raw, effective, worn } = loadoutAttributes(progression);
  const warnings = loadoutWarnings(progression);
  const max = SOFT_CAP * 1.5;
  return (
    <div className="mt-4 border border-border p-3">
      <div className="flex items-center justify-between"><b className="text-sm">Your loadout</b><span className="font-mono text-[9px] text-muted-foreground">{worn}/5 armor worn{hasFlexibility(progression) ? " · mixed-gear bonus active" : ""}</span></div>
      <p className="text-[10px] text-muted-foreground">Mix any pieces. Past {SOFT_CAP} a stat gains less, heavy defense slows you, heavy intellect thins your protection.</p>
      <div className="mt-2 space-y-1.5">
        {ATTRIBUTES.map((attr) => (
          <div key={attr}>
            <div className="flex justify-between font-mono text-[9px]"><span>{ATTRIBUTE_INFO[attr][0]} <span className="text-muted-foreground">· {ATTRIBUTE_INFO[attr][1]}</span></span><span>{effective[attr].toFixed(0)}{Math.abs(raw[attr] - effective[attr]) >= 1 ? <span className="text-muted-foreground"> ({raw[attr].toFixed(0)} raw)</span> : null}</span></div>
            <div className="h-1.5 bg-border/60"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (effective[attr] / max) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
      {warnings.length > 0 && <ul className="mt-2 space-y-0.5 text-[10px] text-amber-300">{warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
    </div>
  );
}
