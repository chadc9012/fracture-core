/** Living World runtime: the per-frame glue between the pure Living World rules and the live sim. Scene calls
 * `stepLivingRuntime` once per frame after stepSim; it advances the event director, spawns/despawns event machines,
 * runs city patrols (their hits go through the same damage path as everything else), tracks where civilians should
 * run from, and returns the save-changing events (`emits`) that GameCanvas applies to progression. No rendering. */
import { alert, defeatMachine, spawnNemesis, hurtPlayer, spawnEventSquad, summonBoss, type WorldSim } from "./sim";
import { CITIES, FACTIONS, TIER_RULES, cityAt, districtById, tierOf, type CityId, type FactionId, type LivingState } from "./living-world";
import { EVENT_RULES, FRACTURE_HOLD, FRACTURE_RADIUS, createLivingDirector, stepLivingDirector, type LivingDirector, type LivingEvent } from "./living-events";
import { createGuards, stepGuards, type Guard } from "./city-patrols";
import { STASH_REACH, SURVEY_REACH } from "./living-npcs";
import { REGIONS, regionAt } from "./world";
import { GUARDIAN_TAG, HOLLOW_CROWN, guardianDue } from "./godforge";
import { CONDITION_TEXT, SECRET_REACH, SECRET_SHIMMER, secretPoint, senseSecret, type SecretContext } from "./secrets";
import { ambushDue, TRAITS, type KillerSnapshot, type Nemesis } from "./nemesis";

export type LivingEmit =
  | { type: "KILLS"; city: CityId; count: number }
  /** player kills per region (map-activities.ts patrols) */
  | { type: "REGION_KILLS"; region: string; count: number }
  | { type: "EVENT"; event: LivingEvent; outcome: "WON" | "FAILED" }
  | { type: "REACH"; x: number; z: number }
  /** nemesis.ts: the player died to this machine / a nemesis machine died (killed = by the player) */
  | { type: "PLAYER_KILLED"; killer: KillerSnapshot; regionName: string }
  | { type: "NEMESIS_DOWN"; id: string; killed: boolean }
  /** secrets.ts: the player reached a secret that answers now */
  | { type: "SECRET"; id: string; night: boolean; storm: boolean }
  /** godforge.ts: the Furnace Guardian fell to the player; kills made with a Godforged relic in hand */
  | { type: "FORGE_HEART" }
  | { type: "RELIC_KILLS"; itemId: string; count: number };

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
  /** nemesis ambush timing */
  nemRegion: string | null; nemInRegion: number; nemLastAmbush: number; nemSummonDone: string | null;
  /** secrets.ts: the one the player is sensing (LivingCity draws its shimmer) */
  secretNear: { x: number; z: number; open: boolean; dist: number } | null;
  /** godforge.ts: the guardian has been summoned for this visit to the Hollow Crown */
  guardianOut: boolean;
};

export function createLivingRuntime(sim: Pick<WorldSim, "kills">): LivingRuntime {
  return { director: createLivingDirector(), guards: createGuards(), killsSeen: sim.kills, killAcc: {}, regionAcc: {}, flushIn: 1.5, reached: new Set(), threats: [], warnedAt: {}, clock: 0, nemRegion: null, nemInRegion: 0, nemLastAmbush: -1e9, nemSummonDone: null, secretNear: null, guardianOut: false };
}

export type LivingStepInput = {
  dt: number; now: number; px: number; pz: number;
  /** a scripted mission, tutorial, interior or cinematic is running */
  blocked: boolean;
  living: LivingState;
  fallen: readonly string[];
  markers: readonly { id: string; x: number; z: number; kind: "survey" | "stash" }[];
  rnd: () => number;
  /** nemesis.ts: the save's nemeses and one the player chose on the map (skips the wait) */
  nemeses?: readonly Nemesis[];
  summonedNemesis?: string | null;
  /** secrets.ts conditions (night, storm, nemesis slain, pledged) and what is already found */
  secrets?: SecretContext;
  /** godforge.ts: the save's ledger (stage) and the Godforged relic in hand, if any */
  forge?: { earned: readonly string[]; relicId: string | null };
};

export type LivingHud = {
  city: CityId | null;
  /** secrets.ts: NOVA senses something (distance only; the name shows once you are in reach) */
  secret?: { dist: number; inReach: boolean; open: boolean; name: string | null; locked: string | null } | null;
  /** a nemesis is on the field */
  nemesis?: { name: string; rank: number; traits: string[]; weak: string | null; hp: number } | null;
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

  // 3b) nemeses: report deaths/kills, and ambush the player in a nemesis's region (never during missions or city events)
  for (const d of sim.deathEvents.splice(0)) emits.push({ type: "PLAYER_KILLED", killer: d.killer, regionName: REGIONS.find((r) => r.id === d.killer.zone)?.name ?? "the wastes" });
  for (const e of sim.nemesisEvents.splice(0)) emits.push({ type: "NEMESIS_DOWN", id: e.id, killed: e.killed });
  {
    const here = regionAt(inp.px, inp.pz)?.id ?? null;
    if (here !== rt.nemRegion) { rt.nemRegion = here; rt.nemInRegion = 0; } else rt.nemInRegion += inp.dt;
    const busy = inp.blocked || !!rt.director.current || sim.machines.some((m) => m.alive && m.nemesis);
    const summoned = inp.summonedNemesis && inp.summonedNemesis !== rt.nemSummonDone ? inp.summonedNemesis : null;
    const due = busy || !alive ? null : ambushDue(inp.nemeses ?? [], here, rt.nemInRegion, rt.clock - rt.nemLastAmbush, summoned);
    if (due) {
      const a = inp.rnd() * Math.PI * 2;
      if (spawnNemesis(sim, due, inp.px + Math.cos(a) * 24, inp.pz + Math.sin(a) * 24)) { rt.nemLastAmbush = rt.clock; if (due.id === summoned) rt.nemSummonDone = summoned; }
    }
  }

  // 3c) secrets: sense the nearest unfound one; reaching one that answers now emits its claim (once per session)
  rt.secretNear = null;
  let secretHud: LivingHud["secret"] = null;
  if (inp.secrets && alive) {
    const sensed = senseSecret(inp.px, inp.pz, inp.secrets);
    if (sensed) {
      const p = secretPoint(sensed.secret), inReach = sensed.dist <= SECRET_REACH;
      rt.secretNear = sensed.dist <= SECRET_SHIMMER ? { x: p.x, z: p.z, open: sensed.open, dist: sensed.dist } : null;
      secretHud = { dist: Math.round(sensed.dist), inReach, open: sensed.open, name: inReach ? sensed.secret.name : null, locked: inReach && !sensed.open ? sensed.secret.locked || CONDITION_TEXT[sensed.secret.condition] : null };
      if (inReach && sensed.open && !rt.reached.has(`secret:${sensed.secret.id}`)) { rt.reached.add(`secret:${sensed.secret.id}`); emits.push({ type: "SECRET", id: sensed.secret.id, night: inp.secrets.night, storm: inp.secrets.storm }); }
    }
  }

  // 3d) the Godforge: the Furnace Guardian wakes when you walk into the opened Hollow Crown; relic mastery counts kills
  if (inp.forge) {
    const fp = { earnedRewards: inp.forge.earned as string[] };
    if (guardianDue(fp, inp.px, inp.pz) && !rt.guardianOut && alive && !sim.machines.some((m) => m.alive && m.living === GUARDIAN_TAG)) {
      const hp = 60 * (sim.challenge?.enemyHp ?? 1);
      if (summonBoss(sim, "ember", HOLLOW_CROWN.x, HOLLOW_CROWN.z + 6, { profile: "The Furnace Guardian", living: GUARDIAN_TAG, hp, maxHp: hp, drop: "thermalShards" })) {
        rt.guardianOut = true;
        alert(sim, "The Furnace Guardian wakes: \"None pass to the forge unproven.\"");
      }
    }
    if (rt.guardianOut && Math.hypot(inp.px - HOLLOW_CROWN.x, inp.pz - HOLLOW_CROWN.z) > HOLLOW_CROWN.radius * 6 && !sim.machines.some((m) => m.alive && m.living === GUARDIAN_TAG)) rt.guardianOut = false;
    if ((sim.livingKills[GUARDIAN_TAG] ?? 0) > 0) { delete sim.livingKills[GUARDIAN_TAG]; emits.push({ type: "FORGE_HEART" }); }
    if (delta > 0 && inp.forge.relicId) emits.push({ type: "RELIC_KILLS", itemId: inp.forge.relicId, count: delta });
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
  const nm = sim.machines.find((m) => m.alive && m.nemesis);
  const nd = nm ? (inp.nemeses ?? []).find((n) => n.id === nm.nemesis) : undefined;
  const hud: LivingHud = {
    city,
    secret: secretHud,
    nemesis: nm && nd ? { name: `${nd.name} ${nd.epithet}`, rank: nd.rank, traits: nd.traits.map((t) => TRAITS[t].label), weak: nm.nemesisWeak ?? null, hp: Math.round(nm.hp * 10) / 10 } : null,
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
