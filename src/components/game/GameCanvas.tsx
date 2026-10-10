import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Bloom, BrightnessContrast, ChromaticAberration, DepthOfField, EffectComposer, HueSaturation, Noise, SSAO, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Suspense, useEffect, useRef, useState } from "react";

import { appearanceById, classById, subclassById, type AppearanceDefinition, type ClassId, type SubclassId } from "@/game/loadout";
import { REGIONS } from "@/game/world";
import { walkHeight } from "@/game/terrain";
import type { VehicleId } from "@/game/vehicles";
import { STARTER_VEHICLES, VEHICLES, vehicleAcquisition } from "@/game/vehicles";
import { Button } from "@/components/ui/button";
import { HUD } from "./HUD";
import { Scene, type HudState } from "./Scene";
import { WorldErrorBoundary } from "./WorldErrorBoundary";
import { GraphicsGuard } from "./GraphicsGuard";
import { StartMenu, type Deployment } from "./StartMenu";
import { perfFlags } from "@/game/perf-flags";
import { SettingsWindow, DEFAULT_SETTINGS, type GameSettings } from "./SettingsWindow";
import { BootSequence } from "./BootSequence";
import { MainMenu } from "./MainMenu";
import { bootSeen, evaluateSave, markBootSeen } from "@/game/startup";
import { DeploymentBriefing } from "./DeploymentBriefing";
import { RaidStrategyPanel } from "./RaidStrategyPanel";
import { EMPTY_RETICLE } from "@/game/crosshair";
import { EMPTY_STRATAGEM_HUD } from "@/game/stratagems";
import { OperationsHub } from "./OperationsHub";
import { ZoneAnalysisPanel } from "./ZoneAnalysisPanel";
import { CloudSavePanel } from "./CloudSavePanel";
import { StarMap } from "./StarMap";
import { ArsenalLoadouts } from "./ArsenalLoadouts";
import { SaveManager } from "./SaveManager";
import { activeLoadout, rewardMission, loadProgression, rewardVehicle, saveProgression, type PlayerProgression } from "@/game/progression";
import { RENDER_PRESETS, defaultTierForGpu, detectGpuRenderer } from "@/game/performance";
import { classBuild } from "@/game/live-build";
import { persistCharacter } from "@/game/deployment/saveCharacter";
import { bodyTypeOr, type BodyType } from "@/game/operators";
import { nodeById } from "@/game/ability-network";
import { questEventsFromHud, NEW_QUEST_SIGNALS } from "@/game/quest-signals";
import { brokenSignalReady, hasVehicle } from "@/game/mission-gates";
import { advanceTutorial, FIRST_TUTORIAL, type TutorialEvent, type TutorialState } from "@/game/onboarding";
import { OnboardingSignal } from "./OnboardingSignal";
import { IntroCinematic } from "./IntroCinematic";
import { introTotalSeconds } from "@/game/intro";
import { VictoryReport } from "./VictoryReport";
import { claimDrops } from "@/game/inventory";
import { InventoryWindow } from "./InventoryWindow";
import { WorldAtlas } from "./WorldAtlas";
import { BrokenSignalOverlay } from "./BrokenSignalOverlay";
import { AwakeningOverlay } from "./AwakeningOverlay";
import { armorLook } from "@/game/armor-look";
import { applyMissionCompletion, restoreMission, withMissionRun } from "@/game/missions/persistence";
import { advanceAwakening, AWAKENING, type AwakeningEvent, type AwakeningRun } from "@/game/missions/awakening";
import { normalizeBindings } from "@/game/bindings";
import { advanceMission, BROKEN_SIGNAL, type MissionEvent, type MissionRun } from "@/game/missions/broken-signal";
import { advanceMission as advanceBlackout, BLACKOUT_PROTOCOL, type MissionEvent as BlackoutEvent, type MissionRun as BlackoutRun } from "@/game/missions/blackout-protocol";
import { BlackoutProtocolOverlay } from "./BlackoutProtocolOverlay";
import { advanceMission as advanceNeonCore, STITCHED_NEON_CORE, type MissionEvent as NeonCoreEvent, type MissionRun as NeonCoreRun } from "@/game/missions/stitched-neon-core";
import { StitchedNeonCoreOverlay } from "./StitchedNeonCoreOverlay";
import { advanceMission as advanceDescent, DESCENT_PROTOCOL, type MissionEvent as DescentEvent, type MissionRun as DescentRun } from "@/game/missions/descent-protocol";
import { DescentProtocolOverlay } from "./DescentProtocolOverlay";
import { advanceMission as advanceSystemCore, SYSTEM_CORE, type MissionEvent as SystemCoreEvent, type MissionRun as SystemCoreRun } from "@/game/missions/system-core";
import { SystemCoreOverlay } from "./SystemCoreOverlay";
import { gameTick, reconcileQuests, QUESTS } from "@/game/quests";
import { QuestTracker } from "./QuestTracker";
import { dialogueFor, revisitDialogueFor, type DialogueLine } from "@/game/dialogue";
import { DialogueOverlay } from "./DialogueOverlay";
import { EndingOverlay, endingTierFor } from "./EndingOverlay";
import { DeathOverlay } from "./DeathOverlay";
import { playEnding, playLevelUp, playNovaUnlock } from "@/game/audio";
import { Minimap } from "./Minimap";
import { grantXP } from "@/game/xp";
import type { WorldSim } from "@/game/sim";
import { LevelUpOverlay } from "./LevelUpOverlay";
import { PerfOverlay, PerfSampler } from "./PerfOverlay";
import { ForestAssetStatus } from "./ForestAssetStatus";
import { VoiceSubtitle } from "./VoiceSubtitle";
import { MainMenuHub } from "./MainMenuHub";
import { configureVoice, speakVoice, stopVoice } from "@/game/voice-director";
import { recapDue, recapLine } from "@/game/retention";
import { localSavedAt } from "@/game/cloud-save";

const CA_OFFSET = new THREE.Vector2(0.0006, 0.0006);
const START = REGIONS.find((r) => r.id === "nexus")!;

const initial: HudState = {
  region: START.name,
  regionId: START.id,
  sub: START.sub,
  kind: START.kind,
  difficulty: START.difficulty,
  rules: START.rules,
  phase: "Day",
  clock: "06:43",
  speed: 0,
  mode: "foot",
  owner: "vanguard",
  challenger: "syndicate",
  progress: 0,
  contested: false,
  instability: 0,
  gravity: 26,
  hp: 100,
  credits: 0,
  cargo: 0,
  kills: 0,
  elevation: 0,
  traction: 1,
  alerts: [],
  threat: 20,
  heat: 0,
  coreHp: 100,
  trend: "reading the world",
  missions: [],
  inspector: null,
  markers: [],
  px: 0,
  pz: 0,
  yaw: 0,
  structure: { standing: 0, total: 0, lastEvent: "" },
  diving: false,
  oxygen: 100,
  depth: 0,
  underwaterState: "SURFACE",
  heatLevel: 1,
  heatLabel: "MONITORED",
  heatResponse: "Patrol units aware of your position",
  vehicleStage: "NOMINAL",
  parkourChain: 0,
  nexusDetection: "GREEN",
  nexusLockdownTier: "MONITORING",
  nexusLockdownLabel: "MONITORING",
  nexusLockdownResponse: "Passive surveillance sweep",
  hacking: false,
  hackProgress: 0,
  insideInterior: null,
  interiorName: "",
  interiorOpen: true,
  zoneTier: "STABLE",
  justDied: 0,
  deathCause: "",
  deathCargoLost: 0,
  deaths: 0,
  bossHud: null,
  emergencyQuest: null,
  weaponHeat: 0,
  overheated: false,
  loot: [],
  view: "first",
  aimLocked: false,
  aiming: false,
  meleeTime: 0,
  weaponName: "Auto Rifle",
  weaponSlot: 1,
  ammo: [],
  reloading: 0,
  weaponWheel: false,
  weaponSwitched: 0,
  controller: false,
  bloom: 0,
  hitMarker: false,
  reticle: EMPTY_RETICLE,
  playerClass: "TITAN",
  subclassName: "Shield Titan",
  callsign: "BASTION-01",
  abilities: classById("TITAN").abilities.map((ability) => ({ slot: ability.slot, name: ability.name, ready: true })),
  firstMissionComplete: false,
  weather: "Rain mist",
  environment: "",
  hazardWarning: "",
  stratagem: EMPTY_STRATAGEM_HUD,
  streamTier: "ACTIVE · neighbors reduced · distant dormant",
  vehicleUnlocked: false,
  vehicleName: "No vehicle unlocked",
  vehicleDomain: "LAND",
  vehicleWeapon: "Ram bar + roof repeater",
  vehicleSeats: 2,
  shield: 100,
  energy: 0,
  stability: 55,
  blocking: false,
  domeTime: 0,
  titanFeedback: "",
  liveEnergy: 100,
  liveEffect: "",
  enemyResponse: "Scanning loadout",
  momentum: 0,
  ownership: REGIONS.map((r) => ({
    id: r.id,
    name: r.name,
    owner: r.id === "nexus" ? "vanguard" : r.kind === "fracture" || r.kind === "core" ? "overseer" : "syndicate",
  })),
};

/** The in-game setting or the OS-level preference, whichever asks for less motion. */
const prefersReduced = (setting?: boolean) => !!setting || (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

export function GameCanvas() {
  const [hud, setHud] = useState<HudState>(initial);
  const [phase, setPhase] = useState<"boot" | "title" | "hub" | "loadout" | "briefing" | "world">(() => (bootSeen() ? "title" : "boot"));
  const [pendingDeployment, setPendingDeployment] = useState<Deployment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [adaptiveDpr, setAdaptiveDpr] = useState(1.5);
  const [lowPerf, setLowPerf] = useState(false);
  useEffect(() => {
    try {
      const savedSettings = window.localStorage.getItem("world-fracture-settings");
      if (savedSettings) setSettings((current) => ({ ...current, ...(JSON.parse(savedSettings) as Partial<GameSettings>) }));
      else { const tier = defaultTierForGpu(detectGpuRenderer()); setSettings((current) => ({ ...current, renderTier: tier })); }
    } catch { /* keep safe defaults */ }
    const saved = window.localStorage.getItem("world-fracture-camera");
    if (saved === "third") setSettings((current) => ({ ...current, firstPersonDefault: false }));
    const vol = Number(window.localStorage.getItem("world-fracture-volume"));
    if (window.localStorage.getItem("world-fracture-volume") !== null && Number.isFinite(vol)) setSettings((current) => ({ ...current, volume: Math.min(1, Math.max(0, vol)) }));
    try { const m = window.localStorage.getItem("world-fracture-mix"); if (m) { const p = JSON.parse(m) as { music?: number; sfx?: number; voice?: number; spoken?: boolean }; const c = (n: unknown, fallback = 1) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback); setSettings((current) => ({ ...current, musicVolume: c(p.music), sfxVolume: c(p.sfx), voiceVolume: c(p.voice, 0.85), spokenDialogue: p.spoken ?? true })); } } catch { /* keep defaults */ }
    try { const b = window.localStorage.getItem("world-fracture-bindings"); if (b) setSettings((current) => ({ ...current, bindings: normalizeBindings(JSON.parse(b)) })); } catch { /* keep defaults */ }
  }, []);
  const updateSettings = (next: GameSettings) => {
    window.localStorage.setItem("world-fracture-settings", JSON.stringify(next));
    if (next.volume !== settings.volume && next.volume !== undefined) window.localStorage.setItem("world-fracture-volume", String(next.volume));
    if (next.musicVolume !== settings.musicVolume || next.sfxVolume !== settings.sfxVolume || next.voiceVolume !== settings.voiceVolume || next.spokenDialogue !== settings.spokenDialogue) window.localStorage.setItem("world-fracture-mix", JSON.stringify({ music: next.musicVolume ?? 1, sfx: next.sfxVolume ?? 1, voice: next.voiceVolume ?? 0.85, spoken: next.spokenDialogue ?? true }));
    if (next.firstPersonDefault !== settings.firstPersonDefault) window.localStorage.setItem("world-fracture-camera", next.firstPersonDefault ? "first" : "third");
    if (next.bindings !== settings.bindings) window.localStorage.setItem("world-fracture-bindings", JSON.stringify(next.bindings));
    setSettings(next);
  };
  useEffect(() => configureVoice({ enabled: settings.spokenDialogue ?? true, volume: (settings.volume ?? 0.7) * (settings.voiceVolume ?? 0.85) }), [settings.spokenDialogue, settings.voiceVolume, settings.volume]);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-game-motion", settings.reducedMotion ?? false);
    document.documentElement.classList.toggle("high-contrast-hud", settings.highContrastHud ?? false);
    return () => {
      document.documentElement.classList.remove("reduce-game-motion", "high-contrast-hud");
    };
  }, [settings.reducedMotion, settings.highContrastHud]);
  useEffect(() => { if (menuOpen) stopVoice(); }, [menuOpen]);
  const [cls, setCls] = useState<ClassId>("TITAN");
  const [subclass, setSubclass] = useState<SubclassId>("SHIELD_TITAN");
  const [appearance, setAppearance] = useState<AppearanceDefinition>(() => appearanceById("BASTION"));
  const [vehicleId, setVehicleId] = useState<VehicleId>("scrap-interceptor");
  const [garageOpen, setGarageOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [hubView, setHubView] = useState<"starmap" | "arsenal" | "saves" | null>(null);
  const [travelTo, setTravelTo] = useState<{ x: number; z: number; nonce: number } | null>(null);
  const [savedFlash, setSavedFlash] = useState(0);
  useEffect(() => { if (!savedFlash) return; const t = window.setTimeout(() => setSavedFlash(0), 1800); return () => window.clearTimeout(t); }, [savedFlash]);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [operationsView, setOperationsView] = useState<"DUNGEONS" | "ARSENAL" | "ABILITIES" | null>(null);
  const [last, setLast] = useState<{ credits: number; kills: number } | null>(null);
  const [progression, setProgression] = useState<PlayerProgression>(() => loadProgression());
  // the starter vehicle is saved progression, so Continue never re-asks for it
  const vehicleUnlocked = hasVehicle(progression);
  useEffect(() => { if (progression.selectedVehicle) setVehicleId(progression.selectedVehicle); }, [progression.selectedVehicle]);
  // repair/forward quest progress against what the save already proves (missions finished before their quest was active)
  useEffect(() => { setProgression((current) => { const next = reconcileQuests(current); return next === current ? current : next; }); }, [progression.completedMissions.length, progression.dungeonClears]);
  const [bodyType, setBodyType] = useState<BodyType>(() => bodyTypeOr(progression.character?.bodyType));
  const progressionRef = useRef(progression);
  progressionRef.current = progression;
  const [tutorial, setTutorial] = useState<TutorialState | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const lastPlayed = useRef<string | null>(null);
  const recapped = useRef(false);
  useEffect(() => { lastPlayed.current = localSavedAt(); }, []);
  useEffect(() => {
    if (phase !== "world" || recapped.current) return;
    recapped.current = true;
    const line = recapDue(lastPlayed.current, Date.now()) ? recapLine(progression) : null;
    if (line) speakVoice({ id: "return-recap", scope: "recap", speaker: "NOVA", text: line, priority: "story" });
  }, [phase, progression]);
  const [introElapsed, setIntroElapsed] = useState(0);

  useEffect(() => saveProgression(progression), [progression]);
  useEffect(() => { if (phase !== "world") return; const t = window.setTimeout(() => setSavedFlash(Date.now()), 1200); return () => window.clearTimeout(t); }, [progression, phase]);
  useEffect(() => {
    if (tutorial?.step === "VICTORY" && !progression.completedMissions.includes("mission-01")) setProgression((current) => ({ ...rewardMission(current, "mission-01", { dataShards: 1 }), tutorialComplete: true, unlockedAbilities: Array.from(new Set([...current.unlockedAbilities, classBuild(cls).slots.TACTICAL])), calibrationTokens: current.calibrationTokens + 1 }));
  }, [tutorial?.step, progression.completedMissions, cls]);

  /* Mission 01 · Broken Signal starts as a world event once the player is free-roaming. */
  const [mission, setMission] = useState<MissionRun | null>(() => restoreMission<MissionRun>("broken-signal", progression));
  useEffect(() => setProgression((p) => withMissionRun(p, "broken-signal", mission)), [mission]);
  const [awakening, setAwakening] = useState<AwakeningRun | null>(() => restoreMission<AwakeningRun>("awakening", progression));
  useEffect(() => setProgression((p) => withMissionRun(p, "awakening", awakening)), [awakening]);
  const awakeningDone = progression.completedMissions.includes("awakening");
  useEffect(() => {
    if (phase !== "world" || tutorial || awakening || awakeningDone) return;
    const timer = window.setTimeout(() => setAwakening(advanceAwakening(AWAKENING, { type: "START" })), 2500);
    return () => window.clearTimeout(timer);
  }, [phase, tutorial, awakening, awakeningDone]);
  useEffect(() => {
    if (awakening?.state === "LOOT") return; // loot granted on ACK
    if (awakening?.state !== "COMPLETE" || awakeningDone) return;
    setProgression((current) => { return applyMissionCompletion(current, "awakening"); });
    const timer = window.setTimeout(() => setAwakening(null), 7000);
    return () => window.clearTimeout(timer);
  }, [awakening?.state, awakeningDone]);
  const recordAwakening = (event: AwakeningEvent) => setAwakening((current) => {
    if (!current) return current;
    const next = advanceAwakening(current, event);
    if (current.state === "LOOT" && next.state === "CAPTURE") setProgression((p) => ({ ...p, materials: { ...p.materials, scrapMetal: (p.materials.scrapMetal ?? 0) + 4 } }));
    return next;
  });
  const missionReady = brokenSignalReady({ phase, tutorialActive: Boolean(tutorial), progression, missionRunning: false });
  useEffect(() => {
    if (!missionReady || mission) return;
    const timer = window.setTimeout(() => setMission(advanceMission(BROKEN_SIGNAL, { type: "START" })), 6000);
    return () => window.clearTimeout(timer);
  }, [missionReady, mission]);
  useEffect(() => {
    if (mission?.state !== "WORLD_UPDATE" || progression.completedMissions.includes("broken-signal")) return;
    setProgression((current) => { return applyMissionCompletion(current, "broken-signal"); });
    const timer = window.setTimeout(() => setMission(null), 9000);
    return () => window.clearTimeout(timer);
  }, [mission?.state, progression.completedMissions]);

  /* Mission 02 · Blackout Protocol — picks up once Broken Signal is behind you; NOVA's line
   * sends you into the real Neon City street, same ANCHOR/ARRIVED/CLEAR/HACK/ACK shape as
   * Mission 01 so Scene.tsx wires it the identical way. */
  const [blackout, setBlackout] = useState<BlackoutRun | null>(() => restoreMission<BlackoutRun>("blackout-protocol", progression));
  useEffect(() => setProgression((p) => withMissionRun(p, "blackout-protocol", blackout)), [blackout]);
  const blackoutReady = phase === "world" && !tutorial && progression.completedMissions.includes("broken-signal") && !progression.completedMissions.includes("blackout-protocol");
  useEffect(() => {
    if (!blackoutReady || blackout) return;
    const timer = window.setTimeout(() => setBlackout(advanceBlackout(BLACKOUT_PROTOCOL, { type: "START" })), 8000);
    return () => window.clearTimeout(timer);
  }, [blackoutReady, blackout]);
  const recordBlackout = (event: BlackoutEvent) => setBlackout((current) => current ? advanceBlackout(current, event) : current);
  useEffect(() => {
    if (blackout?.state !== "WORLD_UPDATE" || progression.completedMissions.includes("blackout-protocol")) return;
    setProgression((current) => { return applyMissionCompletion(current, "blackout-protocol"); });
    const timer = window.setTimeout(() => setBlackout(null), 9000);
    return () => window.clearTimeout(timer);
  }, [blackout?.state, progression.completedMissions]);

  /* Mission 03 · Stitched Neon Core — the dungeon Blackout Protocol's ending hooked but never
   * built a physical layer for; same ANCHOR/ARRIVED/CLEAR/HACK/ACK shape, ending in the game's
   * first scripted boss fight (Aegis-Prime, summoned through the normal summonBoss() path). */
  const [neonCore, setNeonCore] = useState<NeonCoreRun | null>(() => restoreMission<NeonCoreRun>("stitched-neon-core", progression));
  useEffect(() => setProgression((p) => withMissionRun(p, "stitched-neon-core", neonCore)), [neonCore]);
  const neonCoreReady = phase === "world" && !tutorial && progression.completedMissions.includes("blackout-protocol") && !progression.completedMissions.includes("stitched-neon-core");
  useEffect(() => {
    if (!neonCoreReady || neonCore) return;
    const timer = window.setTimeout(() => setNeonCore(advanceNeonCore(STITCHED_NEON_CORE, { type: "START" })), 8000);
    return () => window.clearTimeout(timer);
  }, [neonCoreReady, neonCore]);
  const recordNeonCore = (event: NeonCoreEvent) => setNeonCore((current) => current ? advanceNeonCore(current, event) : current);
  useEffect(() => {
    if (neonCore?.state !== "WORLD_UPDATE" || progression.completedMissions.includes("stitched-neon-core")) return;
    setProgression((current) => { return applyMissionCompletion(current, "stitched-neon-core"); });
    const timer = window.setTimeout(() => setNeonCore(null), 9000);
    return () => window.clearTimeout(timer);
  }, [neonCore?.state, progression.completedMissions]);

  /* Mission 04 · Descent Protocol — continues straight from Stitched Neon Core's ending; gives
   * fd-16's dive-to-Thalassia (previously just a bare survive-underwater timer) an actual
   * destination and story beat in the already-built sunken city. Same shape as Missions 01-03. */
  const [descent, setDescent] = useState<DescentRun | null>(() => restoreMission<DescentRun>("descent-protocol", progression));
  useEffect(() => setProgression((p) => withMissionRun(p, "descent-protocol", descent)), [descent]);
  const descentReady = phase === "world" && !tutorial && progression.completedMissions.includes("stitched-neon-core") && !progression.completedMissions.includes("descent-protocol");
  useEffect(() => {
    if (!descentReady || descent) return;
    const timer = window.setTimeout(() => setDescent(advanceDescent(DESCENT_PROTOCOL, { type: "START" })), 8000);
    return () => window.clearTimeout(timer);
  }, [descentReady, descent]);
  const recordDescent = (event: DescentEvent) => setDescent((current) => current ? advanceDescent(current, event) : current);
  useEffect(() => {
    if (descent?.state !== "WORLD_UPDATE" || progression.completedMissions.includes("descent-protocol")) return;
    setProgression((current) => { return applyMissionCompletion(current, "descent-protocol"); });
    const timer = window.setTimeout(() => setDescent(null), 9000);
    return () => window.clearTimeout(timer);
  }, [descent?.state, progression.completedMissions]);

  /* Mission 05 · The System Core — fd-18's final mission, picking up from Descent Protocol's
   * cliffhanger. Gated on fd-18 actually being the active quest (not just descent-protocol being
   * done) so it doesn't fire while fd-17's own deep-pressure dive timer is still running. Its
   * WORLD_UPDATE dispatches the BOSS_DEFEATED event fd-18 is listening for (key "system-core"),
   * which completes fd-18 and — via the ending effect below — triggers EndingOverlay. */
  const [systemCore, setSystemCore] = useState<SystemCoreRun | null>(() => restoreMission<SystemCoreRun>("system-core", progression));
  useEffect(() => setProgression((p) => withMissionRun(p, "system-core", systemCore)), [systemCore]);
  const systemCoreReady = phase === "world" && !tutorial && progression.completedMissions.includes("descent-protocol") && progression.activeQuestId === "fd-18" && !progression.completedMissions.includes("system-core");
  useEffect(() => {
    if (!systemCoreReady || systemCore) return;
    const timer = window.setTimeout(() => setSystemCore(advanceSystemCore(SYSTEM_CORE, { type: "START" })), 8000);
    return () => window.clearTimeout(timer);
  }, [systemCoreReady, systemCore]);
  const recordSystemCore = (event: SystemCoreEvent) => setSystemCore((current) => current ? advanceSystemCore(current, event) : current);
  useEffect(() => {
    if (systemCore?.state !== "WORLD_UPDATE" || progression.completedMissions.includes("system-core")) return;
    setProgression((current) => {
      return applyMissionCompletion(current, "system-core");
    });
    const timer = window.setTimeout(() => setSystemCore(null), 9000);
    return () => window.clearTimeout(timer);
  }, [systemCore?.state, progression.completedMissions]);

  /* Cross-world quest engine: HUD already reports region/heat/lockdown/hack/dive state every ~0.18s
   * (see Scene.tsx's onHud), so that cadence — not Scene's 60fps loop — is what drives gameTick here. */
  const questSignals = useRef({ signals: NEW_QUEST_SIGNALS, at: 0 });
  useEffect(() => {
    if (phase !== "world") { questSignals.current.at = 0; return; }
    const now = performance.now();
    const dt = questSignals.current.at ? (now - questSignals.current.at) / 1000 : 0;
    questSignals.current.at = now;
    const { events, next } = questEventsFromHud(questSignals.current.signals, hud, dt);
    questSignals.current.signals = next;
    if (!events.length) return;
    // functional update: this fires several times a second and must never overwrite newer progression
    setProgression((current) => events.reduce((p, event) => gameTick(p, event), current));
  }, [hud, phase]);

  /* Interior NPC dialogue: a canned greeting the first time, then real revisit content after that —
   * reacting to the zone's live instability tier and territory-control owner (sim.ts, the same data
   * RegionLabels/Minimap already surface) and whichever Fracture Descent quest is active, so an NPC
   * you've already met has something new to say rather than going silent forever. */
  const visitCounts = useRef(new Map<string, number>());
  const [activeDialogue, setActiveDialogue] = useState<DialogueLine[] | null>(null);
  useEffect(() => {
    if (!hud.insideInterior) return;
    const visits = visitCounts.current.get(hud.insideInterior) ?? 0;
    const lines =
      visits === 0
        ? dialogueFor(hud.insideInterior)
        : revisitDialogueFor(hud.insideInterior, {
            questTitle: progression.activeQuestId ? QUESTS[progression.activeQuestId]?.title ?? null : null,
            zoneTier: hud.zoneTier,
            owner: hud.owner,
            regionId: hud.regionId,
            visitCount: visits,
          });
    if (!lines) return;
    visitCounts.current.set(hud.insideInterior, visits + 1);
    setActiveDialogue(lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud.insideInterior]);

  /* Hull-destroyed feedback: hud.justDied mirrors sim.lastDeath (Scene.tsx already teleports the
   * player back to Nexus the instant it changes), so this only has to notice a new timestamp and
   * show the flash — unlike the ending above, this fires every time, not once ever. */
  const [deathInfo, setDeathInfo] = useState<{ cause: string; cargoLost: number; deaths: number } | null>(null);
  const seenDeathAt = useRef(0);
  useEffect(() => {
    if (!hud.justDied || hud.justDied === seenDeathAt.current) return;
    seenDeathAt.current = hud.justDied;
    setDeathInfo({ cause: hud.deathCause, cargoLost: hud.deathCargoLost, deaths: hud.deaths });
  }, [hud.justDied, hud.deathCause, hud.deathCargoLost, hud.deaths]);

  /* The Fracture Descent's ending: fires once ever, the moment fd-18 lands in completedMissions —
   * gated on the persisted progression.endingSeen flag (not just a session ref) so a returning
   * player who already finished the campaign doesn't get the screen replayed on next launch. */
  const [showEnding, setShowEnding] = useState(false);
  const triggeringEnding = useRef(false);
  useEffect(() => {
    if (triggeringEnding.current || progression.endingSeen || !progression.completedMissions.includes("fd-18")) return;
    triggeringEnding.current = true;
    playEnding(endingTierFor(progression));
    setShowEnding(true);
    setProgression((current) => ({ ...current, endingSeen: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progression]);

  const prepareDeployment = (deployment: Deployment) => {
    setPendingDeployment(deployment);
    setPhase("briefing");
  };

  const deploy = (deployment: Deployment) => {
    setCls(deployment.classId);
    setSubclass(deployment.subclassId);
    setAppearance(deployment.appearance);
    setBodyType(deployment.bodyType);
    // players who already finished onboarding never replay it when they re-deploy from Character
    setTutorial(progression.tutorialComplete ? null : FIRST_TUTORIAL);
    setProgression((current) => ({ ...current, identityClass: deployment.classId, activeBuild: classBuild(deployment.classId) }));
    if (progression.selectedVehicle) setVehicleId(progression.selectedVehicle);
    setHud((current) => ({
      ...current,
      region: "Veridan Forest",
      regionId: "veridan",
      sub: "Starter Zone / Resources",
      kind: "starter",
      difficulty: 1,
      weather: "Rain mist",
      playerClass: deployment.classId,
      subclassName: subclassById(deployment.subclassId).name,
      callsign: deployment.appearance.callsign,
      abilities: classById(deployment.classId).abilities.map((ability) => ({ slot: ability.slot, name: ability.name, ready: true })),
      missions: [{
        id: "mission-01",
        name: "Mission 01 — First Resonance",
        kind: "FIRST_RESONANCE",
        regionId: "veridan",
        intensity: "LOW",
        state: "ACTIVE",
        objectives: [
          { type: "SURVIVE", label: "Stabilize after insertion (s)", amount: 20, progress: 0, done: false },
          { type: "KILL", label: "Clear the forest patrol", amount: 2, progress: 0, done: false },
        ],
        reward: 500,
        age: 0,
        stage: 0,
      }],
    }));
    setMenuOpen(false);
    setPhase("world");
    setIntroElapsed(0);
    setShowIntro(true);
  };
  const recordTutorial = (event: TutorialEvent) => setTutorial((current) => current ? advanceTutorial(current, event) : current);
  const recordMission = (event: MissionEvent) => setMission((current) => current ? advanceMission(current, event) : current);
  const [levelUpFlash, setLevelUpFlash] = useState<{ level: number; novaUnlocked: string[] } | null>(null);
  const recordXP = (event: WorldSim["xpEvents"][number]) => {
    setProgression((current) => {
      const result = grantXP(current, event.type, { enemyLevel: event.enemyLevel, combatHeat: event.combatHeat });
      if (result.leveledUp) {
        playLevelUp();
        if (result.novaUnlocked.length) playNovaUnlock();
        setLevelUpFlash({ level: result.newLevel, novaUnlocked: result.novaUnlocked });
      }
      return result.progression;
    });
  };

  const toOrbit = () => {
    stopVoice();
    setLast({ credits: hud.credits, kills: hud.kills });
    setMenuOpen(false);
    setPhase("title");
  };

  if (phase === "boot") {
    return <BootSequence reducedMotion={prefersReduced(settings.reducedMotion)} onDone={() => { markBootSeen(); setPhase("title"); }} />;
  }

  if (phase === "title") {
    return (
      <>
        {!menuOpen && (
          <MainMenu
            save={evaluateSave(progression, last !== null)}
            classId={progression.identityClass ?? cls}
            look={armorLook(progression)}
            reducedMotion={prefersReduced(settings.reducedMotion)}
            onContinue={() => setPhase(last || progression.completedMissions.length > 0 ? "hub" : "loadout")}
            onNewGame={() => setPhase("loadout")}
            onCharacter={() => setPhase("loadout")}
            onSettings={() => setMenuOpen(true)}
          />
        )}
        {menuOpen && <SettingsWindow completedMissions={progression.completedMissions} settings={settings} onChange={updateSettings} onClose={() => setMenuOpen(false)} onOrbit={() => setMenuOpen(false)} />}
      </>
    );
  }

  if (phase === "hub") {
    return (
      <>
        {hubView === "starmap" && <StarMap progression={progression} onBack={() => setHubView(null)} onDeploy={(id) => { const r = REGIONS.find((x) => x.id === id)!; setHubView(null); setTravelTo({ x: r.x, z: r.z + 6, nonce: Date.now() }); setPhase("world"); }} />}
        {hubView === "arsenal" && <ArsenalLoadouts progression={progression} onProgression={setProgression} onBack={() => setHubView(null)} />}
        {hubView === "saves" && <SaveManager progression={progression} onProgression={setProgression} onBack={() => setHubView(null)} />}
        {!menuOpen && !hubView && (
          <MainMenuHub
            className={classById(progression.identityClass ?? cls).name}
            level={progression.level}
            shards={progression.materials.dataShards ?? 0}
            completedMissions={progression.completedMissions}
            onNavigate={(target) => {
              if (target === "system") { setMenuOpen(true); return; }
              if (target === "starmap" || target === "arsenal" || target === "saves") { setHubView(target); return; }
              setPhase("world");
            }}
          />
        )}
        {menuOpen && <SettingsWindow completedMissions={progression.completedMissions} settings={settings} onChange={updateSettings} onClose={() => setMenuOpen(false)} onOrbit={() => { setMenuOpen(false); setPhase("title"); }} />}
      </>
    );
  }

  if (phase === "loadout") {
    return (
      <>
        <StartMenu paused={menuOpen} saved={progression.character} gear={progression} onDeploy={prepareDeployment} weaponOrder={activeLoadout(progression, progression.identityClass ?? cls).slots} onSaveCharacter={async (character) => { const result = await persistCharacter(progressionRef.current, character); progressionRef.current = result.progression; setProgression(result.progression); }} onSettings={() => setMenuOpen(true)} onExit={() => setPhase("title")} best={last} />
        {menuOpen && (
          <SettingsWindow
            completedMissions={progression.completedMissions}
            settings={settings}
            onChange={updateSettings}
            onClose={() => setMenuOpen(false)}
            onOrbit={() => setMenuOpen(false)}
          />
        )}
      </>
    );
  }

  if (phase === "briefing" && pendingDeployment) {
    return (
      <DeploymentBriefing
        deployment={pendingDeployment}
        progression={progression}
        onBack={() => setPhase("loadout")}
        onLaunch={() => deploy(pendingDeployment)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-background">
      <WorldErrorBoundary>
      <GraphicsGuard>{(caps, onCreated) => {
        const preset = RENDER_PRESETS[settings.renderTier];
        // Safari: cap pixel ratio, use hard-edged shadows and skip the post-processing pass, which
        // are the usual causes of a blank or lost context there.
        const maxDpr = caps.safari ? Math.min(preset.dpr, 1.5) : preset.dpr;
        const flags = perfFlags();
        const post = preset.distortion && !caps.safari && caps.webgl2 && !lowPerf && flags.post;
        // SSAO and depth-of-field are the two costliest passes in the stack — reserve them for
        // the top render tier so MEDIUM/HIGH still get the cheap color-grade + bloom + vignette
        // look without paying for contact-shadow and bokeh sampling every frame.
        const premium = post && settings.renderTier === "ULTRA";
        return (
      <Canvas
        onCreated={onCreated}
        onPointerDown={(event) => {
          if (event.button === 0 || event.button === 2) event.currentTarget.requestPointerLock?.();
        }}
        onContextMenu={(event) => event.preventDefault()}
        shadows={preset.shadows && flags.shadows ? { type: caps.safari ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap } : false}
        dpr={flags.dpr ?? Math.min(maxDpr, adaptiveDpr)}
        gl={{ antialias: !caps.safari, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false }}
        camera={{
          position: [START.x, walkHeight(START.x, START.z) + 30, START.z + 46],
          fov: 55,
          far: 1200,
        }}
      >
        <color attach="background" args={["#bfe4f2"]} />
        <Suspense fallback={null}>
            <Scene onHud={setHud} onDrops={(drops) => setProgression((current) => claimDrops(current, drops))} gear={progression} settings={settings} onCameraPreference={(firstPerson) => { window.localStorage.setItem("world-fracture-camera", firstPerson ? "first" : "third"); setSettings((current) => ({ ...current, firstPersonDefault: firstPerson })); }} playerClass={cls} subclassId={subclass} appearance={appearance} bodyType={bodyType} vehicleId={vehicleId} vehicleUnlocked={vehicleUnlocked} activeBuild={progression.activeBuild} abilityBranches={progression.abilityBranches} tutorial={tutorial} onTutorialEvent={recordTutorial} mission={mission} onMissionEvent={recordMission} blackout={blackout} onBlackoutEvent={recordBlackout} neonCore={neonCore} onNeonCoreEvent={recordNeonCore} descent={descent} onDescentEvent={recordDescent} systemCore={systemCore} onSystemCoreEvent={recordSystemCore} awakening={awakening} onAwakeningEvent={recordAwakening} onXP={recordXP} weaponOrder={activeLoadout(progression, progression.identityClass ?? cls).slots} travelTo={travelTo} introPlayback={showIntro ? { elapsed: introElapsed, totalSeconds: introTotalSeconds() } : null} armorState={hud.hp < 35 ? "FRACTURE" : hud.heat > 65 ? "ASCENDANT" : hud.heat > 15 ? "ACTIVE" : "STABLE"} />
        </Suspense>
        {post && (
          // cinematic grade: cool-leaning teal shadows, a touch more punch, so the HUD's cyan
          // reads against the world the way it does in the reference concept art. SSAO and
          // depth-of-field (the costly passes) only mount on `premium` so this stays a flat
          // cost increase, not a new tier of budget risk, on MEDIUM/HIGH.
          <EffectComposer multisampling={0}>
            <HueSaturation hue={-0.02} saturation={0.08} />
            <BrightnessContrast brightness={-0.02} contrast={0.12} />
            <Bloom intensity={0.65} luminanceThreshold={0.82} luminanceSmoothing={0.25} mipmapBlur />
            {premium && <SSAO intensity={18} radius={0.18} luminanceInfluence={0.4} bias={0.025} />}
            {premium && <DepthOfField focusDistance={0.012} focalLength={0.045} bokehScale={2.2} />}
            <ChromaticAberration offset={CA_OFFSET} />
            <Vignette offset={0.3} darkness={0.55} />
            <Noise opacity={0.025} premultiply />
          </EffectComposer>
        )}
        <PerfSampler />
        {/* Adaptive quality: when frames drop, lower resolution first, then turn off the
            post-processing stack; recovers when the frame rate is healthy again. */}
        <PerformanceMonitor
          bounds={() => [45, 58]}
          flipflops={6}
          onDecline={() => setAdaptiveDpr((d) => { const next = Math.max(0.75, Math.round((d - 0.25) * 100) / 100); if (next <= 1) setLowPerf(true); return next; })}
          onIncline={() => setAdaptiveDpr((d) => { const next = Math.min(2, d + 0.25); if (next > 1.25) setLowPerf(false); return next; })}
        />
      </Canvas>
        );
      }}</GraphicsGuard>
      </WorldErrorBoundary>
       <PerfOverlay />
      <ForestAssetStatus />
       {savedFlash > 0 && <p className="pointer-events-none fixed right-4 top-4 z-30 font-mono text-[10px] uppercase tracking-[0.25em] text-primary" role="status">◌ Auto-saved</p>}
       <VoiceSubtitle />
       <HUD hud={hud} tutorialActive={Boolean(tutorial && tutorial.step !== "VICTORY")} onMenu={() => { setInventoryOpen(false); setAtlasOpen(false); setOperationsView(null); setMenuOpen(true); }} onStrategy={() => setStrategyOpen(true)} onGarage={() => setGarageOpen(true)} onAnalyze={() => setAnalysisOpen(true)} onOperations={(view) => { setInventoryOpen(false); setAtlasOpen(false); setOperationsView(view); }} onInventory={() => { setAtlasOpen(false); setOperationsView(null); setInventoryOpen(true); }} onAtlas={() => { setInventoryOpen(false); setOperationsView(null); setAtlasOpen(true); }} />
       {!tutorial && !hud.insideInterior && <Minimap hud={hud} />}
       {!tutorial && <QuestTracker progression={progression} />}
       {activeDialogue && <DialogueOverlay lines={activeDialogue} onDone={() => setActiveDialogue(null)} />}
       {deathInfo && <DeathOverlay cause={deathInfo.cause} cargoLost={deathInfo.cargoLost} deaths={deathInfo.deaths} onDone={() => setDeathInfo(null)} />}
       {levelUpFlash && <LevelUpOverlay level={levelUpFlash.level} novaUnlocked={levelUpFlash.novaUnlocked} onDone={() => setLevelUpFlash(null)} />}
       {showEnding && <EndingOverlay progression={progression} onClose={() => setShowEnding(false)} />}
       {hud.insideInterior && hud.interiorName && hud.sub.startsWith("Shop") && (
         <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 text-center">
           {hud.interiorOpen ? (
             <Button className="pointer-events-auto" variant="outline" onClick={() => setOperationsView("ARSENAL")}>Browse {hud.interiorName}</Button>
           ) : (
             <p className="border border-border/60 bg-background/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{hud.interiorName} is closed for the night</p>
           )}
         </div>
       )}
       {inventoryOpen && <InventoryWindow progression={progression} onProgression={setProgression} onClose={() => setInventoryOpen(false)} />}
       {atlasOpen && <WorldAtlas progression={progression} markers={hud.markers} px={hud.px} pz={hud.pz} currentRegion={hud.region} phase={hud.phase} onClose={() => setAtlasOpen(false)} />}
      {awakening && <AwakeningOverlay run={awakening} onEvent={recordAwakening} />}
      {mission && <BrokenSignalOverlay mission={mission} onEvent={recordMission} />}
      {blackout && <BlackoutProtocolOverlay mission={blackout} onEvent={recordBlackout} />}
      {neonCore && <StitchedNeonCoreOverlay mission={neonCore} onEvent={recordNeonCore} />}
      {descent && <DescentProtocolOverlay mission={descent} onEvent={recordDescent} />}
      {systemCore && <SystemCoreOverlay mission={systemCore} onEvent={recordSystemCore} />}
      {tutorial && <OnboardingSignal tutorial={tutorial} classId={cls} onOpenHub={() => { setTutorial(null); setOperationsView("ABILITIES"); }} />}
      {tutorial?.step === "VICTORY" && (
        <VictoryReport
          classId={cls}
          abilityName={nodeById(classBuild(cls).slots.TACTICAL)?.name ?? ""}
          onContinue={() => { setTutorial(null); setOperationsView("ABILITIES"); }}
        />
      )}
      {showIntro && <IntroCinematic onComplete={() => setShowIntro(false)} onTick={setIntroElapsed} />}
      {strategyOpen && <RaidStrategyPanel onClose={() => setStrategyOpen(false)} />}
      {analysisOpen && <ZoneAnalysisPanel zoneName={hud.region} onClose={() => setAnalysisOpen(false)} />}
      {operationsView && <OperationsHub initialView={operationsView} progression={progression} onProgression={setProgression} onClose={() => setOperationsView(null)} />}
      {progression.tutorialComplete && !tutorial && !vehicleUnlocked && <div className="fixed inset-0 z-40 grid place-items-center bg-background/80 p-4"><section className="w-full max-w-3xl border border-primary bg-card p-6"><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Mission 01 complete · Garage assistant online</p><h2 className="mt-2 text-2xl font-semibold">Choose your first vehicle</h2><p className="mt-2 text-sm text-muted-foreground">This frame becomes your permanent world-travel unlock.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{STARTER_VEHICLES.map((vehicle) => <Button key={vehicle.id} variant="outline" onClick={() => { setVehicleId(vehicle.id); setProgression((current) => rewardVehicle(current, vehicle.id)); }} className="h-auto min-h-36 items-start justify-start rounded-none p-4 text-left whitespace-normal"><span><span className="font-mono text-base">{vehicle.name}</span><span className="mt-2 block text-xs text-muted-foreground">{vehicle.role}</span></span></Button>)}</div></section></div>}
      <CloudSavePanel progression={progression} onProgression={setProgression} />
      {garageOpen && <div className="fixed inset-0 z-40 grid place-items-center bg-background/80 p-4"><section className="max-h-[85vh] w-full max-w-4xl overflow-y-auto border border-border bg-card p-6"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Garage assistant</p><h2 className="mt-2 text-2xl">Vehicle registry</h2><p className="mt-1 text-xs text-muted-foreground">Garage loadout {progression.garageLoadout.length}/3</p></div><Button variant="outline" onClick={() => setGarageOpen(false)}>Back</Button></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{VEHICLES.map((vehicle) => { const owned = progression.ownedVehicles.includes(vehicle.id); const selected = progression.selectedVehicle === vehicle.id; return <div key={vehicle.id} className={`border p-3 ${selected ? "border-primary" : "border-border"}`}><p className="font-mono text-sm">{vehicle.name}</p><p className="mt-1 text-[10px] uppercase text-muted-foreground">{selected ? "Active · summon with V" : owned ? "Owned" : vehicleAcquisition(vehicle).replace("_", " ")}</p>{owned && !selected && <Button size="sm" variant="outline" className="mt-3" onClick={() => { setVehicleId(vehicle.id); setProgression((current) => ({ ...current, selectedVehicle: vehicle.id })); }}>Equip</Button>}</div>; })}</div></section></div>}
      {menuOpen && (
        <SettingsWindow
            completedMissions={progression.completedMissions}
          settings={settings}
          onChange={updateSettings}
          onClose={() => setMenuOpen(false)}
          onOrbit={toOrbit}
        />
      )}
    </div>
  );
}
