import { useEffect, useRef, useState } from "react";
import { QUESTS, objectiveProgress } from "@/game/quests";
import type { PlayerProgression } from "@/game/progression";

/**
 * Surfaces the real "Fracture Descent" quest chain (@/game/quests) to the player — gameTick()
 * already drives progression.activeQuestId/questObjectiveProgress every frame in GameCanvas.tsx,
 * but nothing rendered any of it. This is the missing display layer the pasted "Mission tracker
 * UI" / "Story message system" specs were reaching for, done as a small React overlay reading
 * real progression state (matching AwakeningOverlay/BrokenSignalOverlay's pattern) instead of a
 * parallel mission engine or raw document.createElement DOM injection.
 */
export function QuestTracker({ progression }: { progression: PlayerProgression }) {
  const quest = progression.activeQuestId ? QUESTS[progression.activeQuestId] ?? null : null;
  const seenQuestId = useRef<string | null>(null);
  const [showLine, setShowLine] = useState(false);

  useEffect(() => {
    if (quest && quest.id !== seenQuestId.current) {
      seenQuestId.current = quest.id;
      setShowLine(true);
      const t = setTimeout(() => setShowLine(false), 6000);
      return () => clearTimeout(t);
    }
  }, [quest]);

  if (!quest) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-64 z-20 w-[min(88vw,320px)] text-right">
      <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">The Fracture Descent</p>
      <p className="mt-0.5 text-sm font-semibold uppercase tracking-wide text-foreground">{quest.title}</p>
      <div className="mt-1.5 space-y-1">
        {quest.objectives.map((objective, i) => {
          const progress = objectiveProgress(progression, quest.id, i);
          const done = progress >= objective.amount;
          return (
            <p key={i} className={`text-[10px] uppercase tracking-wide ${done ? "text-primary" : "text-muted-foreground"}`}>
              {done ? "✓" : "›"} {objective.label} {objective.amount > 1 ? `(${Math.floor(progress)}/${objective.amount})` : ""}
            </p>
          );
        })}
      </div>
      {showLine && <p className="mt-2 border-t border-border/40 pt-2 text-xs italic text-muted-foreground">"{quest.line}"</p>}
    </div>
  );
}
