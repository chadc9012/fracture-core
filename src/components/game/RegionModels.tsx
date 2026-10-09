import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type * as THREE from "three";
import { REGIONS } from "@/game/world";
import { heightAt, slopeAt, WATER_LEVEL } from "@/game/terrain";
import { mulberry32 } from "@/game/useKeyboard";
import { distanceToRoad, LANE_HALF_WIDTH } from "@/game/lanes";
import { addObstacle } from "@/game/obstacles";
import { isReserved } from "@/game/verdant";
import boulder from "@/assets/polyhaven/namaqualand_boulder_02.glb.asset.json";
import mossRocks from "@/assets/polyhaven/rock_moss_set_01.glb.asset.json";
import deadTrunk from "@/assets/polyhaven/dead_tree_trunk.glb.asset.json";

/** Poly Haven (CC0) self-contained GLBs placed per region. Each model is HEAD-verified and isolated
 * in its own Suspense + error boundary so a failed asset can never suspend the world scene. */
const PLACEMENT: { url: string; regions: string[]; count: number; scale: [number, number]; seed: number }[] = [
  { url: boulder.url, regions: ["wastelands", "solara", "ember", "frostspire"], count: 3, scale: [2.2, 4], seed: 71 },
  { url: mossRocks.url, regions: ["veridan", "swamps", "frostspire"], count: 3, scale: [2.5, 4.5], seed: 83 },
  { url: deadTrunk.url, regions: ["swamps", "wastelands", "ember", "veridan"], count: 3, scale: [1.4, 2.2], seed: 97 },
];

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? null : this.props.children; }
}

function Placed({ url, regions, count, scale, seed }: (typeof PLACEMENT)[number]) {
  const { scene } = useGLTF(url);
  const spots = useMemo(() => {
    const rnd = mulberry32(seed);
    const out: { x: number; y: number; z: number; s: number; r: number }[] = [];
    for (const id of regions) {
      const region = REGIONS.find((r) => r.id === id);
      if (!region) continue;
      let n = 0, guard = count * 10;
      while (n < count && guard-- > 0) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * region.radius * 0.85;
        const x = region.x + Math.cos(a) * d, z = region.z + Math.sin(a) * d, y = heightAt(x, z);
        if (y < WATER_LEVEL + 0.3 || slopeAt(x, z) > 0.6 || distanceToRoad(x, z) < LANE_HALF_WIDTH + 2) continue;
        if (Math.hypot(x - region.x, z - (region.z + 12)) < 16) continue;
        if (id === "veridan" && isReserved(x, z, 2)) continue; // keep the mission trail and clearings open
        out.push({ x, y, z, s: scale[0] + rnd() * (scale[1] - scale[0]), r: rnd() * Math.PI * 2 });
        n++;
      }
    }
    return out;
  }, [regions, count, scale, seed]);
  useEffect(() => { for (const p of spots) addObstacle("rock", p.x, p.z, 0.9 * p.s, 200, 1.4); }, [spots]);
  // Poly Haven "sets" ship several variants side by side; one clone must not draw all of them.
  const variant = useMemo(() => (scene.children.length > 1 ? scene.children[0]! : scene), [scene]);
  const clones = useMemo(() => spots.map(() => {
    const c = variant.clone(true);
    c.position.set(0, 0, 0);
    c.traverse((o) => { o.castShadow = false; o.receiveShadow = true; });
    return c;
  }), [variant, spots]);
  // Each model is ~100k triangles, so only the ones near the camera are drawn at all, and only the
  // closest few cast shadows. Re-checked a few times a second; hysteresis stops edge flicker.
  const group = useRef<THREE.Group>(null);
  const clock = useRef(0);
  useFrame(({ camera }, dt) => {
    clock.current += dt;
    if (clock.current < 0.3) return;
    clock.current = 0;
    const g = group.current;
    if (!g) return;
    g.children.forEach((node, i) => {
      const p = spots[i];
      if (!p) return;
      const d = Math.hypot(camera.position.x - p.x, camera.position.z - p.z);
      const show = node.visible ? d < SHOW_RADIUS * 1.1 : d < SHOW_RADIUS;
      if (node.visible !== show) node.visible = show;
      const cast = d < SHADOW_RADIUS;
      node.traverse((o) => { if (o.castShadow !== cast) o.castShadow = cast; });
    });
  });
  return <group ref={group}>{spots.map((p, i) => <primitive key={i} object={clones[i]!} position={[p.x, p.y - 0.2, p.z]} rotation-y={p.r} scale={p.s} visible={false} />)}</group>;
}

const SHOW_RADIUS = 70;
const SHADOW_RADIUS = 35;

const verified = new Map<string, boolean>();

function Verified(props: (typeof PLACEMENT)[number]) {
  const [ok, setOk] = useState(verified.get(props.url) ?? false);
  useEffect(() => {
    if (verified.has(props.url)) return;
    fetch(props.url, { method: "HEAD" }).then((r) => { verified.set(props.url, r.ok); setOk(r.ok); }).catch(() => verified.set(props.url, false));
  }, [props.url]);
  if (!ok) return null;
  return <Quiet><Suspense fallback={null}><Placed {...props} /></Suspense></Quiet>;
}

export function RegionModels() {
  return <>{PLACEMENT.map((p) => <Verified key={p.url} {...p} />)}</>;
}
