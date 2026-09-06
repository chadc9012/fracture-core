import { REGIONS, type Region } from "./world";
import { heightAt, smoothstep, walkHeight } from "./terrain";

/* ------------------------------------------------------------------
 * World simulation: faction capture, fracture instability,
 * AI war machines, NPC convoys and projectiles.
 * Plain mutable state, stepped once per frame (no React churn).
 * ------------------------------------------------------------------ */

export type Faction = "vanguard" | "syndicate" | "overseer";

export const FACTIONS: Record<Faction, { name: string; short: string; color: string }> = {
  vanguard: { name: "Vanguard (you)", short: "VGD", color: "#66e0ff" },
  syndicate: { name: "Iron Syndicate", short: "SYN", color: "#ff4d4d" },
  overseer: { name: "The Overseer", short: "OVR", color: "#c86bff" },
};

export type ZoneState = {
  region: Region;
  owner: Faction;
  /** 0..1 capture progress of the challenger */
  progress: number;
  challenger: Faction;
  contested: boolean;
  /** fracture instability 0..1 */
  instability: number;
};

export type Machine = {
  alive: boolean;
  x: number;
  z: number;
  y: number;
  hp: number;
  rot: number;
  scale: number;
  zone: string;
  cool: number;
};

export type Truck = {
  alive: boolean;
  lane: number;
  t: number;
  dir: 1 | -1;
  x: number;
  z: number;
  y: number;
  rot: number;
  hp: number;
  cargo: number;
};

export type Bullet = {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
};

export type Lane = { name: string; a: Region; b: Region };

export type WorldSim = {
  zones: ZoneState[];
  lanes: Lane[];
  machines: Machine[];
  trucks: Truck[];
  bullets: Bullet[];
  credits: number;
  cargo: number;
  hp: number;
  gravity: number;
  alerts: { text: string; life: number }[];
  kills: number;
  extractions: number;
};

const byId = (id: string) => REGIONS.find((r) => r.id === id)!;

export const MACHINE_POOL = 16;
export const TRUCK_POOL = 12;
export const BULLET_POOL = 48;

export function createSim(): WorldSim {
  const zones: ZoneState[] = REGIONS.map((region) => ({
    region,
    owner:
      region.id === "nexus"
        ? "vanguard"
        : region.kind === "fracture" || region.kind === "core"
          ? "overseer"
          : "syndicate",
    progress: 0,
    challenger: "vanguard",
    contested: false,
    instability: 0,
  }));

  const lanes: Lane[] = [
    { name: "Nexus → Wastelands supply run", a: byId("nexus"), b: byId("wastelands") },
    { name: "Wastelands → Solara convoy", a: byId("wastelands"), b: byId("solara") },
    { name: "Veridan → Nexus resource haul", a: byId("veridan"), b: byId("nexus") },
    { name: "Wastelands → Frostspire ascent", a: byId("wastelands"), b: byId("frostspire") },
  ];

  const machines: Machine[] = Array.from({ length: MACHINE_POOL }, () => ({
    alive: false,
    x: 0,
    z: 0,
    y: 0,
    hp: 0,
    rot: 0,
    scale: 1,
    zone: "",
    cool: 0,
  }));

  const trucks: Truck[] = Array.from({ length: TRUCK_POOL }, (_, i) => ({
    alive: i < 8,
    lane: i % 4,
    t: (i * 0.17) % 1,
    dir: i % 2 === 0 ? 1 : -1,
    x: 0,
    z: 0,
    y: 0,
    rot: 0,
    hp: 3,
    cargo: 1 + (i % 3),
  }));

  const bullets: Bullet[] = Array.from({ length: BULLET_POOL }, () => ({
    alive: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vz: 0,
    life: 0,
  }));

  return {
    zones,
    lanes,
    machines,
    trucks,
    bullets,
    credits: 0,
    cargo: 0,
    hp: 100,
    gravity: 26,
    alerts: [],
    kills: 0,
    extractions: 0,
  };
}

export function alert(sim: WorldSim, text: string) {
  sim.alerts.unshift({ text, life: 6 });
  if (sim.alerts.length > 4) sim.alerts.pop();
}

export function zoneOf(sim: WorldSim, id: string) {
  return sim.zones.find((z) => z.region.id === id);
}

function lanePoint(lane: Lane, t: number) {
  // arc between the two hubs so lanes read as roads, not straight lines
  const mx = (lane.a.x + lane.b.x) / 2;
  const mz = (lane.a.z + lane.b.z) / 2;
  const nx = -(lane.b.z - lane.a.z) * 0.18;
  const nz = (lane.b.x - lane.a.x) * 0.18;
  const cx = mx + nx;
  const cz = mz + nz;
  const u = 1 - t;
  return {
    x: u * u * lane.a.x + 2 * u * t * cx + t * t * lane.b.x,
    z: u * u * lane.a.z + 2 * u * t * cz + t * t * lane.b.z,
  };
}

export function laneSamples(lane: Lane, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, i) => lanePoint(lane, i / steps));
}

function spawnMachine(sim: WorldSim, zone: ZoneState, near: { x: number; z: number }) {
  const m = sim.machines.find((x) => !x.alive);
  if (!m) return;
  const a = Math.random() * Math.PI * 2;
  const d = zone.region.radius * (0.4 + Math.random() * 0.55);
  m.alive = true;
  m.x = zone.region.x + Math.cos(a) * d;
  m.z = zone.region.z + Math.sin(a) * d;
  m.hp = 3 + Math.round(zone.region.difficulty * 0.8);
  m.rot = 0;
  m.scale = 0.9 + Math.random() * 0.8;
  m.zone = zone.region.id;
  m.cool = 1.5;
  void near;
}

export function fireBullet(sim: WorldSim, x: number, y: number, z: number, yaw: number) {
  const b = sim.bullets.find((v) => !v.alive);
  if (!b) return false;
  b.alive = true;
  b.x = x;
  b.y = y;
  b.z = z;
  b.vx = Math.sin(yaw) * 130;
  b.vz = Math.cos(yaw) * 130;
  b.life = 1.4;
  return true;
}

export type SimInput = {
  px: number;
  pz: number;
  dt: number;
  /** 0..1 through the day; night raises AI aggression */
  night: number;
  inVehicle: boolean;
};

export function stepSim(sim: WorldSim, input: SimInput) {
  const { dt, px, pz, night } = input;

  // ---------- alerts ----------
  for (const a of sim.alerts) a.life -= dt;
  sim.alerts = sim.alerts.filter((a) => a.life > 0);

  const t = performance.now() / 1000;
  let playerInstability = 0;
  let liveMachines = 0;
  for (const m of sim.machines) if (m.alive) liveMachines++;

  // ---------- zones: instability + faction capture ----------
  for (const z of sim.zones) {
    const r = z.region;
    const dPlayer = Math.hypot(px - r.x, pz - r.z);
    const inside = dPlayer < r.radius;

    // fracture zones pulse — gravity and terrain go unstable
    if (r.kind === "fracture" || r.kind === "core") {
      const pulse = (Math.sin(t * 0.35 + r.x) + Math.sin(t * 0.11 + r.z)) * 0.5;
      z.instability = Math.min(1, Math.max(0, 0.45 + pulse * 0.55));
    } else {
      z.instability = 0;
    }
    if (inside) {
      playerInstability = Math.max(
        playerInstability,
        z.instability * (1 - smoothstep(r.radius * 0.6, r.radius, dPlayer)),
      );
    }

    if (r.id === "nexus") {
      z.contested = false;
      z.progress = 0;
      continue;
    }

    // background faction pressure + the player's own presence
    const pressure = (0.012 + r.difficulty * 0.004) * (night > 0.5 ? 1.5 : 1);
    if (inside) {
      z.challenger = "vanguard";
      z.progress += dt * (input.inVehicle ? 0.075 : 0.05);
    } else {
      const drift = z.owner === "vanguard" ? 1 : -1;
      if (z.owner === "vanguard") z.challenger = r.kind === "fracture" || r.kind === "core" ? "overseer" : "syndicate";
      z.progress += dt * pressure * drift;
    }
    z.progress = Math.min(1, Math.max(0, z.progress));
    z.contested = z.progress > 0.08;

    if (z.progress >= 1) {
      const old = z.owner;
      z.owner = z.challenger;
      z.progress = 0;
      z.challenger = old;
      alert(sim, `${r.name} captured by ${FACTIONS[z.owner].short}`);
      // control change escalates the AI response
      const waves = 2 + Math.round(r.difficulty * 0.7 * (1 + z.instability));
      for (let i = 0; i < waves; i++) spawnMachine(sim, z, { x: px, z: pz });
    }

    // ambient spawns near the player in hostile ground
    if (inside && z.owner !== "vanguard" && liveMachines < MACHINE_POOL - 2) {
      const rate = 0.16 * (1 + z.instability * 1.6) * (1 + night) * (r.difficulty / 3);
      if (Math.random() < rate * dt) {
        spawnMachine(sim, z, { x: px, z: pz });
        liveMachines++;
      }
    }
  }

  // low gravity inside unstable fracture ground
  sim.gravity = 26 * (1 - playerInstability * 0.66);

  // ---------- war machines ----------
  for (const m of sim.machines) {
    if (!m.alive) continue;
    const dx = px - m.x;
    const dz = pz - m.z;
    const d = Math.hypot(dx, dz) || 1;
    const aggro = 70 + night * 60;
    const speed = (10 + night * 6) * m.scale;
    if (d < aggro) {
      m.x += (dx / d) * speed * dt;
      m.z += (dz / d) * speed * dt;
      m.rot = Math.atan2(dx, dz);
      m.cool -= dt;
      if (d < 6 && m.cool <= 0) {
        m.cool = 1.1;
        sim.hp = Math.max(0, sim.hp - 7);
        if (sim.hp === 0) {
          sim.hp = 100;
          sim.cargo = 0;
          alert(sim, "Systems failed — respawned at Nexus City, cargo lost");
        }
      }
    } else {
      // patrol around its zone
      m.rot += dt * 0.4;
      m.x += Math.sin(m.rot) * 6 * dt;
      m.z += Math.cos(m.rot) * 6 * dt;
      if (d > 260) m.alive = false;
    }
    m.y = walkHeight(m.x, m.z) + 2.2 * m.scale;
  }

  // ---------- convoys ----------
  for (const tr of sim.trucks) {
    if (!tr.alive) continue;
    const lane = sim.lanes[tr.lane]!;
    const prev = lanePoint(lane, tr.t);
    tr.t += dt * 0.035 * tr.dir;
    if (tr.t > 1 || tr.t < 0) {
      tr.dir = (tr.dir * -1) as 1 | -1;
      tr.t = Math.min(1, Math.max(0, tr.t));
    }
    const now = lanePoint(lane, tr.t);
    tr.x = now.x;
    tr.z = now.z;
    tr.y = walkHeight(now.x, now.z) + 1.6;
    tr.rot = Math.atan2(now.x - prev.x, now.z - prev.z);
  }

  // respawn convoys slowly
  const dead = sim.trucks.filter((x) => !x.alive);
  if (dead.length && Math.random() < 0.08 * dt * dead.length) {
    const tr = dead[0]!;
    tr.alive = true;
    tr.hp = 3;
    tr.t = Math.random();
    tr.cargo = 1 + Math.floor(Math.random() * 3);
  }

  // ---------- bullets ----------
  for (const b of sim.bullets) {
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    b.y = Math.max(b.y, heightAt(b.x, b.z) + 1.2);
    if (b.life <= 0) {
      b.alive = false;
      continue;
    }
    for (const m of sim.machines) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - b.x, m.z - b.z) < 3.4 * m.scale) {
        b.alive = false;
        m.hp -= 1;
        if (m.hp <= 0) {
          m.alive = false;
          sim.kills++;
          sim.credits += 45;
          alert(sim, "War machine destroyed  +45 cr");
        }
        break;
      }
    }
    if (!b.alive) continue;
    for (const tr of sim.trucks) {
      if (!tr.alive) continue;
      if (Math.hypot(tr.x - b.x, tr.z - b.z) < 3.6) {
        b.alive = false;
        tr.hp -= 1;
        if (tr.hp <= 0) {
          tr.alive = false;
          sim.cargo += tr.cargo;
          alert(sim, `Convoy ambushed — ${tr.cargo} crate${tr.cargo > 1 ? "s" : ""} seized`);
        }
        break;
      }
    }
  }

  // ---------- extraction ----------
  const nexus = byId("nexus");
  if (sim.cargo > 0 && Math.hypot(px - nexus.x, pz - nexus.z) < nexus.radius * 0.55) {
    const paid = sim.cargo * 120;
    sim.credits += paid;
    sim.extractions += sim.cargo;
    sim.cargo = 0;
    sim.hp = Math.min(100, sim.hp + 35);
    alert(sim, `Extraction complete  +${paid} cr`);
  }

  return { playerInstability };
}
