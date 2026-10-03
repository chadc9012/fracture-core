import { useEffect, useRef, useState } from "react";
import { introStageAt, introTotalSeconds } from "@/game/intro";
import { playIntroSwell, playNovaActivation } from "@/game/audio";
import { speakVoice, stopVoice } from "@/game/voice-director";

/**
 * Full-screen opening cinematic — intro.ts's text beats playing over the real, running world
 * (GameCanvas.tsx mounts this directly on top of the live <Scene>, which Scene.tsx is already
 * flying through on a scripted path per intro-camera.ts/the `introPlayback` prop). This component
 * owns the "world reveal": a black veil that starts near-opaque for the first two beats (so the
 * THE FRACTURE / A WORLD AT WAR text reads clearly against whatever's moving underneath) and
 * clears through SIGNAL/NOVA as the flythrough descends toward spawn, so by the final beat the
 * player is looking at the actual game world, not a title card. Letterbox bars sell the cut away
 * from "cinematic" framing to the HUD's normal 16:9-ish gameplay view the instant this unmounts.
 * Skippable at any time (click, Enter/Space, or Escape) since nothing here gates progression —
 * Scene.tsx's `introPlayback` prop goes away the moment onComplete fires, handing the camera back
 * to the normal follow-cam exactly where the flythrough left it.
 */
export function IntroCinematic({ onComplete, onTick }: { onComplete: () => void; onTick?: (elapsed: number) => void }) {
  const [elapsed, setElapsed] = useState(0);
  const stageSeen = useRef(-1);
  const start = useRef(performance.now());
  const total = introTotalSeconds();

  useEffect(() => {
    playIntroSwell();
    const id = window.setInterval(() => {
      const next = (performance.now() - start.current) / 1000;
      setElapsed(next);
      onTick?.(next);
    }, 80);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const position = introStageAt(elapsed);

  useEffect(() => {
    if (!position || position.index === stageSeen.current) return;
    stageSeen.current = position.index;
    if (position.stage.id === "nova") playNovaActivation();
    const speaker = position.stage.id === "nova" ? "NOVA" : "NARRATOR";
    speakVoice({ id: `intro-${position.stage.id}`, scope: "intro", speaker, text: position.stage.lines.map((line) => line.replace(/^NOVA:\s*/, "")).join(" "), priority: "critical" });
  }, [position]);

  // World-reveal veil: opaque through the first two beats, clears across SIGNAL -> NOVA as the
  // flythrough (intro-camera.ts) descends toward spawn, landing near-transparent by the final
  // frame so the cut to live gameplay reads as a reveal, not a pop.
  const revealFrom = total * 0.52;
  const veilT = total > revealFrom ? Math.max(0, Math.min(1, (elapsed - revealFrom) / (total - revealFrom))) : 0;
  const veilAlpha = 0.94 - veilT * veilT * 0.8;

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
  // Letterbox bars close in as the veil clears, selling "cinematic" framing right up to the cut —
  // widest once the world is actually visible behind the text, gone the instant this unmounts.
  const letterbox = 2 + veilT * 9;

  return (
    <div
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center"
      style={{ backgroundColor: `rgba(0,0,0,${veilAlpha})` }}
      onClick={() => { stopVoice("intro"); onComplete(); }}
    >
      <div className="hud-scanline pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.85)_78%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-black transition-[height] duration-300" style={{ height: `${letterbox}vh` }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black transition-[height] duration-300" style={{ height: `${letterbox}vh` }} />
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
