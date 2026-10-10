import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SkyEnv } from "./CloudLayer";

/** Live (eased) signature-effect state written by Scene from sky-effects.ts. */
export type SkyFxLive = { color: THREE.Color; density: number; fall: number; drift: number; size: number; glow: number; aurora: number };

const COUNT = 900;
const BOX = new THREE.Vector3(70, 34, 70);

/**
 * Regional signature sky: an airborne particle layer around the player (ashfall, spores,
 * dust, pollen, ice glitter, fireflies) and an aurora curtain. Everything animates in shaders
 * from shared refs, so it never re-renders React or touches per-particle JS.
 */
export function SkyFx({ fxRef, envRef, playerRef }: { fxRef: React.RefObject<SkyFxLive>; envRef: React.RefObject<SkyEnv>; playerRef: React.RefObject<THREE.Object3D | null> }) {
  const aurora = useRef<THREE.Mesh>(null!);
  const pts = useRef<THREE.Points>(null!);

  const geo = useMemo(() => {
    let s = 4242; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const pos = new Float32Array(COUNT * 3), seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) { pos.set([rnd() * BOX.x, rnd() * BOX.y, rnd() * BOX.z], i * 3); seed[i] = rnd(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return g;
  }, []);

  const pMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: BOX.clone() },
      uColor: { value: new THREE.Color() }, uTint: { value: new THREE.Color(1, 1, 1) },
      uDensity: { value: 0 }, uFall: { value: 0 }, uDrift: { value: 0 }, uSize: { value: 2 }, uGlow: { value: 0 },
    },
    vertexShader: `attribute float seed; uniform float uTime, uFall, uDrift, uSize, uDensity; uniform vec3 uCenter, uBox;
      varying float vA; varying float vSeed;
      void main(){
        vec3 p = position;
        p.y -= uFall * uTime * (0.7 + seed * 0.6);
        p.x += sin(uTime * (0.3 + seed) + seed * 40.0) * uDrift + uTime * uDrift * 0.4;
        p.z += cos(uTime * (0.25 + seed * 0.8) + seed * 17.0) * uDrift;
        vec3 origin = uCenter - uBox * vec3(0.5, 0.3, 0.5);
        vec3 w = origin + mod(p - origin, uBox);
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        float dist = -mv.z;
        vA = step(seed, uDensity) * smoothstep(1.0, 4.0, dist) * (1.0 - smoothstep(25.0, 38.0, dist));
        vSeed = seed;
        gl_PointSize = uSize * (1.0 + 6.0 / max(dist, 1.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor, uTint; uniform float uGlow, uTime; varying float vA; varying float vSeed;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5 || vA <= 0.0) discard;
        float pulse = mix(1.0, 0.5 + 0.5 * sin(uTime * 2.5 + vSeed * 60.0), uGlow);
        vec3 col = mix(uColor * uTint, uColor * 1.6, uGlow);
        gl_FragColor = vec4(col, (1.0 - r * 2.0) * vA * pulse * 0.85);
      }`,
    transparent: true, depthWrite: false,
  }), []);

  const aMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uStrength: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime, uStrength; varying vec2 vUv;
      void main(){
        float x = vUv.x * 9.0;
        float fold = sin(x * 2.1 + sin(x * 0.7 + uTime * 0.12) * 2.4 + uTime * 0.05);
        float rays = 0.55 + 0.45 * sin(vUv.x * 160.0 + fold * 6.0 + uTime * 0.4);
        float band = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
        float curtain = smoothstep(-0.2, 0.9, fold) * band * rays;
        vec3 low = vec3(0.25, 1.0, 0.55), mid = vec3(0.2, 0.85, 0.75), high = vec3(0.6, 0.35, 0.95);
        vec3 col = mix(mix(low, mid, smoothstep(0.1, 0.45, vUv.y)), high, smoothstep(0.5, 0.95, vUv.y));
        float edges = smoothstep(0.0, 0.15, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x));
        gl_FragColor = vec4(col * curtain, 1.0) * uStrength * edges * 0.7;
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  }), []);

  useFrame((state) => {
    const fx = fxRef.current; if (!fx) return;
    const t = state.clock.elapsedTime;
    const p = playerRef.current?.position;
    const u = pMat.uniforms;
    u["uTime"]!.value = t;
    if (p) u["uCenter"]!.value.copy(p);
    u["uColor"]!.value.copy(fx.color);
    if (envRef.current) u["uTint"]!.value.copy(envRef.current.tint);
    u["uDensity"]!.value = fx.density; u["uFall"]!.value = fx.fall; u["uDrift"]!.value = fx.drift;
    u["uSize"]!.value = fx.size; u["uGlow"]!.value = fx.glow;
    if (pts.current) pts.current.visible = fx.density > 0.01;
    aMat.uniforms["uTime"]!.value = t;
    aMat.uniforms["uStrength"]!.value = fx.aurora;
    if (aurora.current) {
      aurora.current.visible = fx.aurora > 0.01;
      if (p) aurora.current.position.set(p.x, 240, p.z);
    }
  });

  return (
    <>
      <points ref={pts} geometry={geo} material={pMat} frustumCulled={false} />
      {/* curtain arc low over the northern sky (toward the Frostspire peaks) */}
      <mesh ref={aurora} material={aMat} frustumCulled={false}>
        <cylinderGeometry args={[620, 620, 260, 96, 1, true, Math.PI * 0.6, Math.PI * 0.8]} />
      </mesh>
    </>
  );
}
