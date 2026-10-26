import { useEffect, useState } from "react";
import { Crosshair, Globe2, LockKeyhole, Map as MapIcon, Play, Save, Settings2, Shield, Swords, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { activityById, activityState } from "@/game/activities";
import { CRUCIBLE_LOCKED, CRUCIBLE_MODES, RIVAL_LABEL, rivalLineup, type CrucibleModeId, type RivalClass } from "@/game/crucible";
import { FRACTURE_RAID, PVP_RANKS } from "@/game/system-foundations";
import { StarMap, type DeployTarget } from "./StarMap";
import { ArsenalLoadouts } from "./ArsenalLoadouts";
import { SaveManager } from "./SaveManager";
import { PlanetMap } from "./PlanetMap";
import { RAID_INSTANCES, raidArrival } from "@/game/raid-instances";
import { DUNGEONS } from "@/game/dungeons";
import { HOLLOW_STAR } from "@/game/hollow-star-data";
import { cycle, padTabIntent, tabKeyIntent } from "@/game/director-nav";
import { HOLLOW_STAR_ID, hollowStarTierUnlocked } from "@/game/hollow-star-raid";
import { RAID_STAGE_IDS, clearedStages, featuredStage, lockedOut } from "@/game/raid-lockout";
import { weeklyRaidChallenge } from "@/game/difficulty-ladder";
import { RAID_TIERS } from "@/game/difficulty-ladder";
import { setRaidLaunchTier } from "@/game/raid-launch";

/** Destiny-style director: the world map is home, with the Killbox (PvP; "crucible" in code and saves), Raid and the gear/save screens as tabs along the
 * top. Destinations deploy through the map's own transit; Killbox matches start an activity and drop you in the arena. */
export type DirectorTab = "map" | "planet" | "crucible" | "raid" | "arsenal" | "saves";

const TABS: { id: DirectorTab; label: string; icon: LucideIcon }[] = [
  { id: "map", label: "Map", icon: MapIcon },
  { id: "planet", label: "Planet", icon: Globe2 },
  { id: "crucible", label: "Killbox", icon: Swords },
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
  /** planet.ts: the continent world you were last in, for the planet map's "your location" */
  currentWorld?: import("@/game/planet").WorldId | null;
};

export function Director({ progression, onProgression, onDeploy, onCrucible, onResume, onSystem, operatorName, playerClass, notice, currentWorld = null }: Props) {
  const [tab, setTab] = useState<DirectorTab>("map");
  // Q / E on the keyboard, L1 / R1 on a pad cycle the tabs (director-nav.ts)
  useEffect(() => {
    const ids = TABS.map((t) => t.id);
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      const intent = tabKeyIntent(e.code);
      if (intent) setTab((t) => cycle(ids, t, intent));
    };
    window.addEventListener("keydown", onKey);
    let raf = 0, prev: boolean[] = [];
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const gp = typeof navigator !== "undefined" && navigator.getGamepads ? Array.from(navigator.getGamepads()).find((p): p is Gamepad => !!p && p.connected) : undefined;
      const now = gp ? gp.buttons.map((b) => b.pressed) : [];
      const intent = padTabIntent(prev, now);
      prev = now;
      if (intent) setTab((t) => cycle(ids, t, intent));
    };
    raf = requestAnimationFrame(poll);
    return () => { window.removeEventListener("keydown", onKey); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      {/* on the map tab the Destination Map draws these tabs in its own painted tab bar (md and up) */}
      <nav className={`fixed inset-x-0 top-0 z-[60] flex h-14 items-center justify-between gap-2 border-b border-foreground/15 bg-background/90 px-3 backdrop-blur sm:px-6 ${tab === "map" ? "md:hidden" : ""}`} aria-label="Director">
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
      {tab === "map" && <StarMap embedded progression={progression} onBack={() => setTab("map")} onDeploy={onDeploy} onProgression={onProgression}
        chrome={{ tabs: TABS.map(({ id, label }) => ({ id, label })), current: tab, onTab: (id) => setTab(id as DirectorTab), operator: operatorName, level: progression.level, onResume, onSystem }} />}
      {tab === "planet" && <Panel label="Planet"><PlanetMap progression={progression} onDeploy={onDeploy} currentWorld={currentWorld} /></Panel>}
      {tab === "crucible" && <CrucibleView progression={progression} playerClass={playerClass} onLaunch={onCrucible} />}
      {tab === "raid" && <RaidView progression={progression} onDeploy={onDeploy} />}
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
    <Panel label="Killbox">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/15 pb-4">
        <div>
          <p className="ui-kicker text-primary">Wastelands · Grid-Iron arena</p>
          <h1 className="mt-1 font-mono text-3xl uppercase tracking-[0.25em]">Killbox</h1>
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
                  <div><dt className="ui-kicker">Matches</dt><dd className="text-foreground">{Number.isFinite(st.attemptsLeft) ? `${st.attemptsLeft} left today` : "Unlimited"}</dd></div>
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

/** Raids launch from here and nowhere else (owner, Oct 25 2026): they are instances, never places on the world map, and you
 * cannot walk up to one. Launching uses the same transit as deploying; the arena lies far outside the world (raid-instances.ts). */
function RaidView({ progression, onDeploy }: { progression: PlayerProgression; onDeploy: (target: DeployTarget) => void }) {
  const [tierId, setTierId] = useState("normal");
  const roles = Object.entries(FRACTURE_RAID.roles) as [RivalClass, string][];
  return (
    <Panel label="Raid">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/15 pb-4">
        <div>
          <p className="ui-kicker text-primary">Raids · launched from here, never found on the map</p>
          <h1 className="mt-1 font-mono text-3xl uppercase tracking-[0.25em]">Raids</h1>
        </div>
      </header>
      {RAID_INSTANCES.map((raid) => {
        const def = DUNGEONS.find((d) => d.id === raid.id);
        const go = () => { const a = raidArrival(raid); setRaidLaunchTier(hollowStarTierUnlocked(progression, tierId) ? tierId : "normal"); onDeploy({ id: `raid:${raid.id}`, name: raid.name, sub: `Raid · ${raid.entrance}`, color: "#a970ff", x: a.x, z: a.z }); };
        return (
          <div key={raid.id} className="mt-6 grid gap-4 lg:grid-cols-3">
            <section className="border border-foreground/15 bg-background/60 p-5 lg:col-span-2">
              <p className="ui-kicker">{raid.entrance}</p>
              <h2 className="mt-1 font-mono text-2xl uppercase tracking-[0.2em]">{raid.name}</h2>
              {def && <ol className="mt-3 space-y-2">
                {def.stages.map((st, i) => (
                  <li key={st.id} className="flex items-baseline gap-3 border-b border-foreground/10 pb-2 last:border-0">
                    <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-mono uppercase tracking-wide">{st.name}</span>
                    <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">{st.room}</span>
                  </li>
                ))}
              </ol>}
            </section>
            <section className="flex flex-col border border-foreground/15 bg-background/60 p-5">
              <p className="ui-kicker">Final boss</p>
              <p className="mt-1 font-mono uppercase">{def?.boss ?? raid.name}</p>
              <p className="mt-3 text-sm text-muted-foreground">In this build the live raid is its final chamber: you are dropped into Astravore's arena. The encounters before it run as a fireteam simulation in the Operations hub until online fireteams arrive.</p>
              {raid.id === HOLLOW_STAR_ID && <div className="mt-3">
                <p className="ui-kicker">Difficulty</p>
                <div className="mt-2 grid grid-cols-2 gap-2">{RAID_TIERS.map((t) => {
                  const open = hollowStarTierUnlocked(progression, t.id), n = clearedStages(progression, t.id).length;
                  return <Button key={t.id} size="sm" variant={t.id === tierId ? "default" : "outline"} disabled={!open} onClick={() => setTierId(t.id)} className="h-auto flex-col items-start gap-0.5 rounded-none p-2 text-left whitespace-normal"><span className="font-mono text-[10px] uppercase">{!open && <LockKeyhole className="mr-1 inline size-3" />}{t.name} · boss x{t.bossHealthScale}</span><span className="text-[9px] opacity-80">{!open ? `Clear ${RAID_TIERS[t.rank - 1]!.name} first` : lockedOut(progression, t.id) ? "Locked out until reset" : `${n}/${RAID_STAGE_IDS.length} encounters this week`}</span></Button>;
                })}</div>
                <p className="mt-2 text-[10px] text-muted-foreground">Encounters reset every Monday. Each one drops its own gear.</p>
                <p className="mt-1 text-[10px] text-primary">Weekly challenge · {weeklyRaidChallenge(Date.now()).name}: {weeklyRaidChallenge(Date.now()).effect} Featured encounter: {HOLLOW_STAR.stages.find((x) => x.id === featuredStage(Date.now()))?.name}</p>
              </div>}
              <Button className="mt-4 font-mono uppercase tracking-widest" onClick={go}><Swords /> Launch raid</Button>
            </section>
          </div>
        );
      })}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="border border-foreground/15 bg-background/40 p-5 opacity-80 lg:col-span-2">
          <p className="ui-kicker">Coming raid</p>
          <h2 className="mt-1 font-mono text-xl uppercase tracking-[0.2em]">{FRACTURE_RAID.name}</h2>
          <ol className="mt-3 space-y-2">{FRACTURE_RAID.phases.map((p, i) => <li key={p} className="flex gap-3 font-mono text-sm uppercase"><span className="text-primary">{String(i + 1).padStart(2, "0")}</span>{p}</li>)}</ol>
          <p className="mt-3 text-sm text-muted-foreground">Final boss: <span className="text-foreground">{FRACTURE_RAID.finalBoss.name}</span>.</p>
        </section>
        <section className="border border-foreground/15 bg-background/40 p-5 opacity-80">
          <p className="ui-kicker">Fireteam roles</p>
          <ul className="mt-3 space-y-3 text-sm">{roles.map(([cls, role]) => <li key={cls}><span className="font-mono uppercase text-primary">{RIVAL_LABEL[cls]}</span><span className="block text-muted-foreground">{role}</span></li>)}</ul>
          <Button className="mt-4 w-full font-mono uppercase tracking-widest" disabled><LockKeyhole /> Not yet built</Button>
        </section>
      </div>
    </Panel>
  );
}
