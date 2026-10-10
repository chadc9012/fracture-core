import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { heightAt, WATER_LEVEL } from "@/game/terrain";

/**
 * Animated ocean / lake surface: gerstner-ish sine waves in the vertex shader (amplitude scaled by
 * the regional weather chop), fresnel sky blend plus a sun specular in the fragment shader. A baked
 * terrain-height texture gives depth-based colour (bright shallows over sandbars) and a foam band
 * along every shoreline. `sunRef` tracks the day/night cycle; `styleRef` carries the eased regional
 * water style (water-style.ts): deep/shallow colours, murk and chop.
 */
export type WaterStyleUniforms = {
  deep: THREE.Color;
  shallow: THREE.Color;
  murk: number;
  chop: number;
};

const DEPTH_TEX_RES = 192;

export function Water({
  size,
  sunRef,
  styleRef,
}: {
  size: number;
  sunRef: React.MutableRefObject<THREE.Vector3>;
  styleRef: React.MutableRefObject<WaterStyleUniforms>;
}) {
  const mat = useRef<THREE.ShaderMaterial>(null!);

  // Bake terrain height into a texture once, so the shader can tell deep water from shoreline.
  const depthTex = useMemo(() => {
    const data = new Float32Array(DEPTH_TEX_RES * DEPTH_TEX_RES);
    const half = size / 2;
    for (let j = 0; j < DEPTH_TEX_RES; j++) {
      for (let i = 0; i < DEPTH_TEX_RES; i++) {
        const x = (i / (DEPTH_TEX_RES - 1)) * size - half;
        const z = (j / (DEPTH_TEX_RES - 1)) * size - half;
        data[j * DEPTH_TEX_RES + i] = heightAt(x, z);
      }
    }
    const tex = new THREE.DataTexture(data, DEPTH_TEX_RES, DEPTH_TEX_RES, THREE.RedFormat, THREE.FloatType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, [size]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSun: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
      uDeep: { value: new THREE.Color("#062a44") },
      uShallow: { value: new THREE.Color("#1d7fa8") },
      uSky: { value: new THREE.Color("#bfe4f2") },
      uMurk: { value: 0.15 },
      uChop: { value: 1 },
      uDepthTex: { value: depthTex },
      uWorldSize: { value: size },
    }),
    [depthTex, size],
  );

  useFrame((_, raw) => {
    uniforms.uTime.value += Math.min(raw, 0.05);
    uniforms.uSun.value.copy(sunRef.current).normalize();
    const st = styleRef.current;
    uniforms.uDeep.value.copy(st.deep);
    uniforms.uShallow.value.copy(st.shallow);
    uniforms.uMurk.value = st.murk;
    uniforms.uChop.value = st.chop;
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
          uniform float uChop;
          varying vec3 vNormalW;
          varying vec3 vPosW;
          varying float vFoam;

          float wave(vec2 p, vec2 dir, float freq, float speed, float amp) {
            return sin(dot(p, dir) * freq + uTime * speed) * amp;
          }

          float swell(vec2 p) {
            return wave(p, normalize(vec2(1.0, 0.3)), 0.09, 1.1, 0.55)
                 + wave(p, normalize(vec2(-0.4, 1.0)), 0.14, 1.6, 0.32)
                 + wave(p, normalize(vec2(0.7, -0.8)), 0.31, 2.4, 0.12);
          }

          void main() {
            vec3 pos = position;
            vec2 p = pos.xy;
            float h = swell(p) * uChop;
            pos.z += h;
            float e = 0.6;
            float hx = swell(p + vec2(e, 0.0)) * uChop;
            float hz = swell(p + vec2(0.0, e)) * uChop;
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
          uniform float uMurk;
          uniform float uTime;
          uniform sampler2D uDepthTex;
          uniform float uWorldSize;
          varying vec3 vNormalW;
          varying vec3 vPosW;
          varying float vFoam;

          void main() {
            vec3 view = normalize(cameraPosition - vPosW);
            vec3 n = normalize(vNormalW);
            float fres = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 3.0);
            float diff = clamp(dot(n, normalize(uSun)) * 0.5 + 0.5, 0.0, 1.0);

            // water depth from the baked terrain height: bright shallows near shore, deep colour offshore
            vec2 uv = vPosW.xz / uWorldSize + 0.5;
            float ground = texture2D(uDepthTex, uv).r;
            float depth = clamp((${WATER_LEVEL.toFixed(2)} - ground) / 6.0, 0.0, 1.0);
            vec3 col = mix(uShallow, uDeep, sqrt(depth));
            col = mix(col, col * (0.55 + 0.45 * diff), 1.0 - uMurk * 0.5);

            // sky reflection, dulled by murk
            col = mix(col, uSky, fres * 0.7 * (1.0 - uMurk * 0.6));

            // sun glint, dulled by murk
            vec3 h = normalize(normalize(uSun) + view);
            float spec = pow(clamp(dot(n, h), 0.0, 1.0), 220.0);
            col += vec3(1.0, 0.96, 0.85) * spec * 1.6 * (1.0 - uMurk * 0.7);

            // shoreline foam: an animated band where the water meets the land, plus whitecaps on crests
            float shore = 1.0 - smoothstep(0.0, 0.16, depth);
            float lap = 0.5 + 0.5 * sin(uTime * 1.4 + vPosW.x * 0.35 + vPosW.z * 0.27);
            float foam = clamp(vFoam * 0.5 + shore * (0.45 + 0.55 * lap), 0.0, 1.0);
            col = mix(col, vec3(0.92, 0.97, 1.0), foam * (0.35 + shore * 0.45) * (1.0 - uMurk * 0.5));

            float alpha = mix(0.82, 0.96, max(uMurk, depth * 0.6));
            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </mesh>
  );
}
