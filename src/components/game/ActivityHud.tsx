import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AREAS, type ActivityDef, type Payout, type Run } from "@/game/activities";
import { lapOf, livePlace, raceById, rivalPositions, timeLimit, worldPoint, type RaceDef, type RaceReward, type RaceResult, type RaceRun } from "@/game/racing";
import { HudRail } from "./HudRail";

/** In-world tracker for the running activity: objective, progress and the stage clock. */
export function ActivityTracker({ def, run, onAbandon, px, pz }: { def: ActivityDef; run: Run; onAbandon: () => void; /** where you are, for the race map and your live place */ px?: number; pz?: number }) {
  const [, setNow] = useState(0);
  useEffect(() => { const t = setInterval(() => setNow((n) => n + 1), 500); return () => clearInterval(t); }, []);
  const o = def.stages[run.stage]!;
  const limit = "timeLimit" in o ? o.timeLimit : 0;
  const left = limit ? Math.max(0, Math.ceil(limit - (Date.now() - run.stageStartedAt) / 1000)) : null;
  const need = o.kind === "deliver" ? 1 : run.need;
  const rr = run.race as RaceRun | undefined, race = o.kind === "race" ? raceById(o.raceId) : undefined;
  if (race) {
    const lim = timeLimit(race, (rr?.difficulty ?? "standard")), t = rr?.time ?? 0, total = race.points.length - 1;
    const line = !rr || rr.phase === "staging" ? "Go to the start line" : rr.phase === "countdown" ? `Starting in ${Math.ceil(rr.countdown)}…` : `Checkpoint ${Math.min(rr.next, total)}/${total}`;
    const fmtT = (x: number) => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, "0")}`;
    const standing = rr && px !== undefined && pz !== undefined ? livePlace(race, rr, px, pz) : null;
    return <>
      {/* reference: the sample track view — position and checkpoint top left, the race clock top right, the course map bottom left */}
      <HudRail side="left" order={1}><div className="pointer-events-auto absolute left-3 top-28 z-30 w-64 border-l-2 border-[var(--wf-ice)] bg-gradient-to-r from-background/85 to-background/30 p-3 font-mono text-[10px] backdrop-blur" role="status" aria-label="Active race">
        <p className="text-[9px] uppercase tracking-[0.25em] text-[var(--wf-ice)]">{AREAS[def.area]?.name} · {race.type} · {rr?.difficulty ?? "standard"}</p>
        <p className="mt-1 text-sm font-semibold uppercase tracking-wider">{race.name}</p>
        {rr?.phase === "running" && standing ? <div className="mt-2 flex gap-5">
          <div><p className="text-[9px] uppercase tracking-widest text-muted-foreground">Position</p><p className="text-2xl font-bold leading-none">{standing.place}<span className="text-sm text-muted-foreground">/{standing.field}</span></p></div>
          {race.laps > 1 && <div><p className="text-[9px] uppercase tracking-widest text-muted-foreground">Lap</p><p className="text-2xl font-bold leading-none">{lapOf(race, rr.next)}<span className="text-sm text-muted-foreground">/{race.laps}</span></p></div>}
          <div><p className="text-[9px] uppercase tracking-widest text-muted-foreground">Checkpoint</p><p className="text-2xl font-bold leading-none">{Math.min(rr.next, total)}<span className="text-sm text-muted-foreground">/{total}</span></p></div>
        </div> : <p className="mt-1 text-muted-foreground">{line}</p>}
        {rr?.notice && <p className="mt-1 text-destructive">{rr.notice}</p>}
        {race.style && rr && rr.style > 0 && <p className="mt-1 text-primary">Style {Math.round(rr.style)}</p>}
        <p className="mt-1 text-[9px] text-muted-foreground">{race.hazards.join(" · ")}</p>
        <Button size="sm" variant="outline" className="mt-2 h-6 text-[9px]" onClick={onAbandon}>Abandon (attempt is not refunded)</Button>
      </div></HudRail>
      {rr?.phase === "running" && <div className="pointer-events-none absolute right-4 top-24 z-30 text-right font-mono" aria-hidden="true">
        <p className="text-3xl font-bold tabular-nums tracking-wider drop-shadow">{fmtT(t + rr.penalties)}</p>
        <p className="text-[10px] text-muted-foreground">par {fmtT(race.par)} · limit {fmtT(lim)}{rr.penalties > 0 && <span className="ml-1 text-destructive">+{rr.penalties.toFixed(1)}s</span>}</p>
      </div>}
      {rr?.phase === "countdown" && <p className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 font-mono text-7xl font-bold text-[var(--wf-ice)] drop-shadow-lg" aria-live="assertive">{Math.ceil(rr.countdown)}</p>}
      {px !== undefined && pz !== undefined && <RaceMap race={race} run={rr} px={px} pz={pz} />}
    </>;
  }
  return <HudRail side="left" order={1}><div className="pointer-events-auto absolute left-3 top-28 z-30 w-64 border border-primary/60 bg-background/80 p-3 font-mono text-[10px] backdrop-blur" role="status" aria-label="Active activity">
    <p className="text-[9px] uppercase tracking-[0.25em] text-primary">{AREAS[def.area]?.name} · {def.kind === "crucible" ? "killbox" : def.kind}</p>
    <p className="mt-1 text-sm font-semibold">{def.name}</p>
    <p className="mt-1 text-muted-foreground">Stage {run.stage + 1}/{def.stages.length} · {o.label}</p>
    <p className="mt-1">{o.kind === "deliver" ? (run.carrying ? "Cargo picked up — deliver it" : "Go to the pickup") : `${Math.min(run.progress, need)} / ${need}`}{left !== null && <span className={`ml-2 ${left < 15 ? "text-destructive" : "text-primary"}`}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}</p>
    {def.challenge && <p className="mt-1 text-[9px] text-primary/80">Bonus: {def.challenge.label}</p>}
    <Button size="sm" variant="outline" className="mt-2 h-6 text-[9px]" onClick={onAbandon}>Abandon (attempt is not refunded)</Button>
  </div></HudRail>;
}

export type ActivityResult = { def: ActivityDef; ok: boolean; reason?: string; payout?: Payout; race?: { result: RaceResult; reward: RaceReward; name: string }; /** hidden discoveries a beacon just revealed */ revealed?: number };
export function ActivityResultPanel({ result, onDone }: { result: ActivityResult; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 9000); return () => clearTimeout(t); }, [onDone]);
  const p = result.payout;
  return <div className="pointer-events-auto absolute left-1/2 top-24 z-40 w-80 -translate-x-1/2 border border-primary bg-background/90 p-4 font-mono text-xs backdrop-blur" role="alert">
    <p className="text-[9px] uppercase tracking-[0.3em] text-primary">{result.ok ? "Activity complete" : "Activity failed"}</p>
    <p className="mt-1 text-base font-semibold">{result.def.name}</p>
    {result.ok && p ? <ul className="mt-2 space-y-1">
      <li>+{p.nex} Nex · +{p.xp} XP · +{p.rep} reputation</li>
      {Object.entries(p.materials).map(([k, v]) => <li key={k}>+{v} {k}</li>)}
      {result.race && <li className="text-primary">{result.race.name}: {result.race.result.time.toFixed(1)}s (par {result.race.result.par}s) · place {result.race.result.place}/{result.race.result.field}{result.race.result.medal ? ` · ${result.race.result.medal} medal` : ""}{result.race.reward.personalBest ? " · NEW BEST" : ""}</li>}
      {result.race && result.race.reward.nexBonus > 0 && <li>+{result.race.reward.nexBonus} Nex placement bonus</li>}
      {result.race?.reward.championshipPoints ? <li>Championship points: +{result.race.reward.championshipPoints}{result.race.reward.championshipDone ? " · CHAMPIONSHIP COMPLETE" : ""}</li> : null}
      {result.race?.reward.rankUp ? <li className="text-primary">Racing rank up: {result.race.reward.rankUp}</li> : null}
      {result.race && result.race.reward.rivalsFirstBeaten.length > 0 && <li className="text-primary">First win over {result.race.reward.rivalsFirstBeaten.join(", ")}</li>}
      {p.featured && <li className="text-primary">Featured contract bonus (+50%)</li>}
      {result.revealed ? <li className="text-primary">{result.revealed} hidden signal{result.revealed > 1 ? "s" : ""} marked on your map when you get near</li> : null}
      {p.shader && <li className="text-primary">Shader unlocked: {p.shader}</li>}
      {p.bonus ? <li className="text-primary">Bonus challenge met (+25%)</li> : result.def.challenge && <li className="text-muted-foreground">Bonus missed: {result.def.challenge.label}</li>}
      <li className="text-muted-foreground">Cooldown started — see the Activity Board.</li>
    </ul> : <p className="mt-2 text-muted-foreground">{result.reason}. The attempt was spent and is not refunded; other activities stay available.</p>}
    <Button size="sm" className="mt-3" onClick={onDone}>Close</Button>
  </div>;
}

/** the course from above (reference: the sample track view's corner map): the route, passed gates dimmed, the next gate
 * ringed, the rivals on their real pace and you, north up */
function RaceMap({ race, run, px, pz }: { race: RaceDef; run: RaceRun | undefined; px: number; pz: number }) {
  const per = (race.points.length - 1) / race.laps;
  // one lap of the circuit; the next gate is shown on the lap you are on
  const pts = race.points.slice(0, per + 1).map((_, i) => worldPoint(race, i));
  const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z), pad = 20;
  const x0 = Math.min(...xs) - pad, z0 = Math.min(...zs) - pad, span = Math.max(Math.max(...xs) - x0, Math.max(...zs) - z0) + pad;
  const next = run && run.phase === "running" ? ((run.next - 1) % per) + 1 : 0, rivals = run && run.phase === "running" ? rivalPositions(race, run.difficulty, run.time) : [];
  const sw = span / 90;
  return <div className="pointer-events-none absolute bottom-40 left-3 z-30 size-40 rounded-full border border-[var(--wf-line)] bg-background/70 p-2 backdrop-blur sm:bottom-44" aria-hidden="true">
    <svg viewBox={`${x0} ${z0} ${span} ${span}`} className="size-full">
      <polyline points={pts.map((p) => `${p.x},${p.z}`).join(" ")} fill="none" stroke="#0b1622" strokeWidth={sw * 5} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts.map((p) => `${p.x},${p.z}`).join(" ")} fill="none" stroke="#92e9f5" strokeOpacity={0.85} strokeWidth={sw * 2.2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.slice(0, Math.max(1, next)).length > 1 && <polyline points={pts.slice(0, Math.max(1, next)).map((p) => `${p.x},${p.z}`).join(" ")} fill="none" stroke="#3a5566" strokeWidth={sw * 2.4} strokeLinejoin="round" strokeLinecap="round" />}
      <circle cx={pts[0]!.x} cy={pts[0]!.z} r={sw * 3} fill="#ffffff" />
      {pts[next] && <circle cx={pts[next]!.x} cy={pts[next]!.z} r={sw * 5} fill="none" stroke="#ffd166" strokeWidth={sw * 1.6} />}
      {rivals.map((r, i) => <circle key={i} cx={r.x} cy={r.z} r={sw * 2.6} fill="#ff6b6b" />)}
      <circle cx={px} cy={pz} r={sw * 3.4} fill="#7dffb0" stroke="#03120a" strokeWidth={sw} />
    </svg>
  </div>;
}
