import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldSim } from "@/game/sim";
import { GADGET } from "@/game/vehicle-gadgets";
import { walkHeight } from "@/game/terrain";
import { softSprite } from "./softSprite";

/**
 * Vehicle gadgets on screen (presentation only; sim.gadgets decides everything): mines with a blinking arm light, caltrop
 * spike fields, the flame jets licking out around the hull, the RQ-44 Remora drone with its tracers, and falling flares.
 * Gritty: dull steel and rust for the hardware, the only bright things are what is burning or blinking.
 */
const MINES = 10, SPIKES_PER_FIELD = 60, FIELDS = 3, FLAMES = 40, FLARES = 32, TRACERS = 6;

const steel = new THREE.MeshStandardMaterial({ color: "#3b3a36", roughness: 0.75, metalness: 0.6 });
const rust = new THREE.MeshStandardMaterial({ color: "#5a3a26", roughness: 0.9, metalness: 0.3 });
const empShell = new THREE.MeshStandardMaterial({ color: "#2a3138", roughness: 0.5, metalness: 0.7 });

export function GadgetFx({ sim }: { sim: WorldSim }) {
  const parts = useMemo(() => {
    const root = new THREE.Group();
    root.name = "gadget-fx";
    // mines: a squat disc with a pressure cap and an LED that blinks faster once armed
    const mines = Array.from({ length: MINES }, () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.16, 14), steel);
      body.position.y = 0.08;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), rust);
      cap.position.y = 0.2;
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: "#ff2a1a", toneMapped: false }));
      led.position.set(0.28, 0.18, 0);
      g.add(body, cap, led);
      g.visible = false;
      root.add(g);
      return { g, body, led: led.material as THREE.MeshBasicMaterial };
    });
    // caltrops: a scatter of four-point spikes per field (tetrahedra read as caltrops at gameplay distance)
    const spikeGeo = new THREE.TetrahedronGeometry(0.16);
    const spikes = new THREE.InstancedMesh(spikeGeo, steel, SPIKES_PER_FIELD * FIELDS);
    spikes.count = 0; spikes.frustumCulled = false;
    root.add(spikes);
    // flame jets: additive embers spat out round the hull
    const emberMat = (c: string) => new THREE.SpriteMaterial({ map: softSprite("ember") ?? null, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const flames = Array.from({ length: FLAMES }, (_, i) => { const s = new THREE.Sprite(emberMat(i % 3 ? "#ff7a26" : "#ffd27a")); s.visible = false; root.add(s); return s; });
    const flares = Array.from({ length: FLARES }, () => { const s = new THREE.Sprite(emberMat("#fff0c8")); s.visible = false; root.add(s); return s; });
    // the Remora: a small grey quad with four rotor discs and a downward sensor light
    const drone = new THREE.Group();
    drone.name = "gadget:drone";
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.6), steel);
    drone.add(hull);
    const rotors: THREE.Mesh[] = [];
    for (const [rx, rz] of [[0.55, 0.4], [-0.55, 0.4], [0.55, -0.4], [-0.55, -0.4]] as const) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.06), rust);
      arm.position.set(rx * 0.55, 0.05, rz * 0.55); arm.rotation.y = Math.atan2(rz, rx);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 12), new THREE.MeshBasicMaterial({ color: "#9a9a92", transparent: true, opacity: 0.35, depthWrite: false }));
      disc.position.set(rx, 0.12, rz);
      drone.add(arm, disc); rotors.push(disc);
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: "#ff3b2a", toneMapped: false }));
    eye.position.set(0, -0.13, 0.25);
    drone.add(eye);
    drone.visible = false;
    root.add(drone);
    // drone tracers: thin hot lines that fade fast
    const tracers = Array.from({ length: TRACERS }, () => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#ffcf7a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      l.visible = false; l.frustumCulled = false; root.add(l);
      return { l, t: -1 };
    });
    return { root, mines, spikes, flames, flares, drone, rotors, tracers, tracerNext: 0, seenShot: 0, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), sc: new THREE.Vector3(1, 1, 1) };
  }, []);

  useFrame(() => {
    const st = sim.gadgets, now = performance.now() / 1000, p = parts;
    // mines
    p.mines.forEach((slot, i) => {
      const mn = st.mines[i];
      slot.g.visible = !!mn;
      if (!mn) return;
      slot.g.position.set(mn.x, mn.y, mn.z);
      slot.body.material = mn.kind === "EMP_MINE" ? empShell : steel;
      const armed = now >= mn.armAt;
      const blink = armed ? (now * 2.5) % 1 < 0.2 : (now * 8) % 1 < 0.5;
      slot.led.color.set(mn.kind === "EMP_MINE" ? (blink ? "#4de6ff" : "#0b2830") : blink ? "#ff2a1a" : "#2a0805");
    });
    // caltrop fields: a stable scatter seeded by field id
    let n = 0;
    for (const c of st.caltrops.slice(-FIELDS)) {
      if (c.until <= now) continue;
      for (let k = 0; k < SPIKES_PER_FIELD; k++) {
        const h = Math.sin((c.id * 97 + k) * 12.9898) * 43758.5453;
        const fr = h - Math.floor(h), fa = (h * 7.13) - Math.floor(h * 7.13);
        const r = Math.sqrt(fr) * c.r, a = fa * Math.PI * 2;
        const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        p.e.set(fa * 6, fr * 6, k);
        p.q.setFromEuler(p.e);
        p.v.set(x, groundAt(x, z) + 0.1, z);
        p.m.compose(p.v, p.q, p.sc);
        p.spikes.setMatrixAt(n++, p.m);
      }
    }
    p.spikes.count = n;
    p.spikes.instanceMatrix.needsUpdate = true;
    // flame jets: lit within the last moment → embers ring the hull and stream outward
    const lit = st.flameLit && now - st.flameLit.t < 0.08 ? st.flameLit : null;
    p.flames.forEach((s, i) => {
      if (!lit) { s.visible = false; return; }
      const life = ((now * 2.2 + i / FLAMES) % 1);
      const a = (i / FLAMES) * Math.PI * 2 + now * 0.7;
      const along = Math.cos(a) * 2.6, side = Math.sin(a) * 1.4;
      const fx = Math.sin(lit.yaw), fz = Math.cos(lit.yaw);
      const out = 1 + life * GADGET.FLAME.reach * 0.8;
      const lx = fx * along - fz * side, lz = fz * along + fx * side, ln = Math.hypot(lx, lz) || 1;
      const x = lit.x + lx + (lx / ln) * out * 0.6, z = lit.z + lz + (lz / ln) * out * 0.6;
      s.visible = true;
      s.position.set(x, groundAt(x, z) + 0.35 + life * 1.4, z);
      s.scale.setScalar(0.9 + life * 1.8);
      (s.material as THREE.SpriteMaterial).opacity = 0.85 * (1 - life);
    });
    // flares
    p.flares.forEach((s, i) => {
      const f = st.flares[i];
      if (!f) { s.visible = false; return; }
      const k = Math.max(0, (f.until - now) / GADGET.FLARES.fall);
      s.visible = true;
      s.position.set(f.x, f.y, f.z);
      s.scale.setScalar(0.8 + 1.4 * k + Math.sin(now * 40 + i) * 0.2);
      (s.material as THREE.SpriteMaterial).opacity = Math.min(1, k * 1.6);
    });
    // drone
    const d = st.drones.find((x) => x.until > now);
    p.drone.visible = !!d;
    if (d) {
      p.drone.position.set(d.x, d.y, d.z);
      p.drone.rotation.y = d.angle + Math.PI / 2;
      p.rotors.forEach((r, i) => { r.rotation.y = now * 60 * (i % 2 ? 1 : -1); });
    }
    for (const sh of st.droneShots) {
      if (sh.id <= p.seenShot) continue;
      p.seenShot = sh.id;
      const tr = p.tracers[p.tracerNext++ % TRACERS]!;
      const a = tr.l.geometry.getAttribute("position") as THREE.BufferAttribute;
      a.setXYZ(0, sh.x, sh.y - 0.15, sh.z); a.setXYZ(1, sh.tx, sh.ty, sh.tz); a.needsUpdate = true;
      tr.t = now;
    }
    for (const tr of p.tracers) {
      const k = 1 - (now - tr.t) / 0.09;
      tr.l.visible = tr.t > 0 && k > 0;
      if (tr.l.visible) (tr.l.material as THREE.LineBasicMaterial).opacity = k;
    }
  });
  return <primitive object={parts.root} />;
}

const groundAt = (x: number, z: number) => walkHeight(x, z);
