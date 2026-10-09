import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { OBJECTIVE, type MissionEvent, type MissionRun } from "@/game/missions/broken-signal";
import { ADAPTIVE_TUTORIAL_INIT, maybeReteach, recordStruggle, recordSuccess } from "@/game/adaptive-tutorial";
import { useVoiceLine } from "./useVoiceLine";

const NODES = [0, 1, 2, 3];

/** First-time control call-outs for Mission 01 — the tutorial trial teaches the moves in isolation,
 * this teaches them again in a real mission so the lesson survives the jump into open combat. */
const CONTROL_HINT: Partial<Record<MissionRun["state"], string>> = {
  DISCOVERY: "Move with WASD toward the beacon marker on your compass.",
  TRAVERSAL: "Hold Shift to sprint. Press Ctrl while sprinting to slide, hold it to crouch, X for prone (rebind in Settings > Controls).",
  COMBAT_1: "Aim with the mouse, fire with Space.",
  COMBAT_2: "Getting overwhelmed? Your class ability (Q) is up — use it.",
};

/** Mission 01 presentation layer: NOVA hologram line, in-world objective, and the node-route hack. */
export function BrokenSignalOverlay({ mission, onEvent }: { mission: MissionRun; onEvent: (e: MissionEvent) => void }) {
  const [glitch, setGlitch] = useState(mission.state === "TRIGGERED");
  const [route, setRoute] = useState<number[]>([]);
  const order = useMemo(() => [...NODES].sort(() => Math.random() - 0.5), []);
  const [adaptive, setAdaptive] = useState(ADAPTIVE_TUTORIAL_INIT);
  const [reteachHint, setReteachHint] = useState<string | null>(null);
  useEffect(() => { if (mission.state === "TRIGGERED") { setGlitch(true); const t = setTimeout(() => setGlitch(false), 2600); return () => clearTimeout(t); } return undefined; }, [mission.state]);
  useVoiceLine(`broken-signal-${mission.state}`, "NOVA", mission.nova, "critical");

  const pick = (n: number) => {
    const expected = order[route.length];
    if (n !== expected) {
      setRoute([]);
      onEvent({ type: "HACK", progress: mission.wave2Done ? 50 : 0 });
      const next = recordStruggle(adaptive, "HACK_ROUTE");
      const result = maybeReteach(next, "HACK_ROUTE", performance.now() / 1000);
      setAdaptive(result.state);
      if (result.hint) setReteachHint(result.hint);
      return;
    }
    const next = [...route, n];
    setRoute(next.length === NODES.length ? [] : next);
    const base = mission.wave2Done ? 50 : 0;
    onEvent({ type: "HACK", progress: Math.min(100, base + (next.length / NODES.length) * 50) });
    if (next.length === NODES.length) { setAdaptive(recordSuccess(adaptive, "HACK_ROUTE")); setReteachHint(null); }
  };
  const hacking = mission.state === "HACKING";

  return <>
    {glitch && <div className="pointer-events-none fixed inset-x-0 top-24 z-30 mx-auto w-fit animate-pulse border border-destructive bg-background/70 px-6 py-3 font-mono text-lg uppercase tracking-[0.3em] text-destructive">
      <span className="line-through opacity-60">Neon Core ad network active</span><br />Unauthorized signal detected
    </div>}
    {mission.state !== "WORLD_UPDATE" && <div className="pointer-events-none fixed right-3 top-24 z-20 max-w-xs border-l-2 border-primary bg-card/80 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">Broken Signal</p>
      <p className="mt-1 text-sm">{OBJECTIVE[mission.state]}</p>
      {(hacking || mission.state === "COMBAT_2") && <p className="mt-1 font-mono text-[10px] text-muted-foreground">DATA NODE {Math.round(mission.hack)}%</p>}
      {CONTROL_HINT[mission.state] && <p className="mt-2 border-t border-border/50 pt-2 text-[11px] text-primary">{CONTROL_HINT[mission.state]}</p>}
    </div>}
    {mission.nova && <div className="pointer-events-none fixed bottom-24 left-3 z-20 flex max-w-sm items-start gap-3 border border-primary/40 bg-card/80 p-3">
      <span className="mt-1 size-3 shrink-0 animate-pulse rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
      <p className="text-sm"><span className="font-mono text-[10px] uppercase text-primary">NOVA · </span>{mission.nova}</p>
    </div>}
    {hacking && <div className="fixed inset-0 z-30 grid place-items-center bg-background/40">
      <section className="w-[min(26rem,calc(100%-2rem))] border border-primary bg-card/90 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">Neon terminal · route clean data</p>
        <p className="mt-1 text-xs text-muted-foreground">Connect the nodes in signal order. Next: <b className="text-foreground">NODE {(order[route.length] ?? 0) + 1}</b></p>
        <div className="mt-4 grid grid-cols-4 gap-2">{NODES.map((n) => <Button key={n} variant={route.includes(n) ? "default" : "outline"} onClick={() => pick(n)} className="h-14 rounded-none font-mono">{n + 1}</Button>)}</div>
        {reteachHint && <p className="mt-3 border-t border-destructive/40 pt-2 text-[11px] text-destructive">NOVA · {reteachHint}</p>}
      </section>
    </div>}
    {mission.state === "COMPLETE" && <div className="fixed inset-x-0 bottom-40 z-30 mx-auto w-fit border border-primary bg-card/90 p-4 text-center">
      <p className="font-mono text-[10px] uppercase text-primary">Terminal pulse · drones offline</p>
      <p className="mt-1 text-sm">+ XP shards · Data Insight Fragment · Basic Skill System unlocked</p>
      <Button className="mt-3" onClick={() => onEvent({ type: "ACK" })}>Collect fragments</Button>
    </div>}
  </>;
}
