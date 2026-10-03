import { ChevronLeft, ChevronRight, Circle, Cpu, Settings, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLASSES, CUSTOMIZATION_PALETTE, DEFAULT_SUBCLASS, SUBCLASSES, appearanceById, operatorByClass, type AppearanceDefinition, type ClassId, type SubclassId } from "@/game/loadout";
import { CLASS_LABEL, IdentityForge } from "./IdentityForge";
import { CornerBrackets } from "./HudChrome";
import { useVoiceLine } from "./useVoiceLine";

export type { ClassId } from "@/game/loadout";
type Stage = "CLASS" | "SUBCLASS" | "APPEARANCE" | "ASSEMBLING";
/** `appearance` is the fully-resolved, possibly-customized identity — a signature preset by
 * default, or edited colors/callsign from the forge's customize panel. Session-local only, same
 * as the rest of deployment (never synced to player_saves). */
export type Deployment = { classId: ClassId; subclassId: SubclassId; appearance: AppearanceDefinition };
const STAGES: Stage[] = ["CLASS", "SUBCLASS", "APPEARANCE"];
const CHANNELS: { key: "armor" | "cloth" | "visor" | "trim"; label: string }[] = [
  { key: "armor", label: "Armor plate" },
  { key: "cloth", label: "Undersuit" },
  { key: "visor", label: "Visor line" },
  { key: "trim", label: "Trim accent" },
];

/** Default field colors + callsign for a freshly-picked class: that class's one named Operator's
 * signature preset, with their callsign pre-filled (the player can still edit both). Subclass
 * doesn't factor in here — all 3 of an Operator's subclasses are the same character. */
function APPEARANCE_FOR(classId: ClassId): AppearanceDefinition {
  const op = operatorByClass(classId);
  return { ...appearanceById(op.appearanceId), callsign: op.callsign };
}

const GUIDE: Record<Stage, string> = {
  CLASS: "Select your combat identity.",
  SUBCLASS: "Now define how that identity controls the battlefield.",
  APPEARANCE: "The forge is ready. Shape your field armor.",
  ASSEMBLING: "Identity stabilized. Armor assembly in progress.",
};

export function StartMenu({ onDeploy, onSettings }: { onDeploy: (deployment: Deployment) => void; onSettings: () => void; best: { credits: number; kills: number } | null }) {
  const [classId, setClassId] = useState<ClassId>("TITAN");
  const [subclassId, setSubclassId] = useState<SubclassId>("SHIELD_TITAN");
  const [appearance, setAppearance] = useState<AppearanceDefinition>(() => APPEARANCE_FOR("TITAN"));
  const [stage, setStage] = useState<Stage>("CLASS");
  const operator = operatorByClass(classId);
  const subclasses = SUBCLASSES.filter((item) => item.classId === classId);
  const stageIndex = STAGES.indexOf(stage);
  useVoiceLine(`forge-${stage}`, "NOVA", GUIDE[stage], "story");

  // Subclass is a respec of the same Operator, so it never touches appearance; only switching
  // Operator (class) resets colors/callsign back to that Operator's signature.
  const applySubclass = (id: SubclassId) => { setSubclassId(id); };
  const selectClass = (id: ClassId) => { setClassId(id); applySubclass(DEFAULT_SUBCLASS[id]); setAppearance(APPEARANCE_FOR(id)); };
  const next = () => {
    if (stage === "APPEARANCE") {
      setStage("ASSEMBLING");
      window.setTimeout(() => onDeploy({ classId, subclassId, appearance }), 2200);
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
    <div className="pointer-events-none absolute inset-0 forge-veil" />

    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-7">
      <div><p className="hud-label">Identity Forge // Chamber 01</p><h1 className="mt-1 font-mono text-xl font-bold tracking-[0.16em] sm:text-3xl" style={{ textShadow: "0 0 20px color-mix(in oklch, var(--primary) 35%, transparent)" }}>WORLD FRACTURE</h1></div>
      <Button className="hud-panel pointer-events-auto border-0" variant="ghost" size="icon" onClick={onSettings} aria-label="Open settings"><Settings /></Button>
    </header>

    <div className="pointer-events-none absolute inset-x-0 top-20 z-10 text-center ui-enter">
      <div className="flex items-center justify-center gap-3">{STAGES.map((item, index) => <span key={item} className={`flex items-center gap-3 ${stageIndex >= index ? "text-primary" : "text-muted-foreground/40"}`}><Circle className={`size-2 ${stage === item ? "fill-current" : ""}`} />{index < STAGES.length - 1 && <i className="h-px w-8 bg-current" />}</span>)}</div>
      <p className="mt-3 hud-label">NOVA // {stage === "ASSEMBLING" ? "FINALIZATION" : `PHASE 0${Math.max(1, stageIndex + 1)}`}</p>
      <p className="mt-2 text-sm text-foreground/80">{GUIDE[stage]}</p>
    </div>

    {stage === "CLASS" && <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 grid grid-cols-3 px-[4vw] text-center sm:px-[14vw]">
      {CLASSES.map((item, index) => <Button key={item.id} variant="ghost" className={`relative pointer-events-auto mx-auto h-auto w-fit rounded-none border-b-2 bg-transparent px-4 py-3 font-mono transition ${classId === item.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => selectClass(item.id)}><span><span className="block text-[9px] tracking-[0.3em] text-primary">0{index + 1}</span><span className="text-xs font-bold sm:text-lg">{CLASS_LABEL[item.id]}</span><span className="mt-1 hidden text-[8px] uppercase sm:block">{item.id === "TITAN" ? "Control space" : item.id === "HUNTER" ? "Control movement" : "Control systems"}</span></span></Button>)}
    </div>}

    {stage === "SUBCLASS" && <div className="pointer-events-auto absolute bottom-24 left-1/2 z-10 w-[min(62rem,calc(100%-2rem))] -translate-x-1/2">
      <div className="hud-panel relative mb-2 p-3">
        <CornerBrackets size={6} />
        <div className="flex items-baseline justify-between gap-3"><span className="font-mono text-xs uppercase tracking-[0.12em] text-foreground">{operator.name}</span><span className="font-mono text-[9px] uppercase text-primary">{operator.callsign}</span></div>
        <p className="mt-1 text-[10px] italic leading-relaxed text-muted-foreground">{operator.bio}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {subclasses.map((item) => (
          <Button key={item.id} variant="ghost" onClick={() => applySubclass(item.id)} className={`hud-panel relative h-auto min-h-24 justify-start px-4 py-3 text-left whitespace-normal ${subclassId === item.id ? "hud-glow text-foreground" : "text-muted-foreground"}`}>
            <CornerBrackets />
            <span>
              <span className="block font-mono text-xs uppercase tracking-[0.12em]">{item.name}</span>
              <span className="mt-1 block text-[10px] leading-relaxed">{item.description}</span>
              <span className="mt-2 block text-[9px] uppercase tracking-[0.1em] text-primary">Special ability</span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{item.specialAbility}</span>
            </span>
          </Button>
        ))}
      </div>
    </div>}

    {stage === "APPEARANCE" && <div className="pointer-events-auto absolute bottom-20 left-1/2 z-10 w-[min(48rem,calc(100%-2rem))] -translate-x-1/2">
      <div className="hud-panel relative p-3">
        <CornerBrackets size={6} />
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-foreground">{operator.name}</span>
          <span className="font-mono text-[9px] uppercase text-muted-foreground">{operator.classId} / {subclasses.find((item) => item.id === subclassId)?.name ?? ""}</span>
        </div>
        <p className="mt-1 text-[10px] italic leading-relaxed text-muted-foreground">{operator.bio}</p>

        <label className="mt-3 block">
          <span className="hud-label">Callsign</span>
          <Input value={appearance.callsign} maxLength={24} onChange={(event) => setAppearance((current) => ({ ...current, callsign: event.target.value.toUpperCase() }))} className="mt-1 h-8 rounded-none border-primary/30 bg-background/60 font-mono text-xs uppercase tracking-[0.12em]" />
        </label>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {CHANNELS.map(({ key, label }) => (
            <div key={key}>
              <span className="hud-label">{label}</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {CUSTOMIZATION_PALETTE.map((color) => (
                  <button key={color} type="button" aria-label={`${label} ${color}`} onClick={() => setAppearance((current) => ({ ...current, [key]: color }))} className="size-5 border transition" style={{ backgroundColor: color, borderColor: appearance[key] === color ? "var(--primary)" : "color-mix(in oklch, var(--primary) 30%, transparent)", boxShadow: appearance[key] === color ? `0 0 6px ${color}` : "none" }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center hud-label"><Cpu className="mr-1 inline size-3" style={{ filter: "drop-shadow(0 0 3px var(--primary))" }} />Live material projection · changes apply instantly</p>
    </div>}

    {stage !== "ASSEMBLING" && <footer className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-2">
      {stageIndex > 0 && <Button className="hud-panel pointer-events-auto border-0" variant="outline" onClick={back}><ChevronLeft />Back</Button>}
      <Button className="hud-glow pointer-events-auto min-w-44" onClick={next}>{stage === "APPEARANCE" ? <Shield /> : null}{stage === "CLASS" ? `Imprint ${operatorByClass(classId).name}` : stage === "SUBCLASS" ? "Approach armor forge" : "Confirm identity"}<ChevronRight /></Button>
    </footer>}
    {stage === "ASSEMBLING" && <div className="absolute inset-x-0 bottom-12 z-20 text-center"><p className="animate-pulse font-mono text-xs uppercase tracking-[0.35em] text-primary" style={{ textShadow: "0 0 12px color-mix(in oklch, var(--primary) 60%, transparent)" }}>Armor lattice assembling</p><div className="mx-auto mt-3 h-px w-64 overflow-hidden bg-muted"><div className="h-full w-full origin-left animate-[forge-progress_2.1s_ease-in-out] bg-primary" style={{ boxShadow: "0 0 8px var(--primary)" }} /></div></div>}
  </div>;
}