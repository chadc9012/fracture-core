import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { skyParams } from "@/game/sky-dome";
import type { SkyEnv } from "./CloudLayer";
import type { RenderTier } from "@/game/performance";

const VERT = /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** Procedural sky layer drawn over the atmospheric Sky: a sun disc with glow, lit volumetric-looking cumulus + high cirrus, stars and a Milky Way band.
 * The moon, halo and the extra starfield stay in SkyBodies. Everything is analytic (no textures), the dome is one draw call, and cloud octaves drop
 * on LOW so integrated GPUs keep their frame budget. Behind-terrain pixels are rejected by the depth test before the shader runs. */
const frag = (octaves: number) => /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 sunDir, sunColor, cloudLit, cloudShade;
uniform float time, cover, night, sunStrength, starStrength, milkyWay;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<${octaves};i++){ s += vn(p)*a; p = p*2.03 + 7.1; a *= 0.5; } return s; }
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }

void main(){
  vec3 d = normalize(vDir);
  if (d.y < -0.02) discard;
  vec3 col = vec3(0.0); float alpha = 0.0;

  // ---- stars + Milky Way (night only) ----
  if (starStrength > 0.01 || milkyWay > 0.01) {
    vec3 sp = d * 220.0; vec3 cell = floor(sp); vec3 f = fract(sp) - 0.5;
    float r = h31(cell);
    float star = step(0.985, r) * smoothstep(0.35, 0.0, length(f)) * (0.5 + 0.5 * h31(cell + 7.0));
    float tw = 0.75 + 0.25 * sin(time * 2.0 + r * 40.0);
    vec3 axis = normalize(vec3(0.35, 0.8, 0.45));
    float band = exp(-pow(dot(d, axis) * 4.5, 2.0));
    float dust = fbm(d.xz * 9.0 / max(0.25, abs(d.y) + 0.35) + d.y * 3.0);
    vec3 mw = mix(vec3(0.22, 0.26, 0.5), vec3(0.75, 0.55, 0.6), dust) * band * (0.35 + dust * 0.9);
    col += (vec3(0.9, 0.95, 1.0) * star * tw * 1.4) * starStrength + mw * milkyWay * 0.6;
    alpha = max(alpha, clamp(star * starStrength + length(mw) * milkyWay * 0.5, 0.0, 1.0));
  }

  // ---- sun disc + glow ----
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  float disc = smoothstep(0.99935, 0.99975, sd);
  float glow = pow(sd, 90.0) * 0.55 + pow(sd, 10.0) * 0.18 + pow(sd, 3.0) * 0.06;
  col += sunColor * (disc * 4.0 + glow) * sunStrength;
  alpha = max(alpha, clamp((disc + glow * 0.8) * sunStrength, 0.0, 1.0));

  // ---- clouds: a layer projected onto a plane overhead, lit from the sun side ----
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.14) * 1.35 + vec2(time * 0.012, time * 0.006);
    float base = fbm(uv * 0.9);
    float dens = smoothstep(1.0 - cover, 1.0 - cover + 0.28, base);
    // second sample shifted toward the sun: thinner on the sun side means a bright rim, thicker means shadow
    vec2 toSun = normalize(sunDir.xz + 1e-4) * 0.09;
    float base2 = fbm((uv + toSun) * 0.9);
    float thick = clamp((base - base2) * 5.0 + 0.5, 0.0, 1.0);
    float depth = clamp(dens * 1.4, 0.0, 1.0);
    vec3 cc = mix(cloudLit, cloudShade, clamp(thick * 0.8 + depth * 0.45 - 0.2, 0.0, 1.0));
    cc += sunColor * pow(sd, 6.0) * 0.5 * (1.0 - thick) * sunStrength;       // silver lining toward the sun
    // thin high cirrus streaks
    float cir = smoothstep(0.55, 0.85, fbm(vec2(uv.x * 0.35, uv.y * 2.4) + 3.0)) * 0.35;
    float fade = smoothstep(0.0, 0.2, d.y);                                 // clouds melt into the horizon haze
    float ca = clamp(dens + cir * (1.0 - dens), 0.0, 1.0) * fade * (1.0 - night * 0.55);
    col = mix(col, mix(cc, cloudLit, cir * (1.0 - dens)), ca);
    alpha = max(alpha, ca);
  }
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`;

export function SkyDome({ sunDirRef, envRef, playerRef, tier }: { sunDirRef: React.RefObject<THREE.Vector3>; envRef: React.RefObject<SkyEnv>; playerRef: React.RefObject<THREE.Object3D | null>; tier: RenderTier }) {
  const root = useRef<THREE.Group>(null!);
  const octaves = tier === "LOW" ? 3 : tier === "MEDIUM" ? 4 : 5;
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag(octaves),
    uniforms: {
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Vector3(1, 0.95, 0.86) }, cloudLit: { value: new THREE.Vector3(1, 1, 1) }, cloudShade: { value: new THREE.Vector3(0.5, 0.55, 0.7) },
      time: { value: 0 }, cover: { value: 0.4 }, night: { value: 0 }, sunStrength: { value: 1 }, starStrength: { value: 0 }, milkyWay: { value: 0 },
    },
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
  }), [octaves]);

  useFrame(({ clock }) => {
    const sd = sunDirRef.current, env = envRef.current;
    const p = playerRef.current?.position;
    if (root.current && p) root.current.position.set(p.x, 0, p.z);
    const params = skyParams(sd?.y ?? 0.6, env?.cloud ?? 0);
    const u = material.uniforms as Record<string, { value: unknown }>;
    if (sd) (u["sunDir"]!.value as THREE.Vector3).copy(sd);
    (u["sunColor"]!.value as THREE.Vector3).set(...params.sunColor);
    (u["cloudLit"]!.value as THREE.Vector3).set(...params.cloudLit);
    (u["cloudShade"]!.value as THREE.Vector3).set(...params.cloudShade);
    u["time"]!.value = clock.elapsedTime;
    u["cover"]!.value = params.cover;
    u["night"]!.value = params.night;
    u["sunStrength"]!.value = params.sunStrength;
    u["starStrength"]!.value = params.starStrength;
    u["milkyWay"]!.value = params.milkyWay;
  });

  return (
    <group ref={root}>
      <mesh material={material} frustumCulled={false} renderOrder={-5}><sphereGeometry args={[3000, 40, 20]} /></mesh>
    </group>
  );
}
