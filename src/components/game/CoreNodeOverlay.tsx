import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { OBJECTIVE, type MissionEvent, type MissionRun } from "@/game/missions/core-node";
import { SequenceGame } from "./ZoneMissionOverlay";
import { useVoiceLine } from "./useVoiceLine";

const ACCENT = "#66e0ff"; // Nexus City's region accent (world.ts)

/** Core Node presentation: NOVA line, objective, the archive handshake (the shared sequence minigame), a
 * button to reopen the reveal conversation if it was skipped, and the completion banner. The conversation
 * itself is the shared StoryDialogue showing REVEAL_GRAPH; the allegiance is recorded by story.ts. */
export function CoreNodeOverlay({ mission, onEvent, talking, onTalk }: { mission: MissionRun; onEvent: (e: MissionEvent) => void; talking: boolean; onTalk: () => void }) {
  useVoiceLine(`core-node-${mission.state}`, "NOVA", mission.nova, "critical");
  const seed = useMemo(() => Math.floor(Math.random() * 1e9), []);
  const hacking = mission.state === "HACKING";

  return <>
    {mission.state !== "WORLD_UPDATE" && <div className="pointer-events-none fixed right-3 top-24 z-20 max-w-xs border-l-2 p-3" style={{ borderColor: ACCENT, background: "color-mix(in oklch, var(--card) 80%, transparent)" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: ACCENT }}>The Core Node</p>
      <p className="mt-1 text-sm">{OBJECTIVE[mission.state]}</p>
      {hacking && <p className="mt-1 font-mono text-[10px] text-muted-foreground">HANDSHAKE {Math.round(mission.hack)}%</p>}
    </div>}
    {mission.nova && !talking && <div className="pointer-events-none fixed bottom-24 left-3 z-20 flex max-w-sm items-start gap-3 border p-3" style={{ borderColor: `color-mix(in oklch, ${ACCENT} 40%, transparent)`, background: "color-mix(in oklch, var(--card) 80%, transparent)" }}>
      <span className="mt-1 size-3 shrink-0 animate-pulse rounded-full" style={{ background: ACCENT, boxShadow: `0 0 12px ${ACCENT}` }} />
      <p className="text-sm"><span className="font-mono text-[10px] uppercase" style={{ color: ACCENT }}>NOVA · </span>{mission.nova}</p>
    </div>}
    {hacking && mission.hack < 100 && <div className="fixed inset-0 z-30 grid place-items-center bg-background/40">
      <section className="w-[min(30rem,calc(100%-2rem))] border bg-card/90 p-5" style={{ borderColor: ACCENT }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: ACCENT }}>Archive handshake</p>
        <p className="mt-1 text-xs text-muted-foreground">Watch the node's handshake pattern, then repeat it.</p>
        <SequenceGame seed={seed} accent={ACCENT} onProgress={(p) => onEvent({ type: "HACK", progress: p })} />
      </section>
    </div>}
    {mission.state === "REVEAL" && !talking && <div className="fixed inset-x-0 bottom-40 z-30 mx-auto w-fit border bg-card/90 p-4 text-center" style={{ borderColor: ACCENT }}>
      <p className="font-mono text-[10px] uppercase" style={{ color: ACCENT }}>Archive open</p>
      <p className="mt-1 text-sm">NOVA has something to tell you.</p>
      <Button className="mt-3" onClick={onTalk}>Talk to NOVA</Button>
    </div>}
    {mission.state === "COMPLETE" && <div className="fixed inset-x-0 bottom-40 z-30 mx-auto w-fit border bg-card/90 p-4 text-center" style={{ borderColor: ACCENT }}>
      <p className="font-mono text-[10px] uppercase" style={{ color: ACCENT }}>Allegiance chosen · archive copied</p>
      <p className="mt-1 text-sm">+ XP shards · Data Shards · your choice will decide the ending</p>
      <Button className="mt-3" onClick={() => onEvent({ type: "ACK" })}>Leave the node</Button>
    </div>}
  </>;
}
