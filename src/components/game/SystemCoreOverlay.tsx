import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { OBJECTIVE, type MissionEvent, type MissionRun } from "@/game/missions/system-core";
import { useVoiceLine } from "./useVoiceLine";

const NODES = [0, 1, 2];
const ACCENT = "#ff2e4e"; // distinct from Descent Protocol's cyan — this is the thing underneath Thalassia itself

/** Mission 05 presentation layer: NOVA line, in-world objective, the containment-lock stabilize
 * minigame (three locks, per the mission's own "three containment locks" beat), and the
 * completion banner leading into the ending. Boss combat itself needs no bespoke UI here — it's
 * the same BossHealthBar-style readout HUD.tsx already shows for any engaged boss, since the
 * System Core is summoned through the normal summonBoss() path (via unique-scenarios.ts). */
export function SystemCoreOverlay({ mission, onEvent }: { mission: MissionRun; onEvent: (e: MissionEvent) => void }) {
  useVoiceLine(`system-core-${mission.state}`, "NOVA", mission.nova, "critical");
  const [route, setRoute] = useState<number[]>([]);
  const order = useMemo(() => [...NODES].sort(() => Math.random() - 0.5), []);
  const stabilizing = mission.state === "STABILIZING";

  const pick = (n: number) => {
    const expected = order[route.length];
    if (n !== expected) {
      setRoute([]);
      onEvent({ type: "HACK", progress: 0 });
      return;
    }
    const next = [...route, n];
    setRoute(next.length === NODES.length ? [] : next);
    onEvent({ type: "HACK", progress: Math.min(100, (next.length / NODES.length) * 100) });
  };

  return <>
    {mission.state !== "WORLD_UPDATE" && <div className="pointer-events-none fixed right-3 top-24 z-20 max-w-xs border-l-2 p-3" style={{ borderColor: ACCENT, background: "color-mix(in oklch, var(--card) 80%, transparent)" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: ACCENT }}>The System Core</p>
      <p className="mt-1 text-sm">{OBJECTIVE[mission.state]}</p>
      {stabilizing && <p className="mt-1 font-mono text-[10px] text-muted-foreground">LOCKS {Math.round(mission.hack)}%</p>}
      {mission.state === "BOSS" && <p className="mt-1 font-mono text-[10px] text-muted-foreground">It shrugs off brute force — watch for its stagger window</p>}
    </div>}
    {mission.nova && <div className="pointer-events-none fixed bottom-24 left-3 z-20 flex max-w-sm items-start gap-3 border p-3" style={{ borderColor: `color-mix(in oklch, ${ACCENT} 40%, transparent)`, background: "color-mix(in oklch, var(--card) 80%, transparent)" }}>
      <span className="mt-1 size-3 shrink-0 animate-pulse rounded-full" style={{ background: ACCENT, boxShadow: `0 0 12px ${ACCENT}` }} />
      <p className="text-sm"><span className="font-mono text-[10px] uppercase" style={{ color: ACCENT }}>NOVA · </span>{mission.nova}</p>
    </div>}
    {stabilizing && <div className="fixed inset-0 z-30 grid place-items-center bg-background/40">
      <section className="w-[min(26rem,calc(100%-2rem))] border bg-card/90 p-5" style={{ borderColor: ACCENT }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: ACCENT }}>Containment lock · collapse sequence</p>
        <p className="mt-1 text-xs text-muted-foreground">Break the locks in sequence. Next: <b className="text-foreground">LOCK {(order[route.length] ?? 0) + 1}</b></p>
        <div className="mt-4 grid grid-cols-3 gap-2">{NODES.map((n) => <Button key={n} variant={route.includes(n) ? "default" : "outline"} onClick={() => pick(n)} className="h-14 rounded-none font-mono">{n + 1}</Button>)}</div>
      </section>
    </div>}
    {mission.state === "COMPLETE" && <div className="fixed inset-x-0 bottom-40 z-30 mx-auto w-fit border bg-card/90 p-4 text-center" style={{ borderColor: ACCENT }}>
      <p className="font-mono text-[10px] uppercase" style={{ color: ACCENT }}>The System Core is down</p>
      <p className="mt-1 text-sm">+ XP shards · the Fracture Descent, answered</p>
      <Button className="mt-3" onClick={() => onEvent({ type: "ACK" })}>Surface</Button>
    </div>}
  </>;
}
