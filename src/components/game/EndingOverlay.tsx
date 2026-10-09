import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { useVoiceLine } from "./useVoiceLine";

/**
 * The Fracture Descent's closing screen — fires once, when fd-18 (The System Core) completes.
 * Which of the three lore-established endings (Control/Chaos/Resonant-Balance) plays is read off
 * progression.corruptionLevel, the same number the quest chain has been accumulating all along, so
 * the ending reflects how the player actually played rather than a scripted final choice screen.
 * The world keeps running after this closes — per the lore's own "post-game is a live, evolving
 * world" framing, this is a milestone screen, not a game-over.
 */
const ENDINGS = {
  CONTROL: {
    title: "The Control Ending",
    line: "The System Core goes dark under your hand, not the Deepmind's. Reality stops fracturing — and stops changing, too. Every zone will hold its shape from here. Safe. Small. Exactly as far as you let it go.",
  },
  CHAOS: {
    title: "The Chaos Ending",
    line: "You don't shut the Core down. You tear it open. The Fracture doesn't heal — it spreads, hungry and unfiltered, into everything that's left. Whatever the world becomes now, no one designed it. Not even you.",
  },
  BALANCE: {
    title: "The Resonant Ending",
    line: "You don't control the Core, and you don't destroy it. You become part of it. The layers stop fighting each other and start listening. The Fracture isn't over — it's just yours now, and it's still writing itself.",
  },
} as const;

export function endingTierFor(progression: PlayerProgression): keyof typeof ENDINGS {
  if (progression.corruptionLevel < 35) return "CONTROL";
  if (progression.corruptionLevel > 65) return "CHAOS";
  return "BALANCE";
}

export function EndingOverlay({ progression, onClose }: { progression: PlayerProgression; onClose: () => void }) {
  const tier = endingTierFor(progression);
  const ending = ENDINGS[tier];
  useVoiceLine(`ending-${tier}`, "NARRATOR", ending.line, "critical");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-6">
      <section className="w-full max-w-2xl text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">The Fracture Descent · Complete</p>
        <h1 className="mt-3 text-3xl font-semibold uppercase tracking-wide">{ending.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{ending.line}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>Corruption {Math.round(progression.corruptionLevel)}%</span>
          <span>Fracture Shards {progression.fractureShards}</span>
          <span>Worlds unlocked {progression.unlockedWorlds.length}</span>
        </div>
        <Button className="mt-8" onClick={onClose}>Continue exploring the fracture</Button>
      </section>
    </div>
  );
}
