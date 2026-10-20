import { useEffect, useRef, useState } from "react";
import { introStageAt, introTotalSeconds } from "@/game/intro";
import { playIntroSwell, playNovaActivation } from "@/game/audio";
import { speakVoice, stopVoice } from "@/game/voice-director";
import { useMenuInput } from "./useMenuInput";

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

  // controller: A/Cross or B/Circle skips, same as Enter/Space/Escape (start/pause is deliberately ignored)
  const pad = useMenuInput(true, (intent, source) => { if (source === "pad" && (intent === "confirm" || intent === "back")) { stopVoice("intro"); onComplete(); } }, ["confirm", "back"]);

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
      {/* editorial title-card look (ported from the onboarding stage): brand line, a ruled kicker, large light
          uppercase lines set left, the signal progress and the skip control along the bottom */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_52%_40%,transparent_15%,rgba(0,0,0,0.8)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-[#03070d] transition-[height] duration-300" style={{ height: `${letterbox}vh` }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#03070d] transition-[height] duration-300" style={{ height: `${letterbox}vh` }} />
      <div className="pointer-events-none absolute left-[6vw] flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.34em] text-cyan-200/75" style={{ top: `${letterbox + 3}vh` }}>
        <span className="inline-block size-2 rotate-45 border border-cyan-200" /> World Fracture <span className="ml-2 text-white/35">/ Origin</span>
      </div>
      <div className="pointer-events-none absolute left-[8vw] right-[8vw] top-1/2 max-w-[960px] -translate-y-1/2 text-left text-white" style={{ opacity }}>
        <div className="mb-6 flex items-center gap-4"><span className="h-px w-12 bg-cyan-200/80" /><span className="text-[11px] uppercase tracking-[0.42em] text-cyan-100/85">{stage.kicker}</span></div>
        <h1 className="max-w-[850px] text-3xl font-light uppercase leading-[1.17] tracking-[0.08em] drop-shadow-2xl sm:text-5xl lg:text-6xl">
          {stage.lines.map((line, i) => <span key={i} className="block py-1">{line}</span>)}
        </h1>
        <div className="mt-9 h-px w-24 bg-gradient-to-r from-cyan-200 to-transparent" />
      </div>
      <div className="absolute left-[6vw] right-[6vw] flex items-end justify-between gap-6" style={{ bottom: `${letterbox + 3}vh` }}>
        <div className="flex items-center gap-3"><span className="text-[10px] tracking-[0.3em] text-white/55">SIGNAL</span><div className="flex gap-1.5">{Array.from({ length: 4 }, (_, i) => <span key={i} className={`h-[2px] w-9 transition-colors ${i <= position.index ? "bg-cyan-100" : "bg-white/20"}`} />)}</div><span className="font-mono text-[10px] text-white/40">{Math.max(0, Math.ceil(total - elapsed))}s</span></div>
        <button type="button" onClick={(e) => { e.stopPropagation(); stopVoice("intro"); onComplete(); }} className="border border-white/35 bg-black/30 px-5 py-3 text-[10px] uppercase tracking-[0.26em] text-white/85 transition hover:border-cyan-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">{pad ? `Skip · ${pad === "playstation" ? "✕" : pad === "xbox" ? "A" : "Button 1"}` : "Skip · Enter"}</button>
      </div>
    </div>
  );
}
