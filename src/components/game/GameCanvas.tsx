import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useState } from "react";

import type { AppearanceId, ClassId } from "@/game/loadout";
import { REGIONS } from "@/game/world";
import { walkHeight } from "@/game/terrain";
import type { VehicleId } from "@/game/vehicles";
import { HUD } from "./HUD";
import { Scene, type HudState } from "./Scene";
import { StartMenu, type Deployment } from "./StartMenu";
import { SettingsWindow, DEFAULT_SETTINGS, type GameSettings } from "./SettingsWindow";
import { TitleScreen } from "./TitleScreen";

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
  playerClass: "VANGUARD",
  vehicleName: "Scrap-Built Interceptor",
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
  const [cls, setCls] = useState<ClassId>("VANGUARD");
  const [appearance, setAppearance] = useState<AppearanceId>("RANGER");
  const [vehicleId, setVehicleId] = useState<VehicleId>("scrap-interceptor");
  const [last, setLast] = useState<{ credits: number; kills: number } | null>(null);

  const deploy = (deployment: Deployment) => {
    setCls(deployment.classId);
    setAppearance(deployment.appearanceId);
    setVehicleId(deployment.vehicleId);
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
          <Scene onHud={setHud} settings={settings} playerClass={cls} appearanceId={appearance} vehicleId={vehicleId} />
        </Suspense>

      </Canvas>
      <HUD hud={hud} onMenu={() => setMenuOpen(true)} />
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
