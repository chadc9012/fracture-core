import { useEffect, useRef, useState } from "react";
import { cinematicById, cinematicSeconds, inspectCinematic, skipCinematic, startCinematic, stepCinematic, type CinePlayer, type Handoff } from "@/game/cinematics";
import { speakVoice, stopVoice } from "@/game/voice-director";
import { useMenuInput } from "./useMenuInput";

/**
 * Plays an authored Act I cinematic (src/game/cinematics.ts) over the live world: letterbox, shot cue text, speaker-named subtitles
 * (spoken through the shared voice director when available, captions always shown) and a skip control.
 * Output is only `onDone(handoff, skipped)`; skipping or finishing never awards rewards or completes a mission.
 * `onProgress` reports 0..1 so the host can drive its camera. Until shot anchors are resolved in Scene, the host reuses the
 * existing flythrough path (intro-camera.ts) scaled to this scene's length — presentation only, not yet browser-verified.
 */
export function MissionCinematic({ id, onDone, onProgress }: { id: string; onDone: (handoff: Handoff | null, skipped: boolean) => void; onProgress?: (progress: number) => void }) {
  const cine = cinematicById(id);
  const [player, setPlayer] = useState<CinePlayer | null>(() => (cine ? startCinematic(cine) : null));
  const last = useRef(performance.now());
  const done = useRef(false);
  const spokenLines = useRef(new Set<string>());

  useEffect(() => {
    if (!cine) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - last.current) / 1000);
      last.current = now;
      setPlayer((p) => (p ? stepCinematic(p, cine, dt) : p));
    }, 80);
    return () => window.clearInterval(timer);
  }, [cine]);

  const view = player && cine ? inspectCinematic(player, cine) : null;
  useEffect(() => {
    if (!player || !cine) return;
    onProgress?.(Math.min(1, player.elapsed / cinematicSeconds(cine)));
    if (player.status === "done" && !done.current) { done.current = true; stopVoice("cine"); onDone(player.handoff, player.skipped); }
  }, [player, cine, onDone, onProgress]);
  useEffect(() => {
    const line = view?.line;
    if (!line || spokenLines.current.has(line.id)) return;
    spokenLines.current.add(line.id);
    speakVoice({ id: `cine-${line.id}`, scope: "cine", speaker: line.speaker, text: line.text, priority: "critical" });
  }, [view?.line?.id]);

  const skip = () => { if (cine) setPlayer((p) => (p ? skipCinematic(p, cine) : p)); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (["Enter", "Space", "Escape"].includes(e.code)) skip(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cine]);
  useMenuInput(true, (intent, source) => { if (source === "pad" && (intent === "confirm" || intent === "back")) skip(); }, ["confirm", "back"]);

  // unknown id: hand off immediately so the player is never stuck behind a missing scene
  useEffect(() => { if (!cine && !done.current) { done.current = true; onDone(null, true); } }, [cine, onDone]);
  if (!view) return null;
  const fade = Math.min(1, view.shotElapsed / 0.8);
  return (
    <div className="fixed inset-0 z-[100] cursor-pointer" onClick={skip} aria-live="polite">
      <div className="hud-scanline pointer-events-none absolute inset-0 opacity-15" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[10vh] bg-black" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[10vh] bg-black" />
      <p className="pointer-events-none absolute left-6 top-[12vh] font-mono text-[10px] uppercase tracking-[0.4em] text-primary" style={{ opacity: fade }}>{cine!.title}</p>
      {view.shot.cues[0] && <p className="pointer-events-none absolute left-6 top-[15vh] max-w-md font-mono text-[11px] italic text-white/70" style={{ opacity: fade }}>{view.shot.cues[Math.min(view.shot.cues.length - 1, Math.floor(view.progress * view.shot.cues.length))]}</p>}
      {view.line && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[13vh] flex justify-center px-6">
          <p className="max-w-2xl bg-black/55 px-4 py-2 text-center text-base text-white"><span className="mr-2 font-mono text-[11px] uppercase tracking-[0.25em] text-primary">{view.line.speaker}</span>{view.line.text}</p>
        </div>
      )}
      <p className="pointer-events-none absolute bottom-[11vh] right-6 font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">Enter / click to skip</p>
    </div>
  );
}
