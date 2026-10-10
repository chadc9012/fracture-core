import { ChevronLeft, ChevronRight, Circle, Cpu, Settings, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMenuInput } from "./useMenuInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLASSES, CUSTOMIZATION_PALETTE, DEFAULT_SUBCLASS, SUBCLASSES, appearanceById, operatorByClass, type AppearanceDefinition, type ClassId, type OperatorId, type SubclassId } from "@/game/loadout";
import { BODY_PROFILES, BODY_TYPES, type BodyType } from "@/game/operators";
import { createDeployGuard, deployCharacter, newDeploymentId, type PlayerCharacter } from "@/game/deployment/deployCharacter";
import { armorLook } from "@/game/armor-look";
import { armorSummary, cyclePiece, defaultAppearance, forgeDirty, forgeInitial, slotOptions, SLOT_LABEL } from "@/game/deployment/forgeState";
import type { PlayerProgression } from "@/game/progression";
import { SET_SLOTS } from "@/game/armor-sets";
import { ConfirmDialog } from "./ConfirmDialog";
import { CLASS_LABEL, IdentityForge } from "./IdentityForge";
import { CornerBrackets } from "./HudChrome";
import { useVoiceLine } from "./useVoiceLine";

export type { ClassId } from "@/game/loadout";
type Stage = "CLASS" | "SUBCLASS" | "APPEARANCE" | "ASSEMBLING";
/** `appearance` is the fully-resolved, possibly-customized identity — a signature preset by
 * default, or edited colors/callsign from the forge's customize panel. Session-local only, same
 * as the rest of deployment (never synced to player_saves). */
export type Deployment = { classId: ClassId; subclassId: SubclassId; appearance: AppearanceDefinition; bodyType: BodyType; deploymentId: string; operatorId: OperatorId };
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
const APPEARANCE_FOR = defaultAppearance;

type Tab = "body" | "gear" | "armor" | "cloth" | "visor" | "trim" | "callsign";
const TABS: { key: Tab; label: string }[] = [
  { key: "body", label: "Body" }, { key: "gear", label: "Gear" }, { key: "armor", label: "Armor" }, { key: "cloth", label: "Undersuit" },
  { key: "visor", label: "Visor" }, { key: "trim", label: "Trim" }, { key: "callsign", label: "Callsign" },
];

const GUIDE: Record<Stage, string> = {
  CLASS: "Select your operative: GOLIATH, NYX or CIPHER.",
  SUBCLASS: "Now define how that identity controls the battlefield.",
  APPEARANCE: "The forge is ready. Shape your field armor.",
  ASSEMBLING: "Identity stabilized. Armor assembly in progress.",
};

export function StartMenu({ onDeploy, onSaveCharacter, weaponOrder, onSettings, onExit, saved, gear, paused }: { saved?: PlayerCharacter | null; gear?: Pick<PlayerProgression, "inventory" | "equippedGear">; paused?: boolean; onExit?: () => void; onDeploy: (deployment: Deployment) => void; onSaveCharacter?: (character: PlayerCharacter, equippedGear?: PlayerProgression["equippedGear"]) => Promise<void>; weaponOrder?: readonly string[]; onSettings: () => void; best: { credits: number; kills: number } | null }) {
  // reopening character creation restores the saved operator; `start` is what "unsaved edits" are measured against
  const start = useRef(forgeInitial(saved)).current;
  const [classId, setClassId] = useState<ClassId>(start.classId);
  const [subclassId, setSubclassId] = useState<SubclassId>(start.subclassId);
  const [appearance, setAppearance] = useState<AppearanceDefinition>(start.appearance);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [stage, setStage] = useState<Stage>("CLASS");
  const [bodyType, setBodyType] = useState<BodyType>(start.bodyType);
  const [deployError, setDeployError] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [tab, setTab] = useState<Tab>("body");
  const guard = useRef(createDeployGuard()).current;
  // worn armor is edited per slot here and persisted with the character on confirm; slots mix pieces from any set
  const [worn, setWorn] = useState(() => ({ inventory: gear?.inventory ?? [], equippedGear: gear?.equippedGear ?? {} }));
  const startGear = useRef(gear?.equippedGear ?? {}).current;
  const gearDirty = JSON.stringify(worn.equippedGear) !== JSON.stringify(startGear);
  const operator = operatorByClass(classId);
  const subclasses = SUBCLASSES.filter((item) => item.classId === classId);
  const stageIndex = STAGES.indexOf(stage);
  useVoiceLine(`forge-${stage}`, "NOVA", GUIDE[stage], "story");

  // Subclass is a respec of the same Operator, so it never touches appearance; only switching
  // Operator (class) resets colors/callsign back to that Operator's signature.
  const applySubclass = (id: SubclassId) => { setSubclassId(id); };
  const selectClass = (id: ClassId) => { setClassId(id); applySubclass(DEFAULT_SUBCLASS[id]); setAppearance(APPEARANCE_FOR(id)); };
  const confirmIdentity = async () => {
    const deploymentId = newDeploymentId();
    const character: PlayerCharacter = {
      deploymentId, operatorId: operator.id, classId, subclassId, bodyType, displayName: appearance.callsign,
      appearance: { armor: appearance.armor, cloth: appearance.cloth, visor: appearance.visor, trim: appearance.trim, callsign: appearance.callsign },
      loadout: { weaponOrder: weaponOrder ?? [] },
    };
    setDeployError("");
    setDeploying(true);
    const ran = await guard.run(async () => {
      try {
        await deployCharacter(character, {
          saveCharacter: async (c) => { await onSaveCharacter?.(c, gearDirty ? worn.equippedGear : undefined); setStage("ASSEMBLING"); },
          // the mission only launches after the save above resolved and the assembly beat has played
          launchMission: () => new Promise<void>((resolve) => window.setTimeout(() => { onDeploy({ classId, subclassId, appearance, bodyType, deploymentId, operatorId: operator.id }); resolve(); }, 2200)),
        });
      } catch (err) {
        setStage("APPEARANCE");
        setDeployError(err instanceof Error ? err.message : "Unable to save or deploy. Please try again.");
      }
    });
    if (ran !== null) setDeploying(false);
    return ran;
  };
  const next = () => {
    if (stage === "APPEARANCE") { void confirmIdentity(); return; }
    const nextStage = STAGES[stageIndex + 1];
    if (nextStage) setStage(nextStage);
  };
  const back = () => { const previous = STAGES[stageIndex - 1]; if (previous) setStage(previous); };

  // Esc / Backspace / controller B-Circle: previous step, or out to the main menu from the first step (never mid-save)
  const dirty = forgeDirty(start, { classId, subclassId, appearance, bodyType }) || gearDirty;
  const leave = () => { if (dirty) setConfirmLeave(true); else onExit?.(); };
  useMenuInput(stage !== "ASSEMBLING" && !deploying && !paused && !confirmLeave, () => { if (stageIndex > 0) back(); else leave(); }, ["back"]);
  const summary = gear ? armorSummary(worn) : null;
  const look = armorLook(worn);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (stage === "ASSEMBLING" || paused || confirmLeave) return;
      if (stage === "CLASS" && ["Digit1", "Digit2", "Digit3"].includes(event.code)) selectClass(CLASSES[Number(event.code.at(-1)) - 1]?.id ?? "TITAN");
      if (event.code === "Enter" && !event.repeat) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return <div className="fixed inset-0 z-50 overflow-hidden bg-background">
    <div className="absolute inset-0"><IdentityForge look={look} classId={classId} appearance={appearance} bodyType={bodyType} mode={stage} onSelectClass={selectClass} /></div>
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

    {stage === "CLASS" && <>
      <div className="pointer-events-none absolute inset-x-0 bottom-20 z-10 grid grid-cols-3 gap-2 px-[2vw] sm:gap-4 sm:px-[8vw]">
        {CLASSES.map((item, index) => {
          const op = operatorByClass(item.id);
          const active = classId === item.id;
          const stats: [string, number, number][] = [["Health", op.baseStats.health, 160], ["Armor", op.baseStats.armor, 130], ["Mobility", op.baseStats.mobility, 100], ["Tech", op.baseStats.tech, 110]];
          return <button key={item.id} type="button" onClick={() => selectClass(item.id)} className={`hud-panel pointer-events-auto relative overflow-hidden px-3 pb-3 pt-4 text-center transition ${active ? "hud-glow text-foreground" : "text-muted-foreground opacity-75 hover:opacity-100"}`}>
            <CornerBrackets size={6} />
            <span className="block font-mono text-[9px] tracking-[0.3em] text-primary">0{index + 1} // {op.className.toUpperCase()} CLASS</span>
            <span className="mt-1 block font-mono text-lg font-bold tracking-[0.2em] sm:text-2xl">{op.name}</span>
            <span className="mt-0.5 hidden text-[10px] sm:block">{item.role}</span>
            <span className="mt-2 hidden gap-1 sm:grid">
              {stats.map(([label, value, max]) => <span key={label} className="grid grid-cols-[3.6rem_1fr] items-center gap-2 text-left font-mono text-[8px] uppercase tracking-[0.1em]">
                <span>{label}</span>
                <span className="h-1 bg-foreground/15"><span className="block h-full bg-primary" style={{ width: `${Math.min(100, (value / max) * 100)}%`, boxShadow: active ? "0 0 6px var(--primary)" : "none" }} /></span>
              </span>)}
            </span>
            {active && <span className="mt-2 hidden border-t border-primary/30 pt-2 text-left sm:block">
              {item.abilities.map((ability) => <span key={ability.slot} className="block text-[9px] leading-snug"><b className="text-primary">{ability.name}</b> · {ability.description}</span>)}
            </span>}
          </button>;
        })}
      </div>
    </>}

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

    {stage === "APPEARANCE" && <div className="pointer-events-auto absolute inset-x-0 bottom-20 z-10 mx-auto w-[min(56rem,calc(100%-2rem))] sm:inset-x-auto sm:bottom-auto sm:right-[4vw] sm:top-28 sm:mx-0 sm:w-[min(26rem,44vw)]">
      <div className="hud-panel relative p-4">
        <CornerBrackets size={6} />
        <h2 className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-foreground">Customize your appearance</h2>
        <div className="mt-1 flex items-baseline justify-between gap-3 border-b border-primary/25 pb-2">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-primary">{operator.name}</span>
          <span className="font-mono text-[9px] uppercase text-muted-foreground">{operator.className} / {subclasses.find((item) => item.id === subclassId)?.name ?? ""}</span>
        </div>
        <div className="mt-3 grid grid-cols-[6.5rem_1fr] gap-3">
          <nav className="grid content-start gap-1" aria-label="Appearance categories">
            {TABS.map(({ key, label }) => <button key={key} type="button" onClick={() => setTab(key)} className={`border px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] transition ${tab === key ? "border-primary bg-primary/15 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
          </nav>
          <div className="min-h-44">
            {tab === "body" && <div className="grid gap-2">
              {BODY_TYPES.map((type) => <button key={type} type="button" onClick={() => setBodyType(type)} className={`border px-3 py-2 text-left transition ${bodyType === type ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}><span className="block font-mono text-[11px] uppercase tracking-[0.12em]">{BODY_PROFILES[type].label}</span><span className="block text-[9px]">{BODY_PROFILES[type].blurb}</span></button>)}
            </div>}
            {tab === "gear" && <div className="grid gap-1.5" role="group" aria-label="Worn armor by slot">
              {SET_SLOTS.map((slot) => {
                const options = slotOptions(worn, slot);
                const current = options.find((o) => o.id === (worn.equippedGear[slot] ?? null)) ?? options[0]!;
                return <div key={slot} className="border border-border p-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <button type="button" aria-label={`Previous ${SLOT_LABEL[slot]}`} disabled={options.length < 2} onClick={() => setWorn((w) => cyclePiece(w, slot, -1))} className="px-1.5 py-1 text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30"><ChevronLeft className="size-3" /></button>
                    <span className="min-w-0 flex-1 text-center"><span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{SLOT_LABEL[slot]}</span><span className={`block truncate font-mono text-[10px] uppercase ${current.id ? "text-foreground" : "text-muted-foreground/60"}`}>{current.name}{current.id ? ` · ${current.power}` : ""}</span></span>
                    <button type="button" aria-label={`Next ${SLOT_LABEL[slot]}`} disabled={options.length < 2} onClick={() => setWorn((w) => cyclePiece(w, slot, 1))} className="px-1.5 py-1 text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30"><ChevronRight className="size-3" /></button>
                  </div>
                  {options.length < 2 && <p className="text-center text-[9px] text-muted-foreground">No {SLOT_LABEL[slot].toLowerCase()} pieces owned yet — earn them from regional drops.</p>}
                </div>;
              })}
              <p className="text-[9px] leading-snug text-muted-foreground">Pieces mix freely across sets. Totals at right come from the worn items; colour motifs show on the model only for set pieces that have a motif.</p>
            </div>}
            {tab === "callsign" && <label className="block">
              <span className="hud-label">Callsign</span>
              <Input value={appearance.callsign} maxLength={24} onChange={(event) => setAppearance((current) => ({ ...current, callsign: event.target.value.toUpperCase() }))} className="mt-1 h-9 rounded-none border-primary/30 bg-background/60 font-mono text-xs uppercase tracking-[0.12em]" />
              <p className="mt-2 text-[10px] italic leading-relaxed text-muted-foreground">{operator.bio}</p>
            </label>}
            {CHANNELS.filter((c) => c.key === tab).map(({ key, label }) => <div key={key}>
              <span className="hud-label">{label}</span>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {CUSTOMIZATION_PALETTE.map((color) => (
                  <button key={color} type="button" aria-label={`${label} ${color}`} onClick={() => setAppearance((current) => ({ ...current, [key]: color }))} className="aspect-square border transition" style={{ backgroundColor: color, borderColor: appearance[key] === color ? "var(--primary)" : "color-mix(in oklch, var(--primary) 30%, transparent)", boxShadow: appearance[key] === color ? `0 0 8px ${color}` : "none" }} />
                ))}
              </div>
            </div>)}
          </div>
        </div>
      </div>
      {deployError && <p role="alert" className="mt-2 text-center font-mono text-xs text-destructive">{deployError}</p>}
      <p className="mt-2 text-center hud-label"><Cpu className="mr-1 inline size-3" style={{ filter: "drop-shadow(0 0 3px var(--primary))" }} />Live material projection · changes apply instantly</p>
    </div>}

    {summary && stage !== "ASSEMBLING" && <aside className="pointer-events-none absolute right-4 top-24 z-10 hidden w-56 border border-primary/30 bg-background/70 p-3 backdrop-blur-sm md:block" aria-label="Equipped armor and stats">
      <p className="hud-label">Equipped armor</p>
      <ul className="mt-2 space-y-1 font-mono text-[10px] uppercase tracking-[0.12em]">
        {summary.slots.map((slot) => <li key={slot.slot} className="flex justify-between gap-2"><span className="text-muted-foreground">{slot.label}</span><span className={slot.name ? "truncate text-foreground" : "text-muted-foreground/50"}>{slot.name ?? "Empty"}</span></li>)}
      </ul>
      <p className="hud-label mt-3">Armor stats</p>
      <ul className="mt-1 space-y-1 font-mono text-[10px] uppercase tracking-[0.12em]">
        {(["defense", "mobility", "intellect"] as const).map((k) => <li key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="text-foreground">{summary.stats[k].toFixed(1)}</span></li>)}
      </ul>
      <p className="mt-3 text-[9px] leading-snug text-muted-foreground">Change worn pieces in the Gear tab; they are saved with your character.</p>
    </aside>}
    {confirmLeave && <ConfirmDialog pad={null} title="Discard changes?" body="You changed your operator but haven't saved. Leaving now discards those edits; your saved character is untouched." confirmLabel="Discard & leave" cancelLabel="Keep editing" onCancel={() => setConfirmLeave(false)} onConfirm={() => { setConfirmLeave(false); onExit?.(); }} />}

    {stage !== "ASSEMBLING" && <footer className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-2">
      {stageIndex > 0 && <Button className="hud-panel pointer-events-auto border-0" variant="outline" onClick={back} disabled={deploying}><ChevronLeft />Back</Button>}
      {stageIndex === 0 && onExit && <Button className="hud-panel pointer-events-auto border-0" variant="outline" onClick={leave}><ChevronLeft />Main menu</Button>}
      <Button className="hud-glow pointer-events-auto min-w-44" onClick={next} disabled={deploying}>{stage === "APPEARANCE" ? <Shield /> : null}{stage === "CLASS" ? `Imprint ${operatorByClass(classId).name}` : stage === "SUBCLASS" ? "Approach armor forge" : deploying ? "Saving character…" : "Save character & deploy"}<ChevronRight /></Button>
    </footer>}
    {stage === "ASSEMBLING" && <div className="absolute inset-x-0 bottom-12 z-20 text-center"><p className="animate-pulse font-mono text-xs uppercase tracking-[0.35em] text-primary" style={{ textShadow: "0 0 12px color-mix(in oklch, var(--primary) 60%, transparent)" }}>Armor lattice assembling</p><div className="mx-auto mt-3 h-px w-64 overflow-hidden bg-muted"><div className="h-full w-full origin-left animate-[forge-progress_2.1s_ease-in-out] bg-primary" style={{ boxShadow: "0 0 8px var(--primary)" }} /></div></div>}
  </div>;
}