import { useState } from "react";
import { Check, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DASH_PERKS, DASHES, RETUNE_COST, TIER_COST, chosenPerks, dashLevel, dashStats, upgradeDash } from "@/game/dash";
import type { ClassId } from "@/game/loadout";
import type { PlayerProgression } from "@/game/progression";

/** The Operator's dash and its three-tier perk tree: one choice per tier, bought with calibration tokens. */
export function DashTree({ progression, classId, onProgression }: { progression: PlayerProgression; classId: ClassId; onProgression: (next: PlayerProgression) => void }) {
  const [notice, setNotice] = useState("");
  const def = DASHES[classId];
  const level = dashLevel(progression.abilityBranches, classId);
  const picked = chosenPerks(progression.abilityBranches, classId);
  const stats = dashStats(classId, progression.abilityBranches);
  const buy = (tier: 1 | 2 | 3, perkId: string) => {
    const r = upgradeDash(progression, classId, tier, perkId);
    if ("error" in r) { setNotice(r.error); return; }
    setNotice(`${DASH_PERKS[classId][tier - 1]!.find((p) => p.id === perkId)!.name} ${tier <= level ? "retuned" : "unlocked"}`);
    onProgression(r.progress);
  };
  return (
    <div className="mt-4 border border-border p-4">
      <div className="flex items-center justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">{def.operator} dash</p><h4 className="mt-1 text-lg">{def.name}</h4></div><span className="font-mono text-[9px]">{progression.calibrationTokens} TOKENS</span></div>
      <p className="mt-1 text-xs text-muted-foreground">{def.blurb}</p>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center font-mono text-[9px]">
        <div className="border border-border p-2">{stats.distance.toFixed(1)} m</div><div className="border border-border p-2">{stats.cooldown.toFixed(1)}s</div><div className="border border-border p-2">{stats.charges} charge{stats.charges > 1 ? "s" : ""}</div><div className="border border-border p-2">{stats.iframes > 0 ? `${stats.iframes.toFixed(2)}s safe` : stats.resist > 0 ? `${Math.round(stats.resist * 100)}% resist` : "—"}</div>
      </div>
      <div className="mt-3 space-y-2">
        {DASH_PERKS[classId].map((pair, i) => {
          const tier = (i + 1) as 1 | 2 | 3;
          const locked = tier > level + 1;
          return (
            <div key={tier} className="grid grid-cols-[auto_1fr_1fr] items-stretch gap-2">
              <div className="flex w-14 flex-col items-center justify-center border border-border font-mono text-[9px]">{locked ? <LockKeyhole className="size-3" /> : null}T{tier}<span className="text-muted-foreground">{TIER_COST[i]}</span></div>
              {pair.map((perk) => {
                const on = picked[i]?.id === perk.id;
                return (
                  <Button key={perk.id} variant="ghost" disabled={locked || on} onClick={() => buy(tier, perk.id)} className={`h-auto rounded-none border p-2 text-left whitespace-normal ${on ? "border-primary bg-primary/10" : "border-border"}`}>
                    <span><span className="flex items-center justify-between"><b className="font-mono text-[10px]">{perk.name}</b>{on && <Check className="size-3 text-primary" />}</span><span className="mt-1 block text-[9px] text-muted-foreground">{perk.blurb}</span></span>
                  </Button>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground">Unlock tiers in order. Changing a tier you already bought costs {RETUNE_COST} token.{notice ? ` · ${notice}` : ""}</p>
    </div>
  );
}
