import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { BOOTS, buyBoots, ownsBoots, type BootId } from "@/game/skate-boots";
import { getEquippedBoots, setEquippedBoots } from "@/game/client-input";

/** Neon City skate shop: buy jet-boots with fracture shards and pick which pair you wear. */
export function SkateShop({ progression, onProgression, onClose }: { progression: PlayerProgression; onProgression: (fn: (p: PlayerProgression) => PlayerProgression) => void; onClose: () => void }) {
  const [worn, setWorn] = useState(getEquippedBoots() ?? "none");
  const [msg, setMsg] = useState<string | null>(null);
  const buy = (id: BootId) => onProgression((p) => {
    const r = buyBoots(p, id);
    if (!r.ok) { setMsg(r.reason === "FUNDS" ? "Not enough fracture shards." : "Already yours."); return p; }
    setMsg(`${BOOTS[id as Exclude<BootId, "none">].name} bought!`);
    return { ...p, earnedRewards: r.earnedRewards, fractureShards: r.fractureShards };
  });
  const wear = (id: string) => { setEquippedBoots(id); setWorn(id); };
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-background/70 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-2 border-primary bg-card p-5" style={{ transform: "rotate(-0.6deg)" }}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate font-mono text-2xl font-black italic uppercase tracking-tight text-primary">Kickz Radio · Skate Shop</h2>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Shards: {progression.fractureShards}. Tap Shift (or Dash) to boost-dash; boots also jump higher and sprint faster.</p>
        {msg && <p className="mt-2 font-mono text-xs uppercase text-primary">{msg}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.values(BOOTS).map((b) => {
            const owned = ownsBoots(progression.earnedRewards, b.id);
            return (
              <div key={b.id} className="border border-border bg-background/60 p-3" style={{ borderLeft: `6px solid ${b.color}` }}>
                <p className="font-mono text-lg font-black italic uppercase" style={{ color: b.color }}>{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.tagline}</p>
                <p className="mt-2 font-mono text-[10px] uppercase text-muted-foreground">Sprint ×{b.boost} · Jump ×{b.jump}{b.extraAirJumps ? ` · +${b.extraAirJumps} air jump` : ""} · Dash {b.dash} ({b.dashStyle}) every {b.dashCooldown}s</p>
                <div className="mt-2 flex gap-2">
                  {owned
                    ? <Button size="sm" variant={worn === b.id ? "default" : "outline"} onClick={() => wear(worn === b.id ? "none" : b.id)}>{worn === b.id ? "Wearing · take off" : "Wear"}</Button>
                    : <Button size="sm" onClick={() => buy(b.id)}>Buy · {b.price} shards</Button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
