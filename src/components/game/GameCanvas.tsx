import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useState } from "react";

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
  weaponHeat: 0,
  overheated: false,
  loot: [],
  view: "third",
  aimLocked: false,
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
  const [cls, setCls] = useState<ClassId>("TITAN");
  const [subclass, setSubclass] = useState<SubclassId>("SHIELD_TITAN");
  const [appearance, setAppearance] = useState<AppearanceId>("RANGER");
  const [vehicleId, setVehicleId] = useState<VehicleId>("scrap-interceptor");
  const [vehicleUnlocked, setVehicleUnlocked] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [operationsView, setOperationsView] = useState<"DUNGEONS" | "ARSENAL" | "ABILITIES" | null>(null);
  const [last, setLast] = useState<{ credits: number; kills: number } | null>(null);

  const deploy = (deployment: Deployment) => {
    setCls(deployment.classId);
    setSubclass(deployment.subclassId);
    setAppearance(deployment.appearanceId);
    setVehicleUnlocked(false);
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

  const toOrbit = () => {
    setLast({ credits: hud.credits, kills: hud.kills });
    setMenuOpen(false);
    setPhase("title");
  };

  if (phase === "title") {
    return (
      <>
        {!menuOpen && (
          <TitleScreen
            canContinue={last !== null}
            onContinue={() => setPhase(last ? "world" : "loadout")}
            onNewGame={() => setPhase("loadout")}
            onLoadout={() => setPhase("loadout")}
            onSettings={() => setMenuOpen(true)}
          />
        )}
        {menuOpen && <SettingsWindow settings={settings} onChange={setSettings} onClose={() => setMenuOpen(false)} onOrbit={() => setMenuOpen(false)} />}
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
            onChange={setSettings}
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
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{
          position: [START.x, walkHeight(START.x, START.z) + 30, START.z + 46],
          fov: 55,
          far: 1200,
        }}
      >
        <color attach="background" args={["#bfe4f2"]} />
        <Suspense fallback={null}>
          <Scene onHud={setHud} settings={settings} playerClass={cls} subclassId={subclass} appearanceId={appearance} vehicleId={vehicleId} vehicleUnlocked={vehicleUnlocked} armorState={hud.hp < 35 ? "FRACTURE" : hud.heat > 65 ? "ASCENDANT" : hud.heat > 15 ? "ACTIVE" : "STABLE"} />
        </Suspense>

      </Canvas>
      <HUD hud={hud} onMenu={() => setMenuOpen(true)} onStrategy={() => setStrategyOpen(true)} onGarage={() => setGarageOpen(true)} onOperations={setOperationsView} />
      {strategyOpen && <RaidStrategyPanel onClose={() => setStrategyOpen(false)} />}
      {operationsView && <OperationsHub initialView={operationsView} onClose={() => setOperationsView(null)} />}
      {hud.firstMissionComplete && !vehicleUnlocked && <div className="fixed inset-0 z-40 grid place-items-center bg-background/80 p-4 backdrop-blur-md"><section className="w-full max-w-3xl border border-primary bg-card p-6"><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Mission 01 complete · Garage assistant online</p><h2 className="mt-2 text-2xl font-semibold">Choose your first vehicle</h2><p className="mt-2 text-sm text-muted-foreground">This frame becomes your permanent world-travel unlock.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{STARTER_VEHICLES.map((vehicle) => <Button key={vehicle.id} variant="outline" onClick={() => { setVehicleId(vehicle.id); setVehicleUnlocked(true); }} className="h-auto min-h-36 items-start justify-start rounded-none p-4 text-left whitespace-normal"><span><span className="font-mono text-base">{vehicle.name}</span><span className="mt-2 block text-xs text-muted-foreground">{vehicle.role}</span></span></Button>)}</div></section></div>}
      {garageOpen && <div className="fixed inset-0 z-40 grid place-items-center bg-background/80 p-4 backdrop-blur-md"><section className="max-h-[85vh] w-full max-w-4xl overflow-y-auto border border-border bg-card p-6"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Garage assistant</p><h2 className="mt-2 text-2xl">Vehicle registry</h2></div><Button variant="outline" onClick={() => setGarageOpen(false)}>Back</Button></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{VEHICLES.map((vehicle) => { const unlocked = vehicleUnlocked && vehicle.id === vehicleId; return <div key={vehicle.id} className={`border p-3 ${unlocked ? "border-primary" : "border-border"}`}><p className="font-mono text-sm">{vehicle.name}</p><p className="mt-1 text-[10px] uppercase text-muted-foreground">{unlocked ? "Unlocked · summon with V" : vehicleAcquisition(vehicle).replace("_", " ")}</p></div>; })}</div></section></div>}
      {menuOpen && (
        <SettingsWindow
          settings={settings}
          onChange={setSettings}
          onClose={() => setMenuOpen(false)}
          onOrbit={toOrbit}
        />
      )}
    </div>
  );
}
