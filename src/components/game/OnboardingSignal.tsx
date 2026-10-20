import { tutorialText, type TutorialState } from "@/game/onboarding";
import type { ClassId } from "@/game/loadout";
import { useVoiceLine } from "./useVoiceLine";

/** VICTORY is handled by the full-screen VictoryReport instead of this small in-progress banner. */
export function OnboardingSignal({ tutorial, classId }: { tutorial: TutorialState; classId: ClassId; onOpenHub: () => void }) {
  const [title, description] = tutorialText(tutorial.step, classId);
  useVoiceLine(`tutorial-${tutorial.step}`, "NOVA", description, "critical");
  if (tutorial.step === "VICTORY") return null;
  // the same editorial look as the opening cinematic: a ruled kicker, a light uppercase title, the brief on a fading band
  const status = tutorial.step === "MOVEMENT" ? `Gates ${tutorial.gates}/3 · Jump ${tutorial.jumped ? "done" : "pending"}` : tutorial.step === "CONTACT" ? `Drones ${tutorial.kills}/2` : tutorial.step === "POWER" ? `Ability chain ${tutorial.chained}/2` : "";
  return <section aria-live="polite" className="pointer-events-none onboarding-card fixed left-4 top-24 z-20 w-[min(26rem,calc(100%-2rem))] text-white ui-enter sm:left-[4vw]">
    <div className="mb-2 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-200/80"><span className="h-px w-9 bg-cyan-200/80" /> NOVA / Field calibration</div>
    <h2 className="text-xl font-light uppercase tracking-[0.12em] drop-shadow-lg sm:text-2xl">{title}</h2>
    <p className="mt-2 max-w-sm border-l-2 border-cyan-200/80 bg-gradient-to-r from-black/70 to-transparent py-2 pl-4 text-sm leading-relaxed text-white/85">{description}</p>
    {status && <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-cyan-100/75">{status}</p>}
  </section>;
}