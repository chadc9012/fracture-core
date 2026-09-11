import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useState } from "react";

import { REGIONS } from "@/game/world";
import { walkHeight } from "@/game/terrain";
import { HUD } from "./HUD";
import { Scene, type HudState } from "./Scene";
import { StartMenu, type ClassId } from "./StartMenu";
import { SettingsWindow, DEFAULT_SETTINGS, type GameSettings } from "./SettingsWindow";

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
  evo: {
    identity: "Unproven Survivor",
    cycle: 0,
    nextIn: 24,
    playstyle: { combat: 0.2, logistics: 0.2, vehicles: 0.2, stealth: 0.2, support: 0.2 },
    skills: [],
    log: [],
  },
  inspector: null,
  weaponHeat: 0,
  overheated: false,
  loot: [],
  view: "third",
  aimLocked: false,
  ownership: REGIONS.map((r) => ({
    id: r.id,
    name: r.name,
    owner: r.id === "nexus" ? "vanguard" : r.kind === "fracture" || r.kind === "core" ? "overseer" : "syndicate",
  })),
};

export function GameCanvas() {
  const [hud, setHud] = useState<HudState>(initial);
  const [phase, setPhase] = useState<"orbit" | "world">("orbit");
  const [menuOpen, setMenuOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [cls, setCls] = useState<ClassId>("VANGUARD");
  const [last, setLast] = useState<{ credits: number; kills: number } | null>(null);

  const deploy = (picked: ClassId) => {
    setCls(picked);
    setMenuOpen(false);
    setPhase("world");
  };

  const toOrbit = () => {
    setLast({ credits: hud.credits, kills: hud.kills });
    setMenuOpen(false);
    setPhase("orbit");
  };

  if (phase === "orbit") {
    return (
      <>
        <StartMenu onDeploy={deploy} onSettings={() => setMenuOpen(true)} best={last} />
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
          <Scene onHud={setHud} settings={settings} playerClass={cls} />
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
