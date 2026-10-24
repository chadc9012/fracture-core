import { useMemo, useState } from "react";
import { ChevronRight, Lock } from "lucide-react";

/** one glyph per activity kind (shared with the destination map) */
export const KIND_GLYPH: Record<Activity["kind"], string> = { STORY: "★", SAFE_ZONE: "⛨", BOSS: "☠", NEMESIS: "☠", RESOURCE: "◆", CONTRACT: "✉", STASH: "▣", PATROL: "⟲", ACTIVITY: "◎" };
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { ACTIVITY_COLOR, ACTIVITY_LABEL, CHALLENGES, CHALLENGE_ORDER, PATROL_DAILY_CAP, activityRewards, patrolsToday, regionActivities, setChallenge, startPatrol, type Activity } from "@/game/map-activities";
import { MATERIALS, type MaterialId } from "@/game/inventory";

/** Map game flow (map-activities.ts): the activities in one region, then a pre-launch card for the chosen one with the
 * challenge level, then Launch, which drops the player next to it through the normal transit. Shared by the star map
 * (orbit) and the in-game world map, so both offer exactly the same choices. */
/** the main action on an activity's card, by kind (Destiny-style: story and bosses launch, patrols start, safe zones fast-travel) */
const ACTION: Partial<Record<Activity["kind"], string>> = { STORY: "Launch", BOSS: "Launch", NEMESIS: "Launch", PATROL: "Start patrol", SAFE_ZONE: "Fast travel" };

export function ActivityPanel({ progression, regionId, onProgression, onLaunch, launchLabel = "Launch", activities, pickId, onPick, onWaypoint, recommendedLevel }: {
  progression: PlayerProgression; regionId: string;
  /** a narrower list than the whole region (the world map's destination + filter); defaults to every activity in the region */
  activities?: Activity[];
  /** controlled selection (the map's markers pick the same activity); uncontrolled when omitted */
  pickId?: string | null; onPick?: (id: string | null) => void;
  /** adds an "Add waypoint" action to the card (the compass and tracker follow it) */
  onWaypoint?: (a: Activity) => void;
  /** shown on the card: the level this destination is meant for */
  recommendedLevel?: number;
  onProgression: (next: PlayerProgression) => void;
  onLaunch: (a: Activity) => void;
  launchLabel?: string;
}) {
  const regionActs = useMemo(() => regionActivities(progression, regionId), [progression, regionId]);
  const acts = activities ?? regionActs;
  const [ownPick, setOwnPick] = useState<string | null>(null);
  const pick = pickId !== undefined ? pickId : ownPick;
  const setPick = (id: string | null) => { if (onPick) onPick(id); else setOwnPick(id); };
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
        <div className="overflow-hidden border border-foreground/20" style={{ boxShadow: `0 0 28px ${ACTIVITY_COLOR[chosen.kind]}22` }}>
          <div className="relative h-16" style={{ background: `linear-gradient(120deg, ${ACTIVITY_COLOR[chosen.kind]}55, #06101f 70%)` }}>
            <span className="absolute bottom-[-18px] left-3 flex size-11 items-center justify-center border-2 bg-[#06101f] text-xl" style={{ borderColor: ACTIVITY_COLOR[chosen.kind], color: ACTIVITY_COLOR[chosen.kind] }} aria-hidden="true">{KIND_GLYPH[chosen.kind]}</span>
          </div>
          <div className="px-3 pb-3 pt-6">
            <h3 className="font-mono text-lg uppercase leading-tight">{chosen.name}</h3>
            <p className="ui-kicker" style={{ color: ACTIVITY_COLOR[chosen.kind] }}>{ACTIVITY_LABEL[chosen.kind]}{chosen.status === "DONE" ? " · completed" : chosen.status === "NEXT" ? " · next" : ""}</p>
            <p className="mt-2 text-xs text-muted-foreground">{chosen.detail}</p>
            {chosen.status === "LOCKED" && <p className="mt-2 text-[11px] text-amber-400">Requires: {chosen.lockReason ?? "not available yet"}</p>}
            {(() => { const r = activityRewards(progression, chosen); return r && <p className="mt-2 text-[11px]">Rewards: <b className="text-amber-300">{[r.nex ? `${r.nex.toLocaleString()} NΞ` : null, ...Object.entries(r.materials ?? {}).map(([k, v]) => `${v} ${MATERIALS[k as MaterialId]?.name ?? k}`)].filter(Boolean).join(" · ")}</b>{r.note && <span className="text-muted-foreground"> · {r.note}</span>}</p>; })()}
            {recommendedLevel !== undefined && <p className="mt-2 text-[11px]">Recommended level: <b style={{ color: progression.level >= recommendedLevel ? "#7ef2b0" : "#ffb23e" }}>{recommendedLevel}</b><span className="text-muted-foreground"> · you are {progression.level}</span></p>}
          </div>
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
        <Button size="lg" className="ui-focus w-full justify-between rounded-none" disabled={chosen.status === "LOCKED"} onClick={launch} aria-label={`${ACTION[chosen.kind] ?? launchLabel}: ${chosen.name}`}>{chosen.status === "LOCKED" ? chosen.lockReason ?? "Locked" : ACTION[chosen.kind] ?? launchLabel}<ChevronRight /></Button>
        {onWaypoint && <Button variant="outline" className="ui-focus w-full rounded-none" onClick={() => onWaypoint(chosen)}>Add waypoint</Button>}
      </div>
    );
  }

  return (
    <div aria-label="Activities">
      <div className="flex items-baseline justify-between"><p className="ui-kicker">Activities</p><p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Patrols {patrolsToday(progression)}/{PATROL_DAILY_CAP} today</p></div>
      {acts.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Nothing here in this category.</p>}
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
