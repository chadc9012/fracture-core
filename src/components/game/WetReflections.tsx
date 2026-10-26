import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { WET, cityGlints, streak, wetness } from "@/game/wet-reflections";
import { walkHeight } from "@/game/terrain";
import { lampLevel, worldLight } from "@/game/world-light";
import { STREET_WET } from "./city-surface";
import { groundWeather } from "@/game/region-materials";

let streakTex: THREE.CanvasTexture | null = null;
/** a reflection streak: bright and tight at the far end (under the light), widening and fading toward the viewer, broken up by
 * the asphalt's ripples so it shimmers instead of reading as a painted stripe */
function streakTexture(): THREE.CanvasTexture | null {
  if (streakTex) return streakTex;
  if (typeof document === "undefined") return null;
  const W = 64, H = 256, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); if (!g) return null;
  const img = g.createImageData(W, H);
  let s = 41; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const rip = Array.from({ length: H }, () => 0.65 + rnd() * 0.35);
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);                                // 0 = under the light, 1 = nearest the viewer
    const along = Math.pow(1 - t, 1.6) * (t < 0.04 ? t / 0.04 : 1);
    const width = 0.18 + t * 0.32;
    for (let x = 0; x < W; x++) {
      const u = Math.abs(x / (W - 1) - 0.5) / width;
      const across = Math.exp(-u * u * 3.2);
      const v = along * across * rip[y]!;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * Math.min(1, v));
    }
  }
  g.putImageData(img, 0, 0);
  streakTex = new THREE.CanvasTexture(c); streakTex.colorSpace = THREE.SRGBColorSpace;
  return streakTex;
}

/** Light streaks on the wet city streets at night (wet-reflections.ts): one additive instanced batch, re-aimed at the camera a few
 * times a second, only for lights near the camera. */
export function WetReflections({ rainRef }: { rainRef?: React.RefObject<number> }) {
  const glints = useMemo(() => cityGlints().map((g) => ({ ...g, y: walkHeight(g.x, g.z) })), []);
  const colors = useMemo(() => glints.map((g) => new THREE.Color(g.color)), [glints]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: streakTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, fog: true }), []);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const last = useRef({ x: Infinity, z: Infinity, t: 0 });
  useFrame(({ camera, clock }) => {
    const m = ref.current; if (!m) return;
    // the streets stay wet after a shower and dry with the ground (Scene steps wetness.ts into groundWeather)
    const wet = wetness(worldLight.night, rainRef?.current ?? groundWeather.uRainWet.value);
    STREET_WET.value = wet * 0.85;
    const lit = lampLevel(worldLight.night) * wet;
    mat.opacity = lit * 0.7;
    m.visible = lit > 0.02;
    if (!m.visible) return;
    const cx = camera.position.x, cz = camera.position.z, L = last.current;
    if (Math.hypot(cx - L.x, cz - L.z) < 0.6 && clock.elapsedTime - L.t < 0.25) return;
    L.x = cx; L.z = cz; L.t = clock.elapsedTime;
    let n = 0;
    for (let i = 0; i < glints.length && n < WET.max; i++) {
      const g = glints[i]!, s = streak(cx, cz, g);
      if (!s) continue;
      o.position.set(s.cx, walkHeight(s.cx, s.cz) + 0.09, s.cz);
      o.rotation.set(0, s.yaw, 0);
      o.scale.set(g.w, 1, s.len);
      o.updateMatrix(); m.setMatrixAt(n, o.matrix); m.setColorAt(n, colors[i]!);
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, WET.max]} frustumCulled={false} renderOrder={3} />;
}
