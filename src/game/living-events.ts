/** Living World events (pure): the dynamic things that happen in Nexus City and Neon City while the player is there —
 * district invasions, distress calls, a roaming boss, a smuggler convoy and reality fractures. A small director picks the
 * next event (always in the city the player is standing in, preferring a fallen district to retake), warns, activates,
 * and resolves it from real sim state: tagged machines still alive, kills the player landed, time spent holding a
 * fracture. Scene spawns/despawns the machines when the phase changes; GameCanvas applies the resolution through
 * `resolveLivingEvent`, which changes standing, district status, contracts and materials once per event id. */
import { CITIES, CITY_FACTIONS, DISTRICTS, FACTIONS, adjustRep, districtStatus, recordDistrict, EMPTY_LIVING, type CityId, type District, type FactionId } from "./living-world";
import { recordEventWin } from "./living-npcs";
import type { MaterialId } from "./inventory";
import type { PlayerProgression } from "./progression";

export type LivingEventKind = "INVASION" | "DISTRESS" | "ROAMING_BOSS" | "CONVOY" | "FRACTURE";
export type LivingPhase = "WARNING" | "ACTIVE" | "WON" | "FAILED";

export type LivingEvent = {
  id: string; kind: LivingEventKind; city: CityId; district: string; x: number; z: number;
  phase: LivingPhase; timer: number;
  /** FRACTURE: seconds the player has held the rift */
  hold: number;
  /** Scene has spawned the wave for this event */
  spawned: boolean;
  /** FRACTURE: seconds until the next aberration wave */
  wave: number;
  /** the hostiles were all cleared, but none by the player (city patrols did it): no reward, no penalty */
  cleared?: boolean;
};

export type EventRule = {
  title: string; brief: string; warn: number; limit: number;
  /** who is grateful when it is won (null = the district's own faction) */
  beneficiary: FactionId | null;
  /** extra side effect: who resents it when won (the convoy's owners) */
  resents?: FactionId;
  win: { rep: number; materials: Partial<Record<MaterialId, number>>; shards: number };
  failRep: number;
  /** does losing it make the district fall */
  districtStakes: boolean;
};

export const EVENT_RULES: Record<LivingEventKind, EventRule> = {
  INVASION: { title: "District Invasion", brief: "Hostiles are pushing into the district. Drive them out before it falls.", warn: 15, limit: 150, beneficiary: null, win: { rep: 10, materials: { reinforcedAlloy: 3, microCircuits: 3 }, shards: 30 }, failRep: -6, districtStakes: true },
  DISTRESS: { title: "Distress Call", brief: "Civilians pinned down. Reach them and clear the attackers.", warn: 8, limit: 70, beneficiary: null, win: { rep: 6, materials: { scrapMetal: 8 }, shards: 15 }, failRep: -4, districtStakes: false },
  ROAMING_BOSS: { title: "Roaming Warlord", brief: "A boss-class threat is walking the city edge. Bring it down before it moves on.", warn: 20, limit: 210, beneficiary: null, win: { rep: 14, materials: { aegisCore: 1 }, shards: 60 }, failRep: -5, districtStakes: true },
  CONVOY: { title: "Smuggler Convoy", brief: "An armed smuggler convoy is crossing the city. Stop it before it slips out.", warn: 12, limit: 100, beneficiary: null, win: { rep: 8, materials: { vehicleParts: 3, fuel: 6 }, shards: 25 }, failRep: -3, districtStakes: false },
  FRACTURE: { title: "Reality Fracture", brief: "A rift has torn open. Hold position inside it while it spits out aberrations.", warn: 12, limit: 120, beneficiary: null, win: { rep: 8, materials: { anomalyCarbon: 3, dataShards: 3 }, shards: 50 }, failRep: -3, districtStakes: false },
};

/** seconds the player must hold a fracture; how close counts as holding it */
export const FRACTURE_HOLD = 25, FRACTURE_RADIUS = 9;
/** a distress call must be reached; leaving a city by this much past its edge abandons the event */
export const ABANDON_MARGIN = 80;
export const FIRST_EVENT_DELAY = 75, EVENT_GAP: [number, number] = [150, 240], RETAKE_DELAY = 45, RESULT_HOLD = 6;

export type LivingDirector = { next: number; current: LivingEvent | null; serial: number };
export const createLivingDirector = (): LivingDirector => ({ next: FIRST_EVENT_DELAY, current: null, serial: 0 });

/** which faction a convoy belongs to: in Neon City the Syndicate smuggles and the Directorate wants it stopped */
export function convoyFactions(city: CityId): { owner: FactionId | null; beneficiary: FactionId } {
  return city === "neon" ? { owner: "syndicate", beneficiary: "aegis" } : { owner: null, beneficiary: "wardens" };
}

export function eventBeneficiary(ev: Pick<LivingEvent, "kind" | "city" | "district">): FactionId {
  if (ev.kind === "CONVOY") return convoyFactions(ev.city).beneficiary;
  return DISTRICTS.find((d) => d.id === ev.district)?.faction ?? CITY_FACTIONS[ev.city][0]!;
}

/** Choose the next event for a city. Fallen districts are retaken first (always an invasion there). */
export function pickEvent(city: CityId, rnd: () => number, fallen: readonly string[], now: number, serial: number): LivingEvent {
  const inCity = DISTRICTS.filter((d) => d.city === city);
  const retake = inCity.find((d) => fallen.includes(d.id));
  const kinds: LivingEventKind[] = ["INVASION", "INVASION", "DISTRESS", "DISTRESS", "CONVOY", "FRACTURE", "ROAMING_BOSS"];
  const kind: LivingEventKind = retake ? "INVASION" : kinds[Math.floor(rnd() * kinds.length)]!;
  const district: District = retake ?? inCity[Math.floor(rnd() * inCity.length)]!;
  const c = CITIES[city];
  // Nexus anchors sit on street intersections of the district grid: stay on them (a jitter can land inside a building block)
  let x = district.x, z = district.z;
  if (city === "neon" && (kind === "ROAMING_BOSS" || kind === "CONVOY")) {
    // Neon's edge: either open end of the cross street (the blocks and the Spire fill the rest of the rim)
    x = c.x + (district.x >= c.x ? 45 : -45); z = c.z + 7;
  }
  const rule = EVENT_RULES[kind];
  return { id: `${city}-${kind.toLowerCase()}-${now.toString(36)}-${serial}`, kind, city, district: district.id, x, z, phase: "WARNING", timer: rule.warn, hold: 0, spawned: false, wave: 0 };
}

export type DirectorInput = {
  dt: number; now: number; rnd: () => number;
  px: number; pz: number; alive: boolean;
  /** the city the player is in (null outside both) */
  city: CityId | null;
  /** a scripted mission, tutorial, cinematic or vehicle chase is running: no new events */
  blocked: boolean;
  /** live tagged machines for the current event, and how many of its machines the PLAYER killed */
  tagAlive: number; playerKills: number;
  fallen: readonly string[];
};
export type DirectorStep = { director: LivingDirector; activated?: LivingEvent; resolved?: { event: LivingEvent; outcome: "WON" | "FAILED" }; started?: LivingEvent };

/** One director step. Mutation-free: returns a new director plus what happened this step. */
export function stepLivingDirector(d: LivingDirector, inp: DirectorInput): DirectorStep {
  const ev = d.current;
  if (!ev) {
    if (!inp.city || inp.blocked || !inp.alive) return { director: d };
    const retakeDue = inp.fallen.some((id) => id.startsWith(`${inp.city}:`));
    const next = Math.min(d.next, retakeDue ? RETAKE_DELAY : d.next) - inp.dt;
    if (next > 0) return { director: { ...d, next } };
    const started = pickEvent(inp.city, inp.rnd, inp.fallen, inp.now, d.serial + 1);
    return { director: { next: 0, current: started, serial: d.serial + 1 }, started };
  }
  const rule = EVENT_RULES[ev.kind];
  if (ev.phase === "WON" || ev.phase === "FAILED") {
    const timer = ev.timer - inp.dt;
    if (timer > 0) return { director: { ...d, current: { ...ev, timer } } };
    const [lo, hi] = EVENT_GAP;
    return { director: { ...d, current: null, next: lo + inp.rnd() * (hi - lo) } };
  }
  const c = CITIES[ev.city];
  const abandoned = Math.hypot(inp.px - c.x, inp.pz - c.z) > c.radius + ABANDON_MARGIN;
  if (ev.phase === "WARNING") {
    if (abandoned) return finish(d, ev, "FAILED");
    const timer = ev.timer - inp.dt;
    if (timer > 0) return { director: { ...d, current: { ...ev, timer } } };
    const activated: LivingEvent = { ...ev, phase: "ACTIVE", timer: rule.limit, wave: 0 };
    return { director: { ...d, current: activated }, activated };
  }
  // ACTIVE
  if (abandoned) return finish(d, ev, "FAILED");
  const timer = ev.timer - inp.dt;
  let hold = ev.hold;
  if (ev.kind === "FRACTURE") {
    if (inp.alive && Math.hypot(inp.px - ev.x, inp.pz - ev.z) <= FRACTURE_RADIUS) hold += inp.dt;
    if (hold >= FRACTURE_HOLD) return finish(d, { ...ev, hold }, "WON");
  } else if (ev.spawned && inp.tagAlive === 0) {
    return inp.playerKills > 0 ? finish(d, ev, "WON") : finish(d, { ...ev, cleared: true }, "FAILED");
  }
  if (timer <= 0) return finish(d, { ...ev, hold }, "FAILED");
  return { director: { ...d, current: { ...ev, timer, hold, wave: Math.max(0, ev.wave - inp.dt) } } };
}

function finish(d: LivingDirector, ev: LivingEvent, outcome: "WON" | "FAILED"): DirectorStep {
  const done: LivingEvent = { ...ev, phase: outcome, timer: RESULT_HOLD };
  return { director: { ...d, current: done }, resolved: { event: done, outcome } };
}

/** fallen district ids from the save (for the director's retake preference) */
export const fallenDistricts = (p: Pick<PlayerProgression, "living">, now: number) =>
  DISTRICTS.filter((d) => districtStatus(p.living ?? EMPTY_LIVING, d.id, now) === "FALLEN").map((d) => d.id);

/** Apply an event's outcome to the save, once per event id: standing, district status, DEFEND contracts and rewards. */
export function resolveLivingEvent(p: PlayerProgression, ev: Pick<LivingEvent, "id" | "kind" | "city" | "district" | "cleared">, outcome: "WON" | "FAILED", now = Date.now()): { progression: PlayerProgression; message: string } {
  const key = `living-event:${ev.id}`;
  if (p.earnedRewards.includes(key)) return { progression: p, message: "" };
  const rule = EVENT_RULES[ev.kind];
  const beneficiary = eventBeneficiary(ev);
  let living = p.living ?? EMPTY_LIVING;
  let next: PlayerProgression = { ...p, earnedRewards: [...p.earnedRewards, key] };
  if (outcome === "WON") {
    living = adjustRep(living, beneficiary, rule.win.rep, ev.kind !== "CONVOY");
    const owner = ev.kind === "CONVOY" ? convoyFactions(ev.city).owner : null;
    if (owner) living = adjustRep(living, owner, -8, false);
    if (rule.districtStakes) living = recordDistrict(living, ev.district, "WON", now);
    const materials = { ...next.materials };
    for (const [k, v] of Object.entries(rule.win.materials) as [MaterialId, number][]) materials[k] = (materials[k] ?? 0) + v;
    next = recordEventWin({ ...next, living, materials, fractureShards: next.fractureShards + rule.win.shards }, ev.city);
    const mats = Object.entries(rule.win.materials).map(([k, v]) => `+${v} ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`).join(", ");
    return { progression: next, message: `${rule.title} won · +${rule.win.rep} ${FACTIONS[beneficiary].name} · ${mats}, +${rule.win.shards} shards${owner ? ` · ${FACTIONS[owner].name} won't forget` : ""}` };
  }
  if (ev.cleared) return { progression: next, message: `${rule.title}: the city patrols handled it without you. No reward.` };
  living = adjustRep(living, beneficiary, rule.failRep, false);
  if (rule.districtStakes) living = recordDistrict(living, ev.district, "FAILED", now);
  const district = DISTRICTS.find((x) => x.id === ev.district);
  return { progression: { ...next, living }, message: `${rule.title} lost${rule.districtStakes && district ? ` · ${district.name} has fallen; its trade is closed until you retake it` : ""}` };
}
