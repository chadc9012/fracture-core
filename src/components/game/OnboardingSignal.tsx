import { tutorialText, type TutorialState } from "@/game/onboarding";
import type { ClassId } from "@/game/loadout";
import { useVoiceLine } from "./useVoiceLine";

/** VICTORY is handled by the full-screen VictoryReport instead of this small in-progress banner. */
export function OnboardingSignal({ tutorial, classId }: { tutorial: TutorialState; classId: ClassId; onOpenHub: () => void }) {
  const [title, description] = tutorialText(tutorial.step, classId);
  useVoiceLine(`tutorial-${tutorial.step}`, "NOVA", description, "critical");
  if (tutorial.step === "VICTORY") return null;
  return <div className="pointer-events-none fixed left-4 top-24 z-20 w-[min(25rem,calc(100%-2rem))] border-l border-primary bg-gradient-to-r from-background/75 to-transparent px-4 py-3 ui-enter">
    <p className="ui-kicker">NOVA / Field calibration</p>
    <p className="mt-2 font-mono text-xs uppercase text-primary">{title}</p>
    <p className="mt-1 text-sm leading-relaxed text-foreground/90">{description}</p>
    {tutorial.step === "MOVEMENT" && <p className="mt-2 font-mono text-[10px] text-muted-foreground">GATES {tutorial.gates}/3 · JUMP {tutorial.jumped ? "COMPLETE" : "PENDING"}</p>}
    {tutorial.step === "CONTACT" && <p className="mt-2 font-mono text-[10px] text-muted-foreground">DRONES {tutorial.kills}/2</p>}
    {tutorial.step === "POWER" && <p className="mt-2 font-mono text-[10px] text-muted-foreground">CHAIN {tutorial.chained}/2</p>}
  </div>;
}