import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { heightAt, WATER_LEVEL } from "@/game/terrain";
import { WORLD_RADIUS } from "@/game/world";
import { WATER_INNER_HALF, waterAxis, waterGrid } from "@/game/water-grid";
import type { RenderTier } from "@/game/performance";

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

const DEPTH_TEX_RES = 256;
/** The surface mesh is a fixed-size patch that follows the camera (snapped to its vertex spacing, waves keyed to world position), so the vertex density stays
 * fine on a map 4x wider. It reaches past the fog, so its edge is never seen. */
const PATCH_STEP = 8; // near-field vertex spacing (water-grid.ts keeps inner coordinates on this lattice)

export function Water({
  size,
  sunRef,
  styleRef,
  tier = "MEDIUM",
}: {
  tier?: RenderTier;
  size: number;
  sunRef: React.MutableRefObject<THREE.Vector3>;
  styleRef: React.MutableRefObject<WaterStyleUniforms>;
}) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  // dense near the camera, coarse toward the fogged edge (water-grid.ts): 18k-65k triangles by tier instead of 180k everywhere
  const geometry = useMemo(() => {
    const { positions, index } = waterGrid(waterAxis(WATER_INNER_HALF[tier]));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2000); // never culled: it is centred on the camera
    return g;
  }, [tier]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const mesh = useRef<THREE.Mesh>(null!);
  const camera = useThree((st) => st.camera);
  // the baked depth texture only needs to cover the land (+ coast); beyond it, edge texels read as deep sea
  const cover = Math.min(size, WORLD_RADIUS * 2.3);

  // Bake terrain height into a texture once, so the shader can tell deep water from shoreline.
  const depthTex = useMemo(() => {
    const data = new Float32Array(DEPTH_TEX_RES * DEPTH_TEX_RES);
    const half = cover / 2;
    for (let j = 0; j < DEPTH_TEX_RES; j++) {
      for (let i = 0; i < DEPTH_TEX_RES; i++) {
        const x = (i / (DEPTH_TEX_RES - 1)) * cover - half;
        const z = (j / (DEPTH_TEX_RES - 1)) * cover - half;
        data[j * DEPTH_TEX_RES + i] = heightAt(x, z);
      }
    }
    const tex = new THREE.DataTexture(data, DEPTH_TEX_RES, DEPTH_TEX_RES, THREE.RedFormat, THREE.FloatType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, [cover]);

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
      uWorldSize: { value: cover },
      uOrigin: { value: new THREE.Vector2(0, 0) },
    }),
    [depthTex, cover],
  );

  useFrame((_, raw) => {
    uniforms.uTime.value += Math.min(raw, 0.05);
    const m = mesh.current;
    if (m) {
      const ox = Math.round(camera.position.x / PATCH_STEP) * PATCH_STEP, oz = Math.round(camera.position.z / PATCH_STEP) * PATCH_STEP;
      m.position.x = ox; m.position.z = oz;
      uniforms.uOrigin.value.set(ox, oz);
    }
    uniforms.uSun.value.copy(sunRef.current).normalize();
    const st = styleRef.current;
    uniforms.uDeep.value.copy(st.deep);
    uniforms.uShallow.value.copy(st.shallow);
    uniforms.uMurk.value = st.murk;
    uniforms.uChop.value = st.chop;
  });

  return (
    <mesh ref={mesh} geometry={geometry} rotation-x={-Math.PI / 2} position-y={WATER_LEVEL} receiveShadow frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        transparent
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          uniform float uTime;
          uniform float uChop;
          uniform vec2 uOrigin;
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
            vec2 p = vec2(pos.x + uOrigin.x, pos.y - uOrigin.y); // world-keyed so the waves do not slide when the patch follows the camera
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
