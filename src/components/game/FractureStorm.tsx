import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { STORM, stormDebris, stormGlow, stormStrike } from "@/game/fracture-storm";
import { organicRock } from "@/game/organic-geometry";
import type { SkyEnv } from "./CloudLayer";

/** The Fracture Storm (fracture-storm.ts): a vast flat lens of violet storm over the city skylines, its rim crackling with
 * lightning, with a strike forking down toward the towers every few seconds. One additive annulus (shader) and one pooled line. */
const FRAG = /* glsl */ `
uniform float uTime; uniform float uGlow; uniform float uFlash;
varying vec2 vUv;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  // a vast flat lens of storm hanging over the city (trailer reference): filled, rippling violet, with a jagged white-hot rim
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p), a = atan(p.y, p.x);
  float edge = 0.9 + (fbm(vec2(a * 5.0, uTime * 0.15)) - 0.5) * 0.12;
  float body = smoothstep(edge + 0.01, edge - 0.05, r);
  vec2 q = vec2(a * 2.0 + uTime * 0.04, r * 6.0 - uTime * 0.07);
  float ripple = fbm(q + fbm(q * 1.9 + uTime * 0.05));
  float vein = pow(1.0 - abs(fbm(vec2(a * 7.0, r * 18.0 + uTime * 0.5)) * 2.0 - 1.0), 14.0);
  float rim = exp(-pow((r - edge) * 34.0, 2.0)) * (0.65 + 0.35 * n2(vec2(a * 40.0, uTime * 3.0)));
  float spark = step(0.985, hh(vec2(floor(a * 90.0), floor(uTime * 12.0)))) * exp(-pow((r - edge - 0.02) * 20.0, 2.0));
  vec3 violet = vec3(0.5, 0.26, 0.95), hot = vec3(0.95, 0.86, 1.0);
  vec3 col = violet * (0.3 + ripple * 0.7) * body * 0.7 + hot * (rim * 1.8 + spark * 2.0 + vein * body * 0.35) + violet * uFlash * body * 0.6;
  float alpha = body * (0.12 + ripple * 0.3 + vein * 0.25) + rim + spark;
  gl_FragColor = vec4(col * uGlow, clamp(alpha * uGlow, 0.0, 1.0));
}`;
const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SEGMENTS = 18;

export function FractureStorm({ envRef }: { envRef: React.RefObject<SkyEnv> }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGlow: { value: 1 }, uFlash: { value: 0 }, uInner: { value: 0 } },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide, toneMapped: false,
  }), []);
  const ring = useRef<THREE.Mesh>(null);
  const bolt = useMemo(() => {
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SEGMENTS * 3), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#e4d2ff", transparent: true, opacity: 1, fog: false, toneMapped: false }));
    l.frustumCulled = false; l.visible = false; return l;
  }, []);
  const light = useRef<THREE.PointLight>(null);
  // drifting debris field: one instanced mesh, violet rim glow so the chunks read against the night sky
  const debris = useMemo(() => stormDebris(), []);
  const rockGeo = useMemo(() => organicRock(1, 77, 1), []);
  const rockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2b2733", roughness: 0.95, emissive: "#5a2bc0", emissiveIntensity: 0.12, flatShading: true, fog: false }), []);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, env = envRef.current;
    const strike = stormStrike(t);
    const m = rocks.current;
    if (m) {
      debris.forEach((d, i) => {
        const a = d.a + t * STORM.spin * 0.6;
        tmp.position.set(STORM.x + Math.cos(a) * d.r, d.y + Math.sin(t * 0.2 + i) * 2, STORM.z + Math.sin(a) * d.r);
        tmp.rotation.set(d.tilt + t * d.spin, t * d.spin * 0.7, 0); tmp.scale.setScalar(d.s); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
      rockMat.emissiveIntensity = 0.08 + (strike.on ? strike.k * 0.6 : 0) + (env?.night ?? 0) * 0.1;
    }
    mat.uniforms["uTime"]!.value = t;
    mat.uniforms["uGlow"]!.value = stormGlow(env?.night ?? 0, (env?.cloud ?? 0) > 0.75);
    mat.uniforms["uFlash"]!.value = strike.on ? strike.k : 0;
    if (ring.current) ring.current.rotation.z = t * STORM.spin;
    bolt.visible = strike.on;
    if (light.current) light.current.intensity = strike.on ? 900 * strike.k : 0;
    if (!strike.on) return;
    // fork from the inner rim down toward the skyline, re-jittered every frame while it flashes
    const pos = bolt.geometry.getAttribute("position") as THREE.BufferAttribute;
    const sx = STORM.x + Math.cos(strike.angle) * STORM.outer * 0.88, sz = STORM.z + Math.sin(strike.angle) * STORM.outer * 0.88;
    const ex = STORM.x + Math.cos(strike.angle) * STORM.outer * 0.6, ez = STORM.z + Math.sin(strike.angle) * STORM.outer * 0.6;
    for (let i = 0; i < SEGMENTS; i++) {
      const f = i / (SEGMENTS - 1), j = (1 - Math.abs(f * 2 - 1)) * 14;
      pos.setXYZ(i, sx + (ex - sx) * f + (Math.random() - 0.5) * j, STORM.y - (STORM.y - 60) * f, sz + (ez - sz) * f + (Math.random() - 0.5) * j);
    }
    pos.needsUpdate = true;
    (bolt.material as THREE.LineBasicMaterial).opacity = strike.k;
    if (light.current) light.current.position.set(ex, 90, ez);
  });
  return <group name="fracture-storm">
    <mesh ref={ring} material={mat} position={[STORM.x, STORM.y, STORM.z]} rotation-x={Math.PI / 2} frustumCulled={false}><circleGeometry args={[STORM.outer, 96]} /></mesh>
    <primitive object={bolt} />
    <instancedMesh ref={rocks} args={[rockGeo, rockMat, debris.length]} frustumCulled={false} />
    <pointLight ref={light} color="#b78aff" intensity={0} distance={420} decay={1.2} />
  </group>;
}
