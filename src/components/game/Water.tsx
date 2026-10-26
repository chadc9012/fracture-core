import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { heightAt, WATER_LEVEL } from "@/game/terrain";
import { WORLD_RADIUS } from "@/game/world";
import { WATER_INNER_HALF, waterAxis, waterGrid } from "@/game/water-grid";
import type { RenderTier } from "@/game/performance";
import { cityGlints, nearestGlints } from "@/game/wet-reflections";
import { walkHeight } from "@/game/terrain";
import { lampLevel, worldLight } from "@/game/world-light";

/** point reflections of nearby city lights on the water, per tier (LOW none: the sky, sun and moon reflections are all it gets) */
const WATER_LIGHTS: Record<RenderTier, number> = { LOW: 0, MEDIUM: 4, HIGH: 8, ULTRA: 12 };

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
  const lightCount = WATER_LIGHTS[tier] ?? 0;
  const glints = useMemo(() => (lightCount ? cityGlints().map((g) => ({ x: g.x, z: g.z, y: walkHeight(g.x, g.z) + g.h, col: new THREE.Color(g.color) })) : []), [lightCount]);
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

  useEffect(() => () => depthTex.dispose(), [depthTex]);

  const uniforms = useMemo(
    () => ({
      // the scene fog (Fog/FogExp2 uniforms, refreshed by the renderer because the material has fog on): without it the ocean stayed
      // bright cyan out to the horizon while the land faded into fog, a flat band seen from every hill and summit
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
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
      uSkyHorizon: { value: new THREE.Color("#87b9d0") },
      uNight: { value: 0 },
      uLightK: { value: 0 },
      uLightPos: { value: Array.from({ length: Math.max(1, lightCount) }, () => new THREE.Vector3(0, -1e4, 0)) },
      uLightCol: { value: Array.from({ length: Math.max(1, lightCount) }, () => new THREE.Color(0, 0, 0)) },
    }),
    [depthTex, cover, lightCount],
  );
  const defines = useMemo(() => ({ WATER_LIGHTS: lightCount }), [lightCount]);
  // R3F 9 hands <shaderMaterial> a deep copy of the `uniforms` prop, so writes to this object never reached the GPU: the ocean's
  // time, sun, origin and regional style were frozen at their first values. Point the live material at this object instead.
  useLayoutEffect(() => { if (mat.current) { mat.current.uniforms = uniforms; mat.current.needsUpdate = true; } }, [uniforms]);
  const lightPick = useRef({ t: -1 });

  useFrame(({ scene, clock }, raw) => {
    uniforms.uTime.value += Math.min(raw, 0.05);
    // the water mirrors the live sky: the zenith colour (scene background) overhead, the horizon colour SkyDome writes at grazing angles
    if (scene.background instanceof THREE.Color) uniforms.uSky.value.copy(scene.background);
    const hz = worldLight.horizon;
    uniforms.uSkyHorizon.value.setRGB(hz[0], hz[1], hz[2]);
    uniforms.uNight.value = worldLight.night;
    const lamps = lampLevel(worldLight.night);
    uniforms.uLightK.value = lightCount ? lamps : 0;
    if (lightCount && lamps > 0.01 && clock.elapsedTime - lightPick.current.t > 0.3) {
      lightPick.current.t = clock.elapsedTime;
      const pick = nearestGlints(glints, camera.position.x, camera.position.z, lightCount);
      for (let i = 0; i < lightCount; i++) {
        const g = pick[i];
        if (g) { uniforms.uLightPos.value[i]!.set(g.x, g.y, g.z); uniforms.uLightCol.value[i]!.copy(g.col); }
        else uniforms.uLightCol.value[i]!.setRGB(0, 0, 0);
      }
    }
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
        key={lightCount}
        ref={mat}
        transparent
        fog
        defines={defines}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          uniform float uTime;
          uniform float uChop;
          uniform vec2 uOrigin;
          varying vec3 vNormalW;
          varying vec3 vPosW;
          varying float vFoam;
          #include <fog_pars_vertex>

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
            // the patch is authored in local XY and displaced along local Z (rotated to world Y by the mesh),
            // so the slope normal is Z-up here; a Y-up normal lit the waves sideways
            vec3 n = normalize(vec3(-(hx - h) / e, -(hz - h) / e, 1.0));
            vNormalW = normalize(mat3(modelMatrix) * n);
            vec4 world = modelMatrix * vec4(pos, 1.0);
            vPosW = world.xyz;
            vFoam = smoothstep(0.55, 0.95, h);
            vec4 mvPosition = viewMatrix * world;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uSun;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform vec3 uSky;
          uniform vec3 uSkyHorizon;
          uniform float uMurk;
          uniform float uTime;
          uniform sampler2D uDepthTex;
          uniform float uWorldSize;
          uniform float uNight;
          uniform float uLightK;
          #if WATER_LIGHTS > 0
          uniform vec3 uLightPos[WATER_LIGHTS];
          uniform vec3 uLightCol[WATER_LIGHTS];
          #endif
          varying vec3 vNormalW;
          varying vec3 vPosW;
          varying float vFoam;
          #include <fog_pars_fragment>

          void main() {
            vec3 view = normalize(cameraPosition - vPosW);
            // ease wave slopes out with distance: three long regular swells otherwise alias into hard
            // reflection stripes near the horizon, while close water keeps its full detail
            float camD = length(cameraPosition - vPosW);
            float far = smoothstep(25.0, 180.0, camD);
            // fine wind ripples on top of the swell: they break the mirrored sky, sun and lights into streaks the way real water
            // does (a dead-flat normal made one smooth blob); faded out with distance before they can alias
            vec2 rp = vPosW.xz;
            vec2 ripple = vec2(sin(rp.x * 1.7 + uTime * 2.1) + sin(rp.y * 2.3 - uTime * 1.6 + rp.x * 0.6),
                               cos(rp.y * 1.9 + uTime * 1.8) + cos(rp.x * 2.6 + uTime * 1.3 - rp.y * 0.5)) * 0.045 * (1.0 - smoothstep(12.0, 90.0, camD));
            ripple += vec2(sin(dot(rp, vec2(0.83, 3.1)) - uTime * 2.6), cos(dot(rp, vec2(-2.9, 1.2)) + uTime * 2.2)) * 0.03 * (1.0 - smoothstep(10.0, 60.0, camD));
            vec3 n = normalize(mix(normalize(vNormalW), vec3(0.0, 1.0, 0.0), far * 0.85) + vec3(ripple.x, 0.0, ripple.y));
            vec3 R = reflect(-view, n);
            float fres = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 3.0);
            float diff = clamp(dot(n, normalize(uSun)) * 0.5 + 0.5, 0.0, 1.0);

            // water depth from the baked terrain height: bright shallows near shore, deep colour offshore
            vec2 uv = vPosW.xz / uWorldSize + 0.5;
            // past the baked terrain footprint it is open ocean: don't smear the edge texel into phantom shallows
            bool inside = all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
            float ground = inside ? texture2D(uDepthTex, uv).r : ${WATER_LEVEL.toFixed(2)} - 60.0;
            float depth = clamp((${WATER_LEVEL.toFixed(2)} - ground) / 6.0, 0.0, 1.0);
            vec3 col = mix(uShallow, uDeep, sqrt(depth));
            col = mix(col, col * (0.55 + 0.45 * diff), 1.0 - uMurk * 0.5);

            // sky reflection, dulled by murk: the reflected ray looks up the live sky gradient (horizon colour low, zenith overhead),
            // so the sea goes gold at sunset and dark at night with the sky instead of always mirroring a fixed noon blue.
            // No screen-space or planar pass: the mirror is analytic.
            vec3 reflectedSky = mix(uSkyHorizon, uSky, smoothstep(0.0, 0.5, max(R.y, 0.0)));
            col = mix(col, reflectedSky, fres * 0.8 * (1.0 - uMurk * 0.6));

            // sun glint, dulled by murk
            vec3 h = normalize(normalize(uSun) + view);
            float spec = pow(clamp(dot(n, h), 0.0, 1.0), 220.0);
            col += vec3(1.0, 0.96, 0.85) * spec * 1.6 * (1.0 - uMurk * 0.7);
            // the sun's path on the water (reference "sunset - Nexus City"): a broad reflected streak that widens and warms as the
            // sun drops, broken into glitter by the wave facets; gone once the sun is below the horizon
            vec3 sd = normalize(uSun);
            float lowSun = 1.0 - smoothstep(0.05, 0.5, sd.y);
            float path = pow(clamp(dot(reflect(-view, n), sd), 0.0, 1.0), mix(380.0, 34.0, lowSun));
            float glit = fract(sin(dot(floor(vPosW.xz * 1.6 + vec2(uTime * 0.6, -uTime * 0.4)), vec2(12.9898, 78.233))) * 43758.5453);
            vec3 sunCol = mix(vec3(1.0, 0.95, 0.82), vec3(1.0, 0.52, 0.18), lowSun);
            col += sunCol * path * (0.35 + 1.5 * lowSun) * (0.45 + 0.9 * step(0.55, glit)) * smoothstep(-0.03, 0.05, sd.y) * (1.0 - uMurk * 0.7);
            // after dark: a cold moon path (the moon rides roughly opposite the sun) broken by the same glitter
            if (uNight > 0.05) {
              vec3 md = normalize(vec3(-sd.x, max(0.18, -sd.y), -sd.z));
              float mpath = pow(clamp(dot(R, md), 0.0, 1.0), 160.0);
              col += vec3(0.62, 0.7, 0.85) * mpath * 0.55 * uNight * (0.4 + 0.9 * step(0.6, glit)) * (1.0 - uMurk * 0.7);
            }
            #if WATER_LIGHTS > 0
            // nearby city lights mirrored on the water: each one a tight highlight the ripples stretch into a shimmering column
            if (uLightK > 0.01) {
              vec3 lsum = vec3(0.0);
              vec2 hR = normalize(R.xz + 1e-5);
              for (int i = 0; i < WATER_LIGHTS; i++) {
                vec3 L = uLightPos[i] - vPosW; float d = length(L); L /= d;
                // anisotropic: tight across (a couple of degrees of azimuth), long along the elevation, so the waves smear
                // each lamp into a vertical column of glints instead of a round blob
                float az = 1.0 - dot(hR, normalize(L.xz + 1e-5));
                float el = R.y - L.y;
                float s = exp(-az * 2600.0 - el * el * 70.0);
                lsum += uLightCol[i] * s / (1.0 + d * 0.004); // a mirrored lamp hardly dims with distance, it just shrinks
              }
              col += lsum * uLightK * 1.3 * (0.55 + 0.9 * step(0.5, glit)) * (1.0 - uMurk * 0.6);
            }
            #endif

            // shoreline foam: an animated band where the water meets the land, plus whitecaps on crests
            // a ring between roughly 10 cm and 50 cm of depth: it traces the waterline instead of whitening flats the
            // baked depth reads as at/above sea level; the lapping pattern is broken up by a second cross-running wave
            float shore = smoothstep(0.0, 0.02, depth) * (1.0 - smoothstep(0.03, 0.09, depth));
            float lap = 0.5 + 0.25 * sin(uTime * 1.4 + vPosW.x * 0.35 + vPosW.z * 0.27) + 0.25 * sin(uTime * 0.9 - vPosW.x * 0.21 + vPosW.z * 0.43);
            float foam = clamp(vFoam * 0.5 + shore * (0.45 + 0.55 * lap), 0.0, 1.0);
            // Break up perfectly continuous whitecaps using world-space interference.
            float crestBreakup = 0.68 + 0.32 * sin(vPosW.x * 0.47 + uTime * 0.7) * sin(vPosW.z * 0.39 - uTime * 0.45);
            col = mix(col, vec3(0.92, 0.97, 1.0), foam * crestBreakup * (0.35 + shore * 0.45) * (1.0 - uMurk * 0.5));

            float alpha = mix(0.82, 0.96, max(uMurk, depth * 0.6));
            gl_FragColor = vec4(col, alpha);
            #include <fog_fragment>
          }
        `}
      />
    </mesh>
  );
}
