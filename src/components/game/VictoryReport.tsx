import { Button } from "@/components/ui/button";
import { CornerBrackets } from "./HudChrome";
import type { ClassId } from "@/game/loadout";
import { CLASS_LABEL } from "./IdentityForge";

/**
 * "First victory report" — the debrief screen the roadmap calls out by name (the staged-onboarding
 * item asked for a "first victory report", not just a small inline button). Replaces the bare
 * "Enter Nexus operations" button OnboardingSignal showed on the VICTORY step with a proper
 * Destiny-style post-mission summary: what was earned, laid out like every mission-complete screen
 * that follows it, so the player's first taste of "mission complete" sets the pattern early.
 */
export function VictoryReport({ classId, abilityName, onContinue }: { classId: ClassId; abilityName: string; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-md">
      <section className="hud-panel hud-glow relative w-full max-w-lg p-6">
        <CornerBrackets />
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">Identity Trial · Complete</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-wide" style={{ textShadow: "0 0 16px color-mix(in oklch, var(--primary) 45%, transparent)" }}>
          IDENTITY STABILIZED
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">First victory secured. Your {CLASS_LABEL[classId]} resonance is calibrated and ready for the field.</p>

        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Mission log</span>
            <span className="text-sm">01 · Identity Trial — cleared</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Ability unlocked</span>
            <span className="text-sm text-primary">{abilityName}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Reward</span>
            <span className="text-sm">Calibration Token +1</span>
          </div>
          <div className="flex items-center justify-between pb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</span>
            <span className="text-sm">Nexus operations online</span>
          </div>
        </div>

        <Button className="hud-glow mt-6 w-full" onClick={onContinue}>
          Enter Nexus Operations
        </Button>
      </section>
    </div>
  );
}
