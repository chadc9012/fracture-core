import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { softSprite } from "./softSprite";
import { waterNetwork } from "@/game/terrain";
import { NEUTRAL_WATER, REGION_WATER } from "@/game/water-style";
import { regionAt } from "@/game/world";
import type { River, Waterfall, Lake } from "@/game/rivers";

/**
 * Rivers, lakes and waterfalls from the traced water network (rivers.ts). Every surface sits on
 * a carved bed in heightAt, uses its own region's water colours, and animates in shaders only.
 */
const shared = { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0.4, 0.8, 0.3) } };

const flowVert = /* glsl */ `
  attribute float aSpeed; varying vec2 vUv; varying float vSpeed; varying vec3 vPosW;
  void main(){ vUv = uv; vSpeed = aSpeed; vec4 w = modelMatrix * vec4(position,1.0); vPosW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const flowFrag = /* glsl */ `
  uniform float uTime, uMurk, uRound; uniform vec3 uDeep, uShallow, uSun;
  varying vec2 vUv; varying float vSpeed; varying vec3 vPosW;
  float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
  void main(){
    // edge: 0 centre .. 1 bank (ribbons use uv.x across; lakes use the radial distance)
    float edge = uRound > 0.5 ? length(vUv - 0.5) * 2.0 : abs(vUv.x - 0.5) * 2.0;
    vec3 col = mix(uDeep, uShallow, smoothstep(0.2, 1.0, edge) * (1.0 - uMurk * 0.4));
    vec2 flowP = uRound > 0.5 ? vPosW.xz * 0.35 + uTime * 0.05 : vec2(vUv.x * 5.0, vUv.y * 0.6 - uTime * vSpeed * 0.6);
    float streak = vn(flowP * vec2(1.0, 3.0)) * vn(flowP * 2.3 + 7.0);
    col += vec3(0.85, 0.95, 1.0) * streak * 0.25 * (1.0 - uMurk);
    vec3 view = normalize(cameraPosition - vPosW);
    float spec = pow(clamp(dot(normalize(normalize(uSun) + view), vec3(0,1,0)), 0.0, 1.0), 120.0);
    col += vec3(1.0, 0.95, 0.85) * spec * (1.0 - uMurk * 0.8);
    // bank foam, and white water on rapids
    float rapid = smoothstep(1.4, 3.0, vSpeed);
    float foam = smoothstep(0.78, 1.0, edge) * (0.5 + 0.5 * sin(uTime * 1.6 + vUv.y * 2.0)) + rapid * smoothstep(0.45, 0.8, vn(flowP * 3.0));
    col = mix(col, vec3(0.93, 0.97, 1.0), clamp(foam, 0.0, 1.0) * 0.6 * (1.0 - uMurk * 0.5));
    float a = mix(0.8, 0.95, uMurk) * (1.0 - smoothstep(0.92, 1.0, edge) * 0.6);
    gl_FragColor = vec4(col, a);
  }`;

function styleFor(regionId: string) {
  return REGION_WATER[regionId] ?? NEUTRAL_WATER;
}

function flowMaterial(regionId: string, round: boolean) {
  const st = styleFor(regionId);
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uDeep: { value: new THREE.Color(st.deep) }, uShallow: { value: new THREE.Color(st.shallow) }, uMurk: { value: st.murk }, uRound: { value: round ? 1 : 0 } },
    vertexShader: flowVert, fragmentShader: flowFrag, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
}

function riverGeometry(r: River) {
  const pos: number[] = [], uv: number[] = [], spd: number[] = [], idx: number[] = [];
  let run = 0;
  r.points.forEach((p, i) => {
    const a = r.points[Math.max(0, i - 1)]!, b = r.points[Math.min(r.points.length - 1, i + 1)]!;
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len, nz = dx / len;
    if (i > 0) run += Math.hypot(p.x - r.points[i - 1]!.x, p.z - r.points[i - 1]!.z);
    const w = p.w * 1.08;
    for (const side of [-1, 1]) { pos.push(p.x + nx * w * side, p.s + 0.05, p.z + nz * w * side); uv.push(side < 0 ? 0 : 1, run / 4); spd.push(r.speed[i] ?? 0.6); }
    if (i > 0) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aSpeed", new THREE.Float32BufferAttribute(spd, 1));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}

const fallMat = (regionId: string) => {
  const st = styleFor(regionId);
  return new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uTint: { value: new THREE.Color(st.shallow) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uTint; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        float col = floor(vUv.x * 28.0);
        float sp = 1.6 + h(vec2(col, 1.0)) * 1.2;
        float s = fract(vUv.y * 3.0 + uTime * sp + h(vec2(col, 3.0)));
        float streak = smoothstep(0.0, 0.5, s) * (1.0 - smoothstep(0.5, 1.0, s));
        vec3 c = mix(uTint, vec3(0.95, 0.98, 1.0), 0.45 + streak * 0.5);
        float sides = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
        gl_FragColor = vec4(c, (0.55 + streak * 0.4) * sides);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
};

const foamMat = new THREE.ShaderMaterial({
  uniforms: { uTime: shared.uTime },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform float uTime; varying vec2 vUv;
    void main(){ vec2 c = vUv - 0.5; float r = length(c) * 2.0; float a = atan(c.y, c.x);
      float churn = 0.5 + 0.5 * sin(a * 9.0 + uTime * 3.0 - r * 12.0);
      gl_FragColor = vec4(vec3(0.95, 0.98, 1.0), (1.0 - smoothstep(0.3, 1.0, r)) * (0.45 + churn * 0.4)); }`,
  transparent: true, depthWrite: false,
});

function WaterfallMesh({ f, regionId }: { f: Waterfall; regionId: string }) {
  const mat = useMemo(() => fallMat(regionId), [regionId]);
  const height = Math.max(1, f.top - f.bottom);
  const yaw = Math.atan2(f.dirX, f.dirZ);
  // mist: a few soft puffs rising from the plunge pool
  const mist = useMemo(() => {
    const g = new THREE.BufferGeometry(); const p: number[] = [];
    for (let i = 0; i < 40; i++) p.push((Math.random() - 0.5) * f.w * 2, Math.random() * 3, (Math.random() - 0.5) * 3);
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); return g;
  }, [f.w]);
  return (
    <group position={[f.x, f.bottom, f.z]} rotation-y={yaw}>
      {/* the curtain leans slightly downstream from the lip */}
      <mesh material={mat} position={[0, height / 2, 0]} rotation-x={-0.12}>
        <planeGeometry args={[f.w * 2, height, 1, 1]} />
      </mesh>
      <mesh material={foamMat} rotation-x={-Math.PI / 2} position={[0, 0.12, 0.8]}>
        <circleGeometry args={[f.w * 1.6, 24]} />
      </mesh>
      <points geometry={mist}>
        <pointsMaterial map={softSprite("dot")} alphaTest={0.01} size={2.6} color="#eef6ff" transparent opacity={0.22} depthWrite={false} />
      </points>
    </group>
  );
}

export function Rivers({ sunRef }: { sunRef: React.RefObject<THREE.Vector3> }) {
  const net = useMemo(() => waterNetwork(), []);
  const rivers = useMemo(() => net.rivers.filter((r) => !r.dry).map((r) => ({ r, geo: riverGeometry(r), mat: flowMaterial(r.regionId, false) })), [net]);
  const lakes = useMemo(() => net.lakes.map((l: Lake) => ({ l, mat: flowMaterial(regionAt(l.x, l.z)?.id ?? "nexus", true) })), [net]);

  useFrame((_, raw) => {
    shared.uTime.value += Math.min(raw, 0.05);
    if (sunRef.current) shared.uSun.value.copy(sunRef.current).normalize();
  });

  return (
    <group>
      {rivers.map(({ r, geo, mat }) => (
        <group key={r.id}>
          <mesh geometry={geo} material={mat} />
          {r.falls.map((f, i) => <WaterfallMesh key={i} f={f} regionId={r.regionId} />)}
        </group>
      ))}
      {lakes.map(({ l, mat }, i) => (
        <mesh key={i} material={mat} rotation-x={-Math.PI / 2} position={[l.x, l.level + 0.04, l.z]}>
          <circleGeometry args={[l.r + 1.5, 40]} />
        </mesh>
      ))}
    </group>
  );
}
