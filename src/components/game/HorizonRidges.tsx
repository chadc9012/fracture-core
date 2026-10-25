import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RIDGES, ridgeProfile } from "@/game/horizon-ridges";
import { worldLight } from "@/game/world-light";

/** Two rings of distant mountain ridgeline (horizon-ridges.ts) that follow the player like the sky: drawn unfogged, hazed toward the
 * live horizon colour (stronger toward the base, as air thickens near the ground), the far ring paler than the near one. Two draws. */
const VERT = /* glsl */ `attribute float aUp; varying float vUp; void main(){ vUp = aUp; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `uniform vec3 uRock; uniform vec3 uHaze; uniform float uK; varying float vUp;
void main(){
  vec3 rock = uRock * (0.7 + 0.45 * vUp);                 // crests catch more light than the shadowed lower slopes
  float haze = clamp(uK * (1.0 - 0.35 * vUp), 0.0, 1.0);   // thicker air low down
  gl_FragColor = vec4(mix(rock, uHaze, haze), 1.0);
}`;

function ringGeometry(heights: number[], r: number): THREE.BufferGeometry {
  const n = heights.length, pos: number[] = [], up: number[] = [], idx: number[] = [];
  const maxH = Math.max(...heights);
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2, h = heights[k % n]!, x = Math.cos(a) * r, z = Math.sin(a) * r;
    pos.push(x, RIDGES.base, z, x, RIDGES.base + h, z);
    up.push(0, h / maxH);
  }
  for (let k = 0; k < n; k++) { const a = k * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aUp", new THREE.Float32BufferAttribute(up, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export function HorizonRidges({ playerRef }: { playerRef: React.RefObject<THREE.Object3D | null> }) {
  const geo = useMemo(() => ({ near: ringGeometry(ridgeProfile("near"), RIDGES.near), far: ringGeometry(ridgeProfile("far"), RIDGES.far) }), []);
  const mats = useMemo(() => {
    const make = (k: number) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, fog: false,
      uniforms: { uRock: { value: new THREE.Color("#4a5260") }, uHaze: { value: new THREE.Color("#a6cdf4") }, uK: { value: k } } });
    return { near: make(0.55), far: make(0.75) };
  }, []);
  useEffect(() => () => { Object.values(geo).forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); }, [geo, mats]);
  const root = useRef<THREE.Group>(null);
  useFrame(() => {
    const p = playerRef.current?.position; if (root.current && p) root.current.position.set(p.x, 0, p.z);
    const [r, g, b] = worldLight.horizon, night = worldLight.night;
    for (const m of [mats.near, mats.far]) {
      (m.uniforms["uHaze"]!.value as THREE.Color).setRGB(r, g, b);
      (m.uniforms["uRock"]!.value as THREE.Color).setRGB(0.29 * (1 - 0.8 * night), 0.32 * (1 - 0.8 * night), 0.38 * (1 - 0.75 * night));
    }
  });
  return (
    <group ref={root} name="horizon-ridges">
      {/* far ring first so the near range overlaps it */}
      <mesh geometry={geo.far} material={mats.far} frustumCulled={false} renderOrder={-4} />
      <mesh geometry={geo.near} material={mats.near} frustumCulled={false} renderOrder={-3} />
    </group>
  );
}
