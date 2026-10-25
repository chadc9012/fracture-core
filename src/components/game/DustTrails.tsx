import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DUST, DUST_TINT, dustAlpha, dustRate } from "@/game/dust-trails";
import type { WorldSim } from "@/game/sim";
import { regionAt } from "@/game/world";
import { walkHeight } from "@/game/terrain";
import { worldLight } from "@/game/world-light";

/** Dust plumes behind the convoy trucks and the player's vehicle in the dry regions (dust-trails.ts). One pooled Points draw: each puff
 * rises, spreads and fades over ~3 s, tinted by the region's ground and dimmed at night. */
const POOL = 420;
const VERT = /* glsl */ `attribute float aSize; attribute float aAlpha; varying float vAlpha;
void main(){ vAlpha = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * (600.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }`;
const FRAG = /* glsl */ `uniform vec3 uColor; varying float vAlpha;
void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float soft = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(uColor, soft * soft * vAlpha * 0.7);
#include <colorspace_fragment>
}`;

type Puff = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; on: boolean };
type Vehicle = { x: number; z: number; inVehicle: boolean };

export function DustTrails({ sim, vehicle }: { sim: WorldSim; vehicle: React.RefObject<Vehicle> }) {
  const puffs = useMemo<Puff[]>(() => Array.from({ length: POOL }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, on: false })), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(POOL * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(POOL), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(POOL), 1));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, uniforms: { uColor: { value: new THREE.Color(DUST_TINT["wastelands"]) } } }), []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  const next = useRef(0), owed = useRef(new Map<string, number>()), last = useRef(new Map<number, { x: number; z: number }>());
  const tint = useMemo(() => new THREE.Color(), []);
  const emit = (x: number, z: number, back: number, speed: number) => {
    for (let n = 0; n < POOL; n++) {
      const k = (next.current + n) % POOL, p = puffs[k]!;
      if (p.on) continue;
      next.current = (k + 1) % POOL;
      const side = (Math.random() - 0.5) * 2.2;
      p.x = x - Math.sin(back) * 2.6 + Math.cos(back) * side; p.z = z - Math.cos(back) * 2.6 - Math.sin(back) * side;
      p.y = walkHeight(p.x, p.z) + 0.3;
      p.vx = -Math.sin(back) * speed * 0.15 + (Math.random() - 0.5) * 0.8; p.vz = -Math.cos(back) * speed * 0.15 + (Math.random() - 0.5) * 0.8;
      p.vy = 0.6 + Math.random() * 0.7; p.age = 0; p.life = DUST.life * (0.75 + Math.random() * 0.5); p.on = true;
      return;
    }
  };
  const feed = (key: string, x: number, z: number, yaw: number, speed: number, dt: number) => {
    const rate = dustRate(regionAt(x, z)?.id, speed, x, z);
    if (!rate) return;
    let o = (owed.current.get(key) ?? 0) + rate * dt;
    while (o >= 1) { emit(x, z, yaw, speed); o -= 1; }
    owed.current.set(key, o);
  };

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    sim.trucks.forEach((t, i) => {
      if (!t.alive) return;
      // the truck's heading from its last position (rot conventions differ between the sim and the models)
      const prev = last.current.get(i); last.current.set(i, { x: t.x, z: t.z });
      if (!prev) return;
      const dx = t.x - prev.x, dz = t.z - prev.z;
      if (dx * dx + dz * dz < 1e-6) return;
      feed(`t${i}`, t.x, t.z, Math.atan2(dx, dz), Math.abs(t.speed), dt);
    });
    const v = vehicle.current;
    if (v?.inVehicle) {
      // heading from the vehicle's actual motion (its yaw convention is the camera's, not the travel direction when sliding)
      const prev = last.current.get(-1); last.current.set(-1, { x: v.x, z: v.z });
      if (prev) { const dx = v.x - prev.x, dz = v.z - prev.z; if (dx * dx + dz * dz > 1e-6) feed("player", v.x, v.z, Math.atan2(dx, dz), Math.hypot(dx, dz) / Math.max(dt, 1e-3), dt); }
    } else last.current.delete(-1);
    const pos = geo.attributes["position"] as THREE.BufferAttribute, size = geo.attributes["aSize"] as THREE.BufferAttribute, alpha = geo.attributes["aAlpha"] as THREE.BufferAttribute;
    let anyOn = false;
    for (let k = 0; k < POOL; k++) {
      const p = puffs[k]!;
      if (p.on) {
        p.age += dt;
        if (p.age >= p.life) p.on = false;
        else {
          anyOn = true;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.vx *= 1 - 0.8 * dt; p.vz *= 1 - 0.8 * dt; p.vy *= 1 - 0.5 * dt;
        }
      }
      const kk = p.on ? p.age / p.life : 1;
      pos.setXYZ(k, p.x, p.y, p.z);
      size.setX(k, DUST.sizeStart + (DUST.sizeEnd - DUST.sizeStart) * Math.sqrt(kk));
      alpha.setX(k, p.on ? dustAlpha(kk) : 0);
    }
    pos.needsUpdate = size.needsUpdate = alpha.needsUpdate = true;
    if (anyOn) geo.computeBoundingSphere();
    const here = v ? regionAt(v.x, v.z)?.id : undefined;
    tint.set(DUST_TINT[here ?? "wastelands"] ?? DUST_TINT["wastelands"]!).multiplyScalar(1 - 0.7 * worldLight.night);
    (mat.uniforms["uColor"]!.value as THREE.Color).copy(tint);
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
