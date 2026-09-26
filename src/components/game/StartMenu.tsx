import { ChevronLeft, ChevronRight, Cpu, Settings, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import lineupArt from "@/assets/class-select-lineup.jpg";
import { APPEARANCES, CLASSES, DEFAULT_SUBCLASS, SUBCLASSES, appearanceById, classById, type AppearanceId, type ClassId, type SubclassId } from "@/game/loadout";
import { OperatorPreview } from "./OperatorPreview";

export type { ClassId } from "@/game/loadout";
type Stage = "CLASS" | "SUBCLASS" | "APPEARANCE";
export type Deployment = { classId: ClassId; subclassId: SubclassId; appearanceId: AppearanceId };
const STAGES: Stage[] = ["CLASS", "SUBCLASS", "APPEARANCE"];

export function StartMenu({ onDeploy, onSettings, best }: { onDeploy: (deployment: Deployment) => void; onSettings: () => void; best: { credits: number; kills: number } | null }) {
  const [classId, setClassId] = useState<ClassId>("TITAN");
  const [subclassId, setSubclassId] = useState<SubclassId>("SHIELD_TITAN");
  const [appearanceId, setAppearanceId] = useState<AppearanceId>("RANGER");
  const [stage, setStage] = useState<Stage>("CLASS");
  const [bodyFrame, setBodyFrame] = useState<"LIGHT" | "BALANCED" | "HEAVY">("BALANCED");
  const [coreType, setCoreType] = useState<"LOGIC" | "COMBAT" | "SYSTEM" | "ADAPTIVE">("ADAPTIVE");
  const [briefing, setBriefing] = useState<number | null>(null);
  useEffect(() => { if (!window.localStorage.getItem("world-fracture-briefing")) setBriefing(0); }, []);
  const closeBriefing = () => { window.localStorage.setItem("world-fracture-briefing", "1"); setBriefing(null); };
  const stageIndex = STAGES.indexOf(stage);
  const selectedClass = CLASSES.find((item) => item.id === classId) ?? classById(classId);
  const appearance = appearanceById(appearanceId);
  const subclasses = SUBCLASSES.filter((item) => item.classId === classId);
  const selectClass = (id: ClassId) => { setClassId(id); setSubclassId(DEFAULT_SUBCLASS[id]); };
  const next = () => { const nextStage = STAGES[stageIndex + 1]; if (nextStage) setStage(nextStage); else onDeploy({ classId, subclassId, appearanceId }); };
  const back = () => { const previous = STAGES[stageIndex - 1]; if (previous) setStage(previous); };

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
    <div className="pointer-events-none absolute inset-0 fracture-grid opacity-50" />
    {briefing !== null && <Briefing step={briefing} onStep={setBriefing} onClose={closeBriefing} />}
    <div className="relative mx-auto flex min-h-full max-w-6xl flex-col px-4 py-5 sm:px-8">
      <header className="flex items-start justify-between border-b border-border/70 pb-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.45em] text-primary">Season 01 · The First Collapse</p><h1 className="mt-2 font-mono text-3xl font-bold tracking-[0.16em] sm:text-5xl">WORLD FRACTURE</h1></div><Button variant="ghost" size="icon" onClick={onSettings} aria-label="Open settings"><Settings /></Button></header>
      <nav className="grid grid-cols-3 border-b border-border/70" aria-label="Operator creation steps">{STAGES.map((item, index) => <Button key={item} variant="ghost" onClick={() => index <= stageIndex && setStage(item)} className={`h-12 rounded-none border-b-2 font-mono text-[9px] uppercase tracking-[0.2em] ${item === stage ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>0{index + 1} · {item}</Button>)}</nav>
      <main className="flex flex-1 flex-col justify-center py-7">
        {stage === "CLASS" && <section aria-labelledby="class-title" className="relative">
          <div className="relative overflow-hidden rounded-lg border border-primary/20">
            <img src={lineupArt} alt="Vanguard, Assassin and Tech operatives on holographic pedestals" width={1792} height={896} className="aspect-[2/1] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
            <div className="absolute inset-x-0 top-4 grid grid-cols-3 text-center">{CLASSES.map((item, index) => <button key={item.id} onClick={() => selectClass(item.id)} className={`font-mono text-sm tracking-[0.2em] transition sm:text-2xl ${classId === item.id ? "text-foreground drop-shadow-[0_0_12px_var(--primary)]" : "text-foreground/60 hover:text-foreground"}`}><span className="text-primary">0{index + 1} //</span> {item.id === "TITAN" ? "VANGUARD" : item.id === "HUNTER" ? "ASSASSIN" : "TECH"}</button>)}</div>
          </div>
          <div className="relative mx-auto -mt-16 max-w-4xl rounded-lg border border-primary/25 bg-card/60 p-5 backdrop-blur-xl sm:-mt-28">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Fracture // Identity system</p>
            <h2 id="class-title" className="mt-1 text-2xl font-semibold sm:text-3xl">Choose who you become.</h2>
            <div className="mt-4 space-y-2">{CLASSES.map((item, index) => <button key={item.id} onClick={() => selectClass(item.id)} className={`w-full rounded-md border px-4 py-2.5 text-left transition ${classId === item.id ? "border-primary bg-primary/80 text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)]" : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70"}`}><span className="font-mono text-lg">0{index + 1} // {item.name}</span>{classId === item.id && <><span className="ml-3 font-mono text-[10px] uppercase tracking-[0.15em]">{item.id === "TITAN" ? "CONTROL SPACE" : item.id === "HUNTER" ? "CONTROL MOVEMENT" : "CONTROL SYSTEMS"}</span><span className="block text-sm">{item.fantasy}</span></>}</button>)}</div>
          </div>
        </section>}
        {stage === "SUBCLASS" && <section aria-labelledby="subclass-title" className="relative grid gap-6 overflow-hidden rounded-lg border border-primary/20 p-4 sm:p-6 lg:grid-cols-[1fr_0.72fr]"><img src={lineupArt} alt="" aria-hidden width={1792} height={896} className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40 blur-[2px]" /><div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/30" /><div className="rounded-lg border border-primary/25 bg-card/60 p-5 backdrop-blur-xl"><p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">{selectedClass.name} signatures</p><h2 id="subclass-title" className="mt-2 text-2xl font-semibold">Choose your first specialization.</h2><div className="mt-6 grid gap-3">{subclasses.map((item) => <Button key={item.id} variant="ghost" onClick={() => setSubclassId(item.id)} className={`h-auto min-h-28 items-stretch justify-start rounded-md border p-4 text-left whitespace-normal ${subclassId === item.id ? "border-primary bg-primary/80 text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)]" : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70"}`}><span><span className="font-mono text-base">{item.name}</span><span className="ml-3 font-mono text-[9px] uppercase opacity-80">{item.role}</span><span className="mt-2 block text-xs leading-relaxed opacity-80">{item.description}</span></span></Button>)}</div></div><div><OperatorPreview appearance={appearance} classId={classId} /><div className="mt-3 grid gap-2">{selectedClass.abilities.map((ability) => <div key={ability.slot} className="rounded-md border border-primary/25 bg-card/60 p-3 backdrop-blur-xl"><p className="font-mono text-[9px] text-primary">{ability.slot} · {ability.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{ability.description}</p></div>)}</div></div></section>}
        {stage === "APPEARANCE" && <section aria-labelledby="appearance-title" className="relative grid gap-6 overflow-hidden rounded-lg border border-primary/20 p-4 sm:p-6 lg:grid-cols-[0.9fr_1.1fr]"><img src={lineupArt} alt="" aria-hidden width={1792} height={896} className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40 blur-[2px]" /><div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/30" /><div className="rounded-lg border border-primary/25 bg-card/60 p-5 backdrop-blur-xl"><p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Fracture body design</p><h2 id="appearance-title" className="mt-2 text-2xl font-semibold">Configure your field identity.</h2><p className="mt-5 font-mono text-[9px] uppercase text-primary">Body frame</p><div className="mt-2 grid grid-cols-3 gap-1">{(["LIGHT", "BALANCED", "HEAVY"] as const).map((item) => <Button key={item} size="sm" variant={bodyFrame === item ? "default" : "outline"} onClick={() => setBodyFrame(item)}>{item}</Button>)}</div><p className="mt-5 font-mono text-[9px] uppercase text-primary">Core type</p><div className="mt-2 grid grid-cols-2 gap-1">{(["LOGIC", "COMBAT", "SYSTEM", "ADAPTIVE"] as const).map((item) => <Button key={item} size="sm" variant={coreType === item ? "default" : "outline"} onClick={() => setCoreType(item)}><Cpu />{item}</Button>)}</div><p className="mt-5 font-mono text-[9px] uppercase text-primary">Armor language</p><div className="mt-2 grid grid-cols-2 gap-2">{APPEARANCES.map((item) => <Button key={item.id} variant="ghost" onClick={() => setAppearanceId(item.id)} className={`h-auto min-h-24 items-stretch justify-start rounded-md border p-3 text-left ${appearanceId === item.id ? "border-primary bg-primary/80 text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)]" : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70"}`}><span><span className="flex gap-2">{[item.armor,item.cloth,item.visor].map(color => <i key={color} className="h-3 w-3 border border-border" style={{backgroundColor:color}} />)}</span><span className="mt-3 block font-mono text-xs">{item.name}</span><span className="mt-1 block font-mono text-[8px] uppercase opacity-80">{item.marking}</span></span></Button>)}</div></div><OperatorPreview appearance={appearance} classId={classId} /></section>}
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4"><div className="flex items-center gap-2">{stageIndex > 0 && <Button variant="outline" onClick={back}><ChevronLeft /> Back</Button>}<Button onClick={next}>{stage === "APPEARANCE" && <Shield />}{stage === "APPEARANCE" ? "Begin Mission 01" : "Continue"}<ChevronRight /></Button></div><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{best ? `Last run · ${best.credits} cr · ${best.kills} kills` : "Veridan insertion channel secure"}</p></footer>
    </div>
  </div>;
}

const BRIEFING = [
  { tag: "01 // Identity", title: "Your class shapes every fight.", body: "Titans control space with shields and barriers. Hunters control movement with speed and precision. Warlocks control systems with drones and hacks. Your class locks in when you enter the world." },
  { tag: "02 // Specialization", title: "Pick a subclass, then your look.", body: "Each class has three subclasses that change your abilities. Then choose a body frame, core type and armor colors — they show on your operator right away." },
  { tag: "03 // Cloud save", title: "Your progress follows you.", body: "Progress saves on this device automatically. Open ☁ Cloud save in the world to sign in and keep unlocks, vehicles and garage across devices — with restore points if something goes wrong." },
];
function Briefing({ step, onStep, onClose }: { step: number; onStep: (n: number) => void; onClose: () => void }) {
  const b = BRIEFING[step]!;
  return <div role="dialog" aria-modal aria-labelledby="briefing-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
    <div className="w-full max-w-lg rounded-lg border border-primary/30 bg-card/80 p-6 shadow-[0_0_60px_-20px_var(--primary)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Operator briefing · {b.tag}</p>
      <h2 id="briefing-title" className="mt-2 text-2xl font-semibold">{b.title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
      <div className="mt-5 flex gap-1.5">{BRIEFING.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />)}</div>
      <div className="mt-5 flex items-center justify-between"><Button variant="ghost" onClick={onClose}>Skip</Button><div className="flex gap-2">{step > 0 && <Button variant="outline" onClick={() => onStep(step - 1)}><ChevronLeft /> Back</Button>}<Button onClick={() => step < BRIEFING.length - 1 ? onStep(step + 1) : onClose()}>{step < BRIEFING.length - 1 ? "Next" : "Start creating"}<ChevronRight /></Button></div></div>
    </div>
  </div>;
}
