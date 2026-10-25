import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FOURBEAT, fourBeatPhase, fourBeatTap, fourBeatTick, startFourBeat, type FourBeat } from "@/game/venue-life";

/** The Four-Beat Dance (venue-life.ts): a pulse ring closes on the beat; tap Space, click the ring or press the pad's A
 * button as it lands. Four clean steps win, four misses or fifteen seconds lose. */
export function FourBeatDance({ venueId, color, onFinish, onClose }: { venueId: string; color: string; onFinish: (won: boolean) => void; onClose: () => void }) {
  const t0 = useRef(performance.now());
  const s = useRef<FourBeat>(startFourBeat(venueId));
  const [, setFrame] = useState(0);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const finished = useRef(false);
  const finishOnce = (st: FourBeat) => { if (st.done && !finished.current) { finished.current = true; onFinish(st.won); } };
  const tap = useRef(() => {});
  tap.current = () => {
    const r = fourBeatTap(s.current, performance.now() - t0.current);
    s.current = r.state;
    if (r.grade) { setFlash(r.grade); setTimeout(() => setFlash(null), 160); }
    finishOnce(s.current);
  };
  useEffect(() => {
    let raf = 0, prevA = false;
    const loop = () => {
      s.current = fourBeatTick(s.current, performance.now() - t0.current);
      finishOnce(s.current);
      const pad = navigator.getGamepads?.()[0], a = Boolean(pad?.buttons[0]?.pressed);
      if (a && !prevA && !s.current.done) tap.current();
      prevA = a;
      setFrame((f) => (f + 1) % 1e6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const key = (e: KeyboardEvent) => {
      if (e.repeat || (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
      if (e.code === "Space") { e.preventDefault(); if (!s.current.done) tap.current(); }
      if (e.code === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", key); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const t = performance.now() - t0.current, st = s.current, phase = fourBeatPhase(st, t);
  const ring = 1 - phase; // shrinks to the marker on each beat
  const left = Math.max(0, Math.ceil((FOURBEAT.timeoutMs - t) / 1000));
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/40" role="dialog" aria-label="Four-Beat Dance">
      <div className="hud-panel w-[min(92vw,380px)] p-5 text-center">
        <p className="hud-label">Four-Beat Dance</p>
        <button type="button" aria-label="Step on the beat" onClick={() => !st.done && tap.current()} className="relative mx-auto my-4 block h-48 w-48 rounded-full focus:outline-none" disabled={st.done}>
          <span className="absolute inset-0 rounded-full border-2" style={{ borderColor: color, opacity: 0.35 }} />
          <span className="absolute left-1/2 top-1/2 rounded-full border-4 transition-none" style={{ width: `${Math.max(8, ring * 100)}%`, height: `${Math.max(8, ring * 100)}%`, transform: "translate(-50%,-50%)", borderColor: flash === "hit" ? "#7dffca" : flash === "miss" ? "#ff6a6a" : color }} />
          <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: color, opacity: phase < 0.15 || phase > 0.85 ? 0.9 : 0.3 }} />
        </button>
        {st.done ? (
          <p className="font-mono text-2xl uppercase" style={{ color: st.won ? "#7dffca" : "#ff8a8a" }}>{st.won ? "On the four" : "Lost the beat"}</p>
        ) : (
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Space · click · pad A when the ring meets the centre</p>
        )}
        <p className="mt-2 font-mono text-sm">Steps {st.hits}/{FOURBEAT.hits} · misses {st.misses}/{FOURBEAT.misses}{st.done ? "" : ` · ${left}s`}</p>
        <Button className="mt-4" variant="outline" onClick={onClose}>{st.done ? "Done" : "Leave the floor"}</Button>
      </div>
    </div>
  );
}
