import { Compass } from "lucide-react";
import { nextActivity, repeatRewardFactor } from "@/game/retention";
import type { PlayerProgression } from "@/game/progression";

/** NOVA's "What next" recommendation, shared by the world map, star map and deployment briefing. */
export function NextActivityCard({ progression, compact = false }: { progression: Pick<PlayerProgression, "completedMissions" | "lastMissionReward">; compact?: boolean }) {
  const next = nextActivity(progression);
  const last = progression.lastMissionReward;
  return (
    <div className="border-l-2 border-primary bg-primary/5 p-3">
      <p className="ui-kicker flex items-center gap-2"><Compass className="size-3 text-primary" /> What next</p>
      <p className="mt-1 font-mono text-sm uppercase text-primary">{next.title}</p>
      <p className="text-xs text-muted-foreground">{next.region} · {next.why}</p>
      {!compact && <p className="mt-1 text-[11px] text-muted-foreground">Reward: {next.reward}{next.why.startsWith("Next chapter") ? ` · first clear ×${repeatRewardFactor(0, true)}` : ""}</p>}
      {!compact && last && <p className="mt-1 text-[11px] text-muted-foreground">Last payout: {last.firstClear ? "first clear bonus" : last.factor < 1 ? `repeat rewards ${Math.round(last.factor * 100)}% — try something new` : "full rewards"} · +{last.xp} XP</p>}
    </div>
  );
}
