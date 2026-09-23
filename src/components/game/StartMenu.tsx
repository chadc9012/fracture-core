import { ChevronLeft, ChevronRight, LockKeyhole, Settings, Shield, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { APPEARANCES, appearanceById, type AppearanceId, type ClassId } from "@/game/loadout";
import { STARTER_VEHICLES, VEHICLES, vehicleById, type VehicleId } from "@/game/vehicles";

export type { ClassId } from "@/game/loadout";

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

type Stage = "CLASS" | "APPEARANCE" | "VEHICLE";
export type Deployment = { classId: ClassId; appearanceId: AppearanceId; vehicleId: VehicleId };

const STAGES: Stage[] = ["CLASS", "APPEARANCE", "VEHICLE"];

/** Orbit screen — the game never drops you into the world unannounced. */
export function StartMenu({
  onDeploy,
  onSettings,
  best,
}: {
  onDeploy: (deployment: Deployment) => void;
  onSettings: () => void;
  best: { credits: number; kills: number } | null;
}) {
  const [classId, setClassId] = useState<ClassId>("VANGUARD");
  const [appearanceId, setAppearanceId] = useState<AppearanceId>("RANGER");
  const [vehicleId, setVehicleId] = useState<VehicleId>("scrap-interceptor");
  const [stage, setStage] = useState<Stage>("CLASS");
  const stageIndex = STAGES.indexOf(stage);
  const selectedClass = CLASSES.find((item) => item.id === classId);
  const appearance = appearanceById(appearanceId);
  const vehicle = vehicleById(vehicleId);

  const next = () => {
    const nextStage = STAGES[stageIndex + 1];
    if (nextStage) setStage(nextStage);
    else onDeploy({ classId, appearanceId, vehicleId });
  };

  const back = () => {
    const previousStage = STAGES[stageIndex - 1];
    if (previousStage) setStage(previousStage);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="pointer-events-none absolute inset-0 fracture-grid opacity-50" />
      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col px-4 py-5 sm:px-8">
        <header className="flex items-start justify-between border-b border-border/70 pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-primary">Season 01 · The First Collapse</p>
            <h1 className="mt-2 font-mono text-3xl font-bold tracking-[0.16em] text-foreground sm:text-5xl">WORLD FRACTURE</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={onSettings} aria-label="Open settings"><Settings /></Button>
        </header>

        <nav className="grid grid-cols-3 border-b border-border/70" aria-label="Deployment steps">
          {STAGES.map((item, index) => (
            <button key={item} type="button" onClick={() => index <= stageIndex && setStage(item)}
              className={`border-b-2 px-2 py-3 font-mono text-[9px] uppercase tracking-[0.25em] ${item === stage ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              0{index + 1} · {item}
            </button>
          ))}
        </nav>

        <main className="flex flex-1 flex-col justify-center py-8">
          {stage === "CLASS" && (
            <section aria-labelledby="class-title">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Resonant doctrine</p>
              <h2 id="class-title" className="mt-2 text-2xl font-semibold text-foreground">Choose how you survive the break.</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {CLASSES.map((item, index) => (
                  <button key={item.id} onClick={() => setClassId(item.id)} className={`group min-h-60 border p-5 text-left transition-colors ${classId === item.id ? "border-primary bg-primary/10" : "border-border bg-card/50 hover:border-primary/50"}`}>
                    <span className="font-mono text-[10px] text-muted-foreground">0{index + 1}</span>
                    <span className="mt-20 block font-mono text-lg text-foreground">{item.name}</span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: item.color }}>{item.role}</span>
                    <span className="mt-3 block text-xs leading-relaxed text-muted-foreground">{item.lore}</span>
                  </button>
                ))}
              </div>
              <p className="mt-4 border-l-2 border-primary pl-3 text-xs text-muted-foreground">Selected: <span className="text-foreground">{selectedClass?.name ?? "Vanguard"}</span></p>
            </section>
          )}

          {stage === "APPEARANCE" && (
            <section aria-labelledby="appearance-title" className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Field identity</p>
                <h2 id="appearance-title" className="mt-2 text-2xl font-semibold">Configure your fracture rig.</h2>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {APPEARANCES.map((item) => (
                    <button key={item.id} onClick={() => setAppearanceId(item.id)} className={`border p-4 text-left ${appearanceId === item.id ? "border-primary bg-primary/10" : "border-border bg-card/50 hover:border-primary/50"}`}>
                      <span className="flex gap-2"><i className="h-3 w-3 border border-border" style={{ backgroundColor: item.armor }} /><i className="h-3 w-3 border border-border" style={{ backgroundColor: item.cloth }} /><i className="h-3 w-3 border border-border" style={{ backgroundColor: item.visor }} /></span>
                      <span className="mt-4 block font-mono text-sm">{item.name}</span>
                      <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{item.marking}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex min-h-80 items-end border border-border bg-card/40 p-6 fracture-scan">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Live rig profile</p>
                  <h3 className="mt-2 font-mono text-2xl">{appearance.name}</h3>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {[appearance.armor, appearance.cloth, appearance.visor].map((color) => <span key={color} className="h-16 border border-border" style={{ backgroundColor: color }} />)}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">Armor finish, field cloth and visor resonance are applied to your in-world operator.</p>
                </div>
              </div>
            </section>
          )}

          {stage === "VEHICLE" && (
            <section aria-labelledby="vehicle-title">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Motor pool · {VEHICLES.length} registered frames</p>
              <h2 id="vehicle-title" className="mt-2 text-2xl font-semibold">Select a deployment vehicle.</h2>
              <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
                <div className="grid gap-3 sm:grid-cols-2">
                  {STARTER_VEHICLES.map((item) => (
                    <button key={item.id} onClick={() => setVehicleId(item.id)} className={`min-h-44 border p-5 text-left ${vehicleId === item.id ? "border-primary bg-primary/10" : "border-border bg-card/50 hover:border-primary/50"}`}>
                      <span className="flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">{item.rarity} · {item.domain}</span><Users className="h-4 w-4 text-muted-foreground" /></span>
                      <span className="mt-8 block font-mono text-lg">{item.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.role}</span>
                    </button>
                  ))}
                  <div className="border border-border bg-card/30 p-4 sm:col-span-2">
                    <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /> Vehicle codex · campaign unlocks</p>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                      {VEHICLES.filter((item) => !item.starter).map((item) => <span key={item.id} className="truncate font-mono text-[9px] text-muted-foreground">{item.name}</span>)}
                    </div>
                  </div>
                </div>
                <aside className="border border-border bg-card/50 p-5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Deployment ready</p>
                  <h3 className="mt-2 font-mono text-xl">{vehicle.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{vehicle.type}</p>
                  <dl className="mt-6 space-y-3 text-xs">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Weapon</dt><dd>{vehicle.weapon}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Seats</dt><dd>{vehicle.seats}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Hull</dt><dd>{Math.round(vehicle.hull * 100)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Speed</dt><dd>{Math.round(vehicle.speed * 100)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Handling</dt><dd>{Math.round(vehicle.handling * 100)}</dd></div>
                  </dl>
                  <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{vehicle.lore}</p>
                </aside>
              </div>
            </section>
          )}
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <div className="flex items-center gap-2">
            {stageIndex > 0 && <Button variant="outline" onClick={back}><ChevronLeft /> Back</Button>}
            <Button onClick={next}>{stage === "VEHICLE" ? <Shield /> : null}{stage === "VEHICLE" ? "Deploy" : "Continue"}<ChevronRight /></Button>
          </div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{best ? `Last run · ${best.credits} cr · ${best.kills} kills` : "Nexus deployment channel secure"}</p>
        </footer>
      </div>
    </div>
  );
}
