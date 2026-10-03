import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Bloom, BrightnessContrast, ChromaticAberration, DepthOfField, EffectComposer, HueSaturation, Noise, SSAO, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Suspense, useEffect, useRef, useState } from "react";

import { classById, subclassById, type AppearanceId, type ClassId, type SubclassId } from "@/game/loadout";
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
import { SettingsWindow, DEFAULT_SETTINGS, type GameSettings } from "./SettingsWindow";
import { TitleScreen } from "./TitleScreen";
import { RaidStrategyPanel } from "./RaidStrategyPanel";
import { OperationsHub } from "./OperationsHub";
import { ZoneAnalysisPanel } from "./ZoneAnalysisPanel";
import { CloudSavePanel } from "./CloudSavePanel";
import { completeMission, loadProgression, rewardVehicle, saveProgression, type PlayerProgression } from "@/game/progression";
import { RENDER_PRESETS } from "@/game/performance";
import { classBuild } from "@/game/live-build";
import { nodeById } from "@/game/ability-network";
import { advanceTutorial, FIRST_TUTORIAL, type TutorialEvent, type TutorialState } from "@/game/onboarding";
import { OnboardingSignal } from "./OnboardingSignal";
import { IntroCinematic } from "./IntroCinematic";
import { VictoryReport } from "./VictoryReport";
import { claimDrops } from "@/game/inventory";
import { InventoryWindow } from "./InventoryWindow";
import { WorldAtlas } from "./WorldAtlas";
import { BrokenSignalOverlay } from "./BrokenSignalOverlay";
import { AwakeningOverlay } from "./AwakeningOverlay";
import { advanceAwakening, AWAKENING, type AwakeningEvent, type AwakeningRun } from "@/game/missions/awakening";
import { normalizeBindings } from "@/game/bindings";
import { advanceMission, BROKEN_SIGNAL, type MissionEvent, type MissionRun } from "@/game/missions/broken-signal";
import { advanceMission as advanceBlackout, BLACKOUT_PROTOCOL, type MissionEvent as BlackoutEvent, type MissionRun as BlackoutRun } from "@/game/missions/blackout-protocol";
import { BlackoutProtocolOverlay } from "./BlackoutProtocolOverlay";
import { advanceMission as advanceNeonCore, STITCHED_NEON_CORE, type MissionEvent as NeonCoreEvent, type MissionRun as NeonCoreRun } from "@/game/missions/stitched-neon-core";
import { StitchedNeonCoreOverlay } from "./StitchedNeonCoreOverlay";
import { advanceMission as advanceDescent, DESCENT_PROTOCOL, type MissionEvent as DescentEvent, type MissionRun as DescentRun } from "@/game/missions/descent-protocol";
import { DescentProtocolOverlay } from "./DescentProtocolOverlay";
import { gameTick, QUESTS } from "@/game/quests";
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
  playerClass: "TITAN",
  subclassName: "Shield Titan",
  abilities: classById("TITAN").abilities.map((ability) => ({ slot: ability.slot, name: ability.name, ready: true })),
  firstMissionComplete: false,
  weather: "Rain mist",
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

export function GameCanvas() {
  const [hud, setHud] = useState<HudState>(initial);
  const [phase, setPhase] = useState<"title" | "loadout" | "world">("title");
  const [menuOpen, setMenuOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [adaptiveDpr, setAdaptiveDpr] = useState(1.5);
  const [lowPerf, setLowPerf] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem("world-fracture-camera");
    if (saved === "third") setSettings((current) => ({ ...current, firstPersonDefault: false }));
    const vol = Number(window.localStorage.getItem("world-fracture-volume"));
    if (window.localStorage.getItem("world-fracture-volume") !== null && Number.isFinite(vol)) setSettings((current) => ({ ...current, volume: Math.min(1, Math.max(0, vol)) }));
    try { const m = window.localStorage.getItem("world-fracture-mix"); if (m) { const p = JSON.parse(m) as { music?: number; sfx?: number }; const c = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1); setSettings((current) => ({ ...current, musicVolume: c(p.music), sfxVolume: c(p.sfx) })); } } catch { /* keep defaults */ }
    try { const b = window.localStorage.getItem("world-fracture-bindings"); if (b) setSettings((current) => ({ ...current, bindings: normalizeBindings(JSON.parse(b)) })); } catch { /* keep defaults */ }
  }, []);
  const updateSettings = (next: GameSettings) => {
    if (next.volume !== settings.volume && next.volume !== undefined) window.localStorage.setItem("world-fracture-volume", String(next.volume));
    if (next.musicVolume !== settings.musicVolume || next.sfxVolume !== settings.sfxVolume) window.localStorage.setItem("world-fracture-mix", JSON.stringify({ music: next.musicVolume ?? 1, sfx: next.sfxVolume ?? 1 }));
    if (next.firstPersonDefault !== settings.firstPersonDefault) window.localStorage.setItem("world-fracture-camera", next.firstPersonDefault ? "first" : "third");
    if (next.bindings !== settings.bindings) window.localStorage.setItem("world-fracture-bindings", JSON.stringify(next.bindings));
    setSettings(next);
  };
  const [cls, setCls] = useState<ClassId>("TITAN");
  const [subclass, setSubclass] = useState<SubclassId>("SHIELD_TITAN");
  const [appearance, setAppearance] = useState<AppearanceId>("RANGER");
  const [vehicleId, setVehicleId] = useState<VehicleId>("scrap-interceptor");
  const [vehicleUnlocked, setVehicleUnlocked] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [operationsView, setOperationsView] = useState<"DUNGEONS" | "ARSENAL" | "ABILITIES" | null>(null);
  const [last, setLast] = useState<{ credits: number; kills: number } | null>(null);
  const [progression, setProgression] = useState<PlayerProgression>(() => loadProgression());
  const [tutorial, setTutorial] = useState<TutorialState | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [boot, setBoot] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setBoot(false), 1700); return () => window.clearTimeout(timer); }, []);

  useEffect(() => saveProgression(progression), [progression]);
  useEffect(() => {
    if (tutorial?.step === "VICTORY" && !progression.completedMissions.includes("mission-01")) setProgression((current) => ({ ...completeMission(current, "mission-01"), tutorialComplete: true, unlockedAbilities: Array.from(new Set([...current.unlockedAbilities, classBuild(cls).slots.TACTICAL])), calibrationTokens: current.calibrationTokens + 1 }));
  }, [tutorial?.step, progression.completedMissions, cls]);

  /* Mission 01 · Broken Signal starts as a world event once the player is free-roaming. */
  const [mission, setMission] = useState<MissionRun | null>(null);
  const [awakening, setAwakening] = useState<AwakeningRun | null>(null);
  const awakeningDone = progression.completedMissions.includes("awakening");
  useEffect(() => {
    if (phase !== "world" || tutorial || awakening || awakeningDone) return;
    const timer = window.setTimeout(() => setAwakening(advanceAwakening(AWAKENING, { type: "START" })), 2500);
    return () => window.clearTimeout(timer);
  }, [phase, tutorial, awakening, awakeningDone]);
  useEffect(() => {
    if (awakening?.state === "LOOT") return; // loot granted on ACK
    if (awakening?.state !== "COMPLETE" || awakeningDone) return;
    setProgression((current) => { const next = completeMission(current, "awakening"); return gameTick({ ...next, materials: { ...next.materials, dataShards: (next.materials.dataShards ?? 0) + 2 } }, { type: "MISSION_COMPLETE", missionId: "awakening" }); });
    const timer = window.setTimeout(() => setAwakening(null), 7000);
    return () => window.clearTimeout(timer);
  }, [awakening?.state, awakeningDone]);
  const recordAwakening = (event: AwakeningEvent) => setAwakening((current) => {
    if (!current) return current;
    const next = advanceAwakening(current, event);
    if (current.state === "LOOT" && next.state === "CAPTURE") setProgression((p) => ({ ...p, materials: { ...p.materials, scrapMetal: (p.materials.scrapMetal ?? 0) + 4 } }));
    return next;
  });
  const missionReady = phase === "world" && !tutorial && vehicleUnlocked && awakeningDone && !progression.completedMissions.includes("broken-signal");
  useEffect(() => {
    if (!missionReady || mission) return;
    const timer = window.setTimeout(() => setMission(advanceMission(BROKEN_SIGNAL, { type: "START" })), 6000);
    return () => window.clearTimeout(timer);
  }, [missionReady, mission]);
  useEffect(() => {
    if (mission?.state !== "WORLD_UPDATE" || progression.completedMissions.includes("broken-signal")) return;
    setProgression((current) => { const next = completeMission(current, "broken-signal"); return gameTick({ ...next, materials: { ...next.materials, dataShards: (next.materials.dataShards ?? 0) + 3 } }, { type: "MISSION_COMPLETE", missionId: "broken-signal" }); });
    const timer = window.setTimeout(() => setMission(null), 9000);
    return () => window.clearTimeout(timer);
  }, [mission?.state, progression.completedMissions]);

  /* Mission 02 · Blackout Protocol — picks up once Broken Signal is behind you; NOVA's line
   * sends you into the real Neon City street, same ANCHOR/ARRIVED/CLEAR/HACK/ACK shape as
   * Mission 01 so Scene.tsx wires it the identical way. */
  const [blackout, setBlackout] = useState<BlackoutRun | null>(null);
  const blackoutReady = phase === "world" && !tutorial && progression.completedMissions.includes("broken-signal") && !progression.completedMissions.includes("blackout-protocol");
  useEffect(() => {
    if (!blackoutReady || blackout) return;
    const timer = window.setTimeout(() => setBlackout(advanceBlackout(BLACKOUT_PROTOCOL, { type: "START" })), 8000);
    return () => window.clearTimeout(timer);
  }, [blackoutReady, blackout]);
  const recordBlackout = (event: BlackoutEvent) => setBlackout((current) => current ? advanceBlackout(current, event) : current);
  useEffect(() => {
    if (blackout?.state !== "WORLD_UPDATE" || progression.completedMissions.includes("blackout-protocol")) return;
    setProgression((current) => { const next = completeMission(current, "blackout-protocol"); return gameTick({ ...next, materials: { ...next.materials, microCircuits: (next.materials.microCircuits ?? 0) + 4 } }, { type: "MISSION_COMPLETE", missionId: "blackout-protocol" }); });
    const timer = window.setTimeout(() => setBlackout(null), 9000);
    return () => window.clearTimeout(timer);
  }, [blackout?.state, progression.completedMissions]);

  /* Mission 03 · Stitched Neon Core — the dungeon Blackout Protocol's ending hooked but never
   * built a physical layer for; same ANCHOR/ARRIVED/CLEAR/HACK/ACK shape, ending in the game's
   * first scripted boss fight (Aegis-Prime, summoned through the normal summonBoss() path). */
  const [neonCore, setNeonCore] = useState<NeonCoreRun | null>(null);
  const neonCoreReady = phase === "world" && !tutorial && progression.completedMissions.includes("blackout-protocol") && !progression.completedMissions.includes("stitched-neon-core");
  useEffect(() => {
    if (!neonCoreReady || neonCore) return;
    const timer = window.setTimeout(() => setNeonCore(advanceNeonCore(STITCHED_NEON_CORE, { type: "START" })), 8000);
    return () => window.clearTimeout(timer);
  }, [neonCoreReady, neonCore]);
  const recordNeonCore = (event: NeonCoreEvent) => setNeonCore((current) => current ? advanceNeonCore(current, event) : current);
  useEffect(() => {
    if (neonCore?.state !== "WORLD_UPDATE" || progression.completedMissions.includes("stitched-neon-core")) return;
    setProgression((current) => { const next = completeMission(current, "stitched-neon-core"); return gameTick({ ...next, materials: { ...next.materials, aegisCore: (next.materials.aegisCore ?? 0) + 1 } }, { type: "MISSION_COMPLETE", missionId: "stitched-neon-core" }); });
    const timer = window.setTimeout(() => setNeonCore(null), 9000);
    return () => window.clearTimeout(timer);
  }, [neonCore?.state, progression.completedMissions]);

  /* Mission 04 · Descent Protocol — continues straight from Stitched Neon Core's ending; gives
   * fd-16's dive-to-Thalassia (previously just a bare survive-underwater timer) an actual
   * destination and story beat in the already-built sunken city. Same shape as Missions 01-03. */
  const [descent, setDescent] = useState<DescentRun | null>(null);
  const descentReady = phase === "world" && !tutorial && progression.completedMissions.includes("stitched-neon-core") && !progression.completedMissions.includes("descent-protocol");
  useEffect(() => {
    if (!descentReady || descent) return;
    const timer = window.setTimeout(() => setDescent(advanceDescent(DESCENT_PROTOCOL, { type: "START" })), 8000);
    return () => window.clearTimeout(timer);
  }, [descentReady, descent]);
  const recordDescent = (event: DescentEvent) => setDescent((current) => current ? advanceDescent(current, event) : current);
  useEffect(() => {
    if (descent?.state !== "WORLD_UPDATE" || progression.completedMissions.includes("descent-protocol")) return;
    setProgression((current) => { const next = completeMission(current, "descent-protocol"); return gameTick({ ...next, materials: { ...next.materials, dataShards: (next.materials.dataShards ?? 0) + 5 } }, { type: "MISSION_COMPLETE", missionId: "descent-protocol" }); });
    const timer = window.setTimeout(() => setDescent(null), 9000);
    return () => window.clearTimeout(timer);
  }, [descent?.state, progression.completedMissions]);

  /* Cross-world quest engine: HUD already reports region/heat/lockdown/hack/dive state every ~0.18s
   * (see Scene.tsx's onHud), so that cadence — not Scene's 60fps loop — is what drives gameTick here. */
  const questSignals = useRef({ region: "", heatLevel: 1, lockdownTier: "MONITORING" as HudState["nexusLockdownTier"], hackDone: false });
  useEffect(() => {
    if (phase !== "world") return;
    let p = progression;
    let changed = false;
    if (hud.regionId && hud.regionId !== questSignals.current.region) {
      questSignals.current.region = hud.regionId;
      p = gameTick(p, { type: "ENTER_WORLD", world: hud.regionId });
      changed = true;
    }
    if (hud.heatLevel > questSignals.current.heatLevel) {
      questSignals.current.heatLevel = hud.heatLevel;
      p = gameTick(p, { type: "HEAT_LEVEL", level: hud.heatLevel });
      changed = true;
    }
    if (hud.nexusLockdownTier !== questSignals.current.lockdownTier) {
      questSignals.current.lockdownTier = hud.nexusLockdownTier;
      p = gameTick(p, { type: "LOCKDOWN_TIER", tier: hud.nexusLockdownTier });
      changed = true;
    }
    if (hud.hackProgress >= 100 && !questSignals.current.hackDone) {
      questSignals.current.hackDone = true;
      p = gameTick(p, { type: "HACK_COMPLETE" });
      changed = true;
    } else if (hud.hackProgress < 50) {
      questSignals.current.hackDone = false;
    }
    if (hud.diving) {
      p = gameTick(p, { type: "SURVIVED", world: "thalassia-dive", seconds: 0.18 });
      changed = true;
    }
    if (changed) setProgression(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const deploy = (deployment: Deployment) => {
    setCls(deployment.classId);
    setSubclass(deployment.subclassId);
    setAppearance(deployment.appearanceId);
    setTutorial(FIRST_TUTORIAL);
    setProgression((current) => ({ ...current, identityClass: deployment.classId, activeBuild: classBuild(deployment.classId) }));
    setVehicleUnlocked(Boolean(progression.selectedVehicle));
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
    setLast({ credits: hud.credits, kills: hud.kills });
    setMenuOpen(false);
    setPhase("title");
  };

  if (boot) return (
    <div className="fixed inset-0 grid place-items-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-7 size-16 animate-pulse rounded-full border border-primary shadow-[0_0_55px_var(--primary)]" />
        <h1 className="font-mono text-2xl font-bold tracking-[0.2em] text-foreground sm:text-3xl">WORLD<span className="text-primary"> FRACTURE</span></h1>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Initializing Adaptive Combat System…</p>
      </div>
    </div>
  );

  if (phase === "title") {
    return (
      <>
        {!menuOpen && (
          <TitleScreen
            canContinue={last !== null || progression.completedMissions.length > 0}
            onContinue={() => setPhase(last || progression.completedMissions.length > 0 ? "world" : "loadout")}
            onNewGame={() => setPhase("loadout")}
            onSettings={() => setMenuOpen(true)}
          />
        )}
        {menuOpen && <SettingsWindow settings={settings} onChange={updateSettings} onClose={() => setMenuOpen(false)} onOrbit={() => setMenuOpen(false)} />}
      </>
    );
  }

  if (phase === "loadout") {
    return (
      <>
        {!menuOpen && <StartMenu onDeploy={deploy} onSettings={() => setMenuOpen(true)} best={last} />}
        {menuOpen && (
          <SettingsWindow
            settings={settings}
            onChange={updateSettings}
            onClose={() => setMenuOpen(false)}
            onOrbit={() => setMenuOpen(false)}
          />
        )}
      </>
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
        const post = preset.distortion && !caps.safari && caps.webgl2 && !lowPerf;
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
        shadows={preset.shadows ? { type: caps.safari ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap } : false}
        dpr={Math.min(maxDpr, adaptiveDpr)}
        gl={{ antialias: !caps.safari, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false }}
        camera={{
          position: [START.x, walkHeight(START.x, START.z) + 30, START.z + 46],
          fov: 55,
          far: 1200,
        }}
      >
        <color attach="background" args={["#bfe4f2"]} />
        <Suspense fallback={null}>
            <Scene onHud={setHud} onDrops={(drops) => setProgression((current) => claimDrops(current, drops))} gear={progression} settings={settings} onCameraPreference={(firstPerson) => { window.localStorage.setItem("world-fracture-camera", firstPerson ? "first" : "third"); setSettings((current) => ({ ...current, firstPersonDefault: firstPerson })); }} playerClass={cls} subclassId={subclass} appearanceId={appearance} vehicleId={vehicleId} vehicleUnlocked={vehicleUnlocked} activeBuild={progression.activeBuild} abilityBranches={progression.abilityBranches} tutorial={tutorial} onTutorialEvent={recordTutorial} mission={mission} onMissionEvent={recordMission} blackout={blackout} onBlackoutEvent={recordBlackout} neonCore={neonCore} onNeonCoreEvent={recordNeonCore} descent={descent} onDescentEvent={recordDescent} awakening={awakening} onAwakeningEvent={recordAwakening} onXP={recordXP} armorState={hud.hp < 35 ? "FRACTURE" : hud.heat > 65 ? "ASCENDANT" : hud.heat > 15 ? "ACTIVE" : "STABLE"} />
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
       <HUD hud={hud} tutorialActive={Boolean(tutorial && tutorial.step !== "VICTORY")} onMenu={() => setMenuOpen(true)} onStrategy={() => setStrategyOpen(true)} onGarage={() => setGarageOpen(true)} onAnalyze={() => setAnalysisOpen(true)} onOperations={setOperationsView} onInventory={() => setInventoryOpen(true)} onAtlas={() => setAtlasOpen(true)} />
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
             <p className="border border-border/60 bg-background/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-md">{hud.interiorName} is closed for the night</p>
           )}
         </div>
       )}
       {inventoryOpen && <InventoryWindow progression={progression} onProgression={setProgression} onClose={() => setInventoryOpen(false)} />}
       {atlasOpen && <WorldAtlas markers={hud.markers} px={hud.px} pz={hud.pz} currentRegion={hud.region} phase={hud.phase} onClose={() => setAtlasOpen(false)} />}
      {awakening && <AwakeningOverlay run={awakening} onEvent={recordAwakening} />}
      {mission && <BrokenSignalOverlay mission={mission} onEvent={recordMission} />}
      {blackout && <BlackoutProtocolOverlay mission={blackout} onEvent={recordBlackout} />}
      {neonCore && <StitchedNeonCoreOverlay mission={neonCore} onEvent={recordNeonCore} />}
      {descent && <DescentProtocolOverlay mission={descent} onEvent={recordDescent} />}
      {tutorial && <OnboardingSignal tutorial={tutorial} classId={cls} onOpenHub={() => { setTutorial(null); setOperationsView("ABILITIES"); }} />}
      {tutorial?.step === "VICTORY" && (
        <VictoryReport
          classId={cls}
          abilityName={nodeById(classBuild(cls).slots.TACTICAL)?.name ?? ""}
          onContinue={() => { setTutorial(null); setOperationsView("ABILITIES"); }}
        />
      )}
      {showIntro && <IntroCinematic onComplete={() => setShowIntro(false)} />}
      {strategyOpen && <RaidStrategyPanel onClose={() => setStrategyOpen(false)} />}
      {analysisOpen && <ZoneAnalysisPanel zoneName={hud.region} onClose={() => setAnalysisOpen(false)} />}
      {operationsView && <OperationsHub initialView={operationsView} progression={progression} onProgression={setProgression} onClose={() => setOperationsView(null)} />}
      {progression.tutorialComplete && !tutorial && !vehicleUnlocked && <div className="fixed inset-0 z-40 grid place-items-center bg-background/80 p-4 backdrop-blur-md"><section className="w-full max-w-3xl border border-primary bg-card p-6"><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Mission 01 complete · Garage assistant online</p><h2 className="mt-2 text-2xl font-semibold">Choose your first vehicle</h2><p className="mt-2 text-sm text-muted-foreground">This frame becomes your permanent world-travel unlock.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{STARTER_VEHICLES.map((vehicle) => <Button key={vehicle.id} variant="outline" onClick={() => { setVehicleId(vehicle.id); setVehicleUnlocked(true); setProgression((current) => rewardVehicle(current, vehicle.id)); }} className="h-auto min-h-36 items-start justify-start rounded-none p-4 text-left whitespace-normal"><span><span className="font-mono text-base">{vehicle.name}</span><span className="mt-2 block text-xs text-muted-foreground">{vehicle.role}</span></span></Button>)}</div></section></div>}
      <CloudSavePanel progression={progression} onProgression={setProgression} />
      {garageOpen && <div className="fixed inset-0 z-40 grid place-items-center bg-background/80 p-4 backdrop-blur-md"><section className="max-h-[85vh] w-full max-w-4xl overflow-y-auto border border-border bg-card p-6"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Garage assistant</p><h2 className="mt-2 text-2xl">Vehicle registry</h2><p className="mt-1 text-xs text-muted-foreground">Garage loadout {progression.garageLoadout.length}/3</p></div><Button variant="outline" onClick={() => setGarageOpen(false)}>Back</Button></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{VEHICLES.map((vehicle) => { const owned = progression.ownedVehicles.includes(vehicle.id); const selected = progression.selectedVehicle === vehicle.id; return <div key={vehicle.id} className={`border p-3 ${selected ? "border-primary" : "border-border"}`}><p className="font-mono text-sm">{vehicle.name}</p><p className="mt-1 text-[10px] uppercase text-muted-foreground">{selected ? "Active · summon with V" : owned ? "Owned" : vehicleAcquisition(vehicle).replace("_", " ")}</p>{owned && !selected && <Button size="sm" variant="outline" className="mt-3" onClick={() => { setVehicleId(vehicle.id); setVehicleUnlocked(true); setProgression((current) => ({ ...current, selectedVehicle: vehicle.id })); }}>Equip</Button>}</div>; })}</div></section></div>}
      {menuOpen && (
        <SettingsWindow
          settings={settings}
          onChange={updateSettings}
          onClose={() => setMenuOpen(false)}
          onOrbit={toOrbit}
        />
      )}
    </div>
  );
}
