/** Open-world discoveries: flags, beacons, patrols, small rift fractures, distress signals, hidden caches, movement routes and anomalies.
 * The Operations Board lists organised work; these are found by roaming. They run on the SAME engine as the board (activities.ts): each discovery
 * owns a hidden ActivityDef, so attempts, cooldowns, payouts, reputation and shaders go through one code path and one save record.
 * Visible discoveries show on the map once you are near; hidden ones appear only after a beacon (or other legitimate clue) reveals them.
 * Patrols move along a real-time path; distress signals expire. Rewards are smaller than board contracts, hidden encounters are better. */
import { ACTIVITIES, AREAS, EXTRA_DEFS, NO_DEATH, NO_DMG, R, activityState, collect, course, hold, kills, pointWorld, type ActivityDef, type ActivityState, type Objective, type OptionalChallenge } from "./activities";
import type { PlayerProgression } from "./progression";

export type DiscoveryKind = "flag" | "beacon" | "patrol" | "fracture" | "distress" | "cache" | "movement" | "anomaly";
export type Discovery = { id: string; area: string; kind: DiscoveryKind; name: string; sign: string; at: readonly [number, number]; hidden: boolean; reveals?: readonly string[]; def: ActivityDef };
export const VISIBLE_RANGE = 120;
export const TRIGGER_RADIUS = 7;
const foundKey = (id: string) => `disc-found:${id}`;

const off = (area: string, at: readonly [number, number], dx: number, dz: number): [number, number] => { const r = AREAS[area]!.radius; return [at[0] + dx / r, at[1] + dz / r]; };
const loop = (area: string, at: readonly [number, number], n: number, r: number, a0 = 0) => Array.from({ length: n }, (_, i) => off(area, at, Math.sin(a0 + (i / n) * Math.PI * 2) * r, Math.cos(a0 + (i / n) * Math.PI * 2) * r));

type Spec = { id: string; area: string; kind: DiscoveryKind; name: string; sign: string; at: [number, number]; hidden?: boolean; reveals?: string[]; faction: string; difficulty?: 1 | 2 | 3 | 4; stages: (at: [number, number]) => Objective[]; rewards: ReturnType<typeof R>; challenge?: OptionalChallenge; submerged?: boolean; attempts?: number };
const KIND: Record<DiscoveryKind, ActivityDef["kind"]> = { flag: "side", beacon: "side", patrol: "bounty", fracture: "event", distress: "side", cache: "side", movement: "parkour", anomaly: "event" };
function make(s: Spec): Discovery {
  const def: ActivityDef = { id: `d-${s.id}`, area: s.area, name: s.name, kind: KIND[s.kind], difficulty: s.difficulty ?? 2, faction: s.faction, brief: s.sign, attempts: s.attempts ?? 3, cooldownMin: 12, stages: s.stages(s.at), rewards: s.rewards, ...(s.challenge ? { challenge: s.challenge } : {}), ...(s.submerged ? { submerged: true } : {}) };
  EXTRA_DEFS.push(def);
  return { id: s.id, area: s.area, kind: s.kind, name: s.name, sign: s.sign, at: s.at, hidden: Boolean(s.hidden), ...(s.reveals ? { reveals: s.reveals } : {}), def };
}
const contain = (n: number) => (_: [number, number]): Objective[] => [kills(n, "Contain the fracture")];
const stabilize = (area: string, n: number, secs: number) => (at: [number, number]): Objective[] => [hold(at[0], at[1], 10, secs, "Hold the stabiliser"), kills(n, "Survive the wave")];
const beaconStages = (at: [number, number]): Objective[] => [hold(at[0], at[1], 6, 8, "Keep the beacon powered")];
const route = (area: string, n: number, secs: number, r = 36) => (at: [number, number]): Objective[] => [course(loop(area, at, n, r), secs, "Follow the marked route")];
const guard = (n: number) => (_: [number, number]): Objective[] => [kills(n, "Clear the guards"), kills(1, "Defeat the guardian", "elite")];
const caches = (area: string, n: number, secs: number) => (at: [number, number]): Objective[] => [collect(loop(area, at, n, 28), secs, "Recover the stash")];

const SPECS: Spec[] = [
  // Verdant Forest
  { id: "vf-flag", area: "veridan", kind: "flag", name: "Lost Expedition Flag", sign: "A torn survey flag marks stranded explorers.", at: [0.35, -0.3], faction: "wardens", stages: (at) => [hold(at[0], at[1], 12, 30, "Defend the extraction"), kills(5, "Drive off the scavengers")], rewards: R(60, 40, 8, { sporeFiber: 2 }, 0.04) },
  { id: "vf-beacon", area: "veridan", kind: "beacon", name: "Ancient Beacon", sign: "A forgotten device hums in the roots.", at: [-0.4, 0.2], faction: "wardens", reveals: ["vf-hidden"], stages: beaconStages, rewards: R(30, 25, 4, { runeDust: 1 }, 0) },
  { id: "vf-rift", area: "veridan", kind: "fracture", name: "Time-Glitched Grove", sign: "Violet cracks run through the trees.", at: [0.1, 0.55], faction: "wardens", stages: stabilize("veridan", 5, 25), rewards: R(80, 50, 8, { bioCatalyst: 1, sporeFiber: 1 }, 0.05) },
  { id: "vf-hidden", area: "veridan", kind: "fracture", name: "Sealed Fracture", sign: "A concealed fracture leads to something unusual.", at: [-0.6, -0.5], hidden: true, faction: "wardens", difficulty: 4, stages: guard(6), challenge: NO_DEATH, rewards: R(260, 140, 20, { bioCatalyst: 3, anomalyCarbon: 1 }, 0.25) },
  // Neon City
  { id: "nc-raceflag", area: "neon", kind: "flag", name: "Underground Racing Flag", sign: "An unofficial race start, painted on the asphalt.", at: [0.5, 0.4], faction: "syndicate", stages: (at) => [course(loop("neon", at, 5, 26), 70, "Beat the local racer")], rewards: R(70, 40, 8, { microCircuits: 2 }, 0.06), challenge: { id: "fast", label: "Finish in under 60% of the time limit" } },
  { id: "nc-parkour", area: "neon", kind: "movement", name: "Parkour Beacon", sign: "Glowing markers trace a rooftop line.", at: [-0.45, -0.3], faction: "syndicate", stages: route("neon", 5, 60, 22), rewards: R(75, 45, 8, { microCircuits: 2 }, 0.06), challenge: { id: "fast", label: "Finish in under 60% of the time limit" } },
  { id: "nc-signal", area: "neon", kind: "beacon", name: "Black-Market Signal", sign: "A stray transmission points under the street.", at: [0.1, -0.6], faction: "syndicate", reveals: ["nc-hidden-rail"], stages: beaconStages, rewards: R(30, 25, 5, { dataChip: 1 }, 0) },
  { id: "nc-patrol", area: "neon", kind: "patrol", name: "Street Patrol Dispute", sign: "A gang patrol and a security sweep are squaring off.", at: [0, 0], faction: "aegis", stages: (_) => [kills(6, "Break up the dispute")], rewards: R(80, 45, 9, { dataShards: 1, microCircuits: 1 }, 0.04) },
  { id: "nc-rift", area: "neon", kind: "fracture", name: "Glitching Street", sign: "The street flickers; the buildings do not agree with each other.", at: [-0.2, 0.6], faction: "aegis", stages: contain(6), rewards: R(85, 50, 9, { microCircuits: 2, energyToken: 1 }, 0.05) },
  { id: "nc-hidden-rail", area: "neon", kind: "movement", name: "Secret Rail Line", sign: "A maintenance rail nobody maps.", at: [0.6, -0.1], hidden: true, faction: "syndicate", difficulty: 4, stages: route("neon", 6, 60, 26), challenge: { id: "fast", label: "Finish in under 60% of the time limit" }, rewards: R(240, 130, 18, { dataChip: 2, microCircuits: 3 }, 0.25) },
  // Neon City Underground
  { id: "nu-cache", area: "neon-underground", kind: "cache", name: "Smuggler Stash", sign: "A loose panel hides a dead drop.", at: [0.3, 0.2], faction: "syndicate", stages: caches("neon-underground", 3, 120), rewards: R(90, 50, 9, { dataChip: 1, scrapMetal: 3 }, 0.05) },
  // Nexus City
  { id: "nx-flag", area: "nexus", kind: "flag", name: "Contested Checkpoint", sign: "A security flag over an unmanned checkpoint.", at: [0.45, 0.35], faction: "aegis", stages: (at) => [kills(6, "Clear the checkpoint"), hold(at[0], at[1], 10, 20, "Hold the checkpoint")], rewards: R(75, 45, 9, { gearParts: 1, microCircuits: 1 }, 0.04) },
  { id: "nx-patrol", area: "nexus", kind: "patrol", name: "Rogue Sentinel Patrol", sign: "A malfunctioning Sentinel is drifting through the district.", at: [-0.2, 0.2], faction: "wardens", difficulty: 3, stages: (_) => [kills(1, "Destroy the Sentinel", "elite"), kills(3, "Clear its escorts")], rewards: R(110, 60, 10, { reinforcedAlloy: 2 }, 0.06) },
  { id: "nx-grid", area: "nexus", kind: "fracture", name: "Grid Fracture", sign: "Arcing energy tears at a failing conduit.", at: [-0.5, -0.4], faction: "wardens", stages: stabilize("nexus", 4, 25), rewards: R(80, 50, 9, { microCircuits: 2 }, 0.05) },
  // Thalassia
  { id: "th-beacon", area: "thalassia", kind: "beacon", name: "Submersible Beacon", sign: "A transponder pings from a wreck in the dark.", at: [0.3, 0.3], faction: "tidewardens", submerged: true, reveals: ["th-wreck"], stages: beaconStages, rewards: R(30, 25, 5, { abyssCore: 0 }, 0) },
  { id: "th-distress", area: "thalassia", kind: "distress", name: "Distress Signal", sign: "A diver is trapped near a failing pressure door.", at: [-0.35, 0.1], faction: "tidewardens", submerged: true, stages: (at) => [hold(at[0], at[1], 10, 25, "Hold the pressure door"), kills(4, "Drive off the predators")], rewards: R(100, 55, 10, { reinforcedAlloy: 1, bioCatalyst: 1 }, 0.05) },
  { id: "th-rift", area: "thalassia", kind: "fracture", name: "Underwater Fracture", sign: "The water bends around a violet tear.", at: [0.1, -0.5], faction: "tidewardens", submerged: true, stages: contain(5), rewards: R(95, 55, 10, { abyssCore: 0, bioCatalyst: 2 }, 0.06) },
  { id: "th-wreck", area: "thalassia", kind: "cache", name: "Hidden Wreck", sign: "A wreck the charts do not show.", at: [0.6, -0.2], hidden: true, faction: "tidewardens", submerged: true, difficulty: 4, stages: guard(5), challenge: NO_DEATH, rewards: R(270, 140, 20, { abyssCore: 1, dataChip: 2 }, 0.25) },
  // Ember Peaks
  { id: "em-flag", area: "ember", kind: "flag", name: "Mining Flag", sign: "A foreman's flag over a half-reclaimed facility.", at: [0.3, -0.3], faction: "forgeborn", stages: (at) => [kills(6, "Clear the facility"), hold(at[0], at[1], 12, 20, "Hold the entrance")], rewards: R(70, 45, 8, { thermalShards: 2 }, 0.04) },
  { id: "em-beacon", area: "ember", kind: "beacon", name: "Emergency Beacon", sign: "A dim light flashes beneath the ash.", at: [-0.4, 0.3], faction: "forgeborn", stages: beaconStages, rewards: R(60, 35, 6, { thermalShards: 1 }, 0) },
  { id: "em-rift", area: "ember", kind: "fracture", name: "Heat Fracture", sign: "The air shimmers, and the rocks flow upward.", at: [0.1, 0.5], faction: "forgeborn", stages: stabilize("ember", 5, 25), rewards: R(90, 50, 9, { thermalShards: 2, magmaCore: 0 }, 0.05) },
  // Wastelands
  { id: "wl-flag", area: "wastelands", kind: "flag", name: "Rebel Flag", sign: "A rebel flag over a pinned-down supply route.", at: [0.4, 0.2], faction: "rebels", stages: (at) => [kills(6, "Break the ambush"), hold(at[0], at[1], 12, 20, "Hold the route")], rewards: R(80, 45, 9, { vehicleParts: 1, scrapMetal: 3 }, 0.05) },
  { id: "wl-convoy", area: "wastelands", kind: "patrol", name: "Convoy Signal", sign: "Engine noise on the wind: a convoy is moving.", at: [-0.3, 0.1], faction: "rebels", stages: (_) => [kills(6, "Intercept the convoy")], rewards: R(90, 50, 9, { vehicleParts: 1, gearParts: 1 }, 0.05) },
  { id: "wl-trail", area: "wastelands", kind: "cache", name: "Scavenger Trail", sign: "Footprints lead to a stash.", at: [0.1, -0.5], faction: "rebels", stages: caches("wastelands", 3, 150), rewards: R(85, 45, 8, { scrapMetal: 4, reinforcedAlloy: 1 }, 0.04) },
  // Shrouded Swamps
  { id: "sw-flag", area: "swamps", kind: "flag", name: "Missing-Person Flag", sign: "A scout's flag, torn and half-submerged.", at: [-0.3, 0.3], faction: "wardens", stages: caches("swamps", 3, 150), rewards: R(65, 40, 8, { sporeFiber: 2 }, 0.04) },
  { id: "sw-beacon", area: "swamps", kind: "beacon", name: "Signal Beacon", sign: "A transmission pulses through the fog.", at: [0.4, 0.1], faction: "wardens", reveals: ["sw-hidden"], stages: beaconStages, rewards: R(30, 25, 4, { runeDust: 1 }, 0) },
  { id: "sw-rift", area: "swamps", kind: "fracture", name: "Swamp Fracture", sign: "The water runs the wrong way around a violet seam.", at: [0, -0.5], faction: "wardens", stages: contain(6), rewards: R(85, 50, 9, { bioCatalyst: 1, sporeFiber: 1 }, 0.05) },
  { id: "sw-hidden", area: "swamps", kind: "fracture", name: "Distorted Hollow", sign: "A hollow the marsh hides from maps.", at: [-0.6, -0.1], hidden: true, faction: "wardens", difficulty: 4, stages: guard(6), challenge: NO_DEATH, rewards: R(260, 140, 20, { bioCatalyst: 3, anomalyCarbon: 1 }, 0.25) },
  // Solara Desert
  { id: "so-flag", area: "solara", kind: "flag", name: "Caravan Flag", sign: "A trader's pennant above a stalled caravan.", at: [-0.3, -0.3], faction: "covenant", stages: (_) => [kills(7, "Break the ambush")], rewards: R(80, 45, 9, { runeDust: 1, relicFragment: 1 }, 0.05) },
  { id: "so-beacon", area: "solara", kind: "beacon", name: "Ancient Beacon", sign: "A buried obelisk answers the sun.", at: [0.4, 0.4], faction: "covenant", reveals: ["so-hunt"], stages: beaconStages, rewards: R(30, 25, 4, { runeDust: 1 }, 0) },
  { id: "so-rift", area: "solara", kind: "fracture", name: "Sandstorm Fracture", sign: "A wall of sand that does not move with the wind.", at: [0.1, -0.5], faction: "covenant", stages: stabilize("solara", 5, 25), rewards: R(90, 50, 9, { runeDust: 2, ruinStone: 0 }, 0.05) },
  { id: "so-hunt", area: "solara", kind: "patrol", name: "Hidden Hunt", sign: "Tracks lead to a rare beast. This is not Vyrak.", at: [-0.55, 0.5], hidden: true, faction: "covenant", difficulty: 4, stages: guard(5), challenge: NO_DEATH, rewards: R(270, 140, 20, { relicFragment: 2, runeDust: 2 }, 0.25) },
  // Frost Spire
  { id: "fs-flag", area: "frostspire", kind: "flag", name: "Rescue Flag", sign: "A flag whipping in the whiteout.", at: [0.3, 0.3], faction: "wardens", stages: caches("frostspire", 3, 150), rewards: R(70, 40, 8, { cryoCrystal: 2 }, 0.04) },
  { id: "fs-beacon", area: "frostspire", kind: "beacon", name: "Frozen Beacon", sign: "An abandoned outpost beacon, iced shut.", at: [-0.4, 0.2], faction: "wardens", stages: beaconStages, rewards: R(60, 35, 6, { cryoCrystal: 1 }, 0) },
  { id: "fs-rift", area: "frostspire", kind: "anomaly", name: "Time-Freeze", sign: "Snow hangs in the air around an outpost. It is not falling.", at: [0, -0.5], faction: "wardens", stages: stabilize("frostspire", 5, 25), rewards: R(95, 55, 9, { cryoCrystal: 2, zeroCore: 0 }, 0.06) },
  // Neon Core
  { id: "ncd-signal", area: "neon-core", kind: "distress", name: "Aegis Distress", sign: "A technician's emergency call from a locked wing.", at: [0.2, 0.3], faction: "aegis", stages: (at) => [hold(at[0], at[1], 10, 25, "Hold the wing"), kills(5, "Drive off the response team")], rewards: R(110, 60, 10, { dataChip: 1, anomalyCore: 0 }, 0.06) },
];
for (const s of SPECS) for (const m of Object.keys(s.rewards.materials) as (keyof typeof s.rewards.materials)[]) if (!s.rewards.materials[m]) delete s.rewards.materials[m];
export const DISCOVERIES: readonly Discovery[] = SPECS.map(make);
export const discoveryById = (id: string) => DISCOVERIES.find((d) => d.id === id);
export const discoveryOfDef = (defId: string) => DISCOVERIES.find((d) => d.def.id === defId);

/* ------------------------------ finding ------------------------------ */
const has = (p: Pick<PlayerProgression, "earnedRewards">, id: string) => p.earnedRewards.includes(foundKey(id));
/** a beacon (or any legitimate clue) reveals hidden discoveries; stored as earned keys so the cloud merge unions them */
export function reveal<T extends Pick<PlayerProgression, "earnedRewards">>(p: T, ids: readonly string[]): T {
  const add = ids.filter((id) => discoveryById(id) && !has(p, id)).map(foundKey);
  return add.length ? { ...p, earnedRewards: [...p.earnedRewards, ...add] } : p;
}
export const revealedBy = (defId: string) => discoveryOfDef(defId)?.reveals ?? [];
export const isKnown = (p: Pick<PlayerProgression, "earnedRewards">, d: Discovery) => !d.hidden || has(p, d.id);

/** patrols walk a loop in real time; everything else stays put */
export function positionOf(d: Discovery, now: number): { x: number; z: number } {
  const base = pointWorld(d.area, d.at);
  if (d.kind !== "patrol") return base;
  const a = (now / 1000 / 180) * Math.PI * 2 + d.id.length, r = Math.min(40, AREAS[d.area]!.radius * 0.2);
  return { x: base.x + Math.sin(a) * r, z: base.z + Math.cos(a) * r };
}
/** distress signals are only audible for 30 of every 90 real minutes (per-signal offset), so an ignored call can expire */
export const DISTRESS_WINDOW_MS = 30 * 60_000, DISTRESS_PERIOD_MS = 90 * 60_000;
export function isOpen(d: Discovery, now: number): { open: boolean; msLeft: number } {
  if (d.kind !== "distress") return { open: true, msLeft: Infinity };
  const off0 = (d.id.length * 7 * 60_000) % DISTRESS_PERIOD_MS, t = (now + off0) % DISTRESS_PERIOD_MS;
  return t < DISTRESS_WINDOW_MS ? { open: true, msLeft: DISTRESS_WINDOW_MS - t } : { open: false, msLeft: 0 };
}
export type Seen = { discovery: Discovery; x: number; z: number; dist: number; state: ActivityState };
/** discoveries the player can currently see or hear: known, open, off cooldown/limit, within range */
export function nearby(p: Pick<PlayerProgression, "earnedRewards" | "missionRuns">, x: number, z: number, now: number, range = VISIBLE_RANGE): Seen[] {
  const out: Seen[] = [];
  for (const d of DISCOVERIES) {
    if (!isKnown(p, d) || !isOpen(d, now).open) continue;
    const pos = positionOf(d, now), dist = Math.hypot(pos.x - x, pos.z - z);
    if (dist > range) continue;
    const state = activityState(p, d.def, now);
    if (!state.available) continue;
    out.push({ discovery: d, ...pos, dist, state });
  }
  return out.sort((a, b) => a.dist - b.dist);
}
export const triggered = (p: Pick<PlayerProgression, "earnedRewards" | "missionRuns">, x: number, z: number, now: number): Discovery | null => nearby(p, x, z, now, TRIGGER_RADIUS)[0]?.discovery ?? null;
export const AREA_COUNT = new Set(ACTIVITIES.map((a) => a.area)).size;
