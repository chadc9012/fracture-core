import { Canvas } from "@react-three/fiber";
import { Suspense, useState } from "react";

import { REGIONS } from "@/game/world";
import { HUD } from "./HUD";
import { Scene, type HudState } from "./Scene";

const initial: HudState = {
  region: REGIONS[0].name,
  sub: REGIONS[0].sub,
  kind: REGIONS[0].kind,
  difficulty: REGIONS[0].difficulty,
  rules: REGIONS[0].rules,
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
        camera={{ position: [REGIONS[0].x, 26, REGIONS[0].z + 40], fov: 55, far: 900 }}
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
