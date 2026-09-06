import { Canvas } from "@react-three/fiber";
import { Suspense, useState } from "react";


import { REGIONS } from "@/game/world";
import { HUD } from "./HUD";
import { Scene, type HudState } from "./Scene";

const START = REGIONS.find((r) => r.id === "nexus")!;

const initial: HudState = {
  region: START.name,
  sub: START.sub,
  kind: START.kind,
  difficulty: START.difficulty,
  rules: START.rules,
  phase: "Day",
  clock: "05:16",
  speed: 0,
};

export function GameCanvas() {
  const [hud, setHud] = useState<HudState>(initial);

  return (
    <div className="fixed inset-0 bg-background">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [START.x, 34, START.z + 46], fov: 55, far: 900 }}
      >
        <color attach="background" args={["#bfe4f2"]} />
        <Suspense fallback={null}>
          <Scene onHud={setHud} />
        </Suspense>
      </Canvas>
      <HUD hud={hud} />
    </div>
  );
}
