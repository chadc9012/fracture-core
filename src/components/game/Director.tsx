import { useEffect, useState } from "react";
import { Crosshair, LockKeyhole, Map as MapIcon, Play, Save, Settings2, Shield, Swords, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { activityById, activityState } from "@/game/activities";
import { CRUCIBLE_LOCKED, CRUCIBLE_MODES, RIVAL_LABEL, rivalLineup, type CrucibleModeId, type RivalClass } from "@/game/crucible";
import { FRACTURE_RAID, PVP_RANKS } from "@/game/system-foundations";
import { StarMap, type DeployTarget } from "./StarMap";
import { ArsenalLoadouts } from "./ArsenalLoadouts";
import { SaveManager } from "./SaveManager";

/** Destiny-style director: the world map is home, with Crucible (PvP), Raid and the gear/save screens as tabs along the
 * top. Destinations deploy through the map's own transit; Crucible matches start an activity and drop you in the arena. */
export type DirectorTab = "map" | "crucible" | "raid" | "arsenal" | "saves";

const TABS: { id: DirectorTab; label: string; icon: LucideIcon }[] = [
  { id: "map", label: "Map", icon: MapIcon },
  { id: "crucible", label: "Crucible", icon: Swords },
  { id: "raid", label: "Raid", icon: Users },
  { id: "arsenal", label: "Arsenal", icon: Shield },
  { id: "saves", label: "Saves", icon: Save },
];

type Props = {
  progression: PlayerProgression;
  onProgression: (p: PlayerProgression) => void;
  onDeploy: (target: DeployTarget) => void;
  onCrucible: (activityId: string) => void;
  onResume: () => void;
  onSystem: () => void;
  operatorName: string;
  playerClass: RivalClass;
  notice?: string | null;
};

export function Director({ progression, onProgression, onDeploy, onCrucible, onResume, onSystem, operatorName, playerClass, notice }: Props) {
  const [tab, setTab] = useState<DirectorTab>("map");
  // keyboard: Q / E cycle tabs like a controller's bumpers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      const i = TABS.findIndex((t) => t.id === tab);
      if (e.code === "KeyQ") setTab(TABS[(i + TABS.length - 1) % TABS.length]!.id);
      if (e.code === "KeyE") setTab(TABS[(i + 1) % TABS.length]!.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab]);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-[60] flex h-14 items-center justify-between gap-2 border-b border-foreground/15 bg-background/90 px-3 backdrop-blur sm:px-6" aria-label="Director">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <span className="mr-2 hidden font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground sm:inline">Q</span>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
              className={`ui-focus flex h-14 shrink-0 items-center gap-2 border-b-2 px-3 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="size-4" />{label}
            </button>
          ))}
          <span className="ml-2 hidden font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground sm:inline">E</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground md:inline">{operatorName} · LVL {progression.level}</span>
          <Button variant="ghost" size="sm" onClick={onSystem} className="ui-focus font-mono" aria-label="System settings"><Settings2 /></Button>
          <Button size="sm" onClick={onResume} className="ui-focus font-mono uppercase tracking-wider"><Play /> Resume</Button>
        </div>
      </nav>
      {notice && <div role="status" className="fixed left-1/2 top-16 z-[61] -translate-x-1/2 border border-destructive/60 bg-background/95 px-4 py-2 font-mono text-xs">{notice}</div>}
      {tab === "map" && <StarMap embedded progression={progression} onBack={() => setTab("map")} onDeploy={onDeploy} onProgression={onProgression} />}
      {tab === "crucible" && <CrucibleView progression={progression} playerClass={playerClass} onLaunch={onCrucible} />}
      {tab === "raid" && <RaidView />}
      {tab === "arsenal" && <ArsenalLoadouts embedded progression={progression} onProgression={onProgression} onBack={() => setTab("map")} />}
      {tab === "saves" && <SaveManager embedded progression={progression} onProgression={onProgression} onBack={() => setTab("map")} />}
    </>
  );
}

function Panel({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="deployment-field fixed inset-x-0 bottom-0 top-14 z-50 overflow-y-auto p-4 text-foreground lg:p-8" role="region" aria-label={label}>
      <div className="fracture-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-6xl">{children}</div>
    </div>
  );
}

function CrucibleView({ progression, playerClass, onLaunch }: { progression: PlayerProgression; playerClass: RivalClass; onLaunch: (id: string) => void }) {
  const modes: { mode: CrucibleModeId; id: string }[] = [{ mode: "duel", id: "crucible-duel" }, { mode: "skirmish", id: "crucible-skirmish" }];
  const wins = modes.reduce((n, m) => n + (progression.earnedRewards.filter((r) => r === `crucible-win:${m.id}`).length), 0);
  const rank = PVP_RANKS[Math.min(PVP_RANKS.length - 1, Math.floor(wins / 5))];
  return (
    <Panel label="Crucible">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/15 pb-4">
        <div>
          <p className="ui-kicker text-primary">Wastelands · Grid-Iron arena</p>
          <h1 className="mt-1 font-mono text-3xl uppercase tracking-[0.25em]">Crucible</h1>
        </div>
        <div className="text-right font-mono"><p className="ui-kicker">Rank</p><p className="text-lg text-primary">{rank}</p></div>
      </header>
      {!progression.tutorialComplete && <p className="mt-4 border-l-2 border-primary pl-3 text-sm">{CRUCIBLE_LOCKED}.</p>}
      <p className="mt-4 max-w-3xl text-sm text-muted-foreground">Fight rival operators in the Wastelands arena. Online matchmaking isn't live yet, so every rival slot is filled by an AI GOLIATH, NYX or CIPHER; the same scoring will carry over when real players can join.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {modes.map(({ mode, id }) => {
          const m = CRUCIBLE_MODES[mode];
          const def = activityById(id)!;
          const st = activityState(progression, def);
          const lineup = rivalLineup(mode, playerClass).map((c) => RIVAL_LABEL[c]).join(" · ");
          return (
            <article key={id} className="ui-enter flex min-h-64 flex-col justify-between border border-foreground/15 bg-background/60 p-5">
              <div>
                <div className="flex items-center justify-between"><span className="ui-kicker">{m.rivals === 1 ? "1 v 1" : `Free-for-all · ${m.rivals + 1} operators`}</span><Crosshair className="size-4 text-primary" /></div>
                <h2 className="mt-3 font-mono text-2xl uppercase tracking-wide">{m.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{m.brief}</p>
                <dl className="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px] uppercase">
                  <div><dt className="ui-kicker">Score to win</dt><dd className="text-foreground">{m.target}</dd></div>
                  <div><dt className="ui-kicker">Rivals</dt><dd className="text-foreground">{lineup}</dd></div>
                  <div><dt className="ui-kicker">Reward</dt><dd className="text-foreground">{def.rewards.nex} NEX · {def.rewards.xp} XP</dd></div>
                  <div><dt className="ui-kicker">Matches today</dt><dd className="text-foreground">{st.attemptsLeft} left</dd></div>
                </dl>
              </div>
              <Button className="mt-5 w-full font-mono uppercase tracking-widest" disabled={!st.available || !progression.tutorialComplete} onClick={() => onLaunch(id)}>
                {!progression.tutorialComplete ? <><LockKeyhole /> Locked</> : st.available ? <><Swords /> Launch {m.name}</> : st.reason ?? "Unavailable"}
              </Button>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

function RaidView() {
  const roles = Object.entries(FRACTURE_RAID.roles) as [RivalClass, string][];
  return (
    <Panel label="Raid">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/15 pb-4">
        <div>
          <p className="ui-kicker text-primary">Raid · {FRACTURE_RAID.players.min}–{FRACTURE_RAID.players.max} operators</p>
          <h1 className="mt-1 font-mono text-3xl uppercase tracking-[0.25em]">{FRACTURE_RAID.name}</h1>
        </div>
        <span className="flex items-center gap-2 border border-foreground/25 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground"><LockKeyhole className="size-3.5" /> Needs a fireteam</span>
      </header>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="border border-foreground/15 bg-background/60 p-5 lg:col-span-2">
          <p className="ui-kicker">Encounters</p>
          <ol className="mt-3 space-y-3">
            {FRACTURE_RAID.phases.map((p, i) => (
              <li key={p} className="flex items-baseline gap-3 border-b border-foreground/10 pb-3 last:border-0">
                <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-mono uppercase tracking-wide">{p}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">Final boss: <span className="text-foreground">{FRACTURE_RAID.finalBoss.name}</span> — {FRACTURE_RAID.finalBoss.lair}.</p>
        </section>
        <section className="border border-foreground/15 bg-background/60 p-5">
          <p className="ui-kicker">Fireteam roles</p>
          <ul className="mt-3 space-y-3 text-sm">
            {roles.map(([cls, role]) => <li key={cls}><span className="font-mono uppercase text-primary">{RIVAL_LABEL[cls]}</span><span className="block text-muted-foreground">{role}</span></li>)}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">Reward: {FRACTURE_RAID.reward}.</p>
        </section>
      </div>
      <div className="mt-4 border border-foreground/15 bg-background/60 p-5">
        <p className="text-sm text-muted-foreground">The raid is built for a fireteam of {FRACTURE_RAID.players.min} or more. It opens here once online multiplayer is in the game; until then it stays locked rather than being played solo.</p>
        <Button className="mt-4 font-mono uppercase tracking-widest" disabled><LockKeyhole /> Launch — awaiting multiplayer</Button>
      </div>
    </Panel>
  );
}
