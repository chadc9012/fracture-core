import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { HOOPS_GREEN_CENTRE, SHOTS, SPORTS, ballAt, greenHalf, meterAt, rallyTap, rallyTick, rallyWon, shoot, sportBest, sportResult, startHoops, startRally, tennisCall, type Hoops, type Rally, type SportId } from "@/game/sports";
import { attributeLevel, awardAttribute } from "@/game/attributes";
import type { PlayerProgression } from "@/game/progression";

/** The residences' multi-sport court (sports.ts): free throws, tennis, beach volleyball as timing games. Space, a tap on the
 * court or gamepad A hits / shoots; Esc or B leaves. Space is captured while it is open so the operator doesn't jump. */
export function CourtGames({ progression, onProgression, onClose, onToast }: { progression: PlayerProgression; onProgression: (p: PlayerProgression) => void; onClose: () => void; onToast: (text: string) => void }) {
  const [sport, setSport] = useState<SportId | null>(null);
  const agility = attributeLevel(progression, "agility");
  const seed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, "")) + Math.floor(Math.random() * 1000);
  const rally = useRef<Rally | null>(null), hoops = useRef<Hoops | null>(null);
  const [, setFrame] = useState(0);
  const [result, setResult] = useState<{ title: string; line: string } | null>(null);
  const progRef = useRef(progression); progRef.current = progression;
  const finish = (s: SportId, score: number, won: boolean) => {
    const r = sportResult(progRef.current, s, score, won);
    const a = awardAttribute(r.progression, "agility", r.agilityXp);
    onProgression(a.progression);
    const title = s === "hoops" ? `${score} / ${SHOTS} made` : won ? "You win!" : "Rival wins";
    setResult({ title, line: `+${r.agilityXp} Agility${a.levelUp ? ` · Agility Lv ${a.levelUp}!` : ""}${r.best ? " · new best" : ""}` });
    if (a.levelUp) onToast(`Agility up · Lv ${a.levelUp}`);
  };
  const begin = (s: SportId) => {
    setResult(null); setSport(s);
    const now = performance.now();
    rally.current = s === "hoops" ? null : startRally(s, seed, agility, now);
    hoops.current = s === "hoops" ? startHoops(seed, agility, now) : null;
  };
  const press = useRef(() => {});
  press.current = () => {
    if (!sport || result) return;
    const now = performance.now();
    if (hoops.current) { hoops.current = shoot(hoops.current, now); if (hoops.current.shot >= SHOTS) finish("hoops", hoops.current.made, hoops.current.made >= 6); }
    else if (rally.current) { rally.current = rallyTap(rally.current, now); }
    setFrame((f) => f + 1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); onClose(); return; }
      if (e.code !== "Space") return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat) press.current();
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); e.stopImmediatePropagation(); } };
    window.addEventListener("keydown", onKey, true); window.addEventListener("keyup", onUp, true);
    let raf = 0, prev: boolean[] = [];
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find((g): g is Gamepad => !!g && g.connected) : undefined;
      const btn = gp ? gp.buttons.map((b) => b.pressed) : [];
      if (btn[0] && !prev[0]) press.current();
      if (btn[1] && !prev[1]) onClose();
      prev = btn;
      const r = rally.current;
      if (r && r.phase !== "done") {
        const next = rallyTick(r, performance.now());
        rally.current = next;
        if (next.phase === "done") finish(next.sport, next.sport === "tennis" ? next.tennis.gamesP : next.volley.p, rallyWon(next));
      }
      setFrame((f) => (f + 1) % 1e6);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey, true); window.removeEventListener("keyup", onUp, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = performance.now();
  const r = rally.current, h = hoops.current;
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="Multi-sport court">
    <div className="w-full max-w-md border border-cyan-400/40 bg-[#0b1420] p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between"><p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-300">Courtyard · multi-sport court</p><button type="button" className="font-mono text-xs text-white/60" onClick={onClose} aria-label="Leave the court">Esc ×</button></div>
      <p className="mt-1 text-xs text-white/60">Agility Lv {agility} · a higher level widens your timing</p>
      {!sport && <ul className="mt-3 space-y-2">{SPORTS.map((s) => <li key={s.id}><button type="button" onClick={() => begin(s.id)} className="w-full border border-white/15 bg-white/5 px-3 py-2 text-left hover:border-cyan-300">
        <span className="font-semibold">{s.name}</span>{sportBest(progression, s.id) ? <span className="ml-2 font-mono text-[10px] text-cyan-300">best {sportBest(progression, s.id)}</span> : null}<span className="block text-xs text-white/60">{s.blurb}</span></button></li>)}</ul>}
      {sport && <div className="mt-3 select-none" onPointerDown={(e) => { e.preventDefault(); press.current(); }}>
        {h && <>
          <p className="text-center font-mono text-sm">Shot {Math.min(SHOTS, h.shot + 1)} / {SHOTS} · made {h.made}</p>
          <div className="relative mx-auto mt-3 h-56 w-14 overflow-hidden rounded border border-white/20 bg-white/5">
            <div className="absolute left-0 right-0 bg-emerald-500/50" style={{ bottom: `${(HOOPS_GREEN_CENTRE - greenHalf(agility)) * 100}%`, height: `${greenHalf(agility) * 200}%` }} />
            <div className="absolute left-0 right-0 h-1.5 bg-orange-400" style={{ bottom: `${meterAt(now - h.start) * 100}%` }} />
          </div>
          <p className="mt-2 h-5 text-center text-sm">{h.last === "swish" ? "Swish!" : h.last === "rim-in" ? "Off the rim… in!" : h.last === "miss" ? "Miss" : "Tap / Space to shoot"}</p>
        </>}
        {r && <>
          <p className="text-center font-mono text-sm">{r.sport === "tennis" ? `Games ${r.tennis.gamesP} – ${r.tennis.gamesO} · ${tennisCall(r.tennis)}` : `${r.volley.p} – ${r.volley.o}`}</p>
          <div className="relative mx-auto mt-3 h-64 w-40 rounded border border-white/30" style={{ background: r.sport === "tennis" ? "#2f6a4f" : "#d9c08a" }}>
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/80" />
            <div className="absolute bottom-0 left-0 right-0 h-10 border-t border-dashed border-yellow-300/80 bg-yellow-300/10" />
            <div className="absolute h-4 w-4 rounded-full bg-yellow-200 shadow" style={{ left: "calc(50% - 8px)", top: `calc(${ballAt(r, now) * 100}% - 8px)`, transition: "none" }} />
            <span className="absolute left-1 top-1 font-mono text-[10px] text-white/70">RIVAL</span><span className="absolute bottom-1 left-1 font-mono text-[10px] text-white/90">YOU</span>
          </div>
          <p className="mt-2 h-5 text-center text-sm">{r.log}</p>
          <p className="text-center text-[11px] text-white/50">Hit as the ball reaches the yellow zone · tap / Space</p>
        </>}
        {result && <div className="mt-3 border border-cyan-300/40 bg-cyan-300/10 p-3 text-center"><p className="text-lg font-semibold">{result.title}</p><p className="text-sm text-cyan-200">{result.line}</p></div>}
        <div className="mt-3 flex justify-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
          {result && <Button variant="outline" className="rounded-none" onClick={() => begin(sport)}>Play again</Button>}
          <Button variant="outline" className="rounded-none" onClick={() => { setSport(null); setResult(null); rally.current = null; hoops.current = null; }}>Other games</Button>
        </div>
      </div>}
    </div>
  </div>;
}
