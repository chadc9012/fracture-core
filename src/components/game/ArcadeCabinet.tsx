import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ARCADE_ROUNDS, ARCADE_VENUES, MAX_MISSES, PAD_HIT, PAD_LEAVE, TARGETS_PER_ROUND, arcadeBest, arcadeSignal, arcadeTap, arcadeTick, isArcadePress, recordArcade, startArcade, type ArcadeRun } from "@/game/arcade";
import { VENUES } from "@/game/nightlife";
import type { PlayerProgression } from "@/game/progression";

const SIGNAL_COLOR = { READY: "#7a5cff", WAIT: "#ff3b5c", HIT: "#3bff8a", JACKPOT: "#ffc247", "GAME OVER": "#ff6b6b" } as const;
const SIGNAL_TEXT = { READY: "Get ready", WAIT: "Wait…", HIT: "Hit!", JACKPOT: "Jackpot", "GAME OVER": "Game over" } as const;

/** The Pixel Pit reflex cabinet overlay (arcade.ts): hit each signal while it is lit with Space, a click / tap on the screen or
 * gamepad A; pressing early is a miss, two misses end the run. Space is captured while it is open so the operator doesn't
 * jump; held repeats and typing in a field are ignored. Esc / B leaves. */
export function ArcadeCabinet({ venueId, progression, onProgression, onClose, onFinish }: { onFinish?: (run: ArcadeRun) => void; venueId: string; progression: PlayerProgression; onProgression: (p: PlayerProgression) => void; onClose: () => void }) {
  const venue = VENUES.find((v) => v.id === venueId);
  const cabinet = ARCADE_VENUES[venueId]?.cabinet ?? "Arcade";
  const run = useRef<ArcadeRun>(startArcade(venueId, new Date().toISOString().slice(0, 10), performance.now()));
  const [, setFrame] = useState(0);
  const [done, setDone] = useState<ArcadeRun | null>(null);
  const best = useRef(arcadeBest(progression, venueId)).current; // the best before this run, so "new best" reads right
  const progRef = useRef(progression); progRef.current = progression;
  const finish = (s: ArcadeRun) => {
    setDone(s);
    onFinish?.(s);
    const next = recordArcade(progRef.current, venueId, s.score);
    if (next !== progRef.current) onProgression(next);
  };
  const press = useRef(() => {});
  press.current = () => {
    if (done) return;
    run.current = arcadeTap(run.current, performance.now());
    if (run.current.done) finish(run.current);
    setFrame((f) => f + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); onClose(); return; }
      if (e.code !== "Space") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (isArcadePress(e)) press.current();
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); e.stopImmediatePropagation(); } };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    let raf = 0, prev: boolean[] = [];
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find((g): g is Gamepad => !!g && g.connected) : undefined;
      const btn = gp ? gp.buttons.map((b) => b.pressed) : [];
      if (btn[PAD_HIT] && !prev[PAD_HIT]) press.current();
      if (btn[PAD_LEAVE] && !prev[PAD_LEAVE]) onClose();
      prev = btn;
      if (run.current.done) return;
      run.current = arcadeTick(run.current, performance.now());
      if (run.current.done) { finish(run.current); return; }
      setFrame((f) => f + 1);
    };
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("keyup", onKeyUp, true); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = performance.now(), s = run.current, signal = arcadeSignal(s, now);
  const flash = s.last && now - s.last.at < 450 ? s.last : null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-black/40" role="dialog" aria-label={`${cabinet} arcade cabinet`}>
      <div className="w-[min(92vw,420px)] border border-white/20 bg-[#0b0712]/90 p-4 text-white" style={{ boxShadow: `0 0 40px ${venue?.color ?? "#ffc247"}55` }}>
        <div className="flex items-baseline justify-between"><p className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: venue?.color }}>{cabinet} · {venue?.name ?? "Arcade"}</p><p className="font-mono text-xs text-white/60">Best {best.toLocaleString()}</p></div>
        {!done ? <>
          <button type="button" aria-label="Hit" className="relative mt-3 flex h-[44vh] max-h-[360px] w-full select-none flex-col items-center justify-center border border-white/10 bg-black/60 outline-none" style={{ touchAction: "manipulation" }} onPointerDown={(e) => { e.preventDefault(); press.current(); }} onKeyDown={(e) => { if (e.code === "Space" || e.code === "Enter") e.preventDefault(); }}>
            <span className="h-32 w-32 rounded-full transition-[background,box-shadow] duration-75" style={{ background: SIGNAL_COLOR[signal], boxShadow: `0 0 ${signal === "HIT" ? 60 : 18}px ${SIGNAL_COLOR[signal]}` }} />
            <span className="mt-4 font-mono text-2xl uppercase tracking-widest" style={{ color: SIGNAL_COLOR[signal] }}>{SIGNAL_TEXT[signal]}</span>
            {flash && <span className="absolute inset-x-0 top-4 text-center font-mono text-lg uppercase tracking-widest" style={{ color: flash.kind === "hit" ? "#7ef2b0" : "#ff6b6b" }}>{flash.kind === "hit" ? `+${flash.points}` : flash.kind === "early" ? "Too early" : "Too late"}</span>}
          </button>
          <div className="mt-2 flex items-center justify-between font-mono text-xs">
            <span>Round {s.round + 1}/{ARCADE_ROUNDS} · {Array.from({ length: TARGETS_PER_ROUND }, (_, i) => (i < s.next ? "●" : "○")).join(" ")}</span>
            <span>Misses {s.misses}/{MAX_MISSES}</span>
            <span>Score {s.score.toLocaleString()}</span>
          </div>
          <p className="mt-1 text-center font-mono text-[10px] text-white/60">Space · click / tap · pad A to hit · Esc / B leaves</p>
        </> : <div className="mt-4 space-y-2 text-center">
          <p className="font-mono text-4xl uppercase" style={{ color: done.won ? SIGNAL_COLOR.JACKPOT : venue?.color }}>{done.won ? "Jackpot" : done.endedBy === "timeout" ? "Time out" : "Game over"}</p>
          <p className="font-mono text-lg">{done.score.toLocaleString()}{done.score > best ? " · new best" : ""}</p>
          <p className="font-mono text-xs text-white/70">{done.hits} hits · {done.misses} missed · reached round {done.round + 1}/{ARCADE_ROUNDS}</p>
          <Button className="mt-2 w-full rounded-none" onClick={onClose}>Back to the floor</Button>
        </div>}
      </div>
    </div>
  );
}
