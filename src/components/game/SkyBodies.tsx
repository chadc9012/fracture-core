import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { moonAngle, starVisibility, lunarIllumination } from "@/game/celestial";
import type { SkyEnv } from "./CloudLayer";

const MOON_R = 520;
const STAR_R = 900;

/** Moon lit by the real sun direction (so phases come for free), a soft halo, and a starfield
 * that fades with darkness and cloud. Reads shared refs every frame; never re-renders React. */
export function SkyBodies({ timeRef, sunDirRef, envRef, playerRef }: { timeRef: React.RefObject<number>; sunDirRef: React.RefObject<THREE.Vector3>; envRef: React.RefObject<SkyEnv>; playerRef: React.RefObject<THREE.Object3D | null> }) {
  const moon = useRef<THREE.Mesh>(null!);
  const halo = useRef<THREE.Sprite>(null!);
  const stars = useRef<THREE.Points>(null!);
  const root = useRef<THREE.Group>(null!);

  const moonMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: new THREE.Vector3(0, 1, 0) }, fade: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 sunDir; uniform float fade; varying vec3 vN; varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){
        vec3 n = normalize(vP);
        // soft maria: low-frequency blotches darken the disc
        float m = smoothstep(0.35, 0.8, h(floor(n * 3.0))) * 0.25 + smoothstep(0.5, 0.95, h(floor(n * 7.0))) * 0.12;
        float lit = smoothstep(-0.05, 0.2, dot(normalize(vN), normalize(sunDir)));
        vec3 col = vec3(0.93, 0.95, 1.0) * (1.0 - m);
        // the dark limb still faintly shows (earthshine)
        gl_FragColor = vec4(col * (0.06 + lit * 1.1), fade);
      }`,
    transparent: true, depthWrite: false, fog: false,
  }), []);

  const haloTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d")!; const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    gr.addColorStop(0, "rgba(220,232,255,0.55)"); gr.addColorStop(1, "rgba(220,232,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);

  const starGeo = useMemo(() => {
    let s = 9001; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const n = 2400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      // bias toward a band so a faint "galaxy" lane appears
      const band = rnd() < 0.35 ? (rnd() - 0.5) * 0.25 : u;
      pos.set([Math.cos(a) * r * STAR_R, Math.abs(band) * STAR_R + 20, Math.sin(a) * r * STAR_R], i * 3);
      const warm = rnd(); const b = 0.5 + rnd() * 0.5;
      col.set([b * (0.85 + warm * 0.15), b * 0.9, b * (1 - warm * 0.2)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  useFrame(() => {
    const t = timeRef.current ?? 0;
    const env = envRef.current;
    const cloud = env?.cloud ?? 0;
    const sd = sunDirRef.current;
    const p = playerRef.current?.position;
    if (root.current && p) root.current.position.set(p.x, 0, p.z); // sky bodies stay at infinity
    const a = moonAngle(t);
    const mx = -Math.cos(a) * MOON_R, my = Math.sin(a) * MOON_R * 0.8, mz = -200;
    if (moon.current) {
      moon.current.position.set(mx, my, mz);
      moon.current.visible = my > -30;
      if (sd) moonMat.uniforms["sunDir"]!.value.copy(sd);
      moonMat.uniforms["fade"]!.value = Math.max(0.15, 1 - cloud * 0.85);
    }
    if (halo.current) {
      halo.current.position.set(mx, my, mz);
      const night = sd ? Math.max(0, -sd.y * 3) : 0;
      (halo.current.material as THREE.SpriteMaterial).opacity = Math.min(1, night) * lunarIllumination(t) * (1 - cloud) * 0.9;
      halo.current.visible = my > 0;
    }
    if (stars.current) {
      const v = starVisibility(sd?.y ?? 1, cloud);
      const m = stars.current.material as THREE.PointsMaterial;
      m.opacity = v;
      stars.current.visible = v > 0.01;
      stars.current.rotation.y = t * 0.05; // slow sky rotation through the night
    }
  });

  return (
    <group ref={root}>
      <points ref={stars} geometry={starGeo} frustumCulled={false}>
        <pointsMaterial size={1.6} sizeAttenuation={false} vertexColors transparent depthWrite={false} fog={false} />
      </points>
      {haloTex && <sprite ref={halo} scale={[150, 150, 1]}><spriteMaterial map={haloTex} transparent depthWrite={false} fog={false} blending={THREE.AdditiveBlending} /></sprite>}
      <mesh ref={moon} material={moonMat} frustumCulled={false}><sphereGeometry args={[22, 32, 24]} /></mesh>
    </group>
  );
}
