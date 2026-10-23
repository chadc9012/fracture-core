import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { RACE_GATES } from "@/game/neon-districts";
import { walkHeight } from "@/game/terrain";
import { softSprite } from "./softSprite";

/** Steam rising from the street grates of Neon City's boulevard (trailer "dark Neon City": white columns curling up between the
 * towers, lit violet and magenta by the signs). One vent between each pair of race gates, so it is always on the street, never inside
 * a tower. Recycled soft sprites, no allocation per frame. */
const PER_VENT = 10, HEIGHT = 26, SPREAD = 6;
export function SteamVents({ c }: { c: { x: number; z: number } }) {
  const tex = useMemo(() => softSprite("dot"), []);
  const vents = useMemo(() => RACE_GATES.map((g, i) => {
    const n = RACE_GATES[(i + 1) % RACE_GATES.length]!;
    const x = c.x + (g.dx + n.dx) / 2 + 3, z = c.z + (g.dz + n.dz) / 2 - 2;
    return { x, z, y: walkHeight(x, z), tint: i % 2 ? new THREE.Color("#c9a8ff") : new THREE.Color("#ffc0ea") };
  }), [c.x, c.z]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    groups.current.forEach((g, v) => {
      if (!g) return;
      g.children.forEach((s, i) => {
        const k = (t * 0.07 + i / PER_VENT + v * 0.13) % 1;
        const size = 2 + k * SPREAD * 1.6;
        s.position.set(Math.sin(i * 2.3 + t * 0.4) * k * SPREAD * 0.4 + k * k * 4, k * HEIGHT, Math.cos(i * 1.7) * k * SPREAD * 0.3);
        s.scale.set(size, size, 1);
        ((s as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.min(1, k * 5) * (1 - k) * 0.45;
      });
    });
  });
  return <group name="steam-vents">
    {vents.map((v, n) => <group key={n} ref={(el) => { groups.current[n] = el; }} position={[v.x, v.y + 0.3, v.z]}>
      {Array.from({ length: PER_VENT }, (_, i) => <sprite key={i}><spriteMaterial map={tex ?? null} color={v.tint} transparent depthWrite={false} fog /></sprite>)}
    </group>)}
  </group>;
}
