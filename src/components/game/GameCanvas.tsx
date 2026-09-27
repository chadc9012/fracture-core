import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Suspense, useEffect, useState } from "react";

import { classById, subclassById, type AppearanceId, type ClassId, type SubclassId } from "@/game/loadout";
import { REGIONS } from "@/game/world";
import { walkHeight } from "@/game/terrain";
import type { VehicleId } from "@/game/vehicles";
import { STARTER_VEHICLES, VEHICLES, vehicleAcquisition } from "@/game/vehicles";
import { Button } from "@/components/ui/button";
import { HUD } from "./HUD";
import { Scene, type HudState } from "./Scene";
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
import { advanceTutorial, FIRST_TUTORIAL, type TutorialEvent, type TutorialState } from "@/game/onboarding";
import { OnboardingSignal } from "./OnboardingSignal";
import { claimDrops } from "@/game/inventory";
import { InventoryWindow } from "./InventoryWindow";
import { WorldAtlas } from "./WorldAtlas";
import { BrokenSignalOverlay } from "./BrokenSignalOverlay";
import { AwakeningOverlay } from "./AwakeningOverlay";
import { advanceAwakening, AWAKENING, type AwakeningEvent, type AwakeningRun } from "@/game/missions/awakening";
import { normalizeBindings } from "@/game/bindings";
import { advanceMission, BROKEN_SIGNAL, type MissionEvent, type MissionRun } from "@/game/missions/broken-signal";

const START = REGIONS.find((r) => r.id === "nexus")!;

const initial: HudState = {
  region: START.name,
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
  useEffect(() => {
    const saved = window.localStorage.getItem("world-fracture-camera");
    if (saved === "third") setSettings((current) => ({ ...current, firstPersonDefault: false }));
    const vol = Number(window.localStorage.getItem("world-fracture-volume"));
    if (window.localStorage.getItem("world-fracture-volume") !== null && Number.isFinite(vol)) setSettings((current) => ({ ...current, volume: Math.min(1, Math.max(0, vol)) }));
    try { const b = window.localStorage.getItem("world-fracture-bindings"); if (b) setSettings((current) => ({ ...current, bindings: normalizeBindings(JSON.parse(b)) })); } catch { /* keep defaults */ }
  }, []);
  const updateSettings = (next: GameSettings) => {
    if (next.volume !== settings.volume && next.volume !== undefined) window.localStorage.setItem("world-fracture-volume", String(next.volume));
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
    setProgression((current) => { const next = completeMission(current, "awakening"); return { ...next, materials: { ...next.materials, dataShards: (next.materials.dataShards ?? 0) + 2 } }; });
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
    setProgression((current) => { const next = completeMission(current, "broken-signal"); return { ...next, materials: { ...next.materials, dataShards: (next.materials.dataShards ?? 0) + 3 } }; });
    const timer = window.setTimeout(() => setMission(null), 9000);
    return () => window.clearTimeout(timer);
  }, [mission?.state, progression.completedMissions]);

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
  };
  const recordTutorial = (event: TutorialEvent) => setTutorial((current) => current ? advanceTutorial(current, event) : current);
  const recordMission = (event: MissionEvent) => setMission((current) => current ? advanceMission(current, event) : current);

  const toOrbit = () => {
    setLast({ credits: hud.credits, kills: hud.kills });
    setMenuOpen(false);
    setPhase("title");
  };

  if (boot) return <div className="fixed inset-0 grid place-items-center bg-background"><div className="text-center"><div className="mx-auto mb-7 size-16 animate-pulse rounded-full border border-primary shadow-[0_0_55px_var(--primary)]" /><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Initializing Adaptive Combat System…</p></div></div>;

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
      <Canvas
        onPointerDown={(event) => {
          if (event.button === 0 || event.button === 2) event.currentTarget.requestPointerLock?.();
        }}
        onContextMenu={(event) => event.preventDefault()}
        shadows={RENDER_PRESETS[settings.renderTier].shadows}
        dpr={[1, RENDER_PRESETS[settings.renderTier].dpr]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{
          position: [START.x, walkHeight(START.x, START.z) + 30, START.z + 46],
          fov: 55,
          far: 1200,
        }}
      >
        <color attach="background" args={["#bfe4f2"]} />
        <Suspense fallback={null}>
            <Scene onHud={setHud} onDrops={(drops) => setProgression((current) => claimDrops(current, drops))} gear={progression} settings={settings} onCameraPreference={(firstPerson) => { window.localStorage.setItem("world-fracture-camera", firstPerson ? "first" : "third"); setSettings((current) => ({ ...current, firstPersonDefault: firstPerson })); }} playerClass={cls} subclassId={subclass} appearanceId={appearance} vehicleId={vehicleId} vehicleUnlocked={vehicleUnlocked} activeBuild={progression.activeBuild} abilityBranches={progression.abilityBranches} tutorial={tutorial} onTutorialEvent={recordTutorial} mission={mission} onMissionEvent={recordMission} awakening={awakening} onAwakeningEvent={recordAwakening} armorState={hud.hp < 35 ? "FRACTURE" : hud.heat > 65 ? "ASCENDANT" : hud.heat > 15 ? "ACTIVE" : "STABLE"} />
        </Suspense>
        {RENDER_PRESETS[settings.renderTier].distortion && <EffectComposer multisampling={0}><Bloom intensity={0.55} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur /><Vignette offset={0.3} darkness={0.55} /></EffectComposer>}
      </Canvas>
       <HUD hud={hud} tutorialActive={Boolean(tutorial && tutorial.step !== "VICTORY")} onMenu={() => setMenuOpen(true)} onStrategy={() => setStrategyOpen(true)} onGarage={() => setGarageOpen(true)} onAnalyze={() => setAnalysisOpen(true)} onOperations={setOperationsView} onInventory={() => setInventoryOpen(true)} onAtlas={() => setAtlasOpen(true)} />
       {inventoryOpen && <InventoryWindow progression={progression} onProgression={setProgression} onClose={() => setInventoryOpen(false)} />}
       {atlasOpen && <WorldAtlas markers={hud.markers} px={hud.px} pz={hud.pz} currentRegion={hud.region} phase={hud.phase} onClose={() => setAtlasOpen(false)} />}
      {awakening && <AwakeningOverlay run={awakening} onEvent={recordAwakening} />}
      {mission && <BrokenSignalOverlay mission={mission} onEvent={recordMission} />}
      {tutorial && <OnboardingSignal tutorial={tutorial} classId={cls} onOpenHub={() => { setTutorial(null); setOperationsView("ABILITIES"); }} />}
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
