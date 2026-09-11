import { REGIONS, type Region } from "./world";
import { heightAt, smoothstep, walkHeight } from "./terrain";
import { LANES, laneLanePoint, laneSamples, type Lane } from "./lanes";
import { collideBody } from "./obstacles";
import {
  createEvolution,
  dominantBehavior,
  evolutionMods,
  logBehavior,
  stepEvolution,
  type Evolution,
  type EvolutionMods,
} from "./evolution";
import {
  beginStats,
  countEntity,
  createStats,
  endStats,
  getSimulationTier,
  predictPosition,
  shouldTick,
  tierDt,
  type SimStats,
  type SimTier,
} from "./lod";
import { generateLoot, type LootContext, type LootItem } from "./loot";
import {
  createDirector,
  directorEvent,
  directorTick,
  type Director,
} from "./director";

/* ------------------------------------------------------------------
 * World simulation: faction capture, fracture instability,
 * AI war machines, NPC convoys, projectiles and physics impacts.
 * One fixed pipeline per frame: inputs → physics → collisions →
 * combat → AI director → world update.
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
  elite: boolean;
  /** knockback velocity from impacts */
  kx: number;
  kz: number;
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
  /** current lane speed, eased so trucks brake instead of colliding */
  speed: number;
  /** seconds spent stopped — used to break rare standoffs */
  stalled: number;
  /** seconds holding at a depot gate, waiting for the player */
  wait: number;
};

export type Turret = {
  x: number;
  z: number;
  y: number;
  /** region the turret defends */
  zone: string;
  cool: number;
  /** >0 while the muzzle flash / tracer is drawn */
  flash: number;
  rot: number;
  range: number;
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

export type { Lane };
export { laneSamples };

export type WorldSim = {
  zones: ZoneState[];
  lanes: Lane[];
  machines: Machine[];
  trucks: Truck[];
  turrets: Turret[];
  bullets: Bullet[];
  credits: number;
  cargo: number;
  hp: number;
  /** Nexus city core integrity — the director's protect target */
  coreHp: number;
  gravity: number;
  alerts: { text: string; life: number }[];
  kills: number;
  extractions: number;
  director: Director;
  /** impact damage cooldown so one obstacle cannot drain the hull */
  impactCool: number;
  /** rolling combat activity used for pacing */
  combatHeat: number;
  /** adaptive skill evolution driven by observed behaviour */
  evo: Evolution;
  /** derived gameplay modifiers from the evolved build */
  mods: EvolutionMods;
  /** simulation optimisation telemetry */
  stats: SimStats;
  /** weapon heat 0..100 — sustained fire overheats the gun */
  weaponHeat: number;
  /** true while the weapon vents and cannot fire */
  overheated: boolean;
  /** most recent AI-generated drops (newest first) */
  loot: LootItem[];
  /** everything picked up this session */
  vault: LootItem[];
};

export const HEAT_PER_SHOT_FOOT = 7;
export const HEAT_PER_SHOT_VEHICLE = 11;

/** roll an AI-generated drop from the live world state */
function dropLoot(sim: WorldSim, zone: ZoneState | undefined, enemyType: string) {
  const ctx: LootContext = {
    enemyType,
    zoneState: zone?.contested ? "Contested" : (zone?.instability ?? 0) > 0.5 ? "Fractured" : "Stable",
    difficulty: zone?.region.difficulty ?? 3,
    isRaid: (zone?.region.kind ?? "war") === "core",
    corruption: Math.round((zone?.instability ?? 0.2) * 100),
    playstyle: dominantBehavior(getPlaystyle(sim.evo)),
  };
  const item = generateLoot(ctx);
  sim.loot.unshift(item);
  if (sim.loot.length > 5) sim.loot.pop();
  sim.vault.push(item);
  sim.credits += Math.round(item.power * 0.12);
  alert(sim, `${item.rarity} drop — ${item.name}`);
}

const byId = (id: string) => REGIONS.find((r) => r.id === id)!;

export const MACHINE_POOL = 18;
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
    elite: false,
    kx: 0,
    kz: 0,
  }));

  // one truck per lane+direction slot: two trucks can never share a corridor
  const trucks: Truck[] = Array.from({ length: TRUCK_POOL }, (_, i) => ({
    alive: i < LANES.length * 2,
    lane: i % LANES.length,
    t: 0.1 + ((i * 0.37) % 0.8),
    dir: Math.floor(i / LANES.length) % 2 === 0 ? 1 : -1,
    x: 0,
    z: 0,
    y: 0,
    rot: 0,
    hp: 3,
    cargo: 1 + (i % 3),
    speed: 0.035,
    stalled: 0,
    wait: 0,
  }));

  // automated defence grid on the safe-zone perimeters
  const turrets: Turret[] = REGIONS.filter((r) => r.kind === "safe" || r.kind === "starter").flatMap((r) => {
    const count = r.kind === "safe" ? 8 : 5;
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      const x = r.x + Math.cos(a) * r.radius * 0.92;
      const z = r.z + Math.sin(a) * r.radius * 0.92;
      return {
        x,
        z,
        y: walkHeight(x, z),
        zone: r.id,
        cool: Math.random(),
        flash: 0,
        rot: a,
        range: r.kind === "safe" ? 62 : 44,
      };
    });
  });

  const bullets: Bullet[] = Array.from({ length: BULLET_POOL }, () => ({
    alive: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vz: 0,
    life: 0,
  }));

  const evo = createEvolution();

  return {
    zones,
    lanes: LANES,
    machines,
    trucks,
    turrets,
    bullets,
    credits: 0,
    cargo: 0,
    hp: 100,
    coreHp: 100,
    gravity: 26,
    alerts: [],
    kills: 0,
    extractions: 0,
    director: createDirector(),
    impactCool: 0,
    combatHeat: 0,
    evo,
    mods: evolutionMods(evo),
    stats: createStats(),
    weaponHeat: 0,
    overheated: false,
    loot: [],
    vault: [],
  };
}

export function alert(sim: WorldSim, text: string) {
  sim.alerts.unshift({ text, life: 6 });
  if (sim.alerts.length > 4) sim.alerts.pop();
}

export function zoneOf(sim: WorldSim, id: string) {
  return sim.zones.find((z) => z.region.id === id);
}

function spawnMachine(sim: WorldSim, zone: ZoneState, elite = false) {
  const m = sim.machines.find((x) => !x.alive);
  if (!m) return;
  const a = Math.random() * Math.PI * 2;
  const d = zone.region.radius * (0.4 + Math.random() * 0.55);
  m.alive = true;
  m.x = zone.region.x + Math.cos(a) * d;
  m.z = zone.region.z + Math.sin(a) * d;
  m.hp = (elite ? 7 : 3) + Math.round(zone.region.difficulty * 0.8);
  m.rot = 0;
  m.scale = (elite ? 1.5 : 0.9) + Math.random() * 0.7;
  m.zone = zone.region.id;
  m.cool = 1.5;
  m.elite = elite;
  m.kx = 0;
  m.kz = 0;
}

export function fireBullet(
  sim: WorldSim,
  x: number,
  y: number,
  z: number,
  yaw: number,
  inVehicle = false,
) {
  if (sim.overheated) return false;
  const b = sim.bullets.find((v) => !v.alive);
  if (!b) return false;
  sim.weaponHeat = Math.min(100, sim.weaponHeat + (inVehicle ? HEAT_PER_SHOT_VEHICLE : HEAT_PER_SHOT_FOOT));
  if (sim.weaponHeat >= 100) {
    sim.overheated = true;
    alert(sim, "WEAPON OVERHEAT — venting");
  }
  b.alive = true;
  b.x = x;
  b.y = y;
  b.z = z;
  b.vx = Math.sin(yaw) * 130;
  b.vz = Math.cos(yaw) * 130;
  b.life = 1.4;
  logBehavior(sim.evo, "combat", 0.35);
  return true;
}

/** hurt the player and respawn at Nexus when the hull is gone */
function hurtPlayer(sim: WorldSim, dmg: number, cause: string) {
  sim.hp = Math.max(0, sim.hp - dmg);
  if (sim.hp === 0) {
    sim.hp = 100;
    sim.cargo = 0;
    alert(sim, `Hull destroyed (${cause}) — respawned at Nexus City, cargo lost`);
  }
}

export type PlayerBody = { x: number; z: number; yaw: number; vSpeed: number; inVehicle: boolean };

/**
 * Physics pass for the player body: collide with terrain props, war machines
 * and convoys. Impacts damage both sides and bleed off speed.
 */
export function collidePlayer(sim: WorldSim, body: PlayerBody) {
  const radius = body.inVehicle ? 3.1 : 1.0;
  const mass = body.inVehicle ? 2.4 : 0.8;
  const speed = body.inVehicle ? body.vSpeed : 8;

  // --- world props (trees, rocks, wrecks, towers) ---
  const impact = collideBody(body, radius, speed, mass);
  if (impact.hit && Math.abs(speed) > 6) {
    body.vSpeed *= impact.broke ? 0.55 : -0.18;
    if (impact.damage > 2 && sim.impactCool <= 0) {
      sim.impactCool = 0.6;
      hurtPlayer(sim, Math.min(30, impact.damage), impact.broke ? `smashed a ${impact.kind}` : `hit a ${impact.kind}`);
      sim.combatHeat += 3;
      if (impact.broke) alert(sim, `Rammed through a ${impact.kind}`);
    }
  }

  // --- vehicle vs war machine ---
  for (const m of sim.machines) {
    if (!m.alive) continue;
    const dx = body.x - m.x;
    const dz = body.z - m.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const min = radius + 3.0 * m.scale;
    if (dist >= min) continue;
    const push = min - dist + 0.05;
    body.x += (dx / dist) * push * 0.4;
    body.z += (dz / dist) * push * 0.4;
    m.kx -= (dx / dist) * Math.abs(speed) * 0.5;
    m.kz -= (dz / dist) * Math.abs(speed) * 0.5;

    const force = Math.abs(speed) * mass;
    if (force > 30 && sim.impactCool <= 0) {
      sim.impactCool = 0.6;
      m.hp -= Math.round((force / 30) * sim.mods.ramDamage);
      logBehavior(sim.evo, body.inVehicle ? "vehicles" : "combat", 2);
      body.vSpeed *= 0.4;
      sim.combatHeat += 4;
      if (m.hp <= 0) {
        m.alive = false;
        sim.kills++;
        sim.credits += 45;
        directorEvent(sim.director, { type: "KILL" });
        alert(sim, "Rammed a war machine  +45 cr");
        dropLoot(sim, zoneOf(sim, m.zone), m.elite ? "ELITE" : "FRACTURE_MACHINE");
      }
      hurtPlayer(sim, (force * 0.12) / sim.mods.hullDurability, "vehicle collision");
    } else {
      hurtPlayer(sim, (force * 0.02) / sim.mods.hullDurability, "vehicle collision");
    }
  }

  // --- vehicle vs convoy truck ---
  for (const tr of sim.trucks) {
    if (!tr.alive) continue;
    const dx = body.x - tr.x;
    const dz = body.z - tr.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const min = radius + 3.4;
    if (dist >= min) continue;
    const push = min - dist + 0.05;
    body.x += (dx / dist) * push;
    body.z += (dz / dist) * push;

    const force = Math.abs(speed) * mass;
    if (force > 40 && sim.impactCool <= 0) {
      sim.impactCool = 0.6;
      tr.hp -= Math.max(1, Math.round(sim.mods.ramDamage));
      body.vSpeed *= 0.3;
      hurtPlayer(sim, (force * 0.1) / sim.mods.hullDurability, "convoy ram");
      logBehavior(sim.evo, "vehicles", 2);
      sim.combatHeat += 4;
      if (tr.hp <= 0) {
        tr.alive = false;
        sim.cargo += tr.cargo;
        logBehavior(sim.evo, "logistics", tr.cargo * 2);
        directorEvent(sim.director, { type: "CARGO", amount: tr.cargo });
        alert(sim, `Convoy rammed — ${tr.cargo} crate${tr.cargo > 1 ? "s" : ""} seized`);
      }
    } else {
      body.vSpeed *= 0.6;
    }
  }
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
  const t0 = performance.now();
  beginStats(sim.stats);

  // ---------- adaptive evolution loop ----------
  // passive behaviour: time spent driving, sneaking past hostiles, holding the line
  if (input.inVehicle) logBehavior(sim.evo, "vehicles", dt * 0.6);
  let escorting = 0;
  for (const tr of sim.trucks) {
    if (tr.alive && Math.hypot(px - tr.x, pz - tr.z) < 40) escorting++;
  }
  if (escorting > 0) logBehavior(sim.evo, "support", dt * 0.5 * escorting);
  stepEvolution(sim.evo, dt);
  sim.mods = evolutionMods(sim.evo);
  if (sim.mods.regen > 0 && sim.hp < 100) sim.hp = Math.min(100, sim.hp + sim.mods.regen * dt);

  // ---------- alerts ----------
  for (const a of sim.alerts) a.life -= dt;
  sim.alerts = sim.alerts.filter((a) => a.life > 0);
  sim.combatHeat = Math.max(0, sim.combatHeat - dt * 6);
  // weapon cooling: venting from an overheat is slower than a normal cooldown
  sim.weaponHeat = Math.max(0, sim.weaponHeat - dt * (sim.overheated ? 22 : 34));
  if (sim.overheated && sim.weaponHeat <= 6) {
    sim.overheated = false;
    alert(sim, "Weapon cooled — ready");
  }
  sim.impactCool = Math.max(0, sim.impactCool - dt);

  const t = performance.now() / 1000;
  let playerInstability = 0;
  let liveMachines = 0;
  let hostileNear = 0;
  let contestedZones = 0;
  for (const m of sim.machines) if (m.alive) liveMachines++;

  // ---------- zones: instability + faction capture ----------
  for (const z of sim.zones) {
    const r = z.region;
    const dPlayer = Math.hypot(px - r.x, pz - r.z);
    const inside = dPlayer < r.radius;

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
      // the core slowly repairs while it is not under siege
      sim.coreHp = Math.min(100, sim.coreHp + dt * 1.2);
      continue;
    }

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
    if (z.contested) contestedZones++;

    if (z.progress >= 1) {
      const old = z.owner;
      z.owner = z.challenger;
      z.progress = 0;
      z.challenger = old;
      alert(sim, `${r.name} captured by ${FACTIONS[z.owner].short}`);
      directorEvent(sim.director, { type: "CAPTURE", regionId: r.id });
      const waves = 2 + Math.round(r.difficulty * 0.7 * (1 + z.instability));
      for (let i = 0; i < waves; i++) spawnMachine(sim, z);
    }

    if (inside && z.owner !== "vanguard" && liveMachines < MACHINE_POOL - 2) {
      const rate = 0.16 * (1 + z.instability * 1.6) * (1 + night) * (r.difficulty / 3);
      if (Math.random() < rate * dt) {
        spawnMachine(sim, z);
        liveMachines++;
      }
    }
  }

  sim.gravity = 26 * (1 - playerInstability * 0.66);

  // ---------- war machines ----------
  for (let i = 0; i < sim.machines.length; i++) {
    const m = sim.machines[i]!;
    if (!m.alive) continue;

    // --- simulation LOD: only nearby machines get full AI + physics ---
    const simTier: SimTier = getSimulationTier(m.x, m.z, px, pz);
    const simTick = shouldTick(simTier, sim.stats.frame);
    countEntity(sim.stats, simTier, simTick, m.zone);
    if (simTier >= 2) {
      // dormant: abstract drift, no collisions, no combat resolution
      if (!simTick) {
        sim.stats.dormant++;
        continue;
      }
      const sdt = tierDt(simTier, dt);
      m.rot += sdt * 0.2;
      const pred = predictPosition(m, 4, sdt);
      m.x = pred.x;
      m.z = pred.z;
      m.y = walkHeight(m.x, m.z) + 2.2 * m.scale;
      if (Math.hypot(px - m.x, pz - m.z) > 340) m.alive = false;
      sim.stats.dormant++;
      continue;
    }

    const dx = px - m.x;
    const dz = pz - m.z;
    const d = Math.hypot(dx, dz) || 1;
    const aggro =
      (70 + night * 60) * (m.elite ? 1.6 : 1) * sim.mods.aggroRadius * sim.evo.influence.aiAggression;
    const speed = (10 + night * 6) * (m.elite ? 1.15 : 1);
    if (d < 120) hostileNear++;

    if (d < aggro) {
      m.x += (dx / d) * speed * dt;
      m.z += (dz / d) * speed * dt;
      m.rot = Math.atan2(dx, dz);
      m.cool -= dt;
      if (d < 6 && m.cool <= 0) {
        m.cool = 1.1;
        sim.combatHeat += 2;
        hurtPlayer(sim, (m.elite ? 12 : 7) / sim.mods.hullDurability, "war machine");
        // machines besieging Nexus chew the city core
        if (Math.hypot(m.x - byId("nexus").x, m.z - byId("nexus").z) < byId("nexus").radius) {
          sim.coreHp = Math.max(0, sim.coreHp - 2);
        }
      }
    } else {
      m.rot += dt * 0.4;
      m.x += Math.sin(m.rot) * 6 * dt;
      m.z += Math.cos(m.rot) * 6 * dt;
      if (d > 260) m.alive = false;
    }

    // knockback from impacts, damped frame-rate independently
    m.x += m.kx * dt;
    m.z += m.kz * dt;
    m.kx *= Math.exp(-3 * dt);
    m.kz *= Math.exp(-3 * dt);

    // machines collide with world props and with each other
    const hit = collideBody(m, 2.6 * m.scale, speed + Math.hypot(m.kx, m.kz), 1.6);
    if (hit.hit && hit.damage > 6) m.hp -= 1;
    for (let j = i + 1; j < sim.machines.length; j++) {
      const o = sim.machines[j]!;
      if (!o.alive) continue;
      const sx = m.x - o.x;
      const sz = m.z - o.z;
      const dist = Math.hypot(sx, sz) || 0.001;
      const min = 2.8 * m.scale + 2.8 * o.scale;
      if (dist < min) {
        const push = (min - dist) * 0.5;
        m.x += (sx / dist) * push;
        m.z += (sz / dist) * push;
        o.x -= (sx / dist) * push;
        o.z -= (sz / dist) * push;
      }
    }
    if (m.hp <= 0) {
      m.alive = false;
      sim.kills++;
      sim.credits += 30;
      directorEvent(sim.director, { type: "KILL" });
      alert(sim, "War machine wrecked on the terrain");
      continue;
    }
    m.y = walkHeight(m.x, m.z) + 2.2 * m.scale;
  }

// stealth: surviving close to hostiles without opening fire
  if (!input.inVehicle && hostileNear > 0 && sim.combatHeat < 2) {
    logBehavior(sim.evo, "stealth", dt * 0.8 * hostileNear);
  }

  // ---------- safe-zone stability field ----------
  // enemies can never enter a friendly safe zone: the field shoves them back
  // out across the boundary and burns their armour while they touch it.
  for (const z of sim.zones) {
    const r = z.region;
    if ((r.kind !== "safe" && r.kind !== "starter") || z.owner !== "vanguard") continue;
    for (const m of sim.machines) {
      if (!m.alive) continue;
      const dx = m.x - r.x;
      const dz = m.z - r.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (d >= r.radius) continue;
      const push = r.radius - d + 0.5;
      m.x += (dx / d) * push;
      m.z += (dz / d) * push;
      m.kx += (dx / d) * 14;
      m.kz += (dz / d) * 14;
      m.hp -= dt * 6;
      if (m.hp <= 0) {
        m.alive = false;
        sim.kills++;
        sim.credits += 15;
        alert(sim, `${r.name} stability field vaporised a war machine`);
      }
    }
  }

  // ---------- perimeter defence turrets ----------
  for (const tur of sim.turrets) {
    tur.flash = Math.max(0, tur.flash - dt * 3);
    tur.cool -= dt;
    let best: Machine | null = null;
    let bestD = tur.range;
    for (const m of sim.machines) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - tur.x, m.z - tur.z);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    if (!best) continue;
    tur.rot = Math.atan2(best.x - tur.x, best.z - tur.z);
    if (tur.cool > 0) continue;
    tur.cool = 0.9;
    tur.flash = 1;
    best.hp -= 2;
    // knock the attacker away from the perimeter
    const dx = best.x - tur.x;
    const dz = best.z - tur.z;
    const d = Math.hypot(dx, dz) || 1;
    best.kx += (dx / d) * 8;
    best.kz += (dz / d) * 8;
    if (best.hp <= 0) {
      best.alive = false;
      sim.kills++;
      sim.credits += 20;
      alert(sim, "Safe-zone turret destroyed an ambusher");
    }
  }

  // ---------- convoys: lane following with headway control ----------
  for (const tr of sim.trucks) {
    if (!tr.alive) continue;
    const lane = sim.lanes[tr.lane]!;

    // --- simulation LOD for logistics: distant convoys move abstractly ---
    const convoyTier: SimTier = getSimulationTier(tr.x, tr.z, px, pz);
    const convoyTick = shouldTick(convoyTier, sim.stats.frame);
    countEntity(sim.stats, convoyTier, convoyTick);
    if (convoyTier >= 2) {
      if (!convoyTick) continue;
      const sdt = tierDt(convoyTier, dt);
      tr.speed = 0.035 * sim.evo.influence.logisticsEfficiency;
      tr.wait = Math.max(0, tr.wait - sdt);
      if (tr.wait <= 0) tr.t += sdt * tr.speed * tr.dir;
      if (tr.t > 0.9) {
        tr.t = 0.1;
        tr.wait = 6;
      }
      if (tr.t < 0.1) {
        tr.t = 0.9;
        tr.wait = 6;
      }
      const abstract = laneLanePoint(lane, tr.t, tr.dir > 0 ? 3.2 : -3.2);
      tr.rot = Math.atan2(abstract.x - tr.x, abstract.z - tr.z) || tr.rot;
      tr.x = abstract.x;
      tr.z = abstract.z;
      tr.y = walkHeight(abstract.x, abstract.z) + 1.6;
      continue;
    }

    // keep a safe gap to the truck ahead on the same lane and heading
    let headway = 1;
    for (const other of sim.trucks) {
      if (other === tr || !other.alive || other.lane !== tr.lane || other.dir !== tr.dir) continue;
      let gap = (other.t - tr.t) * tr.dir;
      if (gap < 0) gap += 1;
      if (gap < 0.07) headway = Math.min(headway, Math.max(0, (gap - 0.025) / 0.045));
    }
    // junction yield: brake for any truck crossing close ahead, whatever lane
    for (const other of sim.trucks) {
      if (other === tr || !other.alive) continue;
      const dx = other.x - tr.x;
      const dz = other.z - tr.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 16) continue;
      const ahead = dx * Math.sin(tr.rot) + dz * Math.cos(tr.rot);
      if (ahead <= 0) continue;
      // both brake, but the higher-index truck keeps more distance so the
      // pair never deadlocks: the lower-index truck clears the junction first
      const keep = sim.trucks.indexOf(tr) > sim.trucks.indexOf(other) ? 10 : 6;
      headway = Math.min(headway, Math.max(0, (dist - keep) / 6));
    }

    // break a rare standoff: only the highest-priority stalled truck rolls on
    tr.stalled = tr.speed < 0.004 ? tr.stalled + dt : 0;
    if (tr.stalled > 4 && !sim.trucks.some((o) => o.alive && o !== tr && o.stalled > tr.stalled)) {
      headway = Math.max(headway, 0.35);
    }

    // holding at a depot gate: convoys wait for the player before rolling out,
    // and while parked inside the safe zone the defences cover them
    if (tr.wait > 0) {
      tr.wait -= dt;
      const playerNear = Math.hypot(px - tr.x, pz - tr.z) < 26;
      if (playerNear) tr.wait = Math.max(tr.wait, 0.6);
      headway = 0;
    }

    // ease toward the target lane speed so trucks brake smoothly
    const target = 0.035 * headway * sim.evo.influence.logisticsEfficiency;
    tr.speed += (target - tr.speed) * (1 - Math.exp(-3 * dt));

    const side = tr.dir > 0 ? 3.2 : -3.2;
    const prev = laneLanePoint(lane, tr.t, side);
    tr.t += dt * tr.speed * tr.dir;
    // loop between the depot gates, staying clear of the hub centres
    if (tr.t > 0.9) {
      tr.t = 0.1;
      tr.wait = 6;
    }
    if (tr.t < 0.1) {
      tr.t = 0.9;
      tr.wait = 6;
    }
    const now = laneLanePoint(lane, tr.t, side);
    tr.x = now.x;
    tr.z = now.z;
    tr.y = walkHeight(now.x, now.z) + 1.6;
    if (Math.hypot(now.x - prev.x, now.z - prev.z) > 0.0001) {
      tr.rot = Math.atan2(now.x - prev.x, now.z - prev.z);
    }
  }

  // only revive a truck when its lane+direction corridor is free
  // hard non-penetration: back the lower-priority truck off its route
  for (let i = 0; i < sim.trucks.length; i++) {
    const a = sim.trucks[i]!;
    if (!a.alive) continue;
    for (let j = i + 1; j < sim.trucks.length; j++) {
      const b = sim.trucks[j]!;
      if (!b.alive) continue;
      if (Math.hypot(a.x - b.x, a.z - b.z) >= 7) continue;
      const lane = sim.lanes[b.lane]!;
      const side = b.dir > 0 ? 3.2 : -3.2;
      for (let k = 0; k < 6; k++) {
        b.t -= b.dir * 0.003;
        if (b.t > 1) b.t -= 1;
        if (b.t < 0) b.t += 1;
        const p = laneLanePoint(lane, b.t, side);
        b.x = p.x;
        b.z = p.z;
        b.y = walkHeight(p.x, p.z) + 1.6;
        if (Math.hypot(a.x - b.x, a.z - b.z) >= 7) break;
      }
      b.speed = 0;
      b.stalled += 0.2;
    }
  }

  const dead = sim.trucks.filter(
    (x) => !x.alive && !sim.trucks.some((o) => o.alive && o.lane === x.lane && o.dir === x.dir),
  );
  if (dead.length && Math.random() < 0.08 * dt * dead.length) {
    const tr = dead[0]!;
    tr.alive = true;
    tr.hp = 3;
    tr.t = tr.dir > 0 ? 0.1 : 0.9;
    tr.speed = 0.01;
    tr.wait = 4;
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
    // bullets chip world cover too
    const cover = collideBody(b, 0.4, 130, 0.25);
    if (cover.hit) {
      b.alive = false;
      continue;
    }
    for (const m of sim.machines) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - b.x, m.z - b.z) < 3.4 * m.scale) {
        b.alive = false;
        m.hp -= sim.mods.bulletDamage;
        logBehavior(sim.evo, "combat", 1);
        // knockback impulse from the hit direction
        m.kx += b.vx * 0.06;
        m.kz += b.vz * 0.06;
        sim.combatHeat += 1.5;
        if (m.hp <= 0) {
          m.alive = false;
          sim.kills++;
          sim.credits += 45;
          directorEvent(sim.director, { type: "KILL" });
          alert(sim, "War machine destroyed  +45 cr");
          dropLoot(sim, zoneOf(sim, m.zone), m.elite ? "ELITE" : "FRACTURE_MACHINE");
        }
        break;
      }
    }
    if (!b.alive) continue;
    for (const tr of sim.trucks) {
      if (!tr.alive) continue;
      if (Math.hypot(tr.x - b.x, tr.z - b.z) < 3.6) {
        b.alive = false;
        tr.hp -= sim.mods.bulletDamage;
        logBehavior(sim.evo, "combat", 1);
        if (tr.hp <= 0) {
          tr.alive = false;
          sim.cargo += tr.cargo;
          logBehavior(sim.evo, "logistics", tr.cargo * 2);
          directorEvent(sim.director, { type: "CARGO", amount: tr.cargo });
          alert(sim, `Convoy ambushed — ${tr.cargo} crate${tr.cargo > 1 ? "s" : ""} seized`);
          dropLoot(sim, sim.zones.find((z) => Math.hypot(tr.x - z.region.x, tr.z - z.region.z) < z.region.radius), "CONVOY");
        }
        break;
      }
    }
  }

  for (const it of sim.loot) it.life -= dt;
  sim.loot = sim.loot.filter((it) => it.life > 0);

  // ---------- extraction ----------
  const nexus = byId("nexus");
  if (sim.cargo > 0 && Math.hypot(px - nexus.x, pz - nexus.z) < nexus.radius * 0.55) {
    const paid = Math.round(sim.cargo * 120 * sim.mods.cargoValue * sim.evo.influence.logisticsEfficiency);
    sim.credits += paid;
    sim.extractions += sim.cargo;
    logBehavior(sim.evo, "logistics", sim.cargo * 3);
    sim.cargo = 0;
    sim.hp = Math.min(100, sim.hp + 35);
    alert(sim, `Extraction complete  +${paid} cr`);
  }

  // ---------- AI mission director ----------
  const playerZone = sim.zones.find((z) => Math.hypot(px - z.region.x, pz - z.region.z) < z.region.radius);
  const before = sim.director.completed;
  directorTick(
    sim.director,
    {
      dt,
      combatHeat: sim.combatHeat,
      playerRegionId: playerZone?.region.id ?? "wastelands",
      contestedZones,
      instability: playerInstability,
      night,
      coreHp: sim.coreHp,
      hostileNear,
    },
    {
      alert: (text) => alert(sim, text),
      spawnWave: (regionId, count, elite) => {
        const zone = sim.zones.find((z) => z.region.id === regionId) ?? sim.zones[0]!;
        for (let i = 0; i < count; i++) spawnMachine(sim, zone, elite);
      },
    },
  );
  if (sim.director.completed > before) {
    const paid = sim.director.missions.find((m) => m.state === "COMPLETED")?.reward ?? 0;
    sim.credits += paid;
  }

  endStats(sim.stats, performance.now() - t0);

  return { playerInstability };
}
