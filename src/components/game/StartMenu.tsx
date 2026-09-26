import { ChevronLeft, ChevronRight, Cpu, Settings, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { APPEARANCES, CLASSES, DEFAULT_SUBCLASS, SUBCLASSES, appearanceById, classById, type AppearanceId, type ClassId, type SubclassId } from "@/game/loadout";
import { CLASS_LABEL, IdentityForge } from "./IdentityForge";

export type { ClassId } from "@/game/loadout";
type Stage = "CLASS" | "SUBCLASS" | "APPEARANCE" | "ASSEMBLING";
export type Deployment = { classId: ClassId; subclassId: SubclassId; appearanceId: AppearanceId };
const STAGES: Stage[] = ["CLASS", "SUBCLASS", "APPEARANCE"];

const GUIDE: Record<Stage, string> = {
  CLASS: "Select your combat identity.",
  SUBCLASS: "Now define how that identity controls the battlefield.",
  APPEARANCE: "The forge is ready. Shape your field armor.",
  ASSEMBLING: "Identity stabilized. Armor assembly in progress.",
};

export function StartMenu({ onDeploy, onSettings }: { onDeploy: (deployment: Deployment) => void; onSettings: () => void; best: { credits: number; kills: number } | null }) {
  const [classId, setClassId] = useState<ClassId>("TITAN");
  const [subclassId, setSubclassId] = useState<SubclassId>("SHIELD_TITAN");
  const [appearanceId, setAppearanceId] = useState<AppearanceId>("RANGER");
  const [stage, setStage] = useState<Stage>("CLASS");
  const appearance = appearanceById(appearanceId);
  const selectedClass = classById(classId);
  const subclasses = SUBCLASSES.filter((item) => item.classId === classId);
  const stageIndex = STAGES.indexOf(stage);

  const selectClass = (id: ClassId) => { setClassId(id); setSubclassId(DEFAULT_SUBCLASS[id]); };
  const next = () => {
    if (stage === "APPEARANCE") {
      setStage("ASSEMBLING");
      window.setTimeout(() => onDeploy({ classId, subclassId, appearanceId }), 2200);
      return;
    }
    const nextStage = STAGES[stageIndex + 1];
    if (nextStage) setStage(nextStage);
  };
  const back = () => { const previous = STAGES[stageIndex - 1]; if (previous) setStage(previous); };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (stage === "ASSEMBLING") return;
      if (stage === "CLASS" && ["Digit1", "Digit2", "Digit3"].includes(event.code)) selectClass(CLASSES[Number(event.code.at(-1)) - 1]?.id ?? "TITAN");
      if (event.code === "Enter") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return <div className="fixed inset-0 z-50 overflow-hidden bg-background">
    <div className="absolute inset-0"><IdentityForge classId={classId} appearance={appearance} mode={stage} onSelectClass={selectClass} /></div>
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--background)_45%,transparent),transparent_30%,color-mix(in_oklch,var(--background)_92%,transparent))]" />

    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-7">
      <div><p className="font-mono text-[9px] uppercase tracking-[0.42em] text-primary">Identity Forge // Chamber 01</p><h1 className="mt-1 font-mono text-xl font-bold tracking-[0.16em] sm:text-3xl">WORLD FRACTURE</h1></div>
      <Button className="pointer-events-auto" variant="ghost" size="icon" onClick={onSettings} aria-label="Open settings"><Settings /></Button>
    </header>

    <div className="pointer-events-none absolute inset-x-0 top-20 z-10 text-center">
      <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-primary">NOVA // {stage === "ASSEMBLING" ? "FINALIZATION" : `PHASE 0${Math.max(1, stageIndex + 1)}`}</p>
      <p className="mt-2 text-sm text-foreground/80">{GUIDE[stage]}</p>
    </div>

    {stage === "CLASS" && <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 grid grid-cols-3 px-[4vw] text-center sm:px-[14vw]">
      {CLASSES.map((item, index) => <button key={item.id} className={`pointer-events-auto mx-auto w-fit font-mono transition ${classId === item.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => selectClass(item.id)}><span className="block text-[9px] tracking-[0.3em] text-primary">0{index + 1}</span><span className="text-xs font-bold tracking-[0.16em] sm:text-lg">{CLASS_LABEL[item.id]}</span><span className="mt-1 hidden text-[8px] uppercase tracking-[0.15em] sm:block">{item.id === "TITAN" ? "Control space" : item.id === "HUNTER" ? "Control movement" : "Control systems"}</span></button>)}
    </div>}

    {stage === "SUBCLASS" && <div className="pointer-events-auto absolute bottom-24 left-1/2 z-10 grid w-[min(62rem,calc(100%-2rem))] -translate-x-1/2 gap-2 sm:grid-cols-3">
      {subclasses.map((item) => <Button key={item.id} variant="ghost" onClick={() => setSubclassId(item.id)} className={`h-auto min-h-20 justify-start border px-4 py-3 text-left whitespace-normal backdrop-blur-md ${subclassId === item.id ? "border-primary bg-primary/20 text-foreground" : "border-border/70 bg-background/65 text-muted-foreground"}`}><span><span className="block font-mono text-xs uppercase tracking-[0.12em]">{item.name}</span><span className="mt-1 block text-[10px] leading-relaxed">{item.description}</span></span></Button>)}
    </div>}

    {stage === "APPEARANCE" && <div className="pointer-events-auto absolute bottom-24 left-1/2 z-10 w-[min(48rem,calc(100%-2rem))] -translate-x-1/2">
      <div className="grid grid-cols-4 gap-2">{APPEARANCES.map((item) => <Button key={item.id} variant="ghost" onClick={() => setAppearanceId(item.id)} className={`h-auto min-h-20 border p-2 backdrop-blur-md ${appearanceId === item.id ? "border-primary bg-primary/20" : "border-border/70 bg-background/65"}`}><span><span className="mx-auto flex justify-center gap-1">{[item.armor, item.cloth, item.visor].map((color) => <i key={color} className="size-3 border border-border" style={{ backgroundColor: color }} />)}</span><span className="mt-2 block font-mono text-[9px] uppercase">{item.name}</span></span></Button>)}</div>
      <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground"><Cpu className="mr-1 inline size-3" />Live material projection · changes apply instantly</p>
    </div>}

    {stage !== "ASSEMBLING" && <footer className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-2">
      {stageIndex > 0 && <Button className="pointer-events-auto" variant="outline" onClick={back}><ChevronLeft />Back</Button>}
      <Button className="pointer-events-auto min-w-44" onClick={next}>{stage === "APPEARANCE" ? <Shield /> : null}{stage === "CLASS" ? `Imprint ${selectedClass.name}` : stage === "SUBCLASS" ? "Approach armor forge" : "Confirm identity"}<ChevronRight /></Button>
    </footer>}
    {stage === "ASSEMBLING" && <div className="absolute inset-x-0 bottom-12 z-20 text-center"><p className="animate-pulse font-mono text-xs uppercase tracking-[0.35em] text-primary">Armor lattice assembling</p><div className="mx-auto mt-3 h-px w-64 overflow-hidden bg-muted"><div className="h-full w-full origin-left animate-[forge-progress_2.1s_ease-in-out] bg-primary" /></div></div>}
  </div>;
}