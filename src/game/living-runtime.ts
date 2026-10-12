/** Living World runtime: the per-frame glue between the pure Living World rules and the live sim. Scene calls
 * `stepLivingRuntime` once per frame after stepSim; it advances the event director, spawns/despawns event machines,
 * runs city patrols (their hits go through the same damage path as everything else), tracks where civilians should
 * run from, and returns the save-changing events (`emits`) that GameCanvas applies to progression. No rendering. */
import { alert, defeatMachine, hurtPlayer, spawnEventSquad, summonBoss, type WorldSim } from "./sim";
import { CITIES, FACTIONS, TIER_RULES, cityAt, districtById, tierOf, type CityId, type FactionId, type LivingState } from "./living-world";
import { EVENT_RULES, FRACTURE_HOLD, FRACTURE_RADIUS, createLivingDirector, stepLivingDirector, type LivingDirector, type LivingEvent } from "./living-events";
import { createGuards, stepGuards, type Guard } from "./city-patrols";
import { STASH_REACH, SURVEY_REACH } from "./living-npcs";
import { regionAt } from "./world";

export type LivingEmit =
  | { type: "KILLS"; city: CityId; count: number }
  /** player kills per region (map-activities.ts patrols) */
  | { type: "REGION_KILLS"; region: string; count: number }
  | { type: "EVENT"; event: LivingEvent; outcome: "WON" | "FAILED" }
  | { type: "REACH"; x: number; z: number };

export type LivingRuntime = {
  director: LivingDirector;
  guards: Guard[];
  killsSeen: number;
  killAcc: Partial<Record<CityId, number>>;
  regionAcc: Record<string, number>;
  flushIn: number;
  reached: Set<string>;
  /** where civilians should run from (live hostile machines inside the cities) */
  threats: { x: number; z: number }[];
  warnedAt: Partial<Record<FactionId, number>>;
  clock: number;
};

export function createLivingRuntime(sim: Pick<WorldSim, "kills">): LivingRuntime {
  return { director: createLivingDirector(), guards: createGuards(), killsSeen: sim.kills, killAcc: {}, regionAcc: {}, flushIn: 1.5, reached: new Set(), threats: [], warnedAt: {}, clock: 0 };
}

export type LivingStepInput = {
  dt: number; now: number; px: number; pz: number;
  /** a scripted mission, tutorial, interior or cinematic is running */
  blocked: boolean;
  living: LivingState;
  fallen: readonly string[];
  markers: readonly { id: string; x: number; z: number; kind: "survey" | "stash" }[];
  rnd: () => number;
};

export type LivingHud = {
  city: CityId | null;
  event: null | { title: string; brief: string; kind: LivingEvent["kind"]; phase: LivingEvent["phase"]; timer: number; district: string; x: number; z: number; hold: number; holdNeed: number; left: number; inRift: boolean };
};

const INVADERS: Record<CityId, string> = { nexus: "wastelands", neon: "nexus" };
const FRACTURE_TROOPS = "swamps";
const FRACTURE_WAVE_EVERY = 10;

function spawnFor(sim: WorldSim, ev: LivingEvent) {
  const region = INVADERS[ev.city];
  switch (ev.kind) {
    case "INVASION": spawnEventSquad(sim, ev.id, ev.x, ev.z, 6, 1, region); break;
    case "DISTRESS": spawnEventSquad(sim, ev.id, ev.x, ev.z, 3, 0, region, 8); break;
    case "CONVOY": spawnEventSquad(sim, ev.id, ev.x, ev.z, 4, 2, "wastelands", 6); break;
    case "ROAMING_BOSS": if (!summonBoss(sim, "nexus", ev.x, ev.z, { living: ev.id })) spawnEventSquad(sim, ev.id, ev.x, ev.z, 4, 4, region); break;
    case "FRACTURE": spawnEventSquad(sim, ev.id, ev.x, ev.z, 3, 0, FRACTURE_TROOPS, FRACTURE_RADIUS + 4); break;
  }
}

function despawn(sim: WorldSim, id: string) {
  for (const m of sim.machines) if (m.alive && m.living === id) { m.alive = false; delete m.living; }
}

export function stepLivingRuntime(rt: LivingRuntime, sim: WorldSim, inp: LivingStepInput): { emits: LivingEmit[]; hud: LivingHud } {
  const emits: LivingEmit[] = [];
  rt.clock += inp.dt;
  const city = cityAt(inp.px, inp.pz);
  const alive = sim.hp > 0;

  // 1) player kills inside a city feed that city's contracts (batched so progression doesn't churn per kill)
  const delta = sim.kills - rt.killsSeen;
  rt.killsSeen = sim.kills;
  if (delta > 0 && city) rt.killAcc[city] = (rt.killAcc[city] ?? 0) + delta;
  const region = delta > 0 ? regionAt(inp.px, inp.pz) : null;
  if (region) rt.regionAcc[region.id] = (rt.regionAcc[region.id] ?? 0) + delta;
  rt.flushIn -= inp.dt;
  if (rt.flushIn <= 0) {
    rt.flushIn = 1.5;
    for (const c of Object.keys(rt.killAcc) as CityId[]) { const n = rt.killAcc[c] ?? 0; if (n > 0) emits.push({ type: "KILLS", city: c, count: n }); }
    rt.killAcc = {};
    for (const [r, n] of Object.entries(rt.regionAcc)) if (n > 0) emits.push({ type: "REGION_KILLS", region: r, count: n });
    rt.regionAcc = {};
  }

  // 2) world events
  const cur = rt.director.current;
  const tagAlive = cur ? sim.machines.reduce((n, m) => n + (m.alive && m.living === cur.id ? 1 : 0), 0) : 0;
  const step = stepLivingDirector(rt.director, { dt: inp.dt, now: inp.now, rnd: inp.rnd, px: inp.px, pz: inp.pz, alive, city, blocked: inp.blocked, tagAlive, playerKills: cur ? sim.livingKills[cur.id] ?? 0 : 0, fallen: inp.fallen });
  rt.director = step.director;
  if (step.started) {
    const r = EVENT_RULES[step.started.kind];
    alert(sim, `${r.title} · ${districtById(step.started.district)?.name ?? CITIES[step.started.city].name} — ${r.brief}`);
  }
  if (step.activated && rt.director.current) {
    spawnFor(sim, rt.director.current);
    rt.director = { ...rt.director, current: { ...rt.director.current, spawned: true, wave: FRACTURE_WAVE_EVERY } };
    alert(sim, `${EVENT_RULES[step.activated.kind].title} is live`);
  }
  const live = rt.director.current;
  if (live && live.phase === "ACTIVE" && live.kind === "FRACTURE" && live.wave <= 0) {
    if (tagAlive < 5) spawnEventSquad(sim, live.id, live.x, live.z, 2, 0, FRACTURE_TROOPS, FRACTURE_RADIUS + 5);
    rt.director = { ...rt.director, current: { ...live, wave: FRACTURE_WAVE_EVERY } };
  }
  if (step.resolved) {
    const { event, outcome } = step.resolved;
    if (outcome === "FAILED" || event.kind === "FRACTURE") despawn(sim, event.id); // a closed rift takes its aberrations with it
    delete sim.livingKills[event.id];
    alert(sim, `${EVENT_RULES[event.kind].title} ${outcome === "WON" ? "won" : "lost"}`);
    emits.push({ type: "EVENT", event, outcome });
  }

  // 3) city patrols defend their city; a hostile faction's patrols warn, then shoot the player
  const stance = (f: FactionId) => TIER_RULES[tierOf(inp.living, f)].patrol;
  const near = rt.guards.some((g) => Math.hypot(g.x - inp.px, g.z - inp.pz) < 160);
  if (near) {
    const res = stepGuards(rt.guards, sim.machines, { dt: inp.dt, px: inp.px, pz: inp.pz, playerAlive: alive, stance, rand: inp.rnd });
    for (const h of res.hits) {
      const m = sim.machines[h.index];
      if (!m?.alive || h.damage <= 0) continue;
      // NOT applyMachineDamageMods: that marks the hit as the player's damage, and a later death would then pay the player
      m.hp -= h.damage * (m.vulnUntil > performance.now() / 1000 ? m.vulnMult : 1);
      if (m.hp <= 0 && !m.boss) defeatMachine(sim, m, "world"); // city defence: the machine dies, the player is not paid for it
      else if (m.hp <= 0) m.hp = 0.01;
    }
    if (res.playerDamage > 0) hurtPlayer(sim, res.playerDamage, "Patrol fire");
    for (const f of res.warnings) {
      if (rt.clock - (rt.warnedAt[f] ?? -99) < 20) continue;
      rt.warnedAt[f] = rt.clock;
      alert(sim, `${FACTIONS[f].name} patrol: "Weapons down, Operator. You're not welcome here."`);
    }
  }

  // 4) where civilians run from
  rt.threats.length = 0;
  for (const m of sim.machines) if (m.alive && !m.decoy && cityAt(m.x, m.z)) rt.threats.push({ x: m.x, z: m.z });

  // 5) survey points and revealed stashes
  for (const mk of inp.markers) {
    if (rt.reached.has(mk.id)) continue;
    if (Math.hypot(inp.px - mk.x, inp.pz - mk.z) <= (mk.kind === "stash" ? STASH_REACH : SURVEY_REACH)) { rt.reached.add(mk.id); emits.push({ type: "REACH", x: inp.px, z: inp.pz }); }
  }

  const ev = rt.director.current;
  const hud: LivingHud = {
    city,
    event: ev ? {
      title: EVENT_RULES[ev.kind].title, brief: EVENT_RULES[ev.kind].brief, kind: ev.kind, phase: ev.phase, timer: ev.timer,
      district: districtById(ev.district)?.name ?? CITIES[ev.city].name, x: ev.x, z: ev.z, hold: ev.hold, holdNeed: FRACTURE_HOLD,
      left: sim.machines.reduce((n, m) => n + (m.alive && m.living === ev.id ? 1 : 0), 0),
      inRift: ev.kind === "FRACTURE" && Math.hypot(inp.px - ev.x, inp.pz - ev.z) <= FRACTURE_RADIUS,
    } : null,
  };
  return { emits, hud };
}

/** Death or a long teleport cancels nothing by itself; the director fails events the player leaves behind. */
export const livingStanceOf = (living: LivingState, f: FactionId) => TIER_RULES[tierOf(living, f)].patrol;
