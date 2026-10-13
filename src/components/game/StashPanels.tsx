import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MATERIALS, type GearItem, type MaterialId } from "@/game/inventory";
import type { PlayerProgression } from "@/game/progression";
import { RUIN_STONE_RECIPE, STACK_CAP, STIMS, VAULT_CAP, craftRuinStone, craftStim, dismantle, dismantleParts, fromVault, inVault, isDuplicate, partsCost, sellDuplicate, sellValue, toVault, upgradeWithParts, useStim, type StimId } from "@/game/stash";
import { activeBuffs } from "@/game/client-input";

const recipe = (r: Partial<Record<MaterialId, number>>) => Object.entries(r).map(([k, n]) => `${n} ${MATERIALS[k as MaterialId].name}`).join(" + ");

/** Crafting tab: Ruin Stones and stims (carry 3, stack 3). */
export function StashCrafting({ progression, onProgression }: { progression: PlayerProgression; onProgression: (p: PlayerProgression) => void }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(t); }, []);
  const m = (id: MaterialId) => progression.materials[id] ?? 0;
  const now = Date.now();
  return (
    <div className="mt-3 space-y-3">
      <div className="hud-panel p-3 text-sm">
        <p className="hud-label">Collectibles · saved to your account</p>
        <p className="mt-1">Data Chips <b className="text-primary">{m("dataChip")}</b> · Energy Tokens <b className="text-primary">{m("energyToken")}</b> · Relic Fragments <b className="text-primary">{m("relicFragment")}</b> · Ruin Stones <b className="text-primary">{m("ruinStone")}</b> · Gear Parts <b className="text-primary">{m("gearParts")}</b> · Shards <b className="text-primary">{progression.fractureShards}</b></p>
      </div>
      <div className="hud-panel p-3">
        <p className="font-semibold">Ruin Stone</p>
        <p className="text-xs text-muted-foreground">{recipe(RUIN_STONE_RECIPE)}</p>
        <Button size="sm" className="mt-2" disabled={craftRuinStone(progression) === progression} onClick={() => onProgression(craftRuinStone(progression))}>Craft Ruin Stone</Button>
      </div>
      {(Object.keys(STIMS) as StimId[]).map((id) => {
        const b = activeBuffs.current[id]; const live = b && b.until > now;
        return (
          <div key={id} className="hud-panel p-3">
            <p className="font-semibold">{STIMS[id].name} <span className="text-primary">{m(id)} / {STACK_CAP}</span></p>
            <p className="text-xs text-muted-foreground">{STIMS[id].blurb}. Craft: {recipe(STIMS[id].recipe)}</p>
            {live && <p className="mt-1 font-mono text-[10px] uppercase text-primary">Active ×{b.stacks} · {Math.ceil((b.until - now) / 1000)} s</p>}
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" disabled={craftStim(progression, id) === progression} onClick={() => onProgression(craftStim(progression, id))}>Craft</Button>
              <Button size="sm" disabled={m(id) < 1} onClick={() => { const r = useStim(progression, activeBuffs.current, id, Date.now()); if (r) { activeBuffs.current = r.buffs; onProgression(r.progression); } }}>Use</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Vault tab: gear stored off your carried inventory. */
export function StashVault({ progression, onProgression, onSelect }: { progression: PlayerProgression; onProgression: (p: PlayerProgression) => void; onSelect: (id: string) => void }) {
  const items = progression.inventory.filter((g) => inVault(progression, g.id));
  return (
    <div className="mt-3">
      <p className="hud-label">Vault · {items.length} / {VAULT_CAP}</p>
      {items.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing stored. Pick gear in the Armory and choose "Store in vault".</p>}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((g) => (
          <div key={g.id} className="hud-panel p-2 text-xs">
            <button className="block w-full truncate text-left font-semibold" onClick={() => onSelect(g.id)}>{g.name}</button>
            <p className="text-muted-foreground">{g.slot} · {g.power}</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={() => onProgression(fromVault(progression, g.id))}>Take out</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Item actions: vault, sell duplicate, dismantle for parts, upgrade with parts. */
export function StashItemActions({ progression, item, onProgression, onRemoved }: { progression: PlayerProgression; item: GearItem; onProgression: (p: PlayerProgression) => void; onRemoved: () => void }) {
  const vaulted = inVault(progression, item.id);
  const dup = isDuplicate(progression, item);
  const sold = sellDuplicate(progression, item.id); const broken = dismantle(progression, item.id); const up = upgradeWithParts(progression, item.id);
  return (
    <div className="mt-4 border-t border-primary/20 pt-4">
      <p className="hud-label">Vault & trade</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!vaulted && toVault(progression, item.id) === progression} onClick={() => onProgression(vaulted ? fromVault(progression, item.id) : toVault(progression, item.id))}>{vaulted ? "Take out of vault" : "Store in vault"}</Button>
        <Button size="sm" variant="outline" disabled={sold === progression} onClick={() => { onProgression(sold); onRemoved(); }}>{dup ? `Sell duplicate · ${sellValue(item)} shards` : "Sell (duplicates only)"}</Button>
        <Button size="sm" variant="outline" disabled={broken === progression} onClick={() => { onProgression(broken); onRemoved(); }}>Dismantle · {dismantleParts(item)} parts</Button>
        <Button size="sm" disabled={up === progression} onClick={() => onProgression(up)}>Upgrade · {partsCost(item)} parts</Button>
      </div>
    </div>
  );
}
