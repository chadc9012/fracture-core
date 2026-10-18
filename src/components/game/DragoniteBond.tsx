import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CHALLENGES, DRAGONITE, DRAGONITE_IDS, MAX_UPGRADE, PIECE_FOCUS, PIECE_NAMES, UPGRADE_COST, appearanceStage, challengeKey, clearCount, upgradeDragonite, upgradeLevel, wornCovenant, type ChallengeId, type CovenantPiece } from "@/game/dragonite";
import { FULL_TRUST, STAGE_NAMES, claimAncientBond, claimEternalCovenant, trustOf, trustStage } from "@/game/vyrak-trust";
import { isBonded } from "@/game/dragon-covenant";
import { COVENANT_ABILITY } from "@/game/dragon-covenant";
import type { ClassId, PlayerProgression } from "@/game/progression";

const STAGE = ["", "Newly bonded", "Awakened", "Ancient ascendant"] as const;

/** Vyrak bond panel: Dragonite abilities and upgrades, worn Covenant pieces, repeat-clear stage and challenge ornaments. Per Operator. */
export function DragoniteBond({ progression, classId, onProgression }: { progression: PlayerProgression; classId: ClassId; onProgression: (next: PlayerProgression) => void }) {
  const [notice, setNotice] = useState("");
  if (!isBonded(progression, classId)) {
    return (
      <div className="mt-4 border border-border p-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Dragon's Covenant</p>
        <p className="mt-1 text-xs text-muted-foreground">Not bonded on this Operator. Win the Sky Sovereign trial in Solara to form the bond; each Operator bonds separately.</p>
      </div>
    );
  }
  const dragonite = progression.materials.dragonite ?? 0;
  const stage = appearanceStage(clearCount(progression, classId));
  const worn = new Set<CovenantPiece>(wornCovenant(progression.inventory, progression.equippedGear));
  const trust = trustOf(progression, classId), tStage = trustStage(progression, classId);
  const claim = (eternal: boolean) => {
    const r = eternal ? claimEternalCovenant(progression, classId) : claimAncientBond(progression, classId);
    if (!r.ok) { setNotice(("reason" in r && r.reason) || "Not yet"); return; }
    setNotice(eternal ? "The Eternal Covenant begins" : "The Ancient Bond is complete: dragon riding unlocked"); onProgression(r.progression);
  };
  const buy = (id: (typeof DRAGONITE_IDS)[number]) => {
    const r = upgradeDragonite(progression, classId, id);
    if ("error" in r) { setNotice(r.error); return; }
    setNotice(`${DRAGONITE[id].name} upgraded`); onProgression(r.progression);
  };
  return (
    <div className="mt-4 border border-border p-4">
      <div className="flex items-center justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">Vyrak's Covenant · {STAGE[stage]}</p><h4 className="mt-1 text-lg">Dragonite</h4></div><span className="font-mono text-[10px]">{dragonite} Dragonite</span></div>
      <p className="mt-1 text-xs text-muted-foreground">Class bond: {COVENANT_ABILITY[classId].name}. {COVENANT_ABILITY[classId].description}</p>
      <div className="mt-3 border border-border p-2">
        <div className="flex items-center justify-between font-mono text-[10px]"><b>{STAGE_NAMES[tStage]}</b><span>Trust {trust.total}/{FULL_TRUST}</span></div>
        <div className="mt-1 h-1 overflow-hidden border border-primary/60 bg-background/70"><div className="h-full bg-primary" style={{ width: `${trust.total}%` }} /></div>
        <p className="mt-1 text-[9px] text-muted-foreground">Trust comes from dragon challenges, hard encounters, ruins, puzzles and protecting Vyrak; each pays once. Riding unlocks at full trust, for this Operator only.</p>
        {tStage < 4 && <Button size="sm" variant="ghost" disabled={trust.total < FULL_TRUST} onClick={() => claim(false)} className="mt-1 h-6 rounded-none border px-2 text-[9px]">Complete the Ancient Bond</Button>}
        {tStage === 4 && <Button size="sm" variant="ghost" onClick={() => claim(true)} className="mt-1 h-6 rounded-none border px-2 text-[9px]">Begin the Eternal Covenant</Button>}
      </div>
      <div className="mt-3 space-y-2">
        {DRAGONITE_IDS.map((id) => {
          const def = DRAGONITE[id], lv = upgradeLevel(progression, classId, id);
          return (
            <div key={id} className="border border-border p-2">
              <div className="flex items-center justify-between"><b className="font-mono text-[10px]">{def.name} <span className="text-muted-foreground">{def.kind} · {def.cooldown}s · {def.energy} energy</span></b>
                <Button size="sm" variant="ghost" disabled={lv >= MAX_UPGRADE} onClick={() => buy(id)} className="h-6 rounded-none border px-2 text-[9px]">{lv >= MAX_UPGRADE ? "MAX" : `Upgrade ${UPGRADE_COST[lv]}`}</Button></div>
              <p className="mt-1 text-[10px] text-muted-foreground">{def.blurb}</p>
              <ul className="mt-1 grid grid-cols-2 gap-x-3 text-[9px]">{def.upgrades.map((u, i) => <li key={u} className={i < lv ? "text-primary" : "text-muted-foreground"}>{i < lv ? "✓" : "·"} {u}</li>)}</ul>
            </div>
          );
        })}
      </div>
      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Covenant armor ({worn.size}/5 worn)</p>
      <ul className="mt-1 text-[10px]">{(Object.keys(PIECE_NAMES) as CovenantPiece[]).map((k) => <li key={k} className={worn.has(k) ? "text-primary" : "text-muted-foreground"}>{worn.has(k) ? "✓" : "·"} {PIECE_NAMES[k]} — {PIECE_FOCUS[k]}</li>)}</ul>
      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Challenges</p>
      <ul className="mt-1 text-[10px]">{(Object.keys(CHALLENGES) as ChallengeId[]).map((k) => { const done = progression.earnedRewards.includes(challengeKey(classId, k)); return <li key={k} className={done ? "text-primary" : "text-muted-foreground"}>{done ? `✓ ${CHALLENGES[k].ornament} · "${CHALLENGES[k].title}"` : `· ${CHALLENGES[k].name} — ${CHALLENGES[k].how}`}</li>; })}</ul>
      <p className="mt-2 text-[9px] text-muted-foreground">Keys 8 / 9 / 0 / - cast Dragonfire, Wyrmwing, Dragonhide and Wyrmcall (rebindable in Controls).{notice ? ` · ${notice}` : ""}</p>
    </div>
  );
}
