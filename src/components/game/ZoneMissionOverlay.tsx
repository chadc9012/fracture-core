import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ZONE_MISSIONS, type MissionEvent, type MissionRun,
  SEQ_GLYPHS, SEQ_LENGTH, sequenceFor, enterGlyph, sequenceProgress, type SequenceState,
  DIALS, DIAL_STEPS, dialStart, dialTarget, turnDial, dialProgress, type DialState,
  MATCH_LOCKS, MATCH_CODES, matchStart, matchSignature, pickCode, matchProgress, type MatchState,
} from "@/game/missions/zone-missions";
import { useVoiceLine } from "./useVoiceLine";

type Props = { mission: MissionRun; onEvent: (e: MissionEvent) => void };

/** Presentation for the shared zone missions (Frozen Beacon / Failure Core / Convoy Breaker): NOVA line,
 * in-world objective, that mission's minigame and the completion banner. Bosses are catalog bosses
 * summoned through summonBoss(), so the HUD's boss readout covers the fight. Rules live in zone-missions.ts. */
export function ZoneMissionOverlay({ mission, onEvent }: Props) {
  const spec = ZONE_MISSIONS[mission.id];
  const accent = spec.accent;
  useVoiceLine(`${mission.id}-${mission.state}`, "NOVA", mission.nova, "critical");
  const seed = useMemo(() => Math.floor(Math.random() * 1e9), []);
  const hacking = mission.state === "HACKING";

  return <>
    {mission.state !== "WORLD_UPDATE" && <div className="pointer-events-none fixed right-3 top-24 z-20 max-w-xs border-l-2 p-3" style={{ borderColor: accent, background: "color-mix(in oklch, var(--card) 80%, transparent)" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: accent }}>{spec.title}</p>
      <p className="mt-1 text-sm">{spec.objective[mission.state]}</p>
      {hacking && <p className="mt-1 font-mono text-[10px] text-muted-foreground">{spec.hackLabel.toUpperCase()} {Math.round(mission.hack)}%</p>}
      {mission.state === "BOSS" && <p className="mt-1 font-mono text-[10px] text-muted-foreground">{spec.bossHint}</p>}
    </div>}
    {mission.nova && <div className="pointer-events-none fixed bottom-24 left-3 z-20 flex max-w-sm items-start gap-3 border p-3" style={{ borderColor: `color-mix(in oklch, ${accent} 40%, transparent)`, background: "color-mix(in oklch, var(--card) 80%, transparent)" }}>
      <span className="mt-1 size-3 shrink-0 animate-pulse rounded-full" style={{ background: accent, boxShadow: `0 0 12px ${accent}` }} />
      <p className="text-sm"><span className="font-mono text-[10px] uppercase" style={{ color: accent }}>NOVA · </span>{mission.nova}</p>
    </div>}
    {hacking && mission.hack < 100 && <div className="fixed inset-0 z-30 grid place-items-center bg-background/40">
      <section className="w-[min(30rem,calc(100%-2rem))] border bg-card/90 p-5" style={{ borderColor: accent }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: accent }}>{spec.hackLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">{spec.hackHelp}</p>
        {spec.minigame === "sequence" && <SequenceGame seed={seed} accent={accent} onProgress={(p) => onEvent({ type: "HACK", progress: p })} />}
        {spec.minigame === "dial" && <DialGame seed={seed} accent={accent} onProgress={(p) => onEvent({ type: "HACK", progress: p })} />}
        {spec.minigame === "match" && <MatchGame seed={seed} accent={accent} onProgress={(p) => onEvent({ type: "HACK", progress: p })} />}
      </section>
    </div>}
    {mission.state === "COMPLETE" && <div className="fixed inset-x-0 bottom-40 z-30 mx-auto w-fit border bg-card/90 p-4 text-center" style={{ borderColor: accent }}>
      <p className="font-mono text-[10px] uppercase" style={{ color: accent }}>{spec.completeBanner}</p>
      <p className="mt-1 text-sm">{spec.completeReward}</p>
      <Button className="mt-3" onClick={() => onEvent({ type: "ACK" })}>{spec.ackLabel}</Button>
    </div>}
  </>;
}

type GameProps = { seed: number; accent: string; onProgress: (p: number) => void };

/** Memorize-and-repeat: the pattern plays once per "Show pattern"; a slip restarts the entry. */
function SequenceGame({ seed, accent, onProgress }: GameProps) {
  const seq = useMemo(() => sequenceFor(seed), [seed]);
  const [state, setState] = useState<SequenceState>({ entered: 0 });
  const [showing, setShowing] = useState(-1);
  useEffect(() => {
    if (showing < 0) return;
    const t = window.setTimeout(() => setShowing((i) => (i + 1 < SEQ_LENGTH ? i + 1 : -1)), 650);
    return () => window.clearTimeout(t);
  }, [showing]);
  const press = (g: number) => {
    if (showing >= 0) return;
    const next = enterGlyph(state, seed, g);
    setState(next);
    onProgress(sequenceProgress(next));
  };
  return <div className="mt-4">
    <div className="flex h-12 items-center justify-center gap-2 border font-mono text-2xl" style={{ borderColor: accent }}>
      {showing >= 0 ? <span style={{ color: accent }}>{SEQ_GLYPHS[seq[showing] ?? 0]}</span> : <span className="text-xs text-muted-foreground">{state.entered}/{SEQ_LENGTH} entered</span>}
    </div>
    <div className="mt-3 grid grid-cols-4 gap-2">{SEQ_GLYPHS.map((g, i) => <Button key={g} variant="outline" disabled={showing >= 0} onClick={() => press(i)} className="h-14 rounded-none text-xl">{g}</Button>)}</div>
    <Button variant="ghost" className="mt-2 w-full rounded-none font-mono text-xs" disabled={showing >= 0} onClick={() => { setState({ entered: 0 }); setShowing(0); }}>Show pattern</Button>
  </div>;
}

/** Valves: raise or lower each one until it locks on the pressure the core can hold. */
function DialGame({ seed, accent, onProgress }: GameProps) {
  const [state, setState] = useState<DialState>(() => dialStart(seed));
  const turn = (i: number, step: 1 | -1) => {
    const next = turnDial(state, seed, i, step);
    if (next === state) return;
    setState(next);
    onProgress(dialProgress(next));
  };
  return <div className="mt-4 grid grid-cols-3 gap-3">{Array.from({ length: DIALS }, (_, i) => {
    const v = state.value[i] ?? 0, t = dialTarget(seed, i), off = Math.abs(v - t);
    return <div key={i} className="flex flex-col items-center gap-2 border p-2" style={{ borderColor: state.locked[i] ? accent : "var(--border)" }}>
      <span className="font-mono text-[10px] uppercase text-muted-foreground">Valve {i + 1}</span>
      <div className="flex h-24 w-3 flex-col-reverse bg-border">{Array.from({ length: DIAL_STEPS }, (_, k) => <span key={k} className="flex-1 border-t border-background" style={{ background: k <= v ? accent : "transparent", opacity: k === t ? 1 : 0.55 }} />)}</div>
      <span className="font-mono text-[10px]">{state.locked[i] ? "HOLDING" : off <= 1 ? "CLOSE" : v > t ? "TOO HIGH" : "TOO LOW"}</span>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" disabled={state.locked[i]} onClick={() => turn(i, -1)} className="rounded-none font-mono">−</Button>
        <Button size="sm" variant="outline" disabled={state.locked[i]} onClick={() => turn(i, 1)} className="rounded-none font-mono">+</Button>
      </div>
    </div>;
  })}</div>;
}

/** Override locks: each shows a signature; pick the code that fits it. */
function MatchGame({ seed, accent, onProgress }: GameProps) {
  const [state, setState] = useState<MatchState>(() => matchStart());
  const lock = state.locked.findIndex((l) => !l);
  const pick = (code: number) => {
    if (lock < 0) return;
    const next = pickCode(state, seed, lock, code);
    setState(next);
    onProgress(matchProgress(next));
  };
  if (lock < 0) return null;
  return <div className="mt-4">
    <div className="flex items-center justify-between border p-3 font-mono" style={{ borderColor: accent }}>
      <span className="text-[10px] uppercase text-muted-foreground">Lock {lock + 1} of {MATCH_LOCKS}</span>
      <span className="text-lg tracking-widest" style={{ color: accent }}>{matchSignature(seed, lock)}</span>
    </div>
    <div className="mt-3 grid grid-cols-4 gap-2">{MATCH_CODES.map((c, i) => <Button key={c} variant="outline" onClick={() => pick(i)} className="h-12 rounded-none font-mono">{c}</Button>)}</div>
    {state.misses > 0 && <p className="mt-2 font-mono text-[10px] text-muted-foreground">Rejected {state.misses}×. Read the digits in the signature.</p>}
  </div>;
}
