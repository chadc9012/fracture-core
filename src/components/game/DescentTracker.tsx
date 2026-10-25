import type { DescentHud } from "@/game/descent-runtime";
import { gateColor, type RiftRank } from "@/game/fracture-gates";
import { HudRail } from "./HudRail";

/** Fracture Gate readout (descent-runtime.ts). Inside a descent there is no map: only the dungeon, the tier, the depth,
 * the objective, shared lives and the boss's collapse clock. Near a gate in the open world: its name, rank and how far. */
export function DescentTracker({ descent }: { descent: DescentHud | undefined }) {
  if (!descent) return null;
  const gate = descent.gateNear;
  if (gate) {
    const c = gateColor(gate.rank as RiftRank, gate.sealed).core;
    return (
      <HudRail side="left" order={3}><div className="pointer-events-none absolute left-4 top-[46%] w-72">
        <div className="border border-border/60 bg-background/80 p-3 backdrop-blur-sm" style={{ borderLeft: `3px solid ${c}` }}>
          <p className="font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: c }}>Fracture Gate · {gate.rank}-rank{gate.sealed ? " · sealed" : ""}</p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider">{gate.name}</p>
          <p className="mt-1 font-mono text-[11px]">{gate.dist} m · walk into the gate to descend</p>
          {gate.breaking && <p className="mt-1 font-mono text-[11px] text-[#ff4d4d]">Dungeon break · its monsters are spilling out</p>}
        </div>
      </div></HudRail>
    );
  }
  const c = descent.rankLied ? "#e8e8e8" : "#a970ff";
  const mm = descent.enrage === null ? null : `${Math.floor(descent.enrage / 60)}:${String(Math.floor(descent.enrage % 60)).padStart(2, "0")}`;
  return (
    <HudRail side="left" order={3}><div className="pointer-events-none absolute left-4 top-[22%] w-72">
      <div className="border border-border/60 bg-background/80 p-3 backdrop-blur-sm" style={{ borderLeft: `3px solid ${c}` }}>
        <p className="font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: c }}>{descent.place} · rank {descent.rank}</p>
        <p className="mt-1 text-sm font-semibold uppercase tracking-wider">{descent.dungeon}</p>
        <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">−{descent.depth.toLocaleString()} m</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{descent.tierLabel}</p>
        <p className="mt-2 text-[12px] leading-snug">{descent.objective}</p>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">Shared lives {descent.lives}{mm ? ` · collapse in ${mm}` : ""}</p>
      </div>
    </div></HudRail>
  );
}
