import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ACTIVITIES, AREAS, CATEGORIES, FEATURED_BONUS, activityState, categoryOf, featuredFor, msUntilPeriodReset, msUntilReset, msUntilWeekReset, reputationOf, weeklyElitesFor, type ActivityDef, type Category } from "@/game/activities";
import type { PlayerProgression } from "@/game/progression";
import { convoyBoard } from "@/game/convoy";
import { DIFFICULTIES, bestMedal, difficultyLocked, isRaceActivity, personalBest, rankName, raceById, type Difficulty } from "@/game/racing";

const fmt = (ms: number) => { const s = Math.ceil(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(s % 60).padStart(2, "0")}`; };
const STARS = ["", "I", "II", "III", "IV"];

/** Regional Operations Board: organised work (side missions, bounties, movement & racing, underground, events) plus today's featured and this week's elite contracts.
 * Limits and rotations use real time (UTC), never the game clock. The world also hides discoveries (flags, beacons, patrols, rift fractures) that are not listed here. */
export function ActivityBoard({ progression, activeId, onStart }: { progression: PlayerProgression; activeId: string | null; onStart: (id: string, difficulty?: Difficulty) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const [area, setArea] = useState<string>("neon");
  const [cat, setCat] = useState<Category | "all">("all");
  const featured = featuredFor(now), elites = weeklyElitesFor(now), featuredIds = new Set(featured.map((f) => f.id));
  const list = ACTIVITIES.filter((a) => a.area === area && (cat === "all" || categoryOf(a) === cat));
  const card = (a: ActivityDef, tag?: string) => {
    const st = activityState(progression, a, now);
    const locked = Boolean(a.minRep && reputationOf(progression, a.faction) < a.minRep);
    const r = a.rewards;
    return <div key={`${tag ?? ""}${a.id}`} className={`border p-3 ${st.available ? "border-border" : "border-border/50 opacity-80"}`}>
      <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">{a.period === "week" ? "Weekly elite" : CATEGORIES.find((c) => c.id === categoryOf(a))?.label} · {AREAS[a.area]?.name} · difficulty {STARS[a.difficulty]}{a.submerged ? " · submersible access" : ""}</p><p className="mt-1 text-sm font-semibold">{a.name}{featuredIds.has(a.id) && a.period !== "week" ? <span className="ml-2 text-[9px] text-primary">FEATURED +{Math.round((FEATURED_BONUS - 1) * 100)}%</span> : null}</p></div>
        <span className="font-mono text-[9px] text-muted-foreground">{st.attemptsLeft}/{a.attempts} {a.period === "week" ? "this week" : "today"}</span></div>
      <p className="mt-1 text-xs text-muted-foreground">{a.brief}</p>
      <ul className="mt-2 font-mono text-[10px] text-muted-foreground">{a.stages.map((o, i) => <li key={i}>{i + 1}. {o.label}{"timeLimit" in o ? ` (${o.timeLimit}s)` : ""}</li>)}</ul>
      {a.challenge && <p className="mt-1 font-mono text-[10px] text-primary/80">Optional: {a.challenge.label} (+25%)</p>}
      <p className="mt-2 font-mono text-[10px]">{r.nex} Nex · {r.xp} XP · +{r.rep} {a.faction} rep · {Object.entries(r.materials).map(([k, v]) => `${v} ${k}`).join(", ")}{r.shaderChance > 0 ? ` · shader chance ${Math.round(r.shaderChance * 100)}%` : ""}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{activeId === a.id ? "In progress" : locked ? `Requires ${a.minRep} ${a.faction} reputation (you have ${reputationOf(progression, a.faction)})` : st.cooldownLeftMs > 0 ? `Cooldown ${fmt(st.cooldownLeftMs)}` : st.attemptsLeft <= 0 ? `Resets in ${fmt(msUntilPeriodReset(a, now))}` : "Ready"}</span>
        {isRaceActivity(a) ? <div className="flex gap-1">{DIFFICULTIES.map((d) => { const why = difficultyLocked(progression, raceById((a.stages[0] as { raceId: string }).raceId)!.id, d); const m = bestMedal(progression, a.id, d); return <Button key={d} size="sm" variant={d === "standard" ? "default" : "outline"} className="h-7 px-2 text-[9px]" title={why ?? `Best: ${personalBest(progression, a.id, d)?.toFixed(1) ?? "—"}s`} disabled={!st.available || Boolean(activeId) || Boolean(why)} onClick={() => onStart(a.id, d)}>{d.slice(0, 3).toUpperCase()}{m ? ` ${m[0]!.toUpperCase()}` : ""}</Button>; })}</div>
          : <Button size="sm" disabled={!st.available || Boolean(activeId)} onClick={() => onStart(a.id)}>{activeId === a.id ? "Active" : "Start"}</Button>}
      </div></div>;
  };
  return <section className="mt-6 border border-border p-4" aria-label="Regional operations board">
    <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Regional operations board</p>
    <p className="mt-1 font-mono text-[10px] text-primary">Racing rank: {rankName(progression)} · rank follows medals and championships, not races entered</p>
    <p className="mt-1 text-xs text-muted-foreground">Cooldowns, daily attempts and rotations use real time and reset at 00:00 UTC. Starting spends an attempt; failing or abandoning does not refund it. A capped activity never blocks the others. The board lists organised work; flags, beacons, patrols and rift fractures out in the world are not listed here, and hidden ones are only found by exploring.</p>
    <div className="mt-4"><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">Featured today · rotates in {fmt(msUntilReset(now))}</p><div className="mt-2 grid gap-3 md:grid-cols-2">{featured.map((a) => card(a, "f-"))}</div></div>
    <div className="mt-4"><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">Weekly elite operations · rotates in {fmt(msUntilWeekReset(now))}</p><div className="mt-2 grid gap-3 md:grid-cols-2">{elites.map((a) => card(a, "e-"))}</div></div>
    <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.25em] text-primary">All activities</p>
    <div className="mt-2 flex flex-wrap gap-1">{Object.entries(AREAS).map(([id, a]) => <Button key={id} size="sm" variant={area === id ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => setArea(id)}>{a.name}</Button>)}</div>
    <div className="mt-2 flex flex-wrap gap-1">{[{ id: "all" as const, label: "All" }, ...CATEGORIES].map((c) => <Button key={c.id} size="sm" variant={cat === c.id ? "default" : "ghost"} className="h-7 text-[10px]" onClick={() => setCat(c.id)}>{c.label}</Button>)}</div>
    {(() => { const row = convoyBoard(progression, now).find((r) => r.region === area); if (!row) return null; return <div className="mt-4 border border-border/60 p-3"><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">Convoy escort · {row.name} · highest cleared {row.highest}/10</p>
      <p className="mt-1 text-xs text-muted-foreground">Preview only: escort runs are not playable yet because the in-world convoy, enemies and vehicles are not built. Threat levels and lock rules below are live.</p>
      <ul className="mt-2 grid gap-1 font-mono text-[10px] text-muted-foreground md:grid-cols-2">{row.levels.map((l) => <li key={l.level}>{l.level}. {l.title}{l.locked ? ` — ${l.locked}` : " — open"}</li>)}</ul></div>; })()}
    <div className="mt-3 grid gap-3 md:grid-cols-2">{list.length ? list.map((a) => card(a)) : <p className="text-xs text-muted-foreground">Nothing in this category here yet.</p>}</div>
  </section>;
}
