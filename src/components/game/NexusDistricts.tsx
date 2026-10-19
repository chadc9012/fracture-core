import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { walkHeight, WATER_LEVEL } from "@/game/terrain";
import { addObstacle } from "@/game/obstacles";
import { CITY_OUTER, NEXUS, buildings, lamps, parkedCars, type Building, type Style } from "@/game/nexus-districts";
import { useInstances } from "./instancing";

/** Nexus City outer districts: a street grid of buildings around the safe-zone hub (layout in nexus-districts.ts).
 * Building bodies are instanced boxes per style; windows are drawn by the shader in world space (so they never stretch
 * with the box), a share of them lit warm. Crowns, rooftop kit, street lamps and parked cars are instanced too. */
export function NexusDistricts() {
  const bs = useMemo(() => buildings(), []);
  useEffect(() => { for (const b of bs) addObstacle("tower", b.x, b.z, Math.min(b.w, b.d) * 0.5, 1e6, 3); }, [bs]);
  return (
    <group>
      <Streets />
      {(["glass", "concrete", "industrial"] as const).map((s) => <Bodies key={s} style={s} list={bs.filter((b) => b.style === s)} />)}
      <Crowns list={bs.filter((b) => b.crown)} />
      <Roofs list={bs} />
      <Lamps />
      <Cars />
    </group>
  );
}

const LOOK: Record<Style, { color: string; glass: string; lit: number; cell: [number, number]; win: [number, number]; metal: number; rough: number }> = {
  glass: { color: "#5d7486", glass: "#1b2b3a", lit: 0.42, cell: [2.2, 3.4], win: [0.86, 0.78], metal: 0.32, rough: 0.36 },
  concrete: { color: "#a39a8c", glass: "#1d2229", lit: 0.35, cell: [3.0, 3.4], win: [0.5, 0.5], metal: 0.05, rough: 0.9 },
  industrial: { color: "#4f5458", glass: "#1a1d20", lit: 0.2, cell: [6.0, 4.2], win: [0.35, 0.25], metal: 0.5, rough: 0.7 },
};

/** a MeshStandardMaterial whose faces get a world-space window grid; roofs and floors (|n.y| > 0.5) stay solid */
function windowMaterial(style: Style): THREE.MeshStandardMaterial {
  const L = LOOK[style];
  const m = new THREE.MeshStandardMaterial({ color: L.color, metalness: L.metal, roughness: L.rough });
  m.onBeforeCompile = (sh) => {
    sh.uniforms["uGlass"] = { value: new THREE.Color(L.glass) };
    sh.uniforms["uCell"] = { value: new THREE.Vector2(...L.cell) };
    sh.uniforms["uWin"] = { value: new THREE.Vector2(...L.win) };
    sh.uniforms["uLit"] = { value: L.lit };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWp; varying vec3 vWn;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n#ifdef USE_INSTANCING\n mat4 wfIm = modelMatrix * instanceMatrix;\n#else\n mat4 wfIm = modelMatrix;\n#endif\n vWp = (wfIm * vec4(transformed, 1.0)).xyz; vWn = normalize(mat3(wfIm) * objectNormal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWp; varying vec3 vWn; uniform vec3 uGlass; uniform vec2 uCell; uniform vec2 uWin; uniform float uLit;\nfloat wHash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }")
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
          diffuseColor.rgb *= (0.95 + 0.1 * wHash(mod(floor(id * 0.5), 1024.0))) * (1.0 - seam * 0.12);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.071, 0.084), frame * 0.88);
          diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, inside * 0.91);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.105, 0.12), mullion * 0.7);
          float lit = max(0.0, inside - mullion) * step(h, uLit);
          vec3 warm = mix(vec3(1.0, 0.72, 0.38), vec3(0.75, 0.88, 1.0), step(0.8, fract(h * 7.0)));
          totalEmissiveRadiance += warm * lit * (0.42 + 0.38 * fract(h * 13.0));
        }`);
  };
  return m;
}

function Bodies({ style, list }: { style: Style; list: Building[] }) {
  const mat = useMemo(() => windowMaterial(style), [style]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useInstances<Building>(ref, list, (o, b) => {
    const top = b.crown ? b.base + (b.top - b.base) * 0.78 : b.top;
    o.position.set(b.x, (b.base + top) / 2, b.z); o.rotation.set(0, b.yaw, 0); o.scale.set(b.w, top - b.base, b.d);
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, list.length)]} material={mat} castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /></instancedMesh>;
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
  useInstances<Building>(r3, ant, (o, b) => { o.position.set(b.x, b.top + 6, b.z); o.scale.set(0.15, 12, 0.15); });
  useInstances<Building>(r4, ant, (o, b) => { o.position.set(b.x, b.top + 12.2, b.z); o.scale.setScalar(0.35); });
  useInstances<Building>(r5, heli, (o, b) => { o.position.set(b.x, b.top + 0.15, b.z); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.setScalar(Math.min(b.w, b.d) * 0.35 * cx(b)); });
  useInstances<Building>(r6, garden, (o, b) => { o.position.set(b.x, b.top + 0.35, b.z); o.scale.set(b.w * 0.8, 0.7, b.d * 0.8); });
  const blink = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { if (blink.current) blink.current.opacity = Math.sin(clock.elapsedTime * 3) > 0.6 ? 1 : 0.15; });
  return <group>
    <instancedMesh ref={r1} args={[undefined, undefined, Math.max(1, tanks.length)]} castShadow><cylinderGeometry args={[1, 1, 1, 10]} /><meshStandardMaterial color="#6a5a4a" roughness={0.9} /></instancedMesh>
    <instancedMesh ref={r2} args={[undefined, undefined, Math.max(1, hvac.length)]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#8a8f94" metalness={0.5} roughness={0.5} /></instancedMesh>
    <instancedMesh ref={r3} args={[undefined, undefined, Math.max(1, ant.length)]}><cylinderGeometry args={[1, 1, 1, 5]} /><meshStandardMaterial color="#3a3f45" metalness={0.7} /></instancedMesh>
    <instancedMesh ref={r4} args={[undefined, undefined, Math.max(1, ant.length)]}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial ref={blink} color="#ff3030" transparent toneMapped={false} /></instancedMesh>
    <instancedMesh ref={r5} args={[undefined, undefined, Math.max(1, heli.length)]}><ringGeometry args={[0.75, 1, 32]} /><meshBasicMaterial color="#ffd27a" toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={r6} args={[undefined, undefined, Math.max(1, garden.length)]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#4f7a3a" roughness={1} /></instancedMesh>
  </group>;
}

/** paved streets: a ground-hugging grid mesh over the district ring (skipped over water) */
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
    return g;
  }, []);
  return <mesh geometry={geo} receiveShadow><meshStandardMaterial color="#2c3138" roughness={0.92} metalness={0.05} polygonOffset polygonOffsetFactor={-1} /></mesh>;
}

function Lamps() {
  const ls = useMemo(() => lamps(), []);
  const pole = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null);
  useInstances<(typeof ls)[number]>(pole, ls, (o, l) => { o.position.set(l.x, walkHeight(l.x, l.z) + 3, l.z); o.scale.set(0.09, 6, 0.09); });
  useInstances<(typeof ls)[number]>(head, ls, (o, l) => { o.position.set(l.x + Math.sin(l.yaw) * 0.8, walkHeight(l.x, l.z) + 6, l.z + Math.cos(l.yaw) * 0.8); o.rotation.set(0, l.yaw, 0); o.scale.set(0.35, 0.12, 1.2); });
  return <group>
    <instancedMesh ref={pole} args={[undefined, undefined, Math.max(1, ls.length)]} castShadow><cylinderGeometry args={[1, 1, 1, 6]} /><meshStandardMaterial color="#2a3036" metalness={0.7} roughness={0.4} /></instancedMesh>
    <instancedMesh ref={head} args={[undefined, undefined, Math.max(1, ls.length)]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#fff2d6" emissive="#ffd9a0" emissiveIntensity={2.2} toneMapped={false} /></instancedMesh>
  </group>;
}

const CAR_TINT = ["#7a1f1f", "#1f3a5a", "#d8d8d8", "#2a2a2a", "#c48a2a", "#3d5a3a"];
function Cars() {
  const cs = useMemo(() => parkedCars(), []);
  const body = useRef<THREE.InstancedMesh>(null), cab = useRef<THREE.InstancedMesh>(null);
  useInstances<(typeof cs)[number]>(body, cs, (o, c) => { o.position.set(c.x, walkHeight(c.x, c.z) + 0.55, c.z); o.rotation.set(0, c.yaw, 0); o.scale.set(1.8, 0.7, 4.2); }, (c) => CAR_TINT[c.tint]!);
  useInstances<(typeof cs)[number]>(cab, cs, (o, c) => { o.position.set(c.x, walkHeight(c.x, c.z) + 1.15, c.z); o.rotation.set(0, c.yaw, 0); o.scale.set(1.6, 0.55, 2.2); });
  return <group>
    <instancedMesh ref={body} args={[undefined, undefined, Math.max(1, cs.length)]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial metalness={0.6} roughness={0.35} /></instancedMesh>
    <instancedMesh ref={cab} args={[undefined, undefined, Math.max(1, cs.length)]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#1b2229" metalness={0.8} roughness={0.15} /></instancedMesh>
  </group>;
}
