import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { OBJECTIVE, MIRRORS, HEADINGS, alignProgress, mirrorStart, misalignment, rotateMirror, type MirrorState, type MissionEvent, type MissionRun } from "@/game/missions/solar-array";
import { useVoiceLine } from "./useVoiceLine";

const ACCENT = "#ffe8a8"; // Solara's own region accent (world.ts)
const IDX = Array.from({ length: MIRRORS }, (_, i) => i);

/** Solara story mission presentation: NOVA line, in-world objective, the mirror-realignment minigame
 * and the completion banner. The Unbroken Glass is summoned through summonBoss(), so the HUD's boss
 * readout and poise window cover the fight. Rules live in solar-array.ts. */
export function SolarArrayOverlay({ mission, onEvent }: { mission: MissionRun; onEvent: (e: MissionEvent) => void }) {
  useVoiceLine(`solar-array-${mission.state}`, "NOVA", mission.nova, "critical");
  const seed = useMemo(() => Math.floor(Math.random() * 1e9), []);
  const [mirrors, setMirrors] = useState<MirrorState>(() => mirrorStart(seed));
  const realigning = mission.state === "REALIGNING";

  const turn = (i: number, step: 1 | -1) => {
    const next = rotateMirror(mirrors, seed, i, step);
    if (next === mirrors) return;
    setMirrors(next);
    onEvent({ type: "HACK", progress: alignProgress(next) });
  };

  return <>
    {mission.state !== "WORLD_UPDATE" && <div className="pointer-events-none fixed right-3 top-24 z-20 max-w-xs border-l-2 p-3" style={{ borderColor: ACCENT, background: "color-mix(in oklch, var(--card) 80%, transparent)" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: ACCENT }}>Solar Array Alpha</p>
      <p className="mt-1 text-sm">{OBJECTIVE[mission.state]}</p>
      {realigning && <p className="mt-1 font-mono text-[10px] text-muted-foreground">MIRRORS {Math.round(mission.hack)}%</p>}
      {mission.state === "BOSS" && <p className="mt-1 font-mono text-[10px] text-muted-foreground">Light fractures across its shell before it destabilizes. Hit it then.</p>}
    </div>}
    {mission.nova && <div className="pointer-events-none fixed bottom-24 left-3 z-20 flex max-w-sm items-start gap-3 border p-3" style={{ borderColor: `color-mix(in oklch, ${ACCENT} 40%, transparent)`, background: "color-mix(in oklch, var(--card) 80%, transparent)" }}>
      <span className="mt-1 size-3 shrink-0 animate-pulse rounded-full" style={{ background: ACCENT, boxShadow: `0 0 12px ${ACCENT}` }} />
      <p className="text-sm"><span className="font-mono text-[10px] uppercase" style={{ color: ACCENT }}>NOVA · </span>{mission.nova}</p>
    </div>}
    {realigning && alignProgress(mirrors) < 100 && <div className="fixed inset-0 z-30 grid place-items-center bg-background/40">
      <section className="w-[min(30rem,calc(100%-2rem))] border bg-card/90 p-5" style={{ borderColor: ACCENT }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: ACCENT }}>Mirror realignment</p>
        <p className="mt-1 text-xs text-muted-foreground">Turn each mirror until its beam is at full strength. It locks when it hits the collector.</p>
        <div className="mt-4 grid grid-cols-3 gap-3">{IDX.map((i) => {
          const off = misalignment(mirrors, seed, i);
          const strength = mirrors.locked[i] ? 100 : Math.round(((HEADINGS / 2 - off) / (HEADINGS / 2)) * 100);
          return <div key={i} className="flex flex-col items-center gap-2 border p-2" style={{ borderColor: mirrors.locked[i] ? ACCENT : "var(--border)" }}>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Mirror {i + 1}</span>
            <span className="block h-10 w-1.5 origin-bottom rounded-full transition-transform" style={{ background: ACCENT, transform: `rotate(${(mirrors.heading[i] ?? 0) * (360 / HEADINGS)}deg)` }} />
            <div className="h-1 w-full bg-border"><div className="h-1" style={{ width: `${strength}%`, background: ACCENT }} /></div>
            <span className="font-mono text-[10px]">{mirrors.locked[i] ? "LOCKED" : `BEAM ${strength}%`}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={mirrors.locked[i]} onClick={() => turn(i, -1)} className="rounded-none font-mono">◀</Button>
              <Button size="sm" variant="outline" disabled={mirrors.locked[i]} onClick={() => turn(i, 1)} className="rounded-none font-mono">▶</Button>
            </div>
          </div>;
        })}</div>
      </section>
    </div>}
    {mission.state === "COMPLETE" && <div className="fixed inset-x-0 bottom-40 z-30 mx-auto w-fit border bg-card/90 p-4 text-center" style={{ borderColor: ACCENT }}>
      <p className="font-mono text-[10px] uppercase" style={{ color: ACCENT }}>Unbroken Glass shattered · beam realigned</p>
      <p className="mt-1 text-sm">+ XP shards · Anomaly Carbon · the beam leads to Nexus City</p>
      <Button className="mt-3" onClick={() => onEvent({ type: "ACK" })}>Trace the beam</Button>
    </div>}
  </>;
}
