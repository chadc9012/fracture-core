import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { isPartialMatch, type Dir, type StratagemHud } from "@/game/stratagems";

const ICON: Record<Dir, typeof ArrowUp> = { U: ArrowUp, D: ArrowDown, L: ArrowLeft, R: ArrowRight };

/** Call-in code entry: every stratagem's arrows, lit as you type the matching prefix, red on a typo. */
export function StratagemPanel({ hud }: { hud: StratagemHud }) {
  if (!hud.open && !hud.armedName) return null;
  return <div className="pointer-events-none absolute bottom-40 left-4 z-20 w-[min(20rem,calc(100%-2rem))] ui-enter">
    <p className="hud-label">{hud.open ? "Call-in // enter code with arrow keys" : "Call-in // beacon armed"}</p>
    {hud.armedName ? <p className="mt-2 border-l border-primary bg-background/60 px-3 py-2 font-mono text-xs uppercase text-primary">{hud.armedName} ready · release N to throw</p> : <div className="mt-2 space-y-1">
      {hud.rows.map((row) => {
        const matched = hud.seq.length > 0 && isPartialMatch(hud.seq, row.code) ? hud.seq.length : 0;
        const cooling = row.cooldown > 0;
        return <div key={row.id} className={`hud-panel flex items-center justify-between gap-3 px-3 py-1.5 ${cooling ? "opacity-50" : ""}`}>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]">{row.name}{cooling ? ` · ${Math.ceil(row.cooldown)}s` : ""}</span>
          <span className="flex gap-0.5">{row.code.map((dir, i) => {
            const Icon = ICON[dir];
            return <Icon key={i} className={`size-4 ${hud.failing ? "text-destructive" : i < matched ? "text-primary" : "text-muted-foreground/60"}`} />;
          })}</span>
        </div>;
      })}
    </div>}
  </div>;
}
