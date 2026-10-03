import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { OBJECTIVE, type MissionEvent, type MissionRun } from "@/game/missions/blackout-protocol";
import { playDialogueBlip } from "@/game/audio";

const NODES = [0, 1, 2, 3];

/** Mission 02 presentation layer: NOVA line, in-world objective, and the relay-cut hack minigame. */
export function BlackoutProtocolOverlay({ mission, onEvent }: { mission: MissionRun; onEvent: (e: MissionEvent) => void }) {
  useEffect(() => { if (mission.nova) playDialogueBlip("NOVA"); }, [mission.nova]);
  const [route, setRoute] = useState<number[]>([]);
  const order = useMemo(() => [...NODES].sort(() => Math.random() - 0.5), []);
  const hacking = mission.state === "HACKING";

  const pick = (n: number) => {
    const expected = order[route.length];
    if (n !== expected) {
      setRoute([]);
      onEvent({ type: "HACK", progress: mission.wave2Done ? 50 : 0 });
      return;
    }
    const next = [...route, n];
    setRoute(next.length === NODES.length ? [] : next);
    const base = mission.wave2Done ? 50 : 0;
    onEvent({ type: "HACK", progress: Math.min(100, base + (next.length / NODES.length) * 50) });
  };

  return <>
    {mission.state !== "WORLD_UPDATE" && <div className="pointer-events-none fixed right-3 top-24 z-20 max-w-xs border-l-2 border-[#38e8ff] bg-card/80 p-3 backdrop-blur">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#38e8ff]">Blackout Protocol</p>
      <p className="mt-1 text-sm">{OBJECTIVE[mission.state]}</p>
      {(hacking || mission.state === "COMBAT_2") && <p className="mt-1 font-mono text-[10px] text-muted-foreground">RELAY {Math.round(mission.hack)}%</p>}
    </div>}
    {mission.nova && <div className="pointer-events-none fixed bottom-24 left-3 z-20 flex max-w-sm items-start gap-3 border border-[#38e8ff]/40 bg-card/80 p-3 backdrop-blur">
      <span className="mt-1 size-3 shrink-0 animate-pulse rounded-full bg-[#38e8ff] shadow-[0_0_12px_#38e8ff]" />
      <p className="text-sm"><span className="font-mono text-[10px] uppercase text-[#38e8ff]">NOVA · </span>{mission.nova}</p>
    </div>}
    {hacking && <div className="fixed inset-0 z-30 grid place-items-center bg-background/40 backdrop-blur-sm">
      <section className="w-[min(26rem,calc(100%-2rem))] border border-[#38e8ff] bg-card/90 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#38e8ff]">Substation relay · cut grid power</p>
        <p className="mt-1 text-xs text-muted-foreground">Connect the relays in signal order. Next: <b className="text-foreground">RELAY {(order[route.length] ?? 0) + 1}</b></p>
        <div className="mt-4 grid grid-cols-4 gap-2">{NODES.map((n) => <Button key={n} variant={route.includes(n) ? "default" : "outline"} onClick={() => pick(n)} className="h-14 rounded-none font-mono">{n + 1}</Button>)}</div>
      </section>
    </div>}
    {mission.state === "COMPLETE" && <div className="fixed inset-x-0 bottom-40 z-30 mx-auto w-fit border border-[#38e8ff] bg-card/90 p-4 text-center">
      <p className="font-mono text-[10px] uppercase text-[#38e8ff]">District blacked out · grid offline</p>
      <p className="mt-1 text-sm">+ XP shards · Grid Access Key · Stitched Neon Core signal detected</p>
      <Button className="mt-3" onClick={() => onEvent({ type: "ACK" })}>Collect fragments</Button>
    </div>}
  </>;
}
