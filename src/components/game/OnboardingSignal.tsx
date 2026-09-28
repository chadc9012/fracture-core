import { tutorialText, type TutorialState } from "@/game/onboarding";
import type { ClassId } from "@/game/loadout";

/** VICTORY is handled by the full-screen VictoryReport instead of this small in-progress banner. */
export function OnboardingSignal({ tutorial, classId }: { tutorial: TutorialState; classId: ClassId; onOpenHub: () => void }) {
  if (tutorial.step === "VICTORY") return null;
  const [title, description] = tutorialText(tutorial.step, classId);
  return <div className="pointer-events-none fixed inset-x-0 bottom-20 z-20 mx-auto w-[min(34rem,calc(100%-1rem))] border-l-2 border-primary bg-card/90 p-4 shadow-xl backdrop-blur-lg md:bottom-24">
    <p className="font-mono text-[10px] uppercase text-primary">{title}</p>
    <p className="mt-1 text-sm leading-relaxed">{description}</p>
    {tutorial.step === "MOVEMENT" && <p className="mt-2 font-mono text-[10px] text-muted-foreground">GATES {tutorial.gates}/3 · JUMP {tutorial.jumped ? "COMPLETE" : "PENDING"}</p>}
    {tutorial.step === "CONTACT" && <p className="mt-2 font-mono text-[10px] text-muted-foreground">DRONES {tutorial.kills}/2</p>}
    {tutorial.step === "POWER" && <p className="mt-2 font-mono text-[10px] text-muted-foreground">CHAIN {tutorial.chained}/2</p>}
  </div>;
}