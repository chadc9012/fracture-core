import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GRENADES, THROW, zoneRadius } from "@/game/grenades";
import type { GrenadeRuntime } from "@/game/player-grenades";
import { walkHeight } from "@/game/terrain";

/** The player's Operator grenades on screen (presentation only; player-grenades.ts decides everything). Each live grenade is a
 * small dark canister with a band of its colour; a gone-off grenade that leaves a zone draws it: Shroud a churning cloud of smoke,
 * Thermite a burning pool, Singularity a dark knot with a violet swirl closing in, Rift Well a green ring and column, a Tripmine a
 * red blinking light and its trip ring. Every blast flashes an expanding shell of its colour; Arc Chain draws its arcs. */

const SLOTS = THROW.maxLive, BURSTS = 8, ARCS = 12, PUFFS = 26;

function puffTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d")!, g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.5, "rgba(255,255,255,0.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function PlayerGrenadeFx({ rt }: { rt: GrenadeRuntime }) {
  const geo = useMemo(() => ({
    body: new THREE.CylinderGeometry(0.09, 0.09, 0.2, 20).rotateZ(Math.PI / 2),
    band: new THREE.CylinderGeometry(0.095, 0.095, 0.05, 20).rotateZ(Math.PI / 2),
    ring: new THREE.RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2),
    disc: new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    shell: new THREE.SphereGeometry(1, 32, 16),
    column: new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0),
    swirl: new THREE.TorusGeometry(1, 0.06, 8, 64).rotateX(Math.PI / 2),
    arc: new THREE.BoxGeometry(0.06, 0.06, 1).translate(0, 0, 0.5),
    puff: new THREE.PlaneGeometry(1, 1),
  }), []);
  const mats = useMemo(() => {
    const tex = puffTexture();
    return {
      body: new THREE.MeshStandardMaterial({ color: "#2a2c33", roughness: 0.4, metalness: 0.7 }),
      glow: () => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      smoke: () => new THREE.MeshBasicMaterial({ color: "#c4bcd2", map: tex, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
      dark: new THREE.MeshBasicMaterial({ color: "#05000a" }),
      tex,
    };
  }, []);
  // one material per slot so each can wear its grenade's colour
  const slotMats = useMemo(() => Array.from({ length: SLOTS }, () => ({ band: mats.glow(), ring: mats.glow(), disc: mats.glow(), column: mats.glow(), swirl: mats.glow(), smoke: mats.smoke() })), [mats]);
  const burstMats = useMemo(() => Array.from({ length: BURSTS }, () => mats.glow()), [mats]);
  const arcMat = useMemo(() => { const m = mats.glow(); m.color.set("#bff8ff"); return m; }, [mats]);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose()); mats.body.dispose(); mats.dark.dispose(); mats.tex?.dispose();
    slotMats.forEach((s) => Object.values(s).forEach((m) => m.dispose())); burstMats.forEach((m) => m.dispose()); arcMat.dispose();
  }, [geo, mats, slotMats, burstMats, arcMat]);

  const slots = useRef<(THREE.Group | null)[]>([]), bursts = useRef<(THREE.Mesh | null)[]>([]), arcs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock, camera }) => {
    const now = performance.now() / 1000, t = clock.elapsedTime;
    for (let i = 0; i < SLOTS; i++) {
      const g = slots.current[i]; if (!g) continue;
      const gr = rt.live[i];
      g.visible = !!gr; if (!gr) continue;
      const d = GRENADES[gr.kind], m = slotMats[i]!, col = d.color;
      const [body, band, ring, disc, column, swirl, core, ...puffs] = g.children as THREE.Mesh[];
      for (const k of [m.band, m.ring, m.disc, m.column, m.swirl]) k.color.set(col);
      const groundY = walkHeight(gr.x, gr.z) + 0.04;
      // the canister: flying and rolling, or lying where it went off (hidden once a zone takes over)
      const showBody = !gr.zone;
      body!.visible = band!.visible = showBody;
      if (showBody) {
        body!.position.set(gr.x, gr.y, gr.z); band!.position.copy(body!.position);
        if (!gr.rest) { body!.rotation.x = t * 14; band!.rotation.x = t * 14; }
        // fuse light: blinks faster as it runs out; an armed mine blinks red steadily
        (band!.material as THREE.MeshBasicMaterial).opacity = d.effect === "MINE" ? (gr.armed ? (Math.sin(t * 8) > 0 ? 1 : 0.2) : 0.5) : 0.4 + 0.6 * (Math.sin(t * (4 + (1 - Math.max(0, gr.fuse) / d.fuse) * 22)) > 0 ? 1 : 0);
      }
      const r = gr.zone ? zoneRadius(d) : d.effect === "MINE" && gr.armed ? d.reach : 0, fade = gr.zone ? Math.min(1, gr.life / 1.2) : 1;
      ring!.visible = r > 0; disc!.visible = gr.zone && (d.effect === "BURN" || d.effect === "HEAL");
      column!.visible = gr.zone && d.effect === "HEAL"; swirl!.visible = core!.visible = gr.zone && d.effect === "PULL";
      if (r > 0) { ring!.position.set(gr.x, groundY, gr.z); ring!.scale.setScalar(r); m.ring.opacity = 0.75 * fade; }
      if (disc!.visible) { disc!.position.set(gr.x, groundY - 0.01, gr.z); disc!.scale.setScalar(r); m.disc.opacity = (d.effect === "BURN" ? 0.55 + 0.2 * Math.sin(t * 19) : 0.18) * fade; }
      if (column!.visible) { column!.position.set(gr.x, groundY, gr.z); column!.scale.set(r, 3 + Math.sin(t * 2) * 0.3, r); m.column.opacity = 0.12 * fade; }
      if (swirl!.visible) {
        const k = 1 - Math.max(0, gr.life) / d.duration;
        swirl!.position.set(gr.x, groundY + 1.2, gr.z); swirl!.scale.setScalar(d.reach * (1 - k * 0.8)); swirl!.rotation.y = t * 6;
        core!.position.set(gr.x, groundY + 1.2, gr.z); core!.scale.setScalar(0.5 + k * 0.5);
      }
      // Shroud: puffs churning in the cloud, facing the camera
      const smoke = gr.zone && d.effect === "SMOKE";
      puffs.forEach((p, j) => {
        p.visible = smoke; if (!smoke) return;
        const a = j * 2.39996 + t * 0.15, rr = d.radius * (0.05 + ((j * 37) % 10) / 11);
        p.position.set(gr.x + Math.cos(a) * rr, groundY + 0.9 + ((j * 13) % 7) * 0.4 + Math.sin(t * 0.7 + j) * 0.2, gr.z + Math.sin(a) * rr);
        p.quaternion.copy(camera.quaternion); p.scale.setScalar(3.6 + ((j * 7) % 5) * 0.5);
      });
      m.smoke.opacity = 0.95 * fade;
    }
    // blasts: an expanding shell for the first half second
    const recent = rt.fx.filter((e) => now - e.at < 0.6).slice(-BURSTS);
    for (let i = 0; i < BURSTS; i++) {
      const b = bursts.current[i]; if (!b) continue;
      const e = recent[i]; b.visible = !!e; if (!e) continue;
      const k = (now - e.at) / 0.6;
      b.position.set(e.x, e.y + 0.3, e.z); b.scale.setScalar(Math.max(0.2, e.radius * (0.25 + 0.75 * Math.sqrt(k))));
      burstMats[i]!.color.set(GRENADES[e.kind].color); burstMats[i]!.opacity = 0.55 * (1 - k);
    }
    // Arc Chain's arcs, flickering for a third of a second
    const lines = rt.fx.filter((e) => e.arcs && now - e.at < 0.35).flatMap((e) => e.arcs!.map((a) => ({ ...a, y: e.y + 1 })));
    for (let i = 0; i < ARCS; i++) {
      const l = arcs.current[i]; if (!l) continue;
      const a = lines[i]; l.visible = !!a && Math.sin(t * 60 + i) > -0.3; if (!a) continue;
      l.position.set(a.ax, a.y, a.az); l.lookAt(a.bx, a.y, a.bz); l.scale.set(1, 1, Math.hypot(a.bx - a.ax, a.bz - a.az));
    }
  });

  return (
    <group name="player-grenades">
      {Array.from({ length: SLOTS }, (_, i) => {
        const m = slotMats[i]!;
        return (
          <group key={i} ref={(g) => { slots.current[i] = g; }} visible={false}>
            <mesh geometry={geo.body} material={mats.body} />
            <mesh geometry={geo.band} material={m.band} />
            <mesh geometry={geo.ring} material={m.ring} />
            <mesh geometry={geo.disc} material={m.disc} />
            <mesh geometry={geo.column} material={m.column} />
            <mesh geometry={geo.swirl} material={m.swirl} />
            <mesh geometry={geo.shell} material={mats.dark} />
            {Array.from({ length: PUFFS }, (_, j) => <mesh key={j} geometry={geo.puff} material={m.smoke} />)}
          </group>
        );
      })}
      {Array.from({ length: BURSTS }, (_, i) => <mesh key={i} ref={(m) => { bursts.current[i] = m; }} geometry={geo.shell} material={burstMats[i]!} visible={false} />)}
      {Array.from({ length: ARCS }, (_, i) => <mesh key={i} ref={(m) => { arcs.current[i] = m; }} geometry={geo.arc} material={arcMat} visible={false} />)}
    </group>
  );
}
