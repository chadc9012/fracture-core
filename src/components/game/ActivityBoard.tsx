import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ACTIVITIES, AREAS, activityState, msUntilReset, reputationOf, type ActivityDef } from "@/game/activities";
import type { PlayerProgression } from "@/game/progression";

const fmt = (ms: number) => { const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(s % 60).padStart(2, "0")}`; };
const STARS = ["", "I", "II", "III", "IV"];

/** Per-region activity board: type/difficulty, requirements, reward preview, attempts left, live real-time cooldown. Limits are real time (UTC), never the game clock. */
export function ActivityBoard({ progression, activeId, onStart }: { progression: PlayerProgression; activeId: string | null; onStart: (id: string) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const [area, setArea] = useState<string>("neon");
  const list = ACTIVITIES.filter((a) => a.area === area);
  const card = (a: ActivityDef) => {
    const st = activityState(progression, a, now);
    const locked = a.minRep && reputationOf(progression, a.faction) < a.minRep;
    const r = a.rewards;
    return <div key={a.id} className={`border p-3 ${st.available && !locked ? "border-border" : "border-border/50 opacity-80"}`}>
      <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">{a.kind} · difficulty {STARS[a.difficulty]}{a.submerged ? " · submersible access" : ""}</p><p className="mt-1 text-sm font-semibold">{a.name}</p></div>
        <span className="font-mono text-[9px] text-muted-foreground">{st.attemptsLeft}/{a.attempts} today</span></div>
      <p className="mt-1 text-xs text-muted-foreground">{a.brief}</p>
      <ul className="mt-2 font-mono text-[10px] text-muted-foreground">{a.stages.map((o, i) => <li key={i}>{i + 1}. {o.label}{"timeLimit" in o ? ` (${o.timeLimit}s)` : ""}</li>)}</ul>
      {a.challenge && <p className="mt-1 font-mono text-[10px] text-primary/80">Optional: {a.challenge.label} (+25%)</p>}
      <p className="mt-2 font-mono text-[10px]">{r.nex} Nex · {r.xp} XP · +{r.rep} {a.faction} rep · {Object.entries(r.materials).map(([k, v]) => `${v} ${k}`).join(", ")}{r.shaderChance > 0 ? ` · shader chance ${Math.round(r.shaderChance * 100)}%` : ""}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{activeId === a.id ? "In progress" : locked ? `Requires ${a.minRep} ${a.faction} reputation` : st.cooldownLeftMs > 0 ? `Cooldown ${fmt(st.cooldownLeftMs)}` : st.attemptsLeft <= 0 ? `Resets in ${fmt(msUntilReset(now))}` : "Ready"}</span>
        <Button size="sm" disabled={!st.available || Boolean(locked) || Boolean(activeId)} onClick={() => onStart(a.id)}>{activeId === a.id ? "Active" : "Start"}</Button>
      </div></div>;
  };
  return <section className="mt-6 border border-border p-4" aria-label="Activity board">
    <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Activity board</p>
    <p className="mt-1 text-xs text-muted-foreground">Cooldowns and daily attempts use real time and reset at 00:00 UTC. Starting spends an attempt; failing or abandoning does not refund it. A capped activity never blocks the others.</p>
    <div className="mt-3 flex flex-wrap gap-1">{Object.entries(AREAS).map(([id, a]) => <Button key={id} size="sm" variant={area === id ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => setArea(id)}>{a.name}</Button>)}</div>
    <div className="mt-3 grid gap-3 md:grid-cols-2">{list.map(card)}</div>
  </section>;
}
