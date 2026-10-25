import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ARROWS, LEAD_IN, PAD_ARROW, danceBest, danceSet, expire, finished, keyArrow, press, recordDance, result, type Arrow, type Beat, type DanceResult, type Judgement } from "@/game/dance";
import { VENUES } from "@/game/nightlife";
import type { PlayerProgression } from "@/game/progression";

const GLYPH: Record<Arrow, string> = { left: "◀", up: "▲", down: "▼", right: "▶" };
const LANE_COLOR: Record<Arrow, string> = { left: "#ff3b9d", up: "#35efff", down: "#7a5cff", right: "#ffc247" };
const SCROLL = 1.6; // seconds an arrow takes to fall to the line

/** The dance floor overlay (dance.ts): tonight's set scrolls down four lanes; hit each arrow on the line with the arrow
 * keys / WASD or the d-pad. Keys are captured while it is open so the operator doesn't walk off. Esc / B leaves. */
export function DanceFloor({ venueId, progression, onProgression, onClose, onFinish }: { onFinish?: (r: DanceResult) => void; venueId: string; progression: PlayerProgression; onProgression: (p: PlayerProgression) => void; onClose: () => void }) {
  const venue = VENUES.find((v) => v.id === venueId);
  const beats = useRef<Beat[]>(danceSet(venueId, new Date().toISOString().slice(0, 10)));
  const start = useRef(performance.now());
  const [, setFrame] = useState(0);
  const [flash, setFlash] = useState<{ j: Judgement; at: number } | null>(null);
  const [done, setDone] = useState<DanceResult | null>(null);
  const best = danceBest(progression, venueId);
  const progRef = useRef(progression); progRef.current = progression;

  useEffect(() => {
    const now = () => (performance.now() - start.current) / 1000;
    const hit = (a: Arrow) => { const j = press(beats.current, a, now()); if (j) setFlash({ j, at: performance.now() }); };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); onClose(); return; }
      const a = keyArrow(e.code);
      if (!a) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat && !done) hit(a);
    };
    window.addEventListener("keydown", onKey, true);
    let raf = 0, prev: boolean[] = [];
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find((g): g is Gamepad => !!g && g.connected) : undefined;
      const btn = gp ? gp.buttons.map((b) => b.pressed) : [];
      for (const [i, a] of Object.entries(PAD_ARROW)) if (btn[+i] && !prev[+i]) hit(a);
      if (btn[1] && !prev[1]) onClose();
      prev = btn;
      expire(beats.current, now());
      if (finished(beats.current)) {
        cancelAnimationFrame(raf);
        const r = result(beats.current);
        setDone(r);
        onFinish?.(r);
        const next = recordDance(progRef.current, venueId, r.score);
        if (next !== progRef.current) onProgression(next);
        return;
      }
      setFrame((f) => f + 1);
    };
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("keydown", onKey, true); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = (performance.now() - start.current) / 1000;
  const live = result(beats.current);
  return (
    <div className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-black/40" role="dialog" aria-label="Dance floor">
      <div className="w-[min(92vw,420px)] border border-white/20 bg-[#0b0712]/90 p-4 text-white" style={{ boxShadow: `0 0 40px ${venue?.color ?? "#c040ff"}55` }}>
        <div className="flex items-baseline justify-between"><p className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: venue?.color }}>{venue?.name ?? "Dance floor"} · tonight's set</p><p className="font-mono text-xs text-white/60">Best {best.toLocaleString()}</p></div>
        {!done ? <>
          <div className="relative mt-3 h-[52vh] max-h-[420px] overflow-hidden border border-white/10 bg-black/50">
            {ARROWS.map((a, i) => <div key={a} className="absolute top-0 h-full border-l border-white/5" style={{ left: `${i * 25}%`, width: "25%" }} />)}
            <div className="absolute inset-x-0 bottom-[12%] h-[2px] bg-white/70" />
            {ARROWS.map((a, i) => <span key={a} className="absolute bottom-[8%] w-1/4 text-center text-2xl opacity-40" style={{ left: `${i * 25}%`, color: LANE_COLOR[a] }}>{GLYPH[a]}</span>)}
            {beats.current.filter((b) => b.hit === null && b.t - t < SCROLL && b.t - t > -0.3).map((b, k) => {
              const y = 88 - ((b.t - t) / SCROLL) * 88;
              return <span key={`${b.t}-${k}`} className="absolute w-1/4 text-center text-3xl" style={{ left: `${ARROWS.indexOf(b.arrow) * 25}%`, top: `${y - 4}%`, color: LANE_COLOR[b.arrow], textShadow: `0 0 12px ${LANE_COLOR[b.arrow]}` }}>{GLYPH[b.arrow]}</span>;
            })}
            {t < LEAD_IN && <p className="absolute inset-0 flex items-center justify-center font-mono text-4xl">{Math.ceil(LEAD_IN - t)}</p>}
            {flash && performance.now() - flash.at < 400 && <p className="absolute inset-x-0 top-[40%] text-center font-mono text-xl uppercase tracking-widest" style={{ color: flash.j === "perfect" ? "#7ef2b0" : flash.j === "good" ? "#92e9f5" : "#ff6b6b" }}>{flash.j}</p>}
          </div>
          <p className="mt-2 flex justify-between font-mono text-xs"><span>Score {live.score.toLocaleString()}</span><span>Arrow keys · WASD · d-pad · Esc leaves</span></p>
        </> : <div className="mt-4 space-y-2 text-center">
          <p className="font-mono text-6xl" style={{ color: venue?.color }}>{done.grade}</p>
          <p className="font-mono text-lg">{done.score.toLocaleString()}{done.score > best ? " · new best" : ""}</p>
          <p className="font-mono text-xs text-white/70">{done.perfect} perfect · {done.good} good · {done.miss} missed · combo {done.bestCombo}</p>
          <Button className="mt-2 w-full rounded-none" onClick={onClose}>Back to the bar</Button>
        </div>}
      </div>
    </div>
  );
}
