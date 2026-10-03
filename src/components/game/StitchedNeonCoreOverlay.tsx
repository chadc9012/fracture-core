import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { OBJECTIVE, type MissionEvent, type MissionRun } from "@/game/missions/stitched-neon-core";
import { useVoiceLine } from "./useVoiceLine";

const NODES = [0, 1, 2, 3, 4];
const ACCENT = "#ff3df2"; // distinct from Blackout Protocol's cyan — this is the thing underneath it

/** Mission 03 presentation layer: NOVA line, in-world objective, the resonance-node stabilize
 * minigame, and the completion banner leading into the Thalassia hook. Boss combat itself needs
 * no bespoke UI here — it's the same BossHealthBar/EmergencyQuestBanner-style readout HUD.tsx
 * already shows for any engaged boss, since Aegis-Prime is summoned through the normal
 * summonBoss() path. */
export function StitchedNeonCoreOverlay({ mission, onEvent }: { mission: MissionRun; onEvent: (e: MissionEvent) => void }) {
  useVoiceLine(`neon-core-${mission.state}`, "NOVA", mission.nova, "critical");
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
    {mission.state !== "WORLD_UPDATE" && <div className="pointer-events-none fixed right-3 top-24 z-20 max-w-xs border-l-2 p-3 backdrop-blur" style={{ borderColor: ACCENT, background: "color-mix(in oklch, var(--card) 80%, transparent)" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: ACCENT }}>Stitched Neon Core</p>
      <p className="mt-1 text-sm">{OBJECTIVE[mission.state]}</p>
      {stabilizing && <p className="mt-1 font-mono text-[10px] text-muted-foreground">NODES {Math.round(mission.hack)}%</p>}
      {mission.state === "BOSS" && <p className="mt-1 font-mono text-[10px] text-muted-foreground">Shield panels open before the pulse — watch the tell</p>}
    </div>}
    {mission.nova && <div className="pointer-events-none fixed bottom-24 left-3 z-20 flex max-w-sm items-start gap-3 border p-3 backdrop-blur" style={{ borderColor: `color-mix(in oklch, ${ACCENT} 40%, transparent)`, background: "color-mix(in oklch, var(--card) 80%, transparent)" }}>
      <span className="mt-1 size-3 shrink-0 animate-pulse rounded-full" style={{ background: ACCENT, boxShadow: `0 0 12px ${ACCENT}` }} />
      <p className="text-sm"><span className="font-mono text-[10px] uppercase" style={{ color: ACCENT }}>NOVA · </span>{mission.nova}</p>
    </div>}
    {stabilizing && <div className="fixed inset-0 z-30 grid place-items-center bg-background/40 backdrop-blur-sm">
      <section className="w-[min(26rem,calc(100%-2rem))] border bg-card/90 p-5" style={{ borderColor: ACCENT }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: ACCENT }}>Resonance node · stabilize sequence</p>
        <p className="mt-1 text-xs text-muted-foreground">Touch the nodes in resonance order. Next: <b className="text-foreground">NODE {(order[route.length] ?? 0) + 1}</b></p>
        <div className="mt-4 grid grid-cols-5 gap-2">{NODES.map((n) => <Button key={n} variant={route.includes(n) ? "default" : "outline"} onClick={() => pick(n)} className="h-14 rounded-none font-mono">{n + 1}</Button>)}</div>
      </section>
    </div>}
    {mission.state === "COMPLETE" && <div className="fixed inset-x-0 bottom-40 z-30 mx-auto w-fit border bg-card/90 p-4 text-center" style={{ borderColor: ACCENT }}>
      <p className="font-mono text-[10px] uppercase" style={{ color: ACCENT }}>Aegis-Prime down · core exposed</p>
      <p className="mt-1 text-sm">+ XP shards · Aegis Core · a signal from under Thalassia</p>
      <Button className="mt-3" onClick={() => onEvent({ type: "ACK" })}>Collect fragments</Button>
    </div>}
  </>;
}
