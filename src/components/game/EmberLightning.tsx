import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { boltPath, emberStrike, stormLevel } from "@/game/ember-storm";
import { heightAt } from "@/game/terrain";
import { worldLight } from "@/game/world-light";

/** Ember Peaks' dry-lightning storm after dusk (ember-storm.ts): a white-hot forked bolt with a violet glow strikes the peaks every
 * few seconds and a flash light washes the slopes. Fat screen-space lines so a bolt still reads from across the region; ignores fog. */
export function EmberLightning() {
  const size = useThree((s) => s.size);
  const mats = useMemo(() => ({
    core: new LineMaterial({ color: 0xf4eeff, linewidth: 3.2, transparent: true, depthWrite: false, fog: false, toneMapped: false }),
    glow: new LineMaterial({ color: 0x9a6bff, linewidth: 13, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }),
    fork: new LineMaterial({ color: 0xd8c8ff, linewidth: 1.8, transparent: true, depthWrite: false, fog: false, toneMapped: false }),
  }), []);
  useEffect(() => { for (const m of Object.values(mats)) m.resolution.set(size.width, size.height); }, [mats, size]);
  const lines = useMemo(() => {
    const mk = (m: LineMaterial) => { const l = new Line2(new LineGeometry(), m); l.frustumCulled = false; l.visible = false; l.renderOrder = 5; return l; };
    return { glow: mk(mats.glow), core: mk(mats.core), forks: [mk(mats.fork), mk(mats.fork)] };
  }, [mats]);
  useEffect(() => () => { for (const m of Object.values(mats)) m.dispose(); [lines.glow, lines.core, ...lines.forks].forEach((l) => l.geometry.dispose()); }, [mats, lines]);
  const light = useRef<THREE.PointLight>(null);
  const shown = useRef(-1);
  useFrame(({ clock }) => {
    const s = emberStrike(clock.elapsedTime, stormLevel(worldLight.night));
    const all = [lines.glow, lines.core, ...lines.forks];
    if (light.current) light.current.intensity = s.on ? 2600 * s.k : 0;
    if (!s.on) { all.forEach((l) => (l.visible = false)); return; }
    if (shown.current !== s.seed) {
      shown.current = s.seed;
      const b = boltPath(s.seed, s.x, heightAt(s.x, s.z), s.z);
      const flat = (pts: [number, number, number][]) => pts.flat();
      lines.glow.geometry.setPositions(flat(b.main)); lines.core.geometry.setPositions(flat(b.main));
      b.forks.forEach((f, i) => lines.forks[i]!.geometry.setPositions(flat(f)));
      all.forEach((l) => l.computeLineDistances());
      light.current?.position.set(s.x, heightAt(s.x, s.z) + 60, s.z);
    }
    all.forEach((l) => (l.visible = true));
    mats.core.opacity = Math.min(1, s.k * 1.4); mats.fork.opacity = s.k; mats.glow.opacity = 0.35 * s.k;
  });
  return <group name="ember-lightning">
    <primitive object={lines.glow} /><primitive object={lines.core} />
    {lines.forks.map((l, i) => <primitive key={i} object={l} />)}
    <pointLight ref={light} color="#c8b0ff" intensity={0} distance={700} decay={1.1} />
  </group>;
}
