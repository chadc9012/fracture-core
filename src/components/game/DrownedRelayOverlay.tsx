import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { OBJECTIVE, PURGE_CHANNELS, PURGE_FREQUENCIES, PURGE_START, carrierFor, pickFrequency, purgeProgress, type MissionEvent, type MissionRun, type PurgeState } from "@/game/missions/drowned-relay";
import { useVoiceLine } from "./useVoiceLine";

const ACCENT = "#63d6a8"; // the swamps' own region accent (world.ts)
const CHANNELS = Array.from({ length: PURGE_CHANNELS }, (_, i) => i);
/** Pulse period per frequency: a higher carrier blinks faster, so the pulse is the clue. */
const PERIOD = PURGE_FREQUENCIES.map((f) => `${(18 / Number(f)).toFixed(2)}s`);

/** Swamp story mission presentation: NOVA line, in-world objective, the relay-purge minigame and the
 * completion banner. KV-Unit combat needs no bespoke UI: it is summoned through summonBoss(), so the
 * HUD's normal boss readout covers it. Rules (carriers, locking, progress) live in drowned-relay.ts. */
export function DrownedRelayOverlay({ mission, onEvent }: { mission: MissionRun; onEvent: (e: MissionEvent) => void }) {
  useVoiceLine(`drowned-relay-${mission.state}`, "NOVA", mission.nova, "critical");
  const seed = useMemo(() => Math.floor(Math.random() * 1e9), []);
  const [purge, setPurge] = useState<PurgeState>(PURGE_START);
  const purging = mission.state === "PURGING";
  const channel = purge.locked.findIndex((v) => !v);

  const pick = (freq: number) => {
    if (channel < 0) return;
    const next = pickFrequency(purge, seed, channel, freq);
    setPurge(next);
    onEvent({ type: "HACK", progress: purgeProgress(next) });
  };

  return <>
    {mission.state !== "WORLD_UPDATE" && <div className="pointer-events-none fixed right-3 top-24 z-20 max-w-xs border-l-2 p-3" style={{ borderColor: ACCENT, background: "color-mix(in oklch, var(--card) 80%, transparent)" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: ACCENT }}>The Drowned Relay</p>
      <p className="mt-1 text-sm">{OBJECTIVE[mission.state]}</p>
      {purging && <p className="mt-1 font-mono text-[10px] text-muted-foreground">CHANNELS {Math.round(mission.hack)}%</p>}
      {mission.state === "BOSS" && <p className="mt-1 font-mono text-[10px] text-muted-foreground">Tentacles rise before the sweep. Move when they do.</p>}
    </div>}
    {mission.nova && <div className="pointer-events-none fixed bottom-24 left-3 z-20 flex max-w-sm items-start gap-3 border p-3" style={{ borderColor: `color-mix(in oklch, ${ACCENT} 40%, transparent)`, background: "color-mix(in oklch, var(--card) 80%, transparent)" }}>
      <span className="mt-1 size-3 shrink-0 animate-pulse rounded-full" style={{ background: ACCENT, boxShadow: `0 0 12px ${ACCENT}` }} />
      <p className="text-sm"><span className="font-mono text-[10px] uppercase" style={{ color: ACCENT }}>NOVA · </span>{mission.nova}</p>
    </div>}
    {purging && channel >= 0 && <div className="fixed inset-0 z-30 grid place-items-center bg-background/40">
      <section className="w-[min(28rem,calc(100%-2rem))] border bg-card/90 p-5" style={{ borderColor: ACCENT }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: ACCENT }}>Relay purge · channel {channel + 1} of {PURGE_CHANNELS}</p>
        <p className="mt-1 text-xs text-muted-foreground">Match the carrier pulse. Pick the frequency that blinks in time with it.</p>
        <div className="mt-4 flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase text-muted-foreground">Carrier</span>
          <span className="size-4 rounded-full" style={{ background: ACCENT, boxShadow: `0 0 14px ${ACCENT}`, animation: `pulse ${PERIOD[carrierFor(seed, channel)]} ease-in-out infinite` }} />
          {purge.misses >= 3 && <span className="font-mono text-[10px] text-muted-foreground">NOVA: it's {PURGE_FREQUENCIES[carrierFor(seed, channel)]}</span>}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">{PURGE_FREQUENCIES.map((f, i) => (
          <Button key={f} variant="outline" onClick={() => pick(i)} className="h-14 flex-col gap-1 rounded-none font-mono">
            <span className="size-2 rounded-full" style={{ background: ACCENT, animation: `pulse ${PERIOD[i]} ease-in-out infinite` }} />
            {f}
          </Button>
        ))}</div>
        <div className="mt-3 flex gap-1">{CHANNELS.map((c) => <span key={c} className="h-1 flex-1" style={{ background: purge.locked[c] ? ACCENT : "var(--border)" }} />)}</div>
      </section>
    </div>}
    {mission.state === "COMPLETE" && <div className="fixed inset-x-0 bottom-40 z-30 mx-auto w-fit border bg-card/90 p-4 text-center" style={{ borderColor: ACCENT }}>
      <p className="font-mono text-[10px] uppercase" style={{ color: ACCENT }}>Kraken-Vanguard down · relay purged</p>
      <p className="mt-1 text-sm">+ XP shards · Bio Catalyst · the signal leads to Neon City</p>
      <Button className="mt-3" onClick={() => onEvent({ type: "ACK" })}>Follow the signal</Button>
    </div>}
  </>;
}
