import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { regionById } from "@/game/dressing-kit";
import { walkHeight } from "@/game/terrain";

/** Soft alpha falloff prevents dust from looking like rectangular translucent cards. */
function makeDustAlphaMap(): THREE.DataTexture {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5 - size / 2) / (size / 2);
    const v = (y + 0.5 - size / 2) / (size / 2);
    const radial = Math.max(0, 1 - u * u - v * v);
    const alpha = Math.pow(radial, 2.4) * (0.75 + 0.25 * Math.cos(u * 7 + v * 4));
    const i = (y * size + x) * 4;
    pixels[i] = 255; pixels[i + 1] = 255; pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(255 * alpha);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Camera-facing, feathered desert dust. No collision or gameplay effects. */
export function WastelandDustHaze() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const center = useMemo(() => regionById("wastelands"), []);
  const clouds = useMemo(() => {
    let seed = 41231;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    return Array.from({ length: 64 }, () => {
      const a = rand() * Math.PI * 2;
      const d = 45 + Math.sqrt(rand()) * Math.max(75, center.radius * 0.75);
      const x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d;
      return { x, z, y: walkHeight(x, z) + 2 + rand() * 5, scale: 9 + rand() * 21, yaw: rand() * Math.PI, phase: rand() * Math.PI * 2 };
    });
  }, [center]);
  const obj = useMemo(() => new THREE.Object3D(), []);
  const alphaMap = useMemo(() => makeDustAlphaMap(), []);
  useFrame(({ clock, camera }) => {
    if (!ref.current) return;
    const mesh = ref.current;
    const time = clock.elapsedTime;
    clouds.forEach((c, i) => {
      obj.position.set(c.x + Math.sin(time * 0.06 + c.phase) * 3, c.y, c.z);
      // Face the active camera so each dust sheet stays visible while turning.
      obj.quaternion.copy(camera.quaternion);
      obj.scale.set(c.scale, c.scale * 0.36, 1);
      obj.updateMatrix(); mesh.setMatrixAt(i, obj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, clouds.length]} frustumCulled={false} renderOrder={2}>
    <planeGeometry args={[1, 1]} />
    <meshBasicMaterial color="#c5a17b" map={alphaMap} transparent opacity={0.13} depthWrite={false} side={THREE.DoubleSide} fog />
  </instancedMesh>;
}
