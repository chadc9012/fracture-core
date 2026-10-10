import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

import { SHAFT_POOL, forestPresence, shaftStrength, shaftsAround } from "@/game/light-shafts";
import { WATER_LEVEL, heightAt } from "@/game/terrain";

/**
 * Soft sunbeams through the canopy (src/game/light-shafts.ts decides where and how strong). Two crossed, additive,
 * depth-tested cards per shaft in one InstancedMesh; the matrices are rewritten only when the camera has moved 10 m.
 * Presentation only. A failure to build just means no shafts: everything here is guarded.
 */
const VERT = /* glsl */ `
  attribute float aPhase;
  varying vec2 vUv;
  varying float vPhase;
  varying float vDist;
  void main() {
    vUv = uv;
    vPhase = aPhase;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vDist = distance(world.xyz, cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uTime;
  varying vec2 vUv;
  varying float vPhase;
  varying float vDist;
  void main() {
    float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
    float edge = pow(clamp(across, 0.0, 1.0), 1.6);
    float along = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
    float shimmer = 0.78 + 0.22 * sin(uTime * 0.45 + vPhase + vUv.y * 4.0);
    float near = smoothstep(2.0, 9.0, vDist);        // never a hard wall in the player's face
    float far = 1.0 - smoothstep(48.0, 92.0, vDist); // and gone before the fog hides it badly
    float a = edge * along * shimmer * near * far * uStrength * 0.16;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export function LightShafts({ sunRef, skyEnv, forest }: { sunRef: MutableRefObject<THREE.Vector3>; skyEnv: MutableRefObject<{ cloud: number }>; forest: { x: number; z: number; radius: number } }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const camera = useThree((s) => s.camera);
  const last = useRef({ x: NaN, z: NaN, sunY: NaN });
  const tmp = useMemo(() => ({ obj: new THREE.Object3D(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), up: new THREE.Vector3(0, 1, 0), spin: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2) }), []);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    g.setAttribute("aPhase", new THREE.InstancedBufferAttribute(new Float32Array(SHAFT_POOL * 2), 1));
    return g;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uColor: { value: new THREE.Color("#ffe2a8") }, uStrength: { value: 0 }, uTime: { value: 0 } },
  }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    try {
      const cx = camera.position.x, cz = camera.position.z;
      const presence = forestPresence(Math.hypot(cx - forest.x, cz - forest.z), forest.radius);
      const strength = shaftStrength(sunRef.current.y, skyEnv.current.cloud, presence);
      material.uniforms["uStrength"]!.value = strength;
      material.uniforms["uTime"]!.value = state.clock.elapsedTime;
      m.visible = strength > 0.01;
      if (!m.visible) return;
      const st = last.current;
      const sun = sunRef.current;
      if (!Number.isFinite(st.x) || Math.hypot(cx - st.x, cz - st.z) > 10 || Math.abs(sun.y - st.sunY) > 0.02) {
        st.x = cx; st.z = cz; st.sunY = sun.y;
        const shafts = shaftsAround(cx, cz, (x, z) => Math.hypot(x - forest.x, z - forest.z) < forest.radius * 0.92 && heightAt(x, z) > WATER_LEVEL + 1);
        tmp.q.setFromUnitVectors(tmp.up, sun.clone().normalize());
        tmp.q2.copy(tmp.q).multiply(tmp.spin);
        const phase = geometry.getAttribute("aPhase") as THREE.InstancedBufferAttribute;
        shafts.forEach((s, k) => {
          const y = heightAt(s.x, s.z) - 1;
          for (let c = 0; c < 2; c++) {
            tmp.obj.position.set(s.x, y, s.z);
            tmp.obj.quaternion.copy(c === 0 ? tmp.q : tmp.q2);
            tmp.obj.scale.set(s.width, s.height, 1);
            tmp.obj.updateMatrix();
            m.setMatrixAt(k * 2 + c, tmp.obj.matrix);
            phase.setX(k * 2 + c, s.phase);
          }
        });
        m.count = shafts.length * 2;
        m.instanceMatrix.needsUpdate = true;
        phase.needsUpdate = true;
      }
    } catch (error) {
      m.visible = false;
      console.error("[light shafts] disabled", error);
    }
  });

  return <instancedMesh ref={mesh} args={[geometry, material, SHAFT_POOL * 2]} frustumCulled={false} renderOrder={4} visible={false} />;
}
