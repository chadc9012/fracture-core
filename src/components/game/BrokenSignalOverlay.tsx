import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { OBJECTIVE, type MissionEvent, type MissionRun } from "@/game/missions/broken-signal";

const NODES = [0, 1, 2, 3];

/** Mission 01 presentation layer: NOVA hologram line, in-world objective, and the node-route hack. */
export function BrokenSignalOverlay({ mission, onEvent }: { mission: MissionRun; onEvent: (e: MissionEvent) => void }) {
  const [glitch, setGlitch] = useState(mission.state === "TRIGGERED");
  const [route, setRoute] = useState<number[]>([]);
  const order = useMemo(() => [...NODES].sort(() => Math.random() - 0.5), []);
  useEffect(() => { if (mission.state === "TRIGGERED") { setGlitch(true); const t = setTimeout(() => setGlitch(false), 2600); return () => clearTimeout(t); } }, [mission.state]);

  const pick = (n: number) => {
    const expected = order[route.length];
    if (n !== expected) { setRoute([]); onEvent({ type: "HACK", progress: mission.wave2Done ? 50 : 0 }); return; }
    const next = [...route, n];
    setRoute(next.length === NODES.length ? [] : next);
    const base = mission.wave2Done ? 50 : 0;
    onEvent({ type: "HACK", progress: Math.min(100, base + (next.length / NODES.length) * 50) });
  };
  const hacking = mission.state === "HACKING";

  return <>
    {glitch && <div className="pointer-events-none fixed inset-x-0 top-24 z-30 mx-auto w-fit animate-pulse border border-destructive bg-background/70 px-6 py-3 font-mono text-lg uppercase tracking-[0.3em] text-destructive backdrop-blur">
      <span className="line-through opacity-60">Neon Core ad network active</span><br />Unauthorized signal detected
    </div>}
    {mission.state !== "WORLD_UPDATE" && <div className="pointer-events-none fixed right-3 top-24 z-20 max-w-xs border-l-2 border-primary bg-card/80 p-3 backdrop-blur">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">Broken Signal</p>
      <p className="mt-1 text-sm">{OBJECTIVE[mission.state]}</p>
      {(hacking || mission.state === "COMBAT_2") && <p className="mt-1 font-mono text-[10px] text-muted-foreground">DATA NODE {Math.round(mission.hack)}%</p>}
    </div>}
    {mission.nova && <div className="pointer-events-none fixed bottom-24 left-3 z-20 flex max-w-sm items-start gap-3 border border-primary/40 bg-card/80 p-3 backdrop-blur">
      <span className="mt-1 size-3 shrink-0 animate-pulse rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
      <p className="text-sm"><span className="font-mono text-[10px] uppercase text-primary">NOVA · </span>{mission.nova}</p>
    </div>}
    {hacking && <div className="fixed inset-0 z-30 grid place-items-center bg-background/40 backdrop-blur-sm">
      <section className="w-[min(26rem,calc(100%-2rem))] border border-primary bg-card/90 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">Neon terminal · route clean data</p>
        <p className="mt-1 text-xs text-muted-foreground">Connect the nodes in signal order. Next: <b className="text-foreground">NODE {order[route.length] + 1}</b></p>
        <div className="mt-4 grid grid-cols-4 gap-2">{NODES.map((n) => <Button key={n} variant={route.includes(n) ? "default" : "outline"} onClick={() => pick(n)} className="h-14 rounded-none font-mono">{n + 1}</Button>)}</div>
      </section>
    </div>}
    {mission.state === "COMPLETE" && <div className="fixed inset-x-0 bottom-40 z-30 mx-auto w-fit border border-primary bg-card/90 p-4 text-center">
      <p className="font-mono text-[10px] uppercase text-primary">Terminal pulse · drones offline</p>
      <p className="mt-1 text-sm">+ XP shards · Data Insight Fragment · Basic Skill System unlocked</p>
      <Button className="mt-3" onClick={() => onEvent({ type: "ACK" })}>Collect fragments</Button>
    </div>}
  </>;
}
