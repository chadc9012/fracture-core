import { Button } from "@/components/ui/button";
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
                    <span className="text-[10px]">{item.name} <span className="text-muted-foreground">· LV {item.level}</span></span>
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
