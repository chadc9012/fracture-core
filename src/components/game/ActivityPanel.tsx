import { useMemo, useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { ACTIVITY_COLOR, ACTIVITY_LABEL, CHALLENGES, CHALLENGE_ORDER, PATROL_DAILY_CAP, patrolsToday, regionActivities, setChallenge, startPatrol, type Activity } from "@/game/map-activities";

/** Map game flow (map-activities.ts): the activities in one region, then a pre-launch card for the chosen one with the
 * challenge level, then Launch, which drops the player next to it through the normal transit. Shared by the star map
 * (orbit) and the in-game world map, so both offer exactly the same choices. */
export function ActivityPanel({ progression, regionId, onProgression, onLaunch, launchLabel = "Launch" }: {
  progression: PlayerProgression; regionId: string;
  onProgression: (next: PlayerProgression) => void;
  onLaunch: (a: Activity) => void;
  launchLabel?: string;
}) {
  const acts = useMemo(() => regionActivities(progression, regionId), [progression, regionId]);
  const [pick, setPick] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const chosen = acts.find((a) => a.id === pick) ?? null;
  const challenge = progression.challenge ?? "STANDARD";

  const launch = () => {
    if (!chosen || chosen.status === "LOCKED") return;
    if (chosen.kind === "PATROL") {
      const r = startPatrol(progression, chosen.regionId);
      if ("error" in r) { setNotice(r.error); return; }
      onProgression(r.progression);
    }
    onLaunch(chosen);
  };

  if (chosen) {
    return (
      <div className="space-y-3" aria-label="Pre-launch">
        <button type="button" className="ui-focus font-mono text-[10px] uppercase tracking-widest text-muted-foreground" onClick={() => setPick(null)}>← All activities</button>
        <div className="border border-foreground/15 p-3" style={{ borderLeft: `3px solid ${ACTIVITY_COLOR[chosen.kind]}` }}>
          <p className="ui-kicker" style={{ color: ACTIVITY_COLOR[chosen.kind] }}>{ACTIVITY_LABEL[chosen.kind]}</p>
          <h3 className="mt-1 font-mono text-lg uppercase">{chosen.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{chosen.detail}</p>
        </div>
        <div>
          <p className="ui-kicker">Set challenge</p>
          <div className="mt-1 grid grid-cols-3 gap-1" role="radiogroup" aria-label="Challenge">
            {CHALLENGE_ORDER.map((id) => {
              const c = CHALLENGES[id], locked = progression.level < c.minLevel;
              return (
                <button key={id} type="button" role="radio" aria-checked={challenge === id} disabled={locked}
                  onClick={() => { const r = setChallenge(progression, id); if ("error" in r) setNotice(r.error); else onProgression(r.progression); }}
                  className={`ui-focus border px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider ${challenge === id ? "border-primary bg-primary/15" : "border-foreground/20"} ${locked ? "opacity-40" : ""}`}>
                  {c.label}{locked && <span className="block text-[9px] normal-case text-muted-foreground">Level {c.minLevel}</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{CHALLENGES[challenge].blurb}</p>
        </div>
        {notice && <p className="text-xs text-destructive">{notice}</p>}
        <Button size="lg" className="ui-focus w-full justify-between rounded-none" disabled={chosen.status === "LOCKED"} onClick={launch}>{chosen.status === "LOCKED" ? chosen.lockReason ?? "Locked" : `${launchLabel}: ${chosen.name}`}<ChevronRight /></Button>
      </div>
    );
  }

  return (
    <div aria-label="Activities">
      <div className="flex items-baseline justify-between"><p className="ui-kicker">Activities</p><p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Patrols {patrolsToday(progression)}/{PATROL_DAILY_CAP} today</p></div>
      <ul className="mt-2 max-h-[38vh] space-y-1 overflow-y-auto pr-1">
        {acts.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => { setNotice(""); setPick(a.id); }}
              className={`ui-focus group flex w-full items-center justify-between gap-2 border border-foreground/10 bg-background/60 px-2 py-1.5 text-left hover:border-foreground/40 ${a.status === "LOCKED" ? "opacity-50" : ""}`}
              style={{ borderLeft: `3px solid ${ACTIVITY_COLOR[a.kind]}` }} title={a.status === "LOCKED" ? a.lockReason : a.detail}>
              <span className="min-w-0">
                <span className="block font-mono text-[9px] uppercase tracking-widest" style={{ color: ACTIVITY_COLOR[a.kind] }}>{ACTIVITY_LABEL[a.kind]}{a.status === "NEXT" ? " · next" : a.status === "DONE" ? " · done" : ""}</span>
                <span className="block truncate text-xs">{a.name}</span>
              </span>
              {a.status === "LOCKED" ? <Lock className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0 opacity-50 group-hover:opacity-100" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
