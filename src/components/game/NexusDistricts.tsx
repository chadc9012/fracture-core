import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { walkHeight, WATER_LEVEL } from "@/game/terrain";
import { addObstacle } from "@/game/obstacles";
import { BLOCK, CITY_OUTER, blocks, NEXUS, PITCH, SHOP_TINTS, buildings, facadeKit, lamps, parkedCars, streetLights, type Building, type FacadeBox, type Lamp, type Style } from "@/game/nexus-districts";
import { lampLevel, worldLight } from "@/game/world-light";
import { softSprite } from "./softSprite";
import { cityStreetMaterial } from "./city-surface";
import type { FleetModelId } from "@/game/fleet-models";
import { InstancedFleet, type FleetInstance } from "./InstancedFleet";
import { useInstances } from "./instancing";
import { antennaMast, hvacUnit, lampHead, lampLens, lampPole, waterTank } from "@/game/street-geometry";

const SL = { pole: lampPole(7.4, 1.8), housing: lampHead(7.4, 1.8), lens: lampLens(7.4, 1.8), pole6: lampPole(6.2, 1.2), head6: lampLens(6.2, 1.2), tank: waterTank(), hvac: hvacUnit(), mast: antennaMast(12) };

/** Nexus City outer districts: a street grid of buildings around the safe-zone hub (layout in nexus-districts.ts).
 * Building bodies are instanced boxes per style; windows are drawn by the shader in world space (so they never stretch
 * with the box), a share of them lit warm. Crowns, rooftop kit, street lamps and parked cars are instanced too. */
export function NexusDistricts() {
  const bs = useMemo(() => buildings(), []);
  useEffect(() => { for (const b of bs) addObstacle("tower", b.x, b.z, Math.min(b.w, b.d) * 0.5, 1e6, 3); }, [bs]);
  return (
    <group>
      <Streets />
      <RaisedSidewalks />
      {(["glass", "concrete", "industrial"] as const).map((s) => <Bodies key={s} style={s} list={bs.filter((b) => b.style === s)} />)}
      <Crowns list={bs.filter((b) => b.crown)} />
      <Facades list={bs} />
      <Roofs list={bs} />
      <DistrictArchitecture list={bs} />
      <RooftopSolarArrays list={bs} />
      <Lamps />
      <StreetLights />
      <Cars />
    </group>
  );
}

const LOOK: Record<Style, { color: string; glass: string; lit: number; cell: [number, number]; win: [number, number]; metal: number; rough: number }> = {
  // owner's night target (Nexus street): dense, mostly lit facades. Narrower bays and taller glazing than before, more rooms lit
  glass: { color: "#5d7486", glass: "#1b2b3a", lit: 0.56, cell: [1.6, 3.4], win: [0.84, 0.72], metal: 0.32, rough: 0.36 },
  concrete: { color: "#a39a8c", glass: "#1d2229", lit: 0.5, cell: [2.0, 3.4], win: [0.62, 0.62], metal: 0.05, rough: 0.9 },
  industrial: { color: "#4f5458", glass: "#1a1d20", lit: 0.3, cell: [4.0, 4.2], win: [0.45, 0.35], metal: 0.5, rough: 0.7 },
};

/** one shared window-glow level for every district facade: dim by day, bright at night (Bodies updates it each frame) */
const glowUniform = { value: 1 };
/** a MeshStandardMaterial whose faces get a world-space window grid; roofs and floors (|n.y| > 0.5) stay solid */
function windowMaterial(style: Style): THREE.MeshStandardMaterial {
  const L = LOOK[style];
  const m = new THREE.MeshStandardMaterial({ color: L.color, metalness: L.metal, roughness: L.rough });
  m.onBeforeCompile = (sh) => {
    sh.uniforms["uGlass"] = { value: new THREE.Color(L.glass) };
    sh.uniforms["uCell"] = { value: new THREE.Vector2(...L.cell) };
    sh.uniforms["uWin"] = { value: new THREE.Vector2(...L.win) };
    sh.uniforms["uLit"] = { value: L.lit };
    sh.uniforms["uGlow"] = glowUniform;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWp; varying vec3 vWn;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n#ifdef USE_INSTANCING\n mat4 wfIm = modelMatrix * instanceMatrix;\n#else\n mat4 wfIm = modelMatrix;\n#endif\n vWp = (wfIm * vec4(transformed, 1.0)).xyz; vWn = normalize(mat3(wfIm) * objectNormal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWp; varying vec3 vWn; uniform vec3 uGlass; uniform vec2 uCell; uniform vec2 uWin; uniform float uLit; uniform float uGlow;\nfloat wHash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        if (abs(vWn.y) < 0.5) {
          vec3 t = normalize(vec3(-vWn.z, 0.0, vWn.x));
          float u = dot(vWp, t) / uCell.x, v = vWp.y / uCell.y;
          vec2 f = fract(vec2(u, v)), id = floor(vec2(u, v));
          float inside = step(abs(f.x - 0.5), uWin.x * 0.5) * step(abs(f.y - 0.55), uWin.y * 0.5);
          // window frames read as recessed glass; a hashed share are lit, some cool white, most warm
          float h = wHash(mod(id + floor(vWn.xz * 3.0 + 0.5) * 17.0, 1024.0));
          // recessed glazing in a dark frame, a centre mullion and a seam at each floor line, plus a little
          // per-panel variation: all in the facade shader, so no extra draw calls
          float outer = step(abs(f.x - 0.5), min(0.49, uWin.x * 0.5 + 0.045)) * step(abs(f.y - 0.55), min(0.49, uWin.y * 0.5 + 0.045));
          float frame = max(0.0, outer - inside);
          float mullion = inside * (1.0 - step(0.016, abs(f.x - 0.5)));
          float seam = 1.0 - smoothstep(0.0, 0.025, min(f.y, 1.0 - f.y));
          float verticalJoint = 1.0 - smoothstep(0.0, 0.018, min(f.x, 1.0 - f.x));
          diffuseColor.rgb *= (0.95 + 0.1 * wHash(mod(floor(id * 0.5), 1024.0))) * (1.0 - seam * 0.12 - verticalJoint * 0.09);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.071, 0.084), frame * 0.88);
          diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, inside * 0.91);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.105, 0.12), mullion * 0.7);
          float lit = max(0.0, inside - mullion) * step(h, uLit);
          // mostly cool office white with warm rooms (the towers' facade map uses the same mix), brighter at night
          float hc = fract(h * 7.0);
          vec3 warm = hc < 0.56 ? vec3(0.86, 0.93, 1.0) : hc < 0.9 ? vec3(1.0, 0.8, 0.55) : vec3(0.4, 0.9, 1.0);
          totalEmissiveRadiance += warm * lit * (0.42 + 0.38 * fract(h * 13.0)) * uGlow;
        }`);
  };
  return m;
}

function Bodies({ style, list }: { style: Style; list: Building[] }) {
  const mat = useMemo(() => windowMaterial(style), [style]);
  const base = useMemo(() => mat.color.clone(), [mat]);
  useFrame(() => {
    const k = lampLevel(worldLight.night);
    glowUniform.value = 0.55 + 1.65 * k;
    // after dark the walls fall back behind their lit windows (owner's night frames); pale concrete read as floodlit at night
    mat.color.copy(base).multiplyScalar(1 - 0.5 * k);
  });
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances<Building>(ref, list, (o, b) => {
    const top = b.crown ? b.base + (b.top - b.base) * 0.78 : b.top;
    o.position.set(b.x, (b.base + top) / 2, b.z); o.rotation.set(0, b.yaw, 0); o.scale.set(b.w, top - b.base, b.d);
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, list.length)]} material={mat} castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /></instancedMesh>;
}

/** Street lights along every block face: pole, arm over the kerb, LED head, and a soft pool of light on the pavement
 * that fades in at dusk (worldLight). The pools are additive decals rather than real lights, so a hundred of them cost
 * one draw call and light the street the way the trailer's wet roads look. */
function StreetLights() {
  const ls = useMemo(() => streetLights(), []);
  const pole = useRef<THREE.InstancedMesh>(null), arm = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null), pool = useRef<THREE.InstancedMesh>(null);
  const y0 = (l: Lamp) => walkHeight(l.x, l.z);
  useInstances<Lamp>(pole, ls, (o, l) => { o.position.set(l.x, y0(l), l.z); o.rotation.set(0, l.yaw, 0); });
  useInstances<Lamp>(arm, ls, (o, l) => { o.position.set(l.x, y0(l), l.z); o.rotation.set(0, l.yaw, 0); });
  useInstances<Lamp>(head, ls, (o, l) => { o.position.set(l.x, y0(l), l.z); o.rotation.set(0, l.yaw, 0); });
  useInstances<Lamp>(pool, ls, (o, l) => { const x = l.x + Math.sin(l.yaw) * 1.7, z = l.z + Math.cos(l.yaw) * 1.7; o.position.set(x, walkHeight(x, z) + 0.13, z); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.setScalar(7.5); });
  const mats = useMemo(() => ({
    pole: new THREE.MeshStandardMaterial({ color: "#22272d", metalness: 0.8, roughness: 0.35 }),
    head: new THREE.MeshStandardMaterial({ color: "#d9e6ee", emissive: "#fff1d8", emissiveIntensity: 0, roughness: 0.3, toneMapped: false }),
    pool: new THREE.MeshBasicMaterial({ map: softSprite("dot") ?? null, color: "#ffd9a6", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }),
  }), []);
  const seen = useRef(-1);
  useFrame(() => {
    const k = Math.round(lampLevel(worldLight.night) * 50) / 50;
    if (k === seen.current) return;
    seen.current = k;
    mats.head.emissiveIntensity = 0.2 + k * 4.5;
    mats.pool.opacity = k * 0.42;
    if (pool.current) pool.current.visible = k > 0.01;
  });
  return <group>
    {/* tapered pole with a curved outreach arm, a cobra-head housing (arm instance) and its lit lens (head instance) */}
    <instancedMesh ref={pole} args={[SL.pole, undefined, Math.max(1, ls.length)]} material={mats.pole} castShadow />
    <instancedMesh ref={arm} args={[SL.housing, undefined, Math.max(1, ls.length)]} material={mats.pole} />
    <instancedMesh ref={head} args={[SL.lens, undefined, Math.max(1, ls.length)]} material={mats.head} />
    <instancedMesh ref={pool} args={[undefined, undefined, Math.max(1, ls.length)]} material={mats.pool} frustumCulled={false} renderOrder={2}><planeGeometry args={[1, 1]} /></instancedMesh>
  </group>;
}
/** facade articulation (nexus-districts.ts facadeKit): ledges, mullion fins, stone plinths, lit shopfronts and awnings */
function KitBoxes({ list, material, tinted }: { list: FacadeBox[]; material: THREE.Material; tinted?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances<FacadeBox>(ref, list, (o, b) => { o.position.set(b.x, b.y, b.z); o.rotation.set(0, 0, 0); o.scale.set(b.sx, b.sy, b.sz); }, tinted ? (b) => SHOP_TINTS[b.tint]! : undefined);
  return <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, list.length)]} material={material} castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /></instancedMesh>;
}
/** shop glass glows in its sign colour: emissive follows the per-instance colour */
function shopGlass() {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.15, metalness: 0.2 });
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance = vColor.rgb * 1.6;\n#endif"); };
  m.customProgramCacheKey = () => "nexus-shop-glass";
  return m;
}
function Facades({ list }: { list: Building[] }) {
  const kit = useMemo(() => facadeKit(list), [list]);
  const mats = useMemo(() => ({
    ledge: new THREE.MeshStandardMaterial({ color: "#b8b0a2", roughness: 0.85, metalness: 0.02 }),
    fin: new THREE.MeshStandardMaterial({ color: "#2c3640", roughness: 0.3, metalness: 0.85 }),
    plinth: new THREE.MeshStandardMaterial({ color: "#3a3c40", roughness: 0.55, metalness: 0.1 }),
    // shop glass glows in its sign colour (instance colour): bright enough to light the pavement in the bloom pass
    shop: shopGlass(),
    awning: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7, metalness: 0.0 }),
    balcony: new THREE.MeshStandardMaterial({ color: "#a9aaa6", roughness: 0.8, metalness: 0.05 }),
    rail: new THREE.MeshPhysicalMaterial({ color: "#cfe6ee", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.45 }),
    portal: new THREE.MeshStandardMaterial({ color: "#1d2228", roughness: 0.4, metalness: 0.8 }),
    lobby: new THREE.MeshStandardMaterial({ color: "#ffe9c4", emissive: "#ffcf8a", emissiveIntensity: 1.6, roughness: 0.3, toneMapped: false }),
    blade: shopGlass(),
  }), []);
  return <group>
    <KitBoxes list={kit.plinths} material={mats.plinth} />
    <KitBoxes list={kit.ledges} material={mats.ledge} />
    <KitBoxes list={kit.fins} material={mats.fin} />
    <KitBoxes list={kit.shopfronts} material={mats.shop} tinted />
    <KitBoxes list={kit.awnings} material={mats.awning} tinted />
    <KitBoxes list={kit.balconies} material={mats.balcony} />
    <KitBoxes list={kit.rails} material={mats.rail} />
    <KitBoxes list={kit.portals} material={mats.portal} />
    <KitBoxes list={kit.lobbies} material={mats.lobby} />
    <KitBoxes list={kit.blades} material={mats.blade} tinted />
  </group>;
}
/** tall towers step back into a narrower glass crown with a lit band */
function Crowns({ list }: { list: Building[] }) {
  const mat = useMemo(() => windowMaterial("glass"), []);
  const ref = useRef<THREE.InstancedMesh>(null), band = useRef<THREE.InstancedMesh>(null);
  useInstances<Building>(ref, list, (o, b) => { const y0 = b.base + (b.top - b.base) * 0.78; o.position.set(b.x, (y0 + b.top) / 2, b.z); o.scale.set(b.w * 0.7, b.top - y0, b.d * 0.7); });
  useInstances<Building>(band, list, (o, b) => { const y0 = b.base + (b.top - b.base) * 0.78; o.position.set(b.x, y0 + 0.3, b.z); o.scale.set(b.w * 1.01, 0.5, b.d * 1.01); });
  return <group>
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, list.length)]} material={mat} castShadow><boxGeometry args={[1, 1, 1]} /></instancedMesh>
    <instancedMesh ref={band} args={[undefined, undefined, Math.max(1, list.length)]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#66e0ff" toneMapped={false} /></instancedMesh>
  </group>;
}

/** rooftop kit: water tanks, HVAC boxes, antenna masts with a red light, helipads, roof gardens */
function Roofs({ list }: { list: Building[] }) {
  const pick = (k: Building["roof"]) => list.filter((b) => b.roof === k);
  const tanks = useMemo(() => pick("tanks"), [list]), hvac = useMemo(() => pick("hvac"), [list]), ant = useMemo(() => pick("antenna"), [list]), heli = useMemo(() => pick("helipad"), [list]), garden = useMemo(() => pick("garden"), [list]);
  const r1 = useRef<THREE.InstancedMesh>(null), r2 = useRef<THREE.InstancedMesh>(null), r3 = useRef<THREE.InstancedMesh>(null), r4 = useRef<THREE.InstancedMesh>(null), r5 = useRef<THREE.InstancedMesh>(null), r6 = useRef<THREE.InstancedMesh>(null);
  const cx = (b: Building) => (b.crown ? 0.7 : 1);
  useInstances<Building>(r1, tanks, (o, b) => { o.position.set(b.x + b.w * 0.2 * cx(b), b.top + 1.6, b.z - b.d * 0.15 * cx(b)); o.scale.set(1.4, 3.2, 1.4); });
  useInstances<Building>(r2, hvac, (o, b) => { o.position.set(b.x - b.w * 0.18, b.top + 0.7, b.z + b.d * 0.12); o.scale.set(b.w * 0.3, 1.4, b.d * 0.25); });
  useInstances<Building>(r3, ant, (o, b) => { o.position.set(b.x, b.top, b.z); o.rotation.set(0, b.x * 0.37, 0); });
  useInstances<Building>(r4, ant, (o, b) => { o.position.set(b.x, b.top + 14.1, b.z); o.scale.setScalar(0.18); });
  useInstances<Building>(r5, heli, (o, b) => { o.position.set(b.x, b.top + 0.15, b.z); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.setScalar(Math.min(b.w, b.d) * 0.35 * cx(b)); });
  useInstances<Building>(r6, garden, (o, b) => { o.position.set(b.x, b.top + 0.35, b.z); o.scale.set(b.w * 0.8, 0.7, b.d * 0.8); });
  const blink = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { if (blink.current) blink.current.opacity = Math.sin(clock.elapsedTime * 3) > 0.6 ? 1 : 0.15; });
  return <group>
    <instancedMesh ref={r1} args={[SL.tank, undefined, Math.max(1, tanks.length)]} castShadow><meshStandardMaterial color="#6a5a4a" roughness={0.9} /></instancedMesh>
    <instancedMesh ref={r2} args={[SL.hvac, undefined, Math.max(1, hvac.length)]} castShadow><meshStandardMaterial color="#8a8f94" metalness={0.5} roughness={0.5} /></instancedMesh>
    <instancedMesh ref={r3} args={[SL.mast, undefined, Math.max(1, ant.length)]}><meshStandardMaterial color="#3a3f45" metalness={0.7} /></instancedMesh>
    <instancedMesh ref={r4} args={[undefined, undefined, Math.max(1, ant.length)]}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial ref={blink} color="#ff3030" transparent toneMapped={false} /></instancedMesh>
    <instancedMesh ref={r5} args={[undefined, undefined, Math.max(1, heli.length)]}><ringGeometry args={[0.75, 1, 32]} /><meshBasicMaterial color="#ffd27a" toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={r6} args={[undefined, undefined, Math.max(1, garden.length)]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#4f7a3a" roughness={1} /></instancedMesh>
  </group>;
}

/** paved streets: a ground-hugging grid mesh over the district ring (skipped over water) */
/** Low-cost facade detail: instanced crown trim and street-facing shop canopies.
 * All placements derive from the existing building layout, so no navigation,
 * collision, world-coordinate or mission state changes are required. */
function DistrictArchitecture({ list }: { list: Building[] }) {
  const crown = useMemo(() => list.filter((b) => b.floors >= 8 && b.style !== "industrial"), [list]);
  const shops = useMemo(() => list.filter((b) => b.district === "market" && b.floors <= 13), [list]);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  useInstances<Building>(crownRef, crown, (o, b) => {
    o.position.set(b.x, b.top - 0.8, b.z + b.d / 2 + 0.12);
    o.scale.set(b.w * (b.crown ? 0.72 : 0.96), 0.32, 0.22);
  });
  useInstances<Building>(canopyRef, shops, (o, b) => {
    const streetY = Math.min(b.base + 4.6, b.top - 0.4);
    o.position.set(b.x, streetY, b.z + b.d / 2 + 0.9);
    o.scale.set(b.w * 0.72, 0.16, 1.8);
  });
  return <group>
    <instancedMesh ref={crownRef} args={[undefined, undefined, Math.max(1, crown.length)]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#c6d9e0" metalness={0.72} roughness={0.3} />
    </instancedMesh>
    <instancedMesh ref={canopyRef} args={[undefined, undefined, Math.max(1, shops.length)]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#466c83" metalness={0.55} roughness={0.42} />
    </instancedMesh>
  </group>;
}

/** Rooftop solar-glass arrays: one instanced mesh, decorative and no collision changes. */
function RooftopSolarArrays({ list }: { list: Building[] }) {
  const sites = useMemo(() => list.filter((b, i) => b.style !== "industrial" && b.floors >= 6 && i % 3 === 0), [list]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances<Building>(ref, sites, (o, b) => {
    o.position.set(b.x, b.top + 0.18, b.z);
    o.rotation.set(0, b.yaw, 0);
    o.scale.set(Math.max(1.2, b.w * 0.5), 0.12, Math.max(1.2, b.d * 0.46));
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, sites.length)]}>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="#243f54" metalness={0.78} roughness={0.21} emissive="#0b2336" emissiveIntensity={0.12} />
  </instancedMesh>;
}

/** Raised concrete sidewalks only around authored, buildable city blocks.
 * A terrain-conforming strip follows each block perimeter; no sidewalks are
 * placed over the hub, water, highways, or unbuildable terrain.
 * This is visual-only: gameplay walkability still follows the terrain system. */
function RaisedSidewalks() {
  const geo = useMemo(() => {
    const pos: number[] = [], idx: number[] = [];
    const half = BLOCK / 2, inner = half - 2.15;
    const segments = 7;
    const addStrip = (x: number, z: number, axis: "x" | "z", sign: number) => {
      for (let i = 0; i < segments; i++) {
        const t0 = -half + (2 * half * i) / segments;
        const t1 = -half + (2 * half * (i + 1)) / segments;
        const corners = axis === "x"
          ? [[t0, sign * inner], [t0, sign * half], [t1, sign * inner], [t1, sign * half]]
          : [[sign * inner, t0], [sign * half, t0], [sign * inner, t1], [sign * half, t1]];
        const offset = pos.length / 3;
        for (const [dx, dz] of corners) {
          const wx = x + (dx ?? 0), wz = z + (dz ?? 0);
          pos.push(wx, walkHeight(wx, wz) + 0.17, wz);
        }
        // Winding is corrected by DoubleSide, keeping normals consistent with uneven ground.
        idx.push(offset, offset + 1, offset + 2, offset + 2, offset + 1, offset + 3);
      }
    };
    for (const b of blocks()) {
      addStrip(b.x, b.z, "x", -1);
      addStrip(b.x, b.z, "x", 1);
      addStrip(b.x, b.z, "z", -1);
      addStrip(b.x, b.z, "z", 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }, []);
  return <mesh geometry={geo} receiveShadow>
    <meshStandardMaterial color="#92999a" roughness={0.91} metalness={0.02} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} />
  </mesh>;
}

function Streets() {
  const geo = useMemo(() => {
    const step = 4, n = Math.ceil(CITY_OUTER / step), pos: number[] = [], idx: number[] = [], keep: boolean[] = [];
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      const x = NEXUS.x + i * step, z = NEXUS.z + j * step;
      pos.push(x, walkHeight(x, z) + 0.08, z);
      const d = Math.hypot(x - NEXUS.x, z - NEXUS.z);
      keep.push(d <= CITY_OUTER && d >= NEXUS.radius * 0.87 && walkHeight(x, z) > WATER_LEVEL + 0.4);
    }
    const W = 2 * n + 1;
    for (let j = 0; j < W - 1; j++) for (let i = 0; i < W - 1; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      if (keep[a] && keep[b] && keep[c] && keep[d]) idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    // asphalt tiles every 8 m in world space (city-surface.ts draws pavers and markings from the same coordinates)
    const uv: number[] = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k]! / 8, pos[k + 2]! / 8);
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }, []);
  const mat = useMemo(() => cityStreetMaterial({ cx: NEXUS.x, cz: NEXUS.z, pitch: PITCH, block: BLOCK, walk: 2.5 }), []);
  return <mesh geometry={geo} material={mat} receiveShadow />;
}

function Lamps() {
  const ls = useMemo(() => lamps(), []);
  const pole = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null);
  useInstances<(typeof ls)[number]>(pole, ls, (o, l) => { o.position.set(l.x, walkHeight(l.x, l.z), l.z); o.rotation.set(0, l.yaw, 0); });
  useInstances<(typeof ls)[number]>(head, ls, (o, l) => { o.position.set(l.x, walkHeight(l.x, l.z), l.z); o.rotation.set(0, l.yaw, 0); });
  return <group>
    <instancedMesh ref={pole} args={[SL.pole6, undefined, Math.max(1, ls.length)]} castShadow><meshStandardMaterial color="#2a3036" metalness={0.7} roughness={0.4} /></instancedMesh>
    <instancedMesh ref={head} args={[SL.head6, undefined, Math.max(1, ls.length)]}><meshStandardMaterial color="#fff2d6" emissive="#ffd9a0" emissiveIntensity={2.2} toneMapped={false} /></instancedMesh>
  </group>;
}

const CAR_TINT = ["#7a1f1f", "#1f3a5a", "#d8d8d8", "#16181c", "#c48a2a", "#3d5a3a"];
/** street parking: the authored Nexus street cars (fleet-models.ts), instanced per model with their own paint */
const PARKED_MODELS: FleetModelId[] = ["luxury-sedan", "muscle-car", "tuner", "street-racer", "city-pod", "luxury-sedan", "tuner", "security-suv"];
function Cars() {
  const items = useMemo<FleetInstance[]>(() => parkedCars().map((c, i) => ({ model: PARKED_MODELS[(i * 7 + c.tint) % PARKED_MODELS.length]!, x: c.x, y: walkHeight(c.x, c.z), z: c.z, yaw: c.yaw, paint: CAR_TINT[c.tint]! })), []);
  return <InstancedFleet items={items} />;
}
