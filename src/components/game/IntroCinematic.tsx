import { useEffect, useRef, useState } from "react";
import { introStageAt, introTotalSeconds } from "@/game/intro";
import { playIntroSwell, playNovaActivation } from "@/game/audio";
import { speakVoice, stopVoice } from "@/game/voice-director";

/**
 * Full-screen opening cinematic — dark, text-driven beats in the Destiny-style "the world is
 * already broken when you arrive" register, played once right after Identity Forge and before
 * the tutorial trial chamber takes over. Purely a presentation layer over intro.ts's stage data;
 * skippable at any time (click, Enter/Space, or Escape) since nothing here gates progression —
 * the tutorial chamber underneath is already running and will pick up the moment this unmounts.
 */
export function IntroCinematic({ onComplete }: { onComplete: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const stageSeen = useRef(-1);
  const start = useRef(performance.now());

  useEffect(() => {
    playIntroSwell();
    const id = window.setInterval(() => setElapsed((performance.now() - start.current) / 1000), 80);
    return () => window.clearInterval(id);
  }, []);

  const position = introStageAt(elapsed);

  useEffect(() => {
    if (!position || position.index === stageSeen.current) return;
    stageSeen.current = position.index;
    if (position.stage.id === "nova") playNovaActivation();
    const speaker = position.stage.id === "nova" ? "NOVA" : "NARRATOR";
    speakVoice({ id: `intro-${position.stage.id}`, scope: "intro", speaker, text: position.stage.lines.map((line) => line.replace(/^NOVA:\s*/, "")).join(" "), priority: "critical" });
  }, [position]);

  useEffect(() => {
    if (!position) { stopVoice("intro"); onComplete(); }
  }, [position, onComplete]);

  useEffect(() => {
    const skip = (e: KeyboardEvent) => { if (["Enter", "Space", "Escape"].includes(e.code)) { stopVoice("intro"); onComplete(); } };
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [onComplete]);

  if (!position) return null;
  const { stage, stageElapsed } = position;
  const fadeIn = Math.min(1, stageElapsed / 0.6);
  const fadeOut = Math.min(1, (stage.holdSeconds - stageElapsed) / 0.6);
  const opacity = Math.min(fadeIn, fadeOut);
  const total = introTotalSeconds();

  return (
    <div
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-black"
      onClick={() => { stopVoice("intro"); onComplete(); }}
    >
      <div className="hud-scanline pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.85)_78%)]" />
      <div className="relative w-[min(90vw,44rem)] text-center" style={{ opacity }}>
        <p className="font-mono text-[11px] uppercase tracking-[0.45em] text-primary" style={{ textShadow: "0 0 16px color-mix(in oklch, var(--primary) 60%, transparent)" }}>
          {stage.kicker}
        </p>
        <div className="mt-5 space-y-2">
          {stage.lines.map((line, i) => (
            <p key={i} className="text-lg font-medium leading-relaxed text-foreground/90 sm:text-xl">
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-2">
        <div className="flex gap-1.5">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className={`h-1 w-6 rounded-full transition-colors ${i === position.index ? "bg-primary" : "bg-muted-foreground/30"}`} />
          ))}
        </div>
      </div>
      <p className="pointer-events-none absolute bottom-4 right-6 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
        Click or press Enter to skip · {Math.max(0, Math.ceil(total - elapsed))}s
      </p>
    </div>
  );
}
