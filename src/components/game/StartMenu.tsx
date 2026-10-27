import { Check, ChevronLeft, ChevronRight, Circle, Settings, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMenuInput } from "./useMenuInput";
import { moveFocus } from "@/game/menu-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLASSES, DEFAULT_SUBCLASS, SUBCLASSES, operatorByClass, type AppearanceDefinition, type ClassId, type OperatorId, type SubclassId } from "@/game/loadout";
import { BODY_PROFILES, BODY_TYPES, FACES, OPERATOR_START_BODY, type BodyType } from "@/game/operators";
import { DEFAULT_FACE, ROBOT_OPTICS, ROBOT_PLATING, SKIN_TONES, faceDef, faceFor, swatchOr, toneKind, type Swatch } from "@/game/operator-faces";
import { createDeployGuard, deployCharacter, newDeploymentId, type PlayerCharacter } from "@/game/deployment/deployCharacter";
import { armorLook } from "@/game/armor-look";
import { defaultAppearance, forgeDirty, forgeInitial } from "@/game/deployment/forgeState";
import type { PlayerProgression } from "@/game/progression";
import { ConfirmDialog } from "./ConfirmDialog";
import { CLASS_LABEL, IdentityForge, type ForgeFocus } from "./IdentityForge";
import { CornerBrackets } from "./HudChrome";
import { useVoiceLine } from "./useVoiceLine";

const WARM_MODELS = ["/models/foliage/conifer.glb", "/models/foliage/broadleaf.glb"];

export type { ClassId } from "@/game/loadout";
type Stage = "CLASS" | "SUBCLASS" | "APPEARANCE" | "ASSEMBLING";
/** `appearance` is the fully-resolved, possibly-customized identity — a signature preset by
 * default, or edited colors/callsign from the forge's customize panel. Session-local only, same
 * as the rest of deployment (never synced to player_saves). */
export type Deployment = { classId: ClassId; subclassId: SubclassId; appearance: AppearanceDefinition; bodyType: BodyType; deploymentId: string; operatorId: OperatorId };
const STAGES: Stage[] = ["CLASS", "SUBCLASS", "APPEARANCE"];

/** Default field colors + callsign for a freshly-picked class: that class's one named Operator's
 * signature preset, with their callsign pre-filled (the player can still edit both). Subclass
 * doesn't factor in here — all 3 of an Operator's subclasses are the same character. */
const APPEARANCE_FOR = defaultAppearance;

/** Destiny-style appearance menu (owner's reference screens): a list of steps on the left, the operator close up in the
 * middle, the options for the step as a grid of portraits or colour swatches on the right. Armour is not edited here. */
type Tab = "body" | "face" | "tone" | "optics" | "callsign" | "finish";
const tabsFor = (body: BodyType): { key: Tab; label: string }[] => [
  { key: "body", label: "Body" }, { key: "face", label: "Face" },
  { key: "tone", label: body === "robot" ? "Plating" : "Skin tone" },
  ...(body === "robot" ? [{ key: "optics" as const, label: "Optics" }] : []),
  { key: "callsign", label: "Callsign" }, { key: "finish", label: "Finish" },
];
const FOCUS: Record<Tab, ForgeFocus> = { body: "body", face: "face", tone: "face", optics: "face", callsign: "body", finish: "body" };

const GUIDE: Record<Stage, string> = {
  CLASS: "Select your operative: GOLIATH, NYX or CIPHER.",
  SUBCLASS: "Now define how that identity controls the battlefield.",
  APPEARANCE: "Customize your appearance: body, face and colouring.",
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
  const [bodyType, setBodyTypeRaw] = useState<BodyType>(start.bodyType);
  const [face, setFace] = useState<string>(start.face);
  const [skin, setSkin] = useState<string>(start.skin);
  const [eyes, setEyes] = useState<string>(start.eyes);
  // a face belongs to a body type: switching body keeps the face only when it exists there, else the class's face for that body;
  // the colour swatch list changes between skin tones and robot plating
  const setBodyType = (type: BodyType) => { setBodyTypeRaw(type); setFace((current) => faceFor(classId, type, current)); setSkin((current) => swatchOr(toneKind(type), current)); };
  const [deployError, setDeployError] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [tab, setTab] = useState<Tab>("body");
  const guard = useRef(createDeployGuard()).current;
  // worn armor is shown as worn (it picks the rookie / veteran / elite body); it is changed in the character screen, not here
  const worn = { inventory: gear?.inventory ?? [], equippedGear: gear?.equippedGear ?? {} };
  const operator = operatorByClass(classId);
  const subclasses = SUBCLASSES.filter((item) => item.classId === classId);
  const stageIndex = STAGES.indexOf(stage);
  useVoiceLine(`forge-${stage}`, "NOVA", GUIDE[stage], "story");

  // Subclass is a respec of the same Operator, so it never touches appearance; only switching
  // Operator (class) resets colors/callsign back to that Operator's signature.
  const applySubclass = (id: SubclassId) => { setSubclassId(id); };
  const selectClass = (id: ClassId) => {
    const body = OPERATOR_START_BODY[operatorByClass(id).id];
    setClassId(id); applySubclass(DEFAULT_SUBCLASS[id]); setAppearance(APPEARANCE_FOR(id));
    setBodyTypeRaw(body); setFace(DEFAULT_FACE[id][body]); setSkin((current) => swatchOr(toneKind(body), current));
  };
  const confirmIdentity = async () => {
    const deploymentId = newDeploymentId();
    const character: PlayerCharacter = {
      deploymentId, operatorId: operator.id, classId, subclassId, bodyType, face, skin, eyes, displayName: appearance.callsign,
      appearance: { armor: appearance.armor, cloth: appearance.cloth, visor: appearance.visor, trim: appearance.trim, callsign: appearance.callsign },
      loadout: { weaponOrder: weaponOrder ?? [] },
    };
    setDeployError("");
    setDeploying(true);
    const ran = await guard.run(async () => {
      try {
        await deployCharacter(character, {
          saveCharacter: async (c) => { await onSaveCharacter?.(c); setStage("ASSEMBLING"); },
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
  const tabs = tabsFor(bodyType);
  const tabIndex = Math.max(0, tabs.findIndex((t) => t.key === tab));
  const next = () => {
    // through the appearance steps one at a time (Destiny's flow), then save from Finish
    if (stage === "APPEARANCE" && tab !== "finish") { setTab(tabs[tabIndex + 1]?.key ?? "finish"); return; }
    if (stage === "APPEARANCE") { void confirmIdentity(); return; }
    const nextStage = STAGES[stageIndex + 1];
    if (nextStage) setStage(nextStage);
  };
  const back = () => {
    if (stage === "APPEARANCE" && tabIndex > 0) { setTab(tabs[tabIndex - 1]!.key); return; }
    const previous = STAGES[stageIndex - 1]; if (previous) setStage(previous);
  };

  // Esc / Backspace / controller B-Circle: previous step, or out to the main menu from the first step (never mid-save)
  const dirty = forgeDirty(start, { classId, subclassId, appearance, bodyType, face, skin, eyes });
  const leave = () => { if (dirty) setConfirmLeave(true); else onExit?.(); };
  useMenuInput(stage !== "ASSEMBLING" && !deploying && !paused && !confirmLeave, (intent, source) => {
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
      // up/down walks the current step's options
      const cycle = <T,>(list: readonly T[], i: number, set: (v: T) => void) => { const v = list[moveFocus(Math.max(0, i), dir, list.map(() => true))]; if (v !== undefined) set(v); };
      if (tab === "body") cycle(BODY_TYPES, BODY_TYPES.indexOf(bodyType), setBodyType);
      else if (tab === "face") cycle(FACES[bodyType].map((f) => f.id), FACES[bodyType].findIndex((f) => f.id === face), setFace);
      else if (tab === "tone") { const l = bodyType === "robot" ? ROBOT_PLATING : SKIN_TONES; cycle(l.map((x) => x.id), l.findIndex((x) => x.id === skin), setSkin); }
      else if (tab === "optics") cycle(ROBOT_OPTICS.map((x) => x.id), ROBOT_OPTICS.findIndex((x) => x.id === eyes), setEyes);
    }
  });
  const look = armorLook(worn, classId);
  const focus: ForgeFocus = stage === "APPEARANCE" ? FOCUS[tab] : "body";

  // warm the HTTP cache with the two tree models while the player is still in the menu: in the world they queue behind
  // several MB of NPC/enemy models, and the stand-in cone forest showed for a minute after deploy
  useEffect(() => {
    const t = window.setTimeout(() => { for (const href of WARM_MODELS) { if (document.querySelector(`link[data-warm="${href}"]`)) continue; const l = document.createElement("link"); l.rel = "prefetch"; l.as = "fetch"; l.href = href; l.dataset["warm"] = href; document.head.appendChild(l); } }, 1500);
    return () => window.clearTimeout(t);
  }, []);

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
    <div className="absolute inset-0" role="img" aria-label={`${operator.name} ${bodyType} preview`}><IdentityForge gear={worn} look={look} classId={classId} appearance={appearance} bodyType={bodyType} face={{ face, skin, eyes }} focus={focus} mode={stage} onSelectClass={selectClass} /></div>
    <div className="pointer-events-none absolute inset-0 forge-veil" />

    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-7">
      <div><p className="hud-label">Identity Forge // Chamber 01</p><h1 className="mt-1 font-mono text-xl font-bold tracking-[0.16em] sm:text-3xl" style={{ textShadow: "0 0 20px color-mix(in oklch, var(--primary) 35%, transparent)" }}>WORLD FRACTURE</h1></div>
      <Button className="hud-panel pointer-events-auto border-0" variant="ghost" size="icon" onClick={onSettings} aria-label="Open settings"><Settings /></Button>
    </header>

    {stage !== "APPEARANCE" && <div className="pointer-events-none absolute inset-x-0 top-20 z-10 text-center ui-enter">
      <div className="flex items-center justify-center gap-3">{STAGES.map((item, index) => <span key={item} className={`flex items-center gap-3 ${stageIndex >= index ? "text-primary" : "text-muted-foreground/40"}`}><Circle className={`size-2 ${stage === item ? "fill-current" : ""}`} />{index < STAGES.length - 1 && <i className="h-px w-8 bg-current" />}</span>)}</div>
      <p className="mt-3 hud-label">NOVA // {stage === "ASSEMBLING" ? "FINALIZATION" : `PHASE 0${Math.max(1, stageIndex + 1)}`}</p>
      <p className="mt-2 text-sm text-foreground/80">{GUIDE[stage]}</p>
    </div>}

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

    {stage === "APPEARANCE" && <AppearanceMenu
      operatorName={operator.name} className={operator.className} subclassName={subclasses.find((item) => item.id === subclassId)?.name ?? ""} bio={operator.bio}
      classId={classId} tabs={tabs} tab={tab} setTab={setTab} bodyType={bodyType} setBodyType={setBodyType} face={face} setFace={setFace}
      skin={skin} setSkin={setSkin} eyes={eyes} setEyes={setEyes} callsign={appearance.callsign}
      setCallsign={(v) => setAppearance((current) => ({ ...current, callsign: v.toUpperCase() }))} error={deployError} />}

    {confirmLeave && <ConfirmDialog pad={null} title="Discard changes?" body="You changed your operator but haven't saved. Leaving now discards those edits; your saved character is untouched." confirmLabel="Discard & leave" cancelLabel="Keep editing" onCancel={() => setConfirmLeave(false)} onConfirm={() => { setConfirmLeave(false); onExit?.(); }} />}

    {stage !== "ASSEMBLING" && <footer className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-2">
      {stageIndex > 0 && <Button className="hud-panel pointer-events-auto border-0" variant="outline" onClick={back} disabled={deploying}><ChevronLeft />Back</Button>}
      {stageIndex === 0 && onExit && <Button className="hud-panel pointer-events-auto border-0" variant="outline" onClick={leave}><ChevronLeft />Main menu</Button>}
      <Button className="hud-glow pointer-events-auto min-w-44" onClick={next} disabled={deploying}>{stage === "APPEARANCE" && tab === "finish" ? <Shield /> : null}{stage === "CLASS" ? `Imprint ${operatorByClass(classId).name}` : stage === "SUBCLASS" ? "Customize appearance" : tab !== "finish" ? `Next: ${tabs[tabIndex + 1]?.label ?? "Finish"}` : deploying ? "Saving character…" : "Save character & deploy"}<ChevronRight /></Button>
    </footer>}
    {stage === "ASSEMBLING" && <div className="absolute inset-x-0 bottom-12 z-20 text-center"><p className="animate-pulse font-mono text-xs uppercase tracking-[0.35em] text-primary" style={{ textShadow: "0 0 12px color-mix(in oklch, var(--primary) 60%, transparent)" }}>Identity imprinting</p><div className="mx-auto mt-3 h-px w-64 overflow-hidden bg-muted"><div className="h-full w-full origin-left animate-[forge-progress_2.1s_ease-in-out] bg-primary" style={{ boxShadow: "0 0 8px var(--primary)" }} /></div></div>}
  </div>;
}
/** The appearance step, after Destiny's character creation: steps listed down the left, the chosen step's options as a grid on
 * the right (face portraits, body types, colour swatches), the operator framed between them by IdentityForge's camera. */
function AppearanceMenu(p: {
  operatorName: string; className: string; subclassName: string; bio: string; classId: ClassId;
  tabs: { key: Tab; label: string }[]; tab: Tab; setTab: (t: Tab) => void;
  bodyType: BodyType; setBodyType: (b: BodyType) => void; face: string; setFace: (f: string) => void;
  skin: string; setSkin: (s: string) => void; eyes: string; setEyes: (s: string) => void;
  callsign: string; setCallsign: (v: string) => void; error: string;
}) {
  const at = p.tabs.findIndex((t) => t.key === p.tab);
  const robot = p.bodyType === "robot";
  const chosenFace = faceDef(p.bodyType, p.face);
  const tones = robot ? ROBOT_PLATING : SKIN_TONES;
  const tile = (on: boolean) => `relative block overflow-hidden border-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${on ? "border-white ring-2 ring-white/70 ring-offset-2 ring-offset-black shadow-[0_0_14px_rgba(255,255,255,0.35)]" : "border-white/10 hover:border-white/50"}`;
  const swatches = (list: readonly Swatch[], value: string, set: (id: string) => void, label: string) => <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2">
    {list.map((s) => <button key={s.id} type="button" role="radio" aria-checked={value === s.id} aria-label={s.label} title={s.label} onClick={() => set(s.id)} className={`${tile(value === s.id)} aspect-square`}
      style={{ background: s.hex || "linear-gradient(135deg, #e2b79c 0 50%, #43271a 50% 100%)" }}>
      {!s.hex && <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center font-mono text-[8px] uppercase tracking-[0.1em] text-white">Auto</span>}
    </button>)}
  </div>;
  const selectedName = p.tab === "body" ? BODY_PROFILES[p.bodyType].label : p.tab === "face" ? chosenFace.label
    : p.tab === "tone" ? tones.find((t) => t.id === p.skin)?.label : p.tab === "optics" ? ROBOT_OPTICS.find((t) => t.id === p.eyes)?.label : null;
  const selectedBlurb = p.tab === "body" ? BODY_PROFILES[p.bodyType].blurb : p.tab === "face" ? chosenFace.blurb : null;
  return <>
    {/* steps */}
    <nav aria-label="Appearance steps" className="pointer-events-auto absolute inset-x-3 top-16 z-10 sm:inset-x-auto sm:left-[3.5vw] sm:top-24 sm:w-60 ui-enter">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/55">Customize your appearance</p>
      <h2 className="mt-1 font-mono text-2xl font-bold uppercase tracking-[0.18em] text-white">{p.operatorName}</h2>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">{p.className} · {p.subclassName}</p>
      <ol className="mt-4 flex gap-1 overflow-x-auto sm:block sm:space-y-0.5 sm:overflow-visible">
        {p.tabs.map((t, i) => <li key={t.key} className="shrink-0">
          <button type="button" onClick={() => p.setTab(t.key)} aria-current={p.tab === t.key ? "step" : undefined}
            className={`group flex w-full items-center gap-3 border-l-2 px-3 py-2 text-left font-mono text-xs uppercase tracking-[0.2em] transition ${p.tab === t.key ? "border-white bg-white/10 text-white" : "border-white/10 text-white/45 hover:border-white/40 hover:text-white/80"}`}>
            <span className="w-4 text-[9px] text-white/40">{i < at ? <Check className="size-3 text-white/70" /> : `0${i + 1}`}</span>{t.label}
          </button>
        </li>)}
      </ol>
    </nav>

    {/* options */}
    <section aria-label={p.tabs[at]?.label} className="pointer-events-auto absolute inset-x-3 bottom-20 z-10 max-h-[46vh] overflow-y-auto border border-white/10 bg-black/55 p-4 backdrop-blur-md sm:inset-x-auto sm:bottom-auto sm:right-[3.5vw] sm:top-24 sm:max-h-[calc(100vh-11rem)] sm:w-[min(27rem,40vw)]">
      <header className="flex items-baseline justify-between border-b border-white/15 pb-2">
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.28em] text-white">{p.tabs[at]?.label}</h3>
        {selectedName && <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">{selectedName}</span>}
      </header>
      <div className="mt-3">
        {p.tab === "body" && <div role="radiogroup" aria-label="Body type" className="grid grid-cols-3 gap-2">
          {BODY_TYPES.map((b) => { const f = faceDef(b, DEFAULT_FACE[p.classId][b]); return <button key={b} type="button" role="radio" aria-checked={p.bodyType === b} onClick={() => p.setBodyType(b)} className={tile(p.bodyType === b)}>
            <img src={f.thumb} alt="" className="aspect-square w-full object-cover" />
            <span className="block bg-black/70 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white">{BODY_PROFILES[b].label}</span>
          </button>; })}
        </div>}
        {p.tab === "face" && <div role="radiogroup" aria-label="Face" className="grid grid-cols-3 gap-2">
          {FACES[p.bodyType].map((f) => <button key={f.id} type="button" role="radio" aria-checked={p.face === f.id} aria-label={f.label} onClick={() => p.setFace(f.id)} className={tile(p.face === f.id)}>
            <img src={f.thumb} alt="" className="aspect-square w-full object-cover" />
          </button>)}
        </div>}
        {p.tab === "tone" && swatches(tones, p.skin, p.setSkin, robot ? "Plating colour" : "Skin tone")}
        {p.tab === "optics" && swatches(ROBOT_OPTICS, p.eyes, p.setEyes, "Optics colour")}
        {p.tab === "callsign" && <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">Callsign</span>
          <Input value={p.callsign} maxLength={24} onChange={(event) => p.setCallsign(event.target.value)} className="mt-1 h-10 rounded-none border-white/25 bg-black/40 font-mono text-sm uppercase tracking-[0.16em] text-white" />
          <p className="mt-3 text-[11px] italic leading-relaxed text-white/55">{p.bio}</p>
        </label>}
        {p.tab === "finish" && <dl className="grid grid-cols-[6rem_1fr] gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em]">
          <dt className="text-white/50">Body</dt><dd className="text-white">{BODY_PROFILES[p.bodyType].label}</dd>
          <dt className="text-white/50">Face</dt><dd className="text-white">{chosenFace.label}</dd>
          <dt className="text-white/50">{robot ? "Plating" : "Skin tone"}</dt><dd className="text-white">{tones.find((t) => t.id === p.skin)?.label}</dd>
          {robot && <><dt className="text-white/50">Optics</dt><dd className="text-white">{ROBOT_OPTICS.find((t) => t.id === p.eyes)?.label}</dd></>}
          <dt className="text-white/50">Callsign</dt><dd className="truncate text-white">{p.callsign}</dd>
          <dd className="col-span-2 mt-2 text-[10px] normal-case tracking-normal text-white/50">Armour is worn as earned. Recolour gear with shaders found or bought in the world; veteran and elite armour wear their own helmets.</dd>
        </dl>}
        {selectedBlurb && <p className="mt-3 text-[11px] leading-relaxed text-white/60">{selectedBlurb}</p>}
      </div>
      {p.error && <p role="alert" className="mt-3 font-mono text-xs text-destructive">{p.error}</p>}
    </section>
  </>;
}
