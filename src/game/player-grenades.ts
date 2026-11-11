/**
 * The player's grenades in the world (grenades.ts holds the numbers and the throw). Scene steps this each frame after the sim:
 * grenades fly, bounce and go off; blasts, burn pools, smoke, mines, marks, pulls, arcs and heal wells are applied to the real
 * machines through the sim's own damage path (applyMachineDamageMods → defeatMachine), so kills, drops and damage numbers work as
 * for any other player damage. `fx` records what went off for the presentation (PlayerGrenadeFx), which never decides anything.
 */
import { GRENADES, blastDamage, inSmoke, newPouch, stepFlight, stepPouch, switchPouch, throwGrenade, zoneRadius, type GrenadeId, type GrenadePouch, type LiveGrenade } from "./grenades";
import { applyMachineDamageMods, defeatMachine, markGoreHit, stunMachine, type Machine, type WorldSim } from "./sim";

export type GrenadeFxEvent = { id: number; kind: GrenadeId; x: number; y: number; z: number; radius: number; at: number; arcs?: { ax: number; az: number; bx: number; bz: number }[] };
export type GrenadeRuntime = { pouch: GrenadePouch; live: LiveGrenade[]; nextId: number; fx: GrenadeFxEvent[]; nextFx: number;
  /** machines stunned by a grenade, until when (seconds) — the Killbox bots read it so stunned rivals hold fire */
  stunned: Map<Machine, number> };

export const newGrenadeRuntime = (kind: GrenadeId): GrenadeRuntime => ({ pouch: newPouch(kind), live: [], nextId: 1, fx: [], nextFx: 1, stunned: new Map() });
export const setGrenadeKind = (rt: GrenadeRuntime, kind: GrenadeId) => { rt.pouch = switchPouch(rt.pouch, kind); };

/** throw from the player's hand; returns false (and the reason) when the pouch is empty */
export function throwPlayerGrenade(rt: GrenadeRuntime, from: { x: number; y: number; z: number }, yaw: number, pitch: number): boolean {
  const g = throwGrenade(rt.pouch, rt.live, rt.nextId, from, yaw, pitch);
  if (!g) return false;
  rt.nextId++;
  return true;
}

/** is the player standing in Shroud smoke (enemies' sight of them drops to SMOKE_SIGHT)? */
export const playerShrouded = (rt: GrenadeRuntime | null | undefined, x: number, z: number) => !!rt && inSmoke(rt.live, x, z);

type World = { player: { x: number; z: number }; ground: (x: number, z: number) => number; now: number };

export function stepPlayerGrenades(sim: WorldSim, rt: GrenadeRuntime, dt: number, w: World) {
  stepPouch(rt.pouch, dt);
  for (const [m, until] of rt.stunned) if (until <= w.now || !m.alive) rt.stunned.delete(m);
  const hurt = (m: Machine, dmg: number, from: { x: number; z: number }, element: "KINETIC" | "THERMAL" | "ARC") => {
    if (!m.alive || dmg <= 0) return;
    const dealt = applyMachineDamageMods(sim, m, dmg, element, w.player.x, w.player.z);
    m.hp -= dealt;
    markGoreHit(sim, m, m.x - from.x || 0.01, m.z - from.z, dealt * 2, "BLAST");
    sim.lastHit = performance.now(); sim.combatHeat += 1;
    if (m.hp <= 0) defeatMachine(sim, m);
  };
  const stun = (m: Machine, s: number) => { if (s <= 0) return; stunMachine(m, s); if (!m.boss) m.aim = 0; rt.stunned.set(m, Math.max(rt.stunned.get(m) ?? 0, w.now + s)); };
  const shove = (m: Machine, from: { x: number; z: number }, dist: number) => {
    if (m.boss || dist <= 0) return;
    const dx = m.x - from.x, dz = m.z - from.z, d = Math.hypot(dx, dz) || 1;
    m.x += (dx / d) * dist; m.z += (dz / d) * dist;
  };
  const near = (x: number, z: number, r: number) => sim.machines.filter((m) => m.alive && Math.hypot(m.x - x, m.z - z) < r);
  const fx = (gr: LiveGrenade, radius: number, arcs?: GrenadeFxEvent["arcs"]) => { rt.fx.push({ id: rt.nextFx++, kind: gr.kind, x: gr.x, y: gr.y, z: gr.z, radius, at: w.now, ...(arcs ? { arcs } : {}) }); if (rt.fx.length > 24) rt.fx.shift(); };
  const blast = (gr: LiveGrenade, element: "KINETIC" | "THERMAL" | "ARC") => {
    const g = GRENADES[gr.kind];
    for (const m of near(gr.x, gr.z, g.radius)) { const d = Math.hypot(m.x - gr.x, m.z - gr.z); hurt(m, blastDamage(g, d), gr, element); shove(m, gr, g.knockback * (1 - d / g.radius)); stun(m, g.stun); }
  };

  for (const gr of [...rt.live]) {
    const g = GRENADES[gr.kind];
    stepFlight(gr, dt, w.ground);
    // mines: arm on landing, then wait for something to come close
    if (g.effect === "MINE") {
      if (!gr.rest) continue;
      if (!gr.armed) { gr.fuse -= dt; if (gr.fuse <= 0) gr.armed = true; continue; }
      gr.life -= dt;
      if (near(gr.x, gr.z, g.reach).length) { blast(gr, "KINETIC"); fx(gr, g.radius); sim.playerNoise = 1; rt.live.splice(rt.live.indexOf(gr), 1); continue; }
      if (gr.life <= 0) rt.live.splice(rt.live.indexOf(gr), 1);
      continue;
    }
    if (!gr.zone) {
      gr.fuse -= dt;
      if (gr.fuse > 0) continue;
      // it goes off where it lies
      gr.vx = gr.vy = gr.vz = 0; gr.rest = true; sim.playerNoise = 1;
      switch (g.effect) {
        case "BLAST": blast(gr, "KINETIC"); fx(gr, g.radius); rt.live.splice(rt.live.indexOf(gr), 1); continue;
        case "MARK": {
          for (const m of near(gr.x, gr.z, g.radius)) { hurt(m, blastDamage(g, Math.hypot(m.x - gr.x, m.z - gr.z)), gr, "ARC"); if (m.alive) { m.vulnUntil = Math.max(m.vulnUntil, w.now + g.duration); m.vulnMult = Math.max(m.vulnMult, 1 + g.amount); } }
          fx(gr, g.radius); rt.live.splice(rt.live.indexOf(gr), 1); continue;
        }
        case "CHAIN": {
          const hit = near(gr.x, gr.z, g.radius), arcs: NonNullable<GrenadeFxEvent["arcs"]> = [];
          for (const m of hit) { hurt(m, blastDamage(g, Math.hypot(m.x - gr.x, m.z - gr.z)), gr, "ARC"); stun(m, g.stun); arcs.push({ ax: gr.x, az: gr.z, bx: m.x, bz: m.z }); }
          // arc on from the last thing hit to the nearest enemies not yet touched
          let from = hit[hit.length - 1] ?? null;
          const done = new Set(hit);
          for (let j = 0; j < g.jumps && from; j++) {
            const src: Machine = from;
            const next = sim.machines.filter((m) => m.alive && !done.has(m) && Math.hypot(m.x - src.x, m.z - src.z) < g.reach).sort((a, b) => Math.hypot(a.x - src.x, a.z - src.z) - Math.hypot(b.x - src.x, b.z - src.z))[0];
            if (!next) break;
            done.add(next); arcs.push({ ax: src.x, az: src.z, bx: next.x, bz: next.z });
            hurt(next, g.damage * 0.6, src, "ARC"); stun(next, g.stun);
            from = next;
          }
          fx(gr, g.radius, arcs); rt.live.splice(rt.live.indexOf(gr), 1); continue;
        }
        case "BURN": blast(gr, "THERMAL"); break;
        default: break;
      }
      // the rest leave a zone behind
      gr.zone = true; gr.life = g.duration; fx(gr, zoneRadius(g));
      continue;
    }
    // a zone, burning / smoking / pulling / healing
    gr.life -= dt;
    const r = zoneRadius(g);
    if (g.effect === "BURN") for (const m of near(gr.x, gr.z, r)) hurt(m, g.tick * dt, gr, "THERMAL");
    if (g.effect === "SMOKE") for (const m of near(gr.x, gr.z, r)) { if (!m.boss) m.aim = 0; m.cool = Math.max(m.cool, 0.3); }
    if (g.effect === "PULL") for (const m of near(gr.x, gr.z, r)) {
      if (m.boss) continue;
      const dx = gr.x - m.x, dz = gr.z - m.z, d = Math.hypot(dx, dz);
      if (d > 0.6) { const step = Math.min(d - 0.5, 7 * dt); m.x += (dx / d) * step; m.z += (dz / d) * step; }
      m.aim = 0;
    }
    if (g.effect === "HEAL") {
      if (Math.hypot(w.player.x - gr.x, w.player.z - gr.z) < r && sim.hp > 0) sim.hp = Math.min(100, sim.hp + g.tick * dt);
      // enemies in the well fire at a fraction of their rate
      for (const m of near(gr.x, gr.z, r)) m.cool += dt * g.amount;
    }
    if (gr.life <= 0) {
      if (g.effect === "PULL") { for (const m of near(gr.x, gr.z, g.radius)) hurt(m, blastDamage(g, Math.hypot(m.x - gr.x, m.z - gr.z)), gr, "ARC"); fx(gr, g.radius); }
      rt.live.splice(rt.live.indexOf(gr), 1);
    }
  }
}
