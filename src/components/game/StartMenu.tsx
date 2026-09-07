import { useState } from "react";

export type ClassId = "VANGUARD" | "ASSASSIN" | "TECH" | "DESTROYER";

export const CLASSES: { id: ClassId; name: string; role: string; lore: string; color: string }[] = [
  {
    id: "VANGUARD",
    name: "Vanguard",
    role: "Anchor",
    lore: "Former protectors who adapted their armour to stabilise fractured zones. They anchor reality where it breaks.",
    color: "#66e0ff",
  },
  {
    id: "ASSASSIN",
    name: "Assassin",
    role: "Phase",
    lore: "Operatives who learned to move through unstable space. They exist between moments.",
    color: "#7dffca",
  },
  {
    id: "TECH",
    name: "Tech",
    role: "Control",
    lore: "Engineers who merged with AI systems during the Fracture. They command the battlefield through intelligence.",
    color: "#c86bff",
  },
  {
    id: "DESTROYER",
    name: "Destroyer",
    role: "Overload",
    lore: "Survivors overloaded with fracture energy. Walking weapons, barely holding together.",
    color: "#ffb057",
  },
];

const INTRO = [
  { who: "EVO", line: "If you're hearing this… it's already too late." },
  { who: "EVO", line: "We thought we had mastered it. Energy beyond limits. Systems beyond failure." },
  { who: "EVO", line: "We were wrong. The Fracture didn't just break the world — it rewrote it." },
  { who: "EVO", line: "But you… you're different. You can control it." },
  { who: "EVO", line: "And something else is learning to do the same." },
];

/** Orbit screen — the game never drops you into the world unannounced. */
export function StartMenu({
  onDeploy,
  onSettings,
  best,
}: {
  onDeploy: (cls: ClassId) => void;
  onSettings: () => void;
  best: { credits: number; kills: number } | null;
}) {
  const [picked, setPicked] = useState<ClassId>("VANGUARD");
  const [beat, setBeat] = useState(0);
  const cls = CLASSES.find((c) => c.id === picked)!;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(120%_80%_at_50%_-10%,hsl(var(--primary)/0.25),transparent_60%)]" />
      <div className="relative mx-auto flex min-h-full max-w-4xl flex-col justify-center gap-8 px-6 py-14">
        <header className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.5em] text-muted-foreground">
            The Fractured Earth · Season 1
          </p>
          <h1 className="font-mono text-6xl font-bold tracking-[0.25em] text-foreground sm:text-7xl">EVOLIO</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A cosmic event shattered reality into overlapping layers. Weapons drink loose energy, armour became a
            conduit, creatures mutated, and machine intelligence woke up. You are a{" "}
            <span className="text-foreground">Resonant</span> — one of the few who can absorb fracture energy without
            dying.
          </p>
        </header>

        {/* EVO intro log */}
        <section className="rounded-lg border border-border bg-card/70 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">EVO transmission</p>
            <button
              onClick={() => setBeat((b) => (b + 1) % INTRO.length)}
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:underline"
            >
              next ›
            </button>
          </div>
          <p className="font-mono text-sm text-foreground">
            <span className="text-primary">{INTRO[beat]!.who}:</span> “{INTRO[beat]!.line}”
          </p>
        </section>

        {/* class select */}
        <section className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Choose your Resonant</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CLASSES.map((c) => (
              <button
                key={c.id}
                onClick={() => setPicked(c.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  picked === c.id ? "border-primary bg-primary/10" : "border-border bg-card/60 hover:border-primary/50"
                }`}
              >
                <span className="block h-1 w-8 rounded" style={{ background: c.color }} />
                <span className="mt-2 block font-mono text-sm text-foreground">{c.name}</span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {c.role}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{cls.lore}</p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onDeploy(picked)}
            className="rounded-md bg-primary px-6 py-3 font-mono text-sm uppercase tracking-[0.2em] text-primary-foreground transition-opacity hover:opacity-90"
          >
            Enter the Fracture
          </button>
          <button
            onClick={onSettings}
            className="rounded-md border border-border px-5 py-3 font-mono text-sm uppercase tracking-[0.2em] text-foreground hover:border-primary"
          >
            Settings
          </button>
          {best && (
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              last run · {best.credits} cr · {best.kills} kills
            </p>
          )}
        </div>

        <footer className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Act 1 Awakening · WASD move · Space fire · V vehicle · F camera · C jump · T time · I inspector
        </footer>
      </div>
    </div>
  );
}
