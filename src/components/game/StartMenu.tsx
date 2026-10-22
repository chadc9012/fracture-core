import { ChevronLeft, ChevronRight, Circle, Settings, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMenuInput } from "./useMenuInput";
import { moveFocus } from "@/game/menu-nav";
import { Button } from "@/components/ui/button";
import { CLASSES, DEFAULT_SUBCLASS, SUBCLASSES, operatorByClass, type AppearanceDefinition, type ClassId, type OperatorId, type SubclassId } from "@/game/loadout";
import { BODY_PROFILES, BODY_TYPES, type BodyType } from "@/game/operators";
import { createDeployGuard, deployCharacter, newDeploymentId, type PlayerCharacter } from "@/game/deployment/deployCharacter";
import { armorLook } from "@/game/armor-look";
import { defaultAppearance, forgeDirty, forgeInitial } from "@/game/deployment/forgeState";
import type { PlayerProgression } from "@/game/progression";
import { ConfirmDialog } from "./ConfirmDialog";
import { IdentityForge } from "./IdentityForge";
import { CornerBrackets } from "./HudChrome";
import { useVoiceLine } from "./useVoiceLine";
import { ABILITY_NODES } from "@/game/ability-network";
import { initialOperatorSelection, rememberedOperator, rememberOperator, selectionKey } from "@/game/deployment/operatorSelection";

export type { ClassId } from "@/game/loadout";
type Stage = "CLASS" | "SUBCLASS" | "APPEARANCE" | "ASSEMBLING";
/** `appearance` is the fully-resolved, possibly-customized identity — a signature preset by
 * default. Saved colors and callsign are retained when reopening this screen. */
export type Deployment = { classId: ClassId; subclassId: SubclassId; appearance: AppearanceDefinition; bodyType: BodyType; deploymentId: string; operatorId: OperatorId };
const STAGES: Stage[] = ["CLASS", "SUBCLASS", "APPEARANCE"];
/** Default field colors + callsign for a freshly-picked class: that class's one named Operator's
 * signature preset, with their callsign pre-filled. Subclass
 * doesn't factor in here — all 3 of an Operator's subclasses are the same character. */
const APPEARANCE_FOR = defaultAppearance;

const GUIDE: Record<Stage, string> = {
  CLASS: "Select your operative: GOLIATH, NYX or CIPHER.",
  SUBCLASS: "Now define how that identity controls the battlefield.",
  APPEARANCE: "Choose your body profile.",
  ASSEMBLING: "Identity stabilized. Armor assembly in progress.",
};

export function StartMenu({ onDeploy, onSaveCharacter, weaponOrder, onSettings, onExit, saved, gear, paused }: { saved?: PlayerCharacter | null; gear?: Pick<PlayerProgression, "inventory" | "equippedGear">; paused?: boolean; onExit?: () => void; onDeploy: (deployment: Deployment) => void; onSaveCharacter?: (character: PlayerCharacter, equippedGear?: PlayerProgression["equippedGear"]) => Promise<void>; weaponOrder?: readonly string[]; onSettings: () => void; best: { credits: number; kills: number } | null }) {
  // reopening character creation restores the saved operator; `start` is what "unsaved edits" are measured against
  const startRef = useRef(forgeInitial(saved));
  const start = startRef.current;
  const [classId, setClassId] = useState<ClassId>(start.classId);
  const [subclassId, setSubclassId] = useState<SubclassId>(start.subclassId);
  const [appearance, setAppearance] = useState<AppearanceDefinition>(start.appearance);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [stage, setStage] = useState<Stage>("CLASS");
  const [bodyType, setBodyType] = useState<BodyType>(start.bodyType);
  const [deployError, setDeployError] = useState("");
  const [deploying, setDeploying] = useState(false);
  const guard = useRef(createDeployGuard()).current;
  // Keep the equipped armor visible without editing or overwriting it during onboarding.
  const [worn] = useState(() => ({ inventory: gear?.inventory ?? [], equippedGear: gear?.equippedGear ?? {} }));
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
  const preferenceKey = () => selectionKey(new URLSearchParams(window.location.search).get("profile") === "test");
  useEffect(() => {
    if (saved) return;
    try {
      const restored = initialOperatorSelection(saved, rememberedOperator(window.localStorage, preferenceKey()));
      startRef.current = restored;
      setClassId(restored.classId);
      setSubclassId(restored.subclassId);
      setAppearance(restored.appearance);
      setBodyType(restored.bodyType);
    } catch { /* Keep the default if browser storage is unavailable. */ }
  }, [saved]);
  useEffect(() => {
    if (classId === startRef.current.classId) return;
    try { rememberOperator(window.localStorage, preferenceKey(), classId); } catch { /* Best effort. */ }
  }, [classId]);
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
          saveCharacter: async (c) => { await onSaveCharacter?.(c, gearDirty ? worn.equippedGear : undefined); try { rememberOperator(window.localStorage, preferenceKey(), null); } catch { /* Saved identity remains authoritative. */ } setStage("ASSEMBLING"); },
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
  const pad = useMenuInput(stage !== "ASSEMBLING" && !deploying && !paused && !confirmLeave, (intent, source) => {
    if (intent === "back") { if (stageIndex > 0) back(); else leave(); return; }
    // Keyboard keeps its existing shortcuts; pad selection updates the same live preview state.
    if (source !== "pad") return;
    if (intent === "confirm") { next(); return; }
    const dir = intent === "down" ? 1 : -1;
    if (stage === "CLASS") {
      const item = CLASSES[moveFocus(CLASSES.findIndex((c) => c.id === classId), dir, CLASSES.map(() => true))];
      if (item) selectClass(item.id);
    } else if (stage === "SUBCLASS") {
      const item = subclasses[moveFocus(subclasses.findIndex((s) => s.id === subclassId), dir, subclasses.map(() => true))];
      if (item) applySubclass(item.id);
    } else if (stage === "APPEARANCE") {
      const type = BODY_TYPES[moveFocus(BODY_TYPES.indexOf(bodyType), dir, BODY_TYPES.map(() => true))];
      if (type) { setBodyType(type); }
    }
  });
  const look = armorLook(worn);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (stage === "ASSEMBLING" || deploying || paused || confirmLeave) return;
      if (stage === "CLASS" && ["Digit1", "Digit2", "Digit3"].includes(event.code)) selectClass(CLASSES[Number(event.code.at(-1)) - 1]?.id ?? "TITAN");
      if (event.code === "Enter" && !event.repeat) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return <div className="fixed inset-0 z-50 overflow-hidden bg-background">
    <div className="absolute inset-0" role="img" aria-label={`${operator.name} ${bodyType} preview`}><IdentityForge gear={worn} look={look} classId={classId} appearance={appearance} bodyType={bodyType} mode={stage} onSelectClass={selectClass} /></div>
    <div className="pointer-events-none absolute inset-0 forge-veil" />

    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-7">
      <div><p className="hud-label">Identity Forge // Chamber 01</p><h1 className="mt-1 font-mono text-xl font-bold tracking-normal sm:text-3xl" style={{ textShadow: "0 0 20px color-mix(in oklch, var(--primary) 35%, transparent)" }}>WORLD FRACTURE</h1></div>
      <Button className="hud-panel pointer-events-auto border-0" variant="ghost" size="icon" onClick={onSettings} aria-label="Open settings"><Settings /></Button>
    </header>

    <div className="pointer-events-none absolute inset-x-0 top-20 z-10 text-center ui-enter">
      <div className="flex items-center justify-center gap-3">{STAGES.map((item, index) => <span key={item} className={`flex items-center gap-3 ${stageIndex >= index ? "text-primary" : "text-muted-foreground/40"}`}><Circle className={`size-2 ${stage === item ? "fill-current" : ""}`} />{index < STAGES.length - 1 && <i className="h-px w-8 bg-current" />}</span>)}</div>
      <p className="mt-3 hud-label">NOVA // {stage === "ASSEMBLING" ? "FINALIZATION" : `PHASE 0${Math.max(1, stageIndex + 1)}`}</p>
      <p className="mt-2 text-sm text-foreground/80">{GUIDE[stage]}</p>
    </div>

    {stage === "CLASS" && <>
      <div aria-label="Operator selection" className="pointer-events-auto absolute inset-x-0 bottom-24 top-40 z-10 flex flex-col justify-end px-4 sm:px-[8vw]">
      <div className="grid max-h-full grid-cols-1 items-stretch gap-2 overflow-y-auto sm:grid-cols-3 sm:gap-4">
        {CLASSES.map((item, index) => {
          const op = operatorByClass(item.id);
          const active = classId === item.id;
          const stats = [["Health", op.baseStats.health], ["Armor", op.baseStats.armor], ["Mobility", op.baseStats.mobility], ["Tech", op.baseStats.tech]] as const;
          const abilities = ABILITY_NODES.filter((node) => node.classId === item.id && node.cost < 999);
          return <Button variant="ghost" key={item.id} type="button" aria-label={`Select ${op.name}`} aria-pressed={active} onClick={() => selectClass(item.id)} className={`hud-panel pointer-events-auto min-w-0 items-stretch flex-col gap-0 h-auto rounded-none whitespace-normal relative px-3 pb-3 pt-4 text-center transition ${active ? "hud-glow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <CornerBrackets size={6} />
            <span className="block font-mono text-[9px] tracking-normal text-primary">0{index + 1} // {op.className.toUpperCase()} CLASS</span>
            <span className="mt-1 block font-mono text-lg font-bold tracking-normal sm:text-2xl">{op.name}</span>
            <span className="mt-1 text-xs leading-relaxed">{item.role}</span>
            <span className="mt-3 text-left font-mono text-[9px] uppercase text-primary">Base ratings</span>
            <span className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
              {stats.map(([label, value]) => <span key={label} className="flex justify-between gap-2 text-left font-mono text-[10px] uppercase tracking-normal">
                <span>{label}</span><b className="text-foreground">{value}</b>
              </span>)}
            </span>
            <span className="mt-3 grid gap-2 border-t border-primary/30 pt-3 text-left">
              {abilities.map((ability) => <span key={ability.slot} className="block text-xs leading-relaxed"><b className="block text-primary">{ability.name}</b><span className="block">{ability.description}</span><span className="block font-mono text-[9px] text-muted-foreground">{ability.cooldown}s cooldown · {ability.resource} energy</span></span>)}
            </span>
          </Button>;
        })}
      </div>
      </div>
    </>}

    {stage === "SUBCLASS" && <div className="pointer-events-auto absolute bottom-24 top-40 left-1/2 z-10 flex flex-col justify-end w-[min(62rem,calc(100%-2rem))] -translate-x-1/2">
      <div className="max-h-full overflow-y-auto">
      <div className="hud-panel relative mb-2 p-3">
        <CornerBrackets size={6} />
        <div className="flex items-baseline justify-between gap-3"><span className="font-mono text-xs uppercase tracking-normal text-foreground">{operator.name}</span><span className="font-mono text-[9px] uppercase text-primary">{operator.callsign}</span></div>
        <p className="mt-1 text-[10px] italic leading-relaxed text-muted-foreground">{operator.bio}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {subclasses.map((item) => (
          <Button key={item.id} variant="ghost" onClick={() => applySubclass(item.id)} className={`hud-panel relative h-auto min-h-24 justify-start px-4 py-3 text-left whitespace-normal ${subclassId === item.id ? "hud-glow text-foreground" : "text-muted-foreground"}`}>
            <CornerBrackets />
            <span>
              <span className="block font-mono text-xs uppercase tracking-normal">{item.name}</span>
              <span className="mt-1 block text-[10px] leading-relaxed">{item.description}</span>
              <span className="mt-2 block text-[9px] uppercase tracking-normal text-primary">Special ability</span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{item.specialAbility}</span>
            </span>
          </Button>
        ))}
      </div>
      </div>
    </div>}

    {stage === "APPEARANCE" && <section aria-label="Operator body selection" className="pointer-events-auto absolute bottom-24 left-1/2 top-40 z-10 flex w-[min(56rem,calc(100%-2rem))] -translate-x-1/2 flex-col justify-end sm:top-44">
      <div className="max-h-full overflow-y-auto border border-foreground/20 bg-card/90 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
        <p className="font-mono text-[10px] uppercase tracking-normal text-primary">Identity // Final calibration</p>
        <h2 className="mt-2 text-2xl font-semibold uppercase tracking-normal text-foreground sm:text-4xl">Choose your silhouette</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{operator.name} · {subclasses.find((item) => item.id === subclassId)?.name}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {BODY_TYPES.map((type) => <Button variant="ghost" key={type} type="button" onClick={() => setBodyType(type)} aria-pressed={bodyType === type} className={`flex-col items-start gap-0 h-auto rounded-none whitespace-normal min-h-24 min-w-0 border p-2 sm:p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${bodyType === type ? "border-primary bg-primary/15 text-foreground" : "border-foreground/20 bg-foreground/5 text-muted-foreground hover:border-foreground/60"}`}>
            <span className="block font-mono text-[10px] sm:text-xs font-bold uppercase tracking-normal">{BODY_PROFILES[type].label}</span>
            <span className="mt-2 block text-xs leading-relaxed opacity-80">{BODY_PROFILES[type].blurb}</span>
          </Button>)}
        </div>
      </div>
      {deployError && <p role="alert" className="mt-3 bg-destructive/20 p-2 text-center text-sm text-destructive">{deployError}</p>}
    </section>}

    {confirmLeave && <ConfirmDialog pad={pad} title="Discard changes?" body="You changed your operator but haven't saved. Leaving now discards those edits; your saved character is untouched." confirmLabel="Discard & leave" cancelLabel="Keep editing" onCancel={() => setConfirmLeave(false)} onConfirm={() => { try { rememberOperator(window.localStorage, preferenceKey(), null); } catch { /* Best effort. */ } setConfirmLeave(false); onExit?.(); }} />}

    {stage !== "ASSEMBLING" && <footer className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-2">
      {stageIndex > 0 && <Button className="hud-panel pointer-events-auto border-0" variant="outline" onClick={back} disabled={deploying}><ChevronLeft />Back</Button>}
      {stageIndex === 0 && onExit && <Button className="hud-panel pointer-events-auto border-0" variant="outline" onClick={leave}><ChevronLeft />Main menu</Button>}
      <Button className="hud-glow pointer-events-auto min-w-44" onClick={next} disabled={deploying}>{stage === "APPEARANCE" ? <Shield /> : null}{stage === "CLASS" ? `Imprint ${operatorByClass(classId).name}` : stage === "SUBCLASS" ? "Choose body profile" : deploying ? "Saving character…" : "Save character & deploy"}<ChevronRight /></Button>
    </footer>}
    {stage === "ASSEMBLING" && <div className="absolute inset-x-0 bottom-12 z-20 text-center"><p className="animate-pulse font-mono text-xs uppercase tracking-normal text-primary" style={{ textShadow: "0 0 12px color-mix(in oklch, var(--primary) 60%, transparent)" }}>Armor lattice assembling</p><div className="mx-auto mt-3 h-px w-64 overflow-hidden bg-muted"><div className="h-full w-full origin-left animate-[forge-progress_2.1s_ease-in-out] bg-primary" style={{ boxShadow: "0 0 8px var(--primary)" }} /></div></div>}
  </div>;
}