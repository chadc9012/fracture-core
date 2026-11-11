import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GRENADES, OPERATOR_GRENADES, equipGrenade, equippedGrenade } from "@/game/grenades";
import type { ClassId } from "@/game/loadout";
import type { PlayerProgression } from "@/game/progression";

/** The Operator's three grenades: pick the one carried into the field (thrown with [J], switched in the field with [K]). */
export function GrenadePicker({ progression, classId, onProgression }: { progression: PlayerProgression; classId: ClassId; onProgression: (next: PlayerProgression) => void }) {
  const [notice, setNotice] = useState("");
  const on = equippedGrenade(progression.abilityBranches, classId);
  const ids = OPERATOR_GRENADES[classId];
  return (
    <div className="mt-4 border border-border p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">{GRENADES[ids[0]].operator} grenades</p>
      <p className="mt-1 text-xs text-muted-foreground">Three grenades only this Operator carries. Equip one; switch between them in the field.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {ids.map((id) => {
          const g = GRENADES[id], picked = on.id === id;
          return (
            <Button key={id} variant="ghost" disabled={picked} onClick={() => { const r = equipGrenade(progression, classId, id); if ("error" in r) { setNotice(r.error); return; } setNotice(`${g.name} equipped`); onProgression(r); }}
              className={`h-auto min-h-32 rounded-none border p-3 text-left whitespace-normal ${picked ? "border-primary bg-primary/10" : "border-border"}`}>
              <span>
                <span className="flex items-center justify-between"><b className="font-mono text-xs" style={{ color: g.color }}>{g.name}</b>{picked && <Check className="size-3 text-primary" />}</span>
                <span className="mt-2 block text-[10px]">{g.blurb}</span>
                <span className="mt-2 block font-mono text-[9px] text-muted-foreground">{g.charges} charge{g.charges > 1 ? "s" : ""} · {g.cooldown}s{g.damage > 0 ? ` · ${g.damage} dmg` : ""} · {g.effect === "BURN" || g.effect === "PULL" ? g.reach : g.radius} m</span>
              </span>
            </Button>
          );
        })}
      </div>
      {notice && <p className="mt-2 font-mono text-[9px] text-primary">{notice}</p>}
    </div>
  );
}
