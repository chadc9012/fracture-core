import { ArrowRight, Crosshair, Save, Map as MapIcon, Settings2, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { nextActivity } from "@/game/retention";

type HubTarget = "starmap" | "arsenal" | "quick" | "saves" | "system";
type Props = {
  className: string;
  level: number;
  shards: number;
  completedMissions: string[];
  onNavigate: (target: HubTarget) => void;
};

const MODULES: { id: HubTarget; code: string; title: string; body: string; action: string; icon: LucideIcon }[] = [
  { id: "starmap", code: "01", title: "Star Map", body: "Choose a destination across the seven fractured regions and track your next activity.", action: "Open destinations", icon: MapIcon },
  { id: "arsenal", code: "02", title: "Arsenal", body: "Build and switch weapon loadouts for GOLIATH, NYX and CIPHER.", action: "Manage gear", icon: Shield },
  { id: "quick", code: "03", title: "Quick Combat", body: "Skip the map and drop straight back into the world where you left off.", action: "Instant drop", icon: Crosshair },
  { id: "saves", code: "04", title: "Saves", body: "Switch between save slots. Every slot auto-saves and syncs with your cloud save.", action: "Manage slots", icon: Save },
  { id: "system", code: "05", title: "System", body: "Controls, display, audio, accessibility, plus the Chronicle and Roadmap.", action: "Preferences", icon: Settings2 },
];

/** Returning-player hub between the title and the world (layout adapted from the uploaded MainMenuHub). */
export function MainMenuHub({ className, level, shards, completedMissions, onNavigate }: Props) {
  const next = nextActivity({ completedMissions });
  return (
    <div className="deployment-field fixed inset-0 z-50 flex flex-col overflow-y-auto px-5 py-5 text-foreground sm:px-10 sm:py-8">
      <div className="fracture-grid pointer-events-none absolute inset-0 opacity-40" />
      <header className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-foreground/15 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse bg-primary" />
          <h1 className="truncate font-mono text-xl uppercase tracking-[0.3em] sm:text-3xl">World Fracture</h1>
        </div>
        <div className="flex items-center gap-4 border-l border-foreground/15 pl-4 font-mono text-right">
          <div className="hidden sm:block"><p className="ui-kicker">Operator</p><p className="text-sm text-primary">{className}</p></div>
          <div><p className="ui-kicker">Data shards</p><p className="text-sm">{shards.toLocaleString()}</p></div>
          <div><p className="ui-kicker">Level</p><p className="text-sm text-primary">{level}</p></div>
        </div>
      </header>

      <main className="relative mx-auto my-auto grid w-full max-w-6xl grid-cols-1 gap-3 py-8 sm:grid-cols-2 lg:grid-cols-5">
        {MODULES.map(({ id, code, title, body, action, icon: Icon }) => (
          <button key={id} onClick={() => onNavigate(id)} className="ui-focus ui-enter group flex min-h-56 flex-col justify-between border border-foreground/15 bg-background/60 p-5 text-left transition-colors hover:border-primary/60 hover:bg-primary/5">
            <div>
              <div className="flex items-center justify-between"><span className="ui-kicker">Module / {code}</span><Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" /></div>
              <h2 className="mt-3 font-mono text-2xl uppercase tracking-wide group-hover:text-primary">{title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
            <div className="flex items-center justify-between border-t border-foreground/10 pt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              {action}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        ))}
      </main>

      <footer className="relative flex flex-col justify-between gap-2 border-t border-foreground/15 pt-4 font-mono text-[11px] uppercase text-muted-foreground sm:flex-row">
        <span><span className="text-primary">NOVA /</span> Next: {next.title} — {next.region}</span>
        <span>Choose a module to continue</span>
      </footer>
    </div>
  );
}
