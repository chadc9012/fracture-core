import { useEffect, useState } from "react";
import { HeartPulse, Shield, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { keyName, normalizeBindings, type Bindings } from "@/game/bindings";
import { activeBuffs } from "@/game/client-input";
import { CONSUMABLES, STACK_CAP, type ConsumableId } from "@/game/stash";
import type { PlayerProgression } from "@/game/progression";

const IDS: ConsumableId[] = ["healStim", "armorStim", "ruinStone"];
const ICONS = { healStim: HeartPulse, armorStim: Shield, ruinStone: Gem };

export function ConsumableHud({ progression, bindings, disabled, onUse }: { progression: PlayerProgression; bindings: Bindings; disabled: boolean; onUse: (id: ConsumableId) => void }) {
  const [now, setNow] = useState(Date.now());
  const keys = normalizeBindings(bindings).keyboard;
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (disabled || e.repeat || e.defaultPrevented || (e.target instanceof HTMLElement && (e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)))) return;
      const id = IDS.find((id) => keys[id] === e.code);
      if (id) { e.preventDefault(); onUse(id); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [keys.healStim, keys.armorStim, keys.ruinStone, disabled, onUse]);
  return <div className="pointer-events-auto fixed left-3 top-[42%] z-20 flex max-w-[calc(100vw-1.5rem)] flex-col gap-1 font-mono">
    {IDS.map((id) => {
      const buff = activeBuffs.current[id];
      const live = buff && buff.until > now;
      const count = progression.materials[id] ?? 0;
      const Icon = ICONS[id];
      return <div key={id} className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="h-10 gap-1 bg-background/80 px-2" title={CONSUMABLES[id].blurb} aria-label={`Use ${id === "ruinStone" ? "Ruin Stone" : CONSUMABLES[id].name}`} disabled={disabled || count < 1 || Boolean(live && buff.stacks >= STACK_CAP)} onClick={() => onUse(id)}><Icon className="size-4"/><span className="text-[10px]">{keyName(keys[id])} · {count}</span></Button>
        {live && <div role="status" className="max-w-44 border-l-2 border-primary bg-background/80 px-2 py-1 text-[9px] text-primary"><p>{CONSUMABLES[id].name} ×{buff.stacks} · {Math.ceil((buff.until - now) / 1000)}s</p><p>{id === "ruinStone" ? `+${15 * buff.stacks}% damage` : id === "armorStim" ? `+${10 * buff.stacks}% resistance` : `+${5 * buff.stacks} HP/s`}</p></div>}
      </div>;
    })}
  </div>;
}