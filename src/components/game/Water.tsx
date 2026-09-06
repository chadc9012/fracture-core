import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { WATER_LEVEL } from "@/game/terrain";

/**
 * Animated ocean / lake surface: gerstner-ish sine waves in the vertex shader,
 * fresnel sky blend plus a specular highlight from the sun in the fragment
 * shader. `sunDirection` is updated by the day/night cycle.
 */
export function Water({ size, sunRef }: { size: number; sunRef: React.MutableRefObject<THREE.Vector3> }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSun: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
      uDeep: { value: new THREE.Color("#062a44") },
      uShallow: { value: new THREE.Color("#1d7fa8") },
      uSky: { value: new THREE.Color("#bfe4f2") },
    }),
    [],
  );

  useFrame((_, raw) => {
    uniforms.uTime.value += Math.min(raw, 0.05);
    uniforms.uSun.value.copy(sunRef.current).normalize();
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position-y={WATER_LEVEL} receiveShadow>
      <planeGeometry args={[size, size, 200, 200]} />
      <shaderMaterial
        ref={mat}
        transparent
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          uniform float uTime;
          varying vec3 vNormalW;
          varying vec3 vPosW;
          varying float vFoam;

          float wave(vec2 p, vec2 dir, float freq, float speed, float amp) {
            return sin(dot(p, dir) * freq + uTime * speed) * amp;
          }

          void main() {
            vec3 pos = position;
            vec2 p = pos.xy;
            float h = wave(p, normalize(vec2(1.0, 0.3)), 0.09, 1.1, 0.55)
                    + wave(p, normalize(vec2(-0.4, 1.0)), 0.14, 1.6, 0.32)
                    + wave(p, normalize(vec2(0.7, -0.8)), 0.31, 2.4, 0.12);
            pos.z += h;
            float e = 0.6;
            float hx = wave(p + vec2(e, 0.0), normalize(vec2(1.0, 0.3)), 0.09, 1.1, 0.55)
                     + wave(p + vec2(e, 0.0), normalize(vec2(-0.4, 1.0)), 0.14, 1.6, 0.32);
            float hz = wave(p + vec2(0.0, e), normalize(vec2(1.0, 0.3)), 0.09, 1.1, 0.55)
                     + wave(p + vec2(0.0, e), normalize(vec2(-0.4, 1.0)), 0.14, 1.6, 0.32);
            vec3 n = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
            vNormalW = normalize(mat3(modelMatrix) * n);
            vec4 world = modelMatrix * vec4(pos, 1.0);
            vPosW = world.xyz;
            vFoam = smoothstep(0.55, 0.95, h);
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uSun;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform vec3 uSky;
          varying vec3 vNormalW;
          varying vec3 vPosW;
          varying float vFoam;

          void main() {
            vec3 view = normalize(cameraPosition - vPosW);
            vec3 n = normalize(vNormalW);
            float fres = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 3.0);
            float diff = clamp(dot(n, normalize(uSun)) * 0.5 + 0.5, 0.0, 1.0);
            vec3 col = mix(uDeep, uShallow, diff);
            col = mix(col, uSky, fres * 0.7);
            vec3 h = normalize(normalize(uSun) + view);
            float spec = pow(clamp(dot(n, h), 0.0, 1.0), 220.0);
            col += vec3(1.0, 0.96, 0.85) * spec * 1.6;
            col = mix(col, vec3(0.92, 0.97, 1.0), vFoam * 0.35);
            gl_FragColor = vec4(col, 0.9);
          }
        `}
      />
    </mesh>
  );
}
