import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** Weather inside a Killbox arena (the open world's Weather is hidden up there): falling rain streaks over the arenas, slow rising
 * data motes. One instanced draw; the fall is computed in the vertex shader from a time uniform, so the CPU does
 * nothing per frame but bump the clock. `count` is cut on phones by the caller. */
export function ArenaWeather({ kind, center, count, size = 140, height = 70 }: { kind: "rain" | "motes"; center: { x: number; y: number; z: number }; count: number; size?: number; height?: number }) {
  const { geometry, material } = useMemo(() => {
    const base = kind === "rain" ? new THREE.BoxGeometry(0.025, 0.85, 0.025) : new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute("position", base.getAttribute("position"));
    const off = new Float32Array(count * 3);
    // a fixed scatter (seeded), so the field looks the same every match
    let s = 1234567;
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
    for (let i = 0; i < count; i++) { off[i * 3] = (rnd() - 0.5) * size; off[i * 3 + 1] = rnd() * height; off[i * 3 + 2] = (rnd() - 0.5) * size; }
    g.setAttribute("aOffset", new THREE.InstancedBufferAttribute(off, 3));
    g.instanceCount = count;
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSpeed: { value: kind === "rain" ? 26 : -1.2 }, uH: { value: height }, uCenter: { value: new THREE.Vector3(center.x, center.y, center.z) }, uColor: { value: new THREE.Color(kind === "rain" ? "#a9b8ff" : "#5ff0ff") }, uOpacity: { value: kind === "rain" ? 0.32 : 0.75 } },
      vertexShader: `uniform float uTime, uSpeed, uH; uniform vec3 uCenter; attribute vec3 aOffset;
        void main() {
          vec3 p = aOffset; p.y = mod(p.y - uTime * uSpeed, uH);
          // rain leans with the wind as it falls; motes drift in a slow circle
          p.x += ${kind === "rain" ? "p.y * 0.12" : "sin(uTime * 0.4 + aOffset.z) * 1.5"}; p.z += ${kind === "rain" ? "0.0" : "cos(uTime * 0.35 + aOffset.x) * 1.5"};
          gl_Position = projectionMatrix * viewMatrix * vec4(position + p + uCenter - vec3(0.0, uH * 0.15, 0.0), 1.0);
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; void main() { gl_FragColor = vec4(uColor, uOpacity); }`,
      transparent: true, depthWrite: false, blending: kind === "motes" ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    return { geometry: g, material: m };
  }, [kind, count, size, height, center.x, center.y, center.z]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(({ clock }) => { material.uniforms["uTime"]!.value = clock.elapsedTime; });
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
