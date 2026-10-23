import { createDesertScrubGeometry } from "@/game/desert-botanical-geometry";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { walkHeight, slopeAt, WATER_LEVEL } from "@/game/terrain";
import { distanceToRoad, LANE_HALF_WIDTH } from "@/game/lanes";
import { organicRock } from "@/game/organic-geometry";
import { regionById } from "@/game/dressing-kit";
import { useInstances } from "./instancing";
import { terrainContactNormal, terrainContactPosition } from "@/game/terrain-contact";

/** Deterministic, instanced set dressing. Does not alter collision or gameplay. */
type Scatter = { x: number; z: number; scale: number; rotation: number; variant: number };
function scatter(count: number, radius: number, seed: number): Scatter[] {
  let state = seed >>> 0;
  const rand = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const center = regionById("wastelands");
  const placements: Scatter[] = [];
  let attempts = 0;
  while (placements.length < count && attempts++ < count * 32) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    // Keep roads, steep slopes, and submerged terrain clear of decorative obstacles.
    if (distanceToRoad(x, z) < LANE_HALF_WIDTH + 4 || slopeAt(x, z) > 0.65 || walkHeight(x, z) < WATER_LEVEL + 0.4) continue;
    placements.push({ x, z, scale: 0.45 + rand() * 1.9, rotation: rand() * Math.PI * 2, variant: placements.length % 4 });
  }
  return placements;
}

/** Soft ground-contact occlusion. Small, feathered footprints keep boulders and
 * rubble from looking pasted onto the terrain without costly extra shadow maps.
 * This is visual only and deliberately does not modify physics or terrain height. */
function contactAlphaTexture(): THREE.DataTexture {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5 - size / 2) / (size / 2);
    const dy = (y + 0.5 - size / 2) / (size / 2);
    const radius = Math.sqrt(dx * dx + dy * dy);
    const alpha = Math.pow(Math.max(0, 1 - radius * radius), 3) * 0.38;
    const index = (y * size + x) * 4;
    pixels[index] = 45; pixels[index + 1] = 33; pixels[index + 2] = 25;
    pixels[index + 3] = Math.round(alpha * 255);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function materialTexture(name: string, kind: "basecolor" | "normal" | "orm") {
  const texture = new THREE.TextureLoader().load(`/textures/visual-upgrade/${name}_${kind}.png`);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = kind === "basecolor" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function WastelandVisualUpgrade() {
  const rocks = useMemo(() => scatter(330, 430, 9137), []);
  const scrub = useMemo(() => scatter(410, 430, 27183), []);
  const stones = useMemo(() => scatter(620, 430, 7611), []);
  const rockRefs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  const scrubRef = useRef<THREE.InstancedMesh>(null);
  const rockContactRef = useRef<THREE.InstancedMesh>(null);
  const stoneContactRef = useRef<THREE.InstancedMesh>(null);
  const contactTexture = useMemo(() => contactAlphaTexture(), []);
  const contactGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const stoneRefs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  const scrubGeometry = useMemo(() => createDesertScrubGeometry(), []);
  // Four genuinely different silhouettes: layered boulders, fractured slabs and low rubble.
  // Keep a single instanced draw per silhouette instead of hundreds of separate meshes.
  const rockGeometries = useMemo(() => [
    organicRock(1, 913, 2, 0.21), organicRock(1, 1847, 2, 0.34),
    organicRock(1, 2911, 2, 0.28), organicRock(1, 4517, 2, 0.18),
  ], []);
  const rockGroups = useMemo(() => rockGeometries.map((_, variant) => rocks.filter(r => r.variant === variant)), [rocks, rockGeometries]);
  const stoneGroups = useMemo(() => rockGeometries.map((_, variant) => stones.filter(r => r.variant === variant)), [stones, rockGeometries]);
  const maps = useMemo(() => ({
    color: materialTexture("wasteland_cracked_earth", "basecolor"),
    normal: materialTexture("wasteland_cracked_earth", "normal"),
    orm: materialTexture("wasteland_cracked_earth", "orm"),
  }), []);
  // Hooks are called in a fixed order, regardless of the generated placements.
  for (let i = 0; i < 4; i++) {
    useInstances<Scatter>(rockRefs[i]!, rockGroups[i]!, (o, p) => {
      o.position.set(p.x, walkHeight(p.x, p.z) + p.scale * 0.24, p.z);
      o.rotation.set(p.rotation * 0.2, p.rotation, p.rotation * 0.13);
      o.scale.set(p.scale * 1.5, p.scale * 0.8, p.scale);
    }, () => ["#a99580", "#847466", "#6f6258", "#baaa8c"][i]!);
    useInstances<Scatter>(stoneRefs[i]!, stoneGroups[i]!, (o, p) => {
      o.position.set(p.x, walkHeight(p.x, p.z) + 0.07, p.z);
      o.rotation.set(0, p.rotation, 0);
      o.scale.set(p.scale * 0.28, p.scale * 0.14, p.scale * 0.32);
    }, () => ["#b09c83", "#8d7663", "#9c8872", "#c0ac8f"][i]!);
  }
  useInstances<Scatter>(rockContactRef, rocks, (o, p) => {
    const pos = terrainContactPosition(p.x, p.z, walkHeight, 0.055);
    const n = terrainContactNormal(p.x, p.z, walkHeight);
    o.position.set(pos.x, pos.y, pos.z);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n.x, n.y, n.z));
    o.rotateZ(p.rotation);
    o.scale.set(p.scale * 2.9, p.scale * 2.15, 1);
  });
  useInstances<Scatter>(stoneContactRef, stones, (o, p) => {
    const pos = terrainContactPosition(p.x, p.z, walkHeight, 0.045);
    const n = terrainContactNormal(p.x, p.z, walkHeight);
    o.position.set(pos.x, pos.y, pos.z);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n.x, n.y, n.z));
    o.rotateZ(p.rotation);
    o.scale.set(p.scale * 0.65, p.scale * 0.7, 1);
  });
  useInstances<Scatter>(scrubRef, scrub, (o, p) => {
    o.position.set(p.x, walkHeight(p.x, p.z), p.z);
    o.rotation.set(0, p.rotation, 0);
    o.scale.setScalar(p.scale);
  }, (_, i) => ["#756e42", "#8a7c4e", "#5d6540", "#988458"][i % 4]!);
  return <group>
    <instancedMesh ref={rockContactRef} args={[contactGeometry, undefined, rocks.length]} renderOrder={1}>
      <meshBasicMaterial map={contactTexture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={stoneContactRef} args={[contactGeometry, undefined, stones.length]} renderOrder={1}>
      <meshBasicMaterial map={contactTexture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} toneMapped={false} />
    </instancedMesh>
    {rockGeometries.map((geometry, i) => <instancedMesh key={`rock-${i}`} ref={rockRefs[i]!} args={[geometry, undefined, rockGroups[i]!.length]} castShadow receiveShadow>
      <meshStandardMaterial map={maps.color} normalMap={maps.normal} aoMap={maps.orm} roughnessMap={maps.orm} roughness={0.96} metalness={0} />
    </instancedMesh>)}
    {rockGeometries.map((geometry, i) => <instancedMesh key={`stone-${i}`} ref={stoneRefs[i]!} args={[geometry, undefined, stoneGroups[i]!.length]} receiveShadow>
      <meshStandardMaterial map={maps.color} normalMap={maps.normal} roughnessMap={maps.orm} roughness={1} />
    </instancedMesh>)}
    <instancedMesh ref={scrubRef} args={[scrubGeometry, undefined, scrub.length]} castShadow><meshStandardMaterial roughness={1} side={THREE.DoubleSide} />
    </instancedMesh>
  </group>;
}
