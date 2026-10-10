import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import { walkHeight } from "@/game/terrain";
import { ENCOUNTERS } from "@/game/scenario-encounters";
import { ELEMENT_STYLE, attackFx, flightAt, launch, stepFlights, volleyTargets, type Element } from "@/game/combat-fx";
import { stepCasings } from "@/game/casings";
import { CASING_POOL, FLIGHT_POOL, fxBus } from "@/game/fx-bus";

type Pending = { at: number; scenarioId: string; element: Element; count: number; spread: number; reach: number; ax: number; az: number };
type Spell = { start: number; end: number; x: number; y: number; z: number; element: Element };

/** Presentation only: elemental flights (troop shots and boss volleys), Dark Knight staff spell circles and ejected casings. It reads
 * sim.encounterEvents and the fxBus pools; it never changes the sim, a hit, damage or a reward. Pooled meshes, no per-frame allocation. */
export function CombatFx({ sim, reducedMotion }: { sim: WorldSim; reducedMotion: boolean }) {
  const orbs = useRef<(THREE.Mesh | null)[]>([]);
  const trails = useRef<(THREE.Mesh | null)[]>([]);
  const casings = useRef<THREE.InstancedMesh>(null);
  const circles = useRef<(THREE.Group | null)[]>([]);
  const seen = useRef(0);
  const pending = useRef<Pending[]>([]);
  const spells = useRef<(Spell | null)[]>([null, null]);
  const tmp = useMemo(() => ({ pos: [0, 0, 0] as [number, number, number], m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(), p: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), d: new THREE.Vector3(), c: new THREE.Color() }), []);

  useEffect(() => {
    const mesh = casings.current;
    if (mesh) mesh.count = CASING_POOL;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt), now = performance.now() / 1000;
    // 1) boss attacks -> volleys at the end of the tell (when the real hit is resolved) and staff spells during it
    for (const e of sim.encounterEvents) {
      if (e.id <= seen.current) continue;
      seen.current = e.id;
      if (e.kind !== "TELL" || !e.attack) continue;
      const def = ENCOUNTERS[e.scenarioId]?.attacks[e.attack];
      if (!def) continue;
      const fx = attackFx(e.scenarioId, e.attack, def.kind);
      const boss = sim.machines.find((m) => m.alive && m.scenarioId === e.scenarioId);
      if (fx.mode === "volley") pending.current.push({ at: e.at + e.duration, scenarioId: e.scenarioId, element: fx.element, count: fx.count, spread: fx.spread, reach: def.reach ?? 40, ax: e.x, az: e.z });
      else if (fx.mode === "spell" && boss) {
        const slot = spells.current[0] && now < spells.current[0]!.end ? 1 : 0;
        spells.current[slot] = { start: e.at, end: e.at + e.duration + 0.5, x: boss.x, y: Math.max(boss.y, walkHeight(boss.x, boss.z)) + 0.2, z: boss.z, element: fx.element };
      }
    }
    pending.current = pending.current.filter((p) => {
      if (now < p.at) return true;
      const boss = sim.machines.find((m) => m.alive && m.scenarioId === p.scenarioId);
      if (boss) {
        const y0 = Math.max(boss.y, walkHeight(boss.x, boss.z)) + 2.6;
        for (const t of volleyTargets(boss, { x: p.ax, z: p.az }, p.count, p.spread, p.reach)) launch(fxBus.flights, p.element, [boss.x, y0, boss.z], [t.x, walkHeight(t.x, t.z) + 1.2, t.z], 1.3);
      }
      return false;
    });

    // 2) step the pools
    stepFlights(fxBus.flights, dt);
    stepCasings(fxBus.casings, dt, walkHeight);

    // 3) draw flights
    for (let i = 0; i < FLIGHT_POOL; i++) {
      const f = fxBus.flights[i]!, orb = orbs.current[i], tr = trails.current[i];
      if (!orb || !tr) continue;
      orb.visible = tr.visible = f.alive;
      if (!f.alive) continue;
      const st = ELEMENT_STYLE[f.element];
      flightAt(f, tmp.pos);
      orb.position.set(tmp.pos[0], tmp.pos[1], tmp.pos[2]);
      orb.scale.setScalar(f.size * (0.8 + 0.4 * Math.sin(now * 40 + i)));
      (orb.material as THREE.MeshBasicMaterial).color.set(st.core);
      tmp.d.set(f.tx - f.fx, f.ty - f.fy, f.tz - f.fz).normalize();
      tmp.q.setFromUnitVectors(tmp.up, tmp.d);
      tr.quaternion.copy(tmp.q);
      const len = st.trail * (f.size / st.size) * 0.9;
      tr.scale.set(f.size * 2.2, len, f.size * 2.2);
      tr.position.set(tmp.pos[0] - tmp.d.x * len * 0.5, tmp.pos[1] - tmp.d.y * len * 0.5, tmp.pos[2] - tmp.d.z * len * 0.5);
      const mat = tr.material as THREE.MeshBasicMaterial;
      mat.color.set(st.color); mat.opacity = 0.55 * (1 - f.age / f.life * 0.5);
    }

    // 4) casings (instanced; dead ones are collapsed to zero scale)
    const cm = casings.current;
    if (cm) {
      for (let i = 0; i < CASING_POOL; i++) {
        const c = fxBus.casings[i]!;
        if (!c.alive) { tmp.m.makeScale(0, 0, 0); cm.setMatrixAt(i, tmp.m); continue; }
        tmp.e.set(c.rx, 0, c.rz); tmp.q.setFromEuler(tmp.e);
        const k = c.size === "large" ? 2.6 : 1;
        tmp.s.set(k, k, k); tmp.p.set(c.x, c.y, c.z);
        tmp.m.compose(tmp.p, tmp.q, tmp.s);
        cm.setMatrixAt(i, tmp.m);
      }
      cm.instanceMatrix.needsUpdate = true;
    }

    // 5) Dark Knight staff spells: a spinning glyph circle with a rising beam that swells over the tell, then flashes out
    spells.current.forEach((sp, i) => {
      const g = circles.current[i];
      if (!g) return;
      if (!sp || now > sp.end) { g.visible = false; if (sp) spells.current[i] = null; return; }
      const t = Math.min(1, Math.max(0, (now - sp.start) / Math.max(0.1, sp.end - sp.start)));
      const st = ELEMENT_STYLE[sp.element];
      g.visible = true;
      g.position.set(sp.x, sp.y, sp.z);
      const [ring, glyph, beam] = g.children as THREE.Mesh[];
      const r = 2.2 + 3.5 * t;
      ring!.scale.set(r, r, 1);
      glyph!.scale.set(r * 0.62, r * 0.62, 1);
      glyph!.rotation.z = reducedMotion ? 0 : now * 2.4;
      beam!.scale.set(0.5 + t, 6 + 10 * t, 0.5 + t); beam!.position.y = 3 + 5 * t;
      for (const m of [ring, glyph, beam]) { const mat = m!.material as THREE.MeshBasicMaterial; mat.color.set(m === beam ? st.core : st.color); mat.opacity = (m === beam ? 0.45 : 0.85) * (t > 0.9 ? (1 - t) * 10 : 1); }
    });
  });

  return (
    <group>
      {Array.from({ length: FLIGHT_POOL }, (_, i) => (
        <group key={i}>
          <mesh ref={(m) => { orbs.current[i] = m; }} visible={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#ffffff" toneMapped={false} fog={false} /></mesh>
          <mesh ref={(m) => { trails.current[i] = m; }} visible={false}><cylinderGeometry args={[0.3, 1, 1, 6, 1, true]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} /></mesh>
        </group>
      ))}
      <instancedMesh ref={casings} args={[undefined, undefined, CASING_POOL]} frustumCulled={false}>
        <cylinderGeometry args={[0.018, 0.018, 0.07, 6]} />
        <meshStandardMaterial color="#d8a94a" metalness={0.9} roughness={0.35} />
      </instancedMesh>
      {[0, 1].map((i) => (
        <group key={`c${i}`} ref={(g) => { circles.current[i] = g; }} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.92, 1, 64]} /><meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} fog={false} /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.55, 0.62, 6]} /><meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} fog={false} /></mesh>
          <mesh><cylinderGeometry args={[0.5, 0.5, 1, 14, 1, true]} /><meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} fog={false} /></mesh>
        </group>
      ))}
    </group>
  );
}
