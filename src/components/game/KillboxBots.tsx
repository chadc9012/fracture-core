import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { KillboxArena } from "@/game/killbox-arenas";
import type { BotsState } from "@/game/killbox-bots";
import { OPERATOR_HEIGHT } from "@/game/operators";
import { walkHeight } from "@/game/terrain";
import { OperatorModel, type ModelMotion } from "./OperatorModel";

/** Presentation for the Killbox bots (killbox-bots.ts): your ally bots as operators in your team's colourway (blue-white armour,
 * cyan trim, so they never read as rivals), each with a name tag, and every bot's shots as tracers — blue for your team, red for
 * theirs (the rival machines' own bodies are drawn by WarMachines). Reads the bot state only; never moves or damages anyone. */

export const ALLY_COLORS = { armor: "#c9d6e6", trim: "#38e8ff", cloth: "#1b2a3a" } as const;
const TRACER_LIFE = 0.08, TRACERS = 24;

function nameTag(name: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const x = c.getContext("2d")!;
  x.font = "bold 40px Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.lineWidth = 6; x.strokeStyle = "rgba(0,0,0,0.75)"; x.strokeText(name, 128, 32); x.fillStyle = "#7ff4ff"; x.fillText(name, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function KillboxBots({ bots, arena }: { bots: BotsState; arena: KillboxArena }) {
  const root = useRef<THREE.Group>(null), tracers = useRef<THREE.Group>(null);
  const motions = useMemo<ModelMotion[]>(() => bots.allies.map(() => ({ current: { phase: 0, intensity: 0, air: false, combat: false } })), [bots]);
  const tags = useMemo(() => bots.allies.map((b) => new THREE.SpriteMaterial({ map: nameTag(b.name), depthTest: false, transparent: true })), [bots]);
  const tracerMats = useMemo(() => ({ us: new THREE.MeshBasicMaterial({ color: "#7fe8ff", toneMapped: false }), them: new THREE.MeshBasicMaterial({ color: "#ff5a4a", toneMapped: false }) }), []);
  const unit = useMemo(() => new THREE.BoxGeometry(0.03, 0.03, 1).translate(0, 0, 0.5), []);
  const flash = useMemo(() => new THREE.MeshBasicMaterial({ color: "#fff2c0", transparent: true, opacity: 0.9, toneMapped: false }), []);
  const flashGeo = useMemo(() => new THREE.SphereGeometry(0.12, 8, 6), []);

  useFrame((_, dt) => {
    const g = root.current, tr = tracers.current; if (!g || !tr) return;
    bots.allies.forEach((b, i) => {
      const node = g.children[i] as THREE.Group | undefined; if (!node) return;
      node.visible = b.alive;
      if (!b.alive) return;
      const wx = arena.site.x + b.x, wz = arena.site.z + b.z;
      node.position.set(wx, walkHeight(wx, wz), wz);
      node.rotation.y = b.yaw;
      const mo = motions[i]!.current;
      mo.phase += b.speed * dt * 1.25; mo.intensity = Math.min(1, b.speed / 7); mo.combat = b.firing > 0;
      const f = node.getObjectByName("flash"); if (f) f.visible = b.firing > 0.05;
    });
    const live = bots.shots.filter((s) => bots.clock - s.at < TRACER_LIFE).slice(-TRACERS);
    tr.children.forEach((c, i) => {
      const s = live[i], m = c as THREE.Mesh;
      m.visible = !!s; if (!s) return;
      const ax = arena.site.x + s.from.x, az = arena.site.z + s.from.z, bx = arena.site.x + s.to.x, bz = arena.site.z + s.to.z;
      const ay = walkHeight(ax, az) + 1.4, by = walkHeight(bx, bz) + 1.2;
      m.position.set(ax, ay, az); m.lookAt(bx, by, bz); m.scale.set(1, 1, Math.hypot(bx - ax, by - ay, bz - az));
      m.material = s.team === "us" ? tracerMats.us : tracerMats.them;
    });
  });

  return (
    <group name="killbox-bots">
      <group ref={root}>
        {bots.allies.map((b, i) => (
          <group key={b.id}>
            <OperatorModel classId={b.cls} height={OPERATOR_HEIGHT} feetY={0} pose="locomotion" motion={motions[i]} color={ALLY_COLORS.armor} trim={ALLY_COLORS.trim} cloth={ALLY_COLORS.cloth} colorway fallback={null} />
            <sprite material={tags[i]!} position={[0, OPERATOR_HEIGHT + 0.55, 0]} scale={[1.6, 0.4, 1]} />
            <mesh name="flash" geometry={flashGeo} material={flash} position={[0.25, 1.35, 0.7]} visible={false} />
          </group>
        ))}
      </group>
      <group ref={tracers}>{Array.from({ length: TRACERS }, (_, i) => <mesh key={i} geometry={unit} material={tracerMats.us} visible={false} />)}</group>
    </group>
  );
}
