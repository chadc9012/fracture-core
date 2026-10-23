import { useFrame, useThree } from "@react-three/fiber";
import { Effect } from "postprocessing";
import { forwardRef, useMemo } from "react";
import * as THREE from "three";

import { gradeFor, gradeRegionAt, type Grade } from "@/game/color-grade";
import { worldLight } from "@/game/world-light";

/**
 * World Fracture's camera grade as one post pass (color-grade.ts): saturation, contrast around mid-grey in display
 * space, split toning (tinted shadows, tinted highlights), crushed blacks, exposure, a soft vignette and fine film
 * grain. It follows the camera between regions (Neon City's cyberpunk grade vs the gritty wilds) and the night, easing
 * over ~2 s so a border never pops. Replaces the old flat HueSaturation/BrightnessContrast/Vignette trio.
 */
const fragment = /* glsl */ `
uniform float saturation;
uniform float contrast;
uniform float exposure;
uniform float split;
uniform float crush;
uniform float grain;
uniform float vignette;
uniform float time;
uniform vec3 shadowTint;
uniform vec3 highlightTint;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0) * exposure;
  vec3 d = pow(c, vec3(1.0 / 2.2));                       // grade in display space
  float l = dot(d, vec3(0.2126, 0.7152, 0.0722));
  d = mix(vec3(l), d, saturation);
  d = (d - 0.5) * contrast + 0.5;
  // split tone: darks lean to the shadow tint, brights to the highlight tint (soft-light style, luminance kept)
  // (tints are normalised to unit luminance, so they shift hue without darkening or brightening)
  float sh = 1.0 - smoothstep(0.0, 0.55, l), hi = smoothstep(0.45, 1.0, l);
  vec3 sT = shadowTint / max(dot(shadowTint, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
  vec3 hT = highlightTint / max(dot(highlightTint, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
  d = mix(d, d * sT, sh * split);
  d = mix(d, d * hT, hi * split * 0.6);
  d = max(d - crush, 0.0) / (1.0 - crush);
  // vignette
  vec2 q = uv - 0.5;
  d *= 1.0 - vignette * smoothstep(0.35, 0.85, length(q * vec2(1.15, 1.0)));
  // grain, strongest in the mids
  float n = hash(uv * vec2(1931.0, 1171.0) + fract(time) * 97.0) - 0.5;
  d += n * grain * (1.0 - abs(l - 0.5) * 1.4);
  outputColor = vec4(pow(clamp(d, 0.0, 1.0), vec3(2.2)), inputColor.a);
}
`;

class GritGradeEffect extends Effect {
  constructor() {
    super("GritGradeEffect", fragment, {
      uniforms: new Map<string, THREE.Uniform>([
        ["saturation", new THREE.Uniform(1)], ["contrast", new THREE.Uniform(1)], ["exposure", new THREE.Uniform(1)],
        ["split", new THREE.Uniform(0)], ["crush", new THREE.Uniform(0)], ["grain", new THREE.Uniform(0)], ["vignette", new THREE.Uniform(0)],
        ["time", new THREE.Uniform(0)], ["shadowTint", new THREE.Uniform(new THREE.Color("#808080"))], ["highlightTint", new THREE.Uniform(new THREE.Color("#808080"))],
      ]),
    });
  }
}

const NUM: (keyof Grade)[] = ["saturation", "contrast", "exposure", "split", "crush", "grain", "vignette"];
const tmpA = new THREE.Color(), tmpB = new THREE.Color();

export const GritGrade = forwardRef<GritGradeEffect, { grain?: boolean; vignette?: boolean }>(function GritGrade({ grain = true, vignette = true }, ref) {
  const effect = useMemo(() => new GritGradeEffect(), []);
  const camera = useThree((s) => s.camera);
  useMemo(() => { const g = gradeFor(gradeRegionAt(camera.position.x, camera.position.z), worldLight.night); for (const k of NUM) effect.uniforms.get(k)!.value = g[k]; (effect.uniforms.get("shadowTint")!.value as THREE.Color).set(g.shadowTint); (effect.uniforms.get("highlightTint")!.value as THREE.Color).set(g.highlightTint); }, [effect, camera]);
  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.1), k = 1 - Math.exp(-1.6 * dt);
    const g = gradeFor(gradeRegionAt(camera.position.x, camera.position.z), worldLight.night);
    if (!grain) g.grain = 0;
    if (!vignette) g.vignette = 0;
    for (const key of NUM) { const u = effect.uniforms.get(key)!; u.value += ((g[key] as number) - u.value) * k; }
    (effect.uniforms.get("shadowTint")!.value as THREE.Color).lerp(tmpA.set(g.shadowTint), k);
    (effect.uniforms.get("highlightTint")!.value as THREE.Color).lerp(tmpB.set(g.highlightTint), k);
    effect.uniforms.get("time")!.value = state.clock.elapsedTime;
  });
  return <primitive ref={ref} object={effect} dispose={null} />;
});
