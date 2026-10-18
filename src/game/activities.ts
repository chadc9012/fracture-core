/** Regional side missions, bounties and replayable activities (Destiny-style loop, World Fracture's own content).
 * Rules (from the design): cooldowns and daily limits use REAL time (Date.now), never the in-game clock; the daily reset is 00:00 UTC;
 * starting an activity consumes an attempt (failing or abandoning never refunds it); completing it starts the cooldown; a capped activity
 * never blocks the others. Everything persists in progression.missionRuns ({day, count, last}), so saves and the cloud merge already carry it.
 * Objectives are things the client can really measure today: kills (by tier) in the region, ordered checkpoints against a clock (races,
 * parkour, rail runs), collecting points, holding a zone, and delivering from A to B.
 * NOT here: an authoritative backend. A client clock can be edited, so for production the same checks must run server-side. */
import { grantXP } from "./xp";
import { ARMOR_SHADERS, grantShader, ownsShader } from "./armor-shaders";
import { REGIONS } from "./world";
import { NEON_CENTER } from "./living-world";
import { THALASSIA_CENTER } from "./thalassia-site";
import type { MaterialId } from "./inventory";
import type { PlayerProgression } from "./progression";

export type ActivityKind = "side" | "bounty" | "race" | "parkour" | "event" | "contract";
export type Objective =
  | { kind: "kills"; count: number; tier?: "any" | "elite" | "boss"; label: string }
  | { kind: "course"; /** ordered checkpoints, fractions of the area radius */ points: readonly (readonly [number, number])[]; timeLimit: number; label: string }
  | { kind: "collect"; points: readonly (readonly [number, number])[]; timeLimit: number; label: string }
  | { kind: "hold"; at: readonly [number, number]; radius: number; seconds: number; label: string }
  | { kind: "deliver"; from: readonly [number, number]; to: readonly [number, number]; timeLimit: number; label: string };
export type OptionalChallenge = { id: "no-damage" | "fast" | "no-death"; label: string };
export type Rewards = { nex: number; xp: number; rep: number; materials: Partial<Record<MaterialId, number>>; /** earned-only shader chance on completion */ shaderChance: number };
export type ActivityDef = {
  id: string; area: string; name: string; kind: ActivityKind; difficulty: 1 | 2 | 3 | 4; brief: string;
  attempts: number; cooldownMin: number; stages: readonly Objective[]; challenge?: OptionalChallenge; rewards: Rewards;
  /** needs the underwater approach (Thalassia) */ submerged?: boolean; /** reputation needed to see this contract */ minRep?: number; faction: string;
};

/** where each activity area lives: map regions use their own centre; the cities use their own */
export const AREAS: Readonly<Record<string, { name: string; x: number; z: number; radius: number }>> = {
  veridan: { name: "Verdant Forest", ...pick("veridan") }, nexus: { name: "Nexus City", ...pick("nexus") }, ember: { name: "Ember Peaks", ...pick("ember") },
  wastelands: { name: "Wastelands", ...pick("wastelands") }, swamps: { name: "Shrouded Swamps", ...pick("swamps") }, solara: { name: "Solara Desert", ...pick("solara") },
  frostspire: { name: "Frost Spire", ...pick("frostspire") },
  neon: { name: "Neon City", x: NEON_CENTER.x, z: NEON_CENTER.z, radius: 60 },
  "neon-underground": { name: "Neon City Underground", x: NEON_CENTER.x - 22, z: NEON_CENTER.z - 7, radius: 28 },
  "neon-core": { name: "Neon Core District", x: NEON_CENTER.x, z: NEON_CENTER.z - 29, radius: 26 },
  thalassia: { name: "Thalassia — Underwater City", x: THALASSIA_CENTER.x, z: THALASSIA_CENTER.z, radius: 50 },
};
function pick(id: string) { const r = REGIONS.find((x) => x.id === id)!; return { x: r.x, z: r.z, radius: r.radius }; }

const ring = (n: number, r: number, a0 = 0): [number, number][] => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * Math.PI * 2; return [Math.round(Math.sin(a) * r * 100) / 100, Math.round(Math.cos(a) * r * 100) / 100] as [number, number]; });
const R = (nex: number, xp: number, rep: number, materials: Rewards["materials"], shaderChance = 0.06): Rewards => ({ nex, xp, rep, materials, shaderChance });
const kills = (count: number, label: string, tier: "any" | "elite" | "boss" = "any"): Objective => ({ kind: "kills", count, tier, label });
const hold = (x: number, z: number, radius: number, seconds: number, label: string): Objective => ({ kind: "hold", at: [x, z], radius, seconds, label });
const deliver = (from: [number, number], to: [number, number], timeLimit: number, label: string): Objective => ({ kind: "deliver", from, to, timeLimit, label });
const course = (points: [number, number][], timeLimit: number, label: string): Objective => ({ kind: "course", points, timeLimit, label });
const collect = (points: [number, number][], timeLimit: number, label: string): Objective => ({ kind: "collect", points, timeLimit, label });
const NO_DMG: OptionalChallenge = { id: "no-damage", label: "Finish without taking damage" }, FAST: OptionalChallenge = { id: "fast", label: "Finish in under 60% of the time limit" }, NO_DEATH: OptionalChallenge = { id: "no-death", label: "Finish without dying" };

export const ACTIVITIES: readonly ActivityDef[] = [
  // Verdant Forest
  { id: "vf-rescue", area: "veridan", name: "Lost Survey Team", kind: "side", difficulty: 1, faction: "wardens", brief: "A survey team vanished in the canopy. Reach their beacons and bring them back.", attempts: 3, cooldownMin: 20, stages: [collect(ring(3, 0.55, 0.4), 420, "Reach the three survivor beacons")], challenge: NO_DEATH, rewards: R(90, 60, 12, { sporeFiber: 3, scrapMetal: 4 }) },
  { id: "vf-stalker", area: "veridan", name: "Phase-Stalker Bounty", kind: "bounty", difficulty: 2, faction: "wardens", brief: "A stalker that blinks between worlds is hunting travellers. Put it down.", attempts: 3, cooldownMin: 30, stages: [kills(6, "Defeat the Phase-Stalker pack"), kills(1, "Defeat the alpha", "elite")], challenge: NO_DMG, rewards: R(130, 90, 16, { bioCatalyst: 2, sporeFiber: 3 }) },
  { id: "vf-bloom", area: "veridan", name: "Fracture Bloom", kind: "event", difficulty: 2, faction: "wardens", brief: "A bloom of fractured plants is spreading. Hold the line while it is cut back.", attempts: 2, cooldownMin: 45, stages: [hold(0, 0, 14, 60, "Hold the bloom site"), kills(8, "Clear what the bloom draws in")], rewards: R(110, 80, 14, { bioCatalyst: 3 }) },
  // Neon City
  { id: "nc-circuit", area: "neon", name: "Midnight Circuit", kind: "race", difficulty: 2, faction: "syndicate", brief: "Race the elevated roads and rail loops against the clock.", attempts: 3, cooldownMin: 20, stages: [course(ring(8, 0.62, 0.2), 150, "Hit all eight gates in order")], challenge: FAST, rewards: R(120, 70, 14, { microCircuits: 3 }, 0.1) },
  { id: "nc-ghost", area: "neon", name: "Rooftop Ghost Run", kind: "parkour", difficulty: 3, faction: "syndicate", brief: "A timed parkour route across the rooftops: wall-runs, slides, jumps and dashes.", attempts: 3, cooldownMin: 25, stages: [course(ring(6, 0.5, 1.0), 110, "Reach every rooftop marker in order")], challenge: FAST, rewards: R(140, 80, 16, { microCircuits: 3, dataChip: 1 }, 0.1) },
  { id: "nc-riot", area: "neon", name: "Rail Riot", kind: "parkour", difficulty: 3, faction: "syndicate", brief: "Chain rail transfers and mag-grinds through the loop. Mag-Grind Boots help; they are not required.", attempts: 3, cooldownMin: 25, stages: [course(ring(5, 0.45, 2.0), 120, "Ride the five rail nodes in order")], challenge: FAST, rewards: R(140, 80, 16, { microCircuits: 2, energyToken: 2 }, 0.1) },
  { id: "nc-jackers", area: "neon", name: "Signal Jackers", kind: "bounty", difficulty: 2, faction: "aegis", brief: "A crew is hijacking the city's signals. Take them down and cut their relay.", attempts: 3, cooldownMin: 30, stages: [kills(8, "Defeat the crew"), hold(0, 0, 8, 25, "Disable the relay")], challenge: NO_DEATH, rewards: R(150, 90, 18, { dataShards: 2, microCircuits: 2 }) },
  // Neon City Underground
  { id: "nu-ledger", area: "neon-underground", name: "The Black Ledger", kind: "contract", difficulty: 3, faction: "syndicate", brief: "Infiltrate the underground market, steal the evidence and escape the pursuit.", attempts: 2, cooldownMin: 60, stages: [collect(ring(3, 0.5, 0.7), 300, "Take the three ledger pages"), course([[0.8, 0.8], [0, 0.95]], 90, "Escape through the service passage")], rewards: R(240, 130, 24, { dataChip: 2, anomalyCarbon: 1 }, 0.15) },
  { id: "nu-contraband", area: "neon-underground", name: "Contraband Recovery", kind: "contract", difficulty: 3, faction: "syndicate", brief: "Recover a lost shipment from a rival den before it is moved.", attempts: 2, cooldownMin: 60, stages: [kills(6, "Clear the den"), deliver([0, 0], [0.8, -0.6], 120, "Carry the crate out")], rewards: R(230, 120, 22, { relicFragment: 1, dataChip: 1 }, 0.15) },
  // Nexus City
  { id: "nx-grid", area: "nexus", name: "Grid Restoration", kind: "side", difficulty: 2, faction: "wardens", brief: "Reboot three failed grid nodes around the city.", attempts: 3, cooldownMin: 20, stages: [collect(ring(3, 0.6, 0.3), 360, "Reach the three grid nodes")], rewards: R(100, 60, 12, { microCircuits: 3, scrapMetal: 3 }) },
  { id: "nx-contract", area: "nexus", name: "Guild Contract", kind: "contract", difficulty: 2, faction: "guild", brief: "Escort a guild courier across the market district.", attempts: 3, cooldownMin: 25, stages: [deliver([-0.6, 0], [0.6, 0], 150, "Deliver the package")], rewards: R(110, 60, 14, { reinforcedAlloy: 2 }) },
  { id: "nx-sentinel", area: "nexus", name: "Rogue Sentinel", kind: "bounty", difficulty: 3, faction: "wardens", brief: "A Sentinel has gone rogue near the Spire. Stop it.", attempts: 3, cooldownMin: 35, stages: [kills(1, "Destroy the rogue Sentinel", "elite"), kills(4, "Clear its escorts")], challenge: NO_DMG, rewards: R(160, 100, 18, { gearParts: 2, reinforcedAlloy: 2 }) },
  // Thalassia
  { id: "th-pressure", area: "thalassia", name: "Pressure Line", kind: "side", difficulty: 2, faction: "tidewardens", submerged: true, brief: "Repair a failing habitat before the seals give.", attempts: 3, cooldownMin: 30, stages: [collect(ring(4, 0.5, 0.2), 420, "Seal the four failing joints")], rewards: R(120, 70, 14, { abyssCore: 1, reinforcedAlloy: 2 }) },
  { id: "th-hunters", area: "thalassia", name: "Abyssal Hunters", kind: "bounty", difficulty: 3, faction: "tidewardens", submerged: true, brief: "Track and defeat dangerous creatures in the deep water.", attempts: 3, cooldownMin: 45, stages: [kills(5, "Defeat the deep-water pack"), kills(1, "Defeat the apex hunter", "elite")], challenge: NO_DEATH, rewards: R(170, 100, 18, { abyssCore: 1, bioCatalyst: 2 }, 0.1) },
  { id: "th-dock", area: "thalassia", name: "The Silent Dock", kind: "contract", difficulty: 3, faction: "tidewardens", submerged: true, brief: "Infiltrate a derelict pressure dock and intercept the contraband.", attempts: 2, cooldownMin: 60, stages: [collect(ring(3, 0.55, 1.1), 360, "Find the three cargo caches"), kills(4, "Deal with the smugglers")], rewards: R(210, 120, 22, { dataChip: 2, abyssCore: 1 }, 0.12) },
  // Ember Peaks
  { id: "em-survey", area: "ember", name: "Survey Rescue", kind: "side", difficulty: 2, faction: "forgeborn", brief: "A geothermal survey is trapped by lava flows. Reach them.", attempts: 3, cooldownMin: 25, stages: [collect(ring(3, 0.5, 0.9), 420, "Reach the three stranded teams")], rewards: R(110, 70, 14, { thermalShards: 3, magmaCore: 1 }) },
  { id: "em-defense", area: "ember", name: "Geothermal Defense", kind: "event", difficulty: 3, faction: "forgeborn", brief: "Defend the tap while the pressure builds.", attempts: 2, cooldownMin: 35, stages: [hold(0, 0, 14, 75, "Hold the geothermal tap"), kills(8, "Clear the attackers")], rewards: R(150, 90, 16, { thermalShards: 4, forgeCatalyst: 1 }) },
  { id: "em-brute", area: "ember", name: "Cinder-Brute Hunt", kind: "bounty", difficulty: 3, faction: "forgeborn", brief: "A Cinder-Brute is tearing through the foundries.", attempts: 3, cooldownMin: 30, stages: [kills(1, "Defeat the Cinder-Brute", "elite"), kills(5, "Clear the foundry")], challenge: NO_DMG, rewards: R(160, 100, 18, { magmaCore: 1, thermalShards: 3 }) },
  // Wastelands
  { id: "wl-devil", area: "wastelands", name: "Dust Devil Run", kind: "race", difficulty: 2, faction: "rebels", brief: "Race the ruined streets and underground service passages.", attempts: 3, cooldownMin: 25, stages: [course(ring(8, 0.6, 0.5), 170, "Hit every gate in order")], challenge: FAST, rewards: R(120, 70, 14, { vehicleParts: 2, scrapMetal: 4 }, 0.1) },
  { id: "wl-convoy", area: "wastelands", name: "Convoy Breaker", kind: "bounty", difficulty: 3, faction: "rebels", brief: "Intercept a hostile supply convoy and recover its cargo.", attempts: 3, cooldownMin: 40, stages: [kills(8, "Break the convoy"), deliver([0.2, 0.2], [-0.6, -0.5], 150, "Bring the cargo to the rebels")], rewards: R(170, 100, 18, { vehicleParts: 2, gearParts: 2 }) },
  { id: "wl-route", area: "wastelands", name: "Rebel Route", kind: "contract", difficulty: 3, faction: "rebels", brief: "Find the hidden northwestern exit, clear the tunnel checkpoint and deliver supplies to the rebel trade port.", attempts: 2, cooldownMin: 55, stages: [kills(5, "Clear the tunnel checkpoint"), deliver([0.3, 0.3], [-0.75, -0.75], 240, "Deliver supplies to the trade port")], rewards: R(220, 120, 22, { reinforcedAlloy: 3, vehicleParts: 2 }, 0.12) },
  // Shrouded Swamps
  { id: "sw-scout", area: "swamps", name: "Scout Rescue", kind: "side", difficulty: 2, faction: "wardens", brief: "A scouting party is lost in the fog.", attempts: 3, cooldownMin: 20, stages: [collect(ring(3, 0.55, 1.4), 420, "Find the three scouts")], rewards: R(100, 60, 12, { sporeFiber: 3, runeDust: 1 }) },
  { id: "sw-track", area: "swamps", name: "Tracking Mission", kind: "bounty", difficulty: 2, faction: "wardens", brief: "Follow the trail to what is stalking the marsh.", attempts: 3, cooldownMin: 30, stages: [course(ring(4, 0.5, 0.2), 240, "Follow the four track markers"), kills(5, "Put it down")], rewards: R(130, 80, 14, { bioCatalyst: 2, sporeFiber: 3 }) },
  { id: "sw-corrupt", area: "swamps", name: "Corruption Hunt", kind: "bounty", difficulty: 3, faction: "wardens", brief: "A source of corruption is poisoning the water.", attempts: 3, cooldownMin: 35, stages: [kills(7, "Cleanse the corrupted"), kills(1, "Destroy the source", "elite")], challenge: NO_DMG, rewards: R(160, 100, 16, { bioCatalyst: 3, anomalyCarbon: 1 }) },
  // Solara Desert
  { id: "so-caravan", area: "solara", name: "Glass Caravan", kind: "side", difficulty: 2, faction: "covenant", brief: "Escort a caravan through the shifting dunes and reality storms.", attempts: 3, cooldownMin: 30, stages: [deliver([-0.7, -0.5], [0.7, 0.5], 240, "Escort the caravan across the dunes")], rewards: R(120, 70, 14, { runeDust: 2, relicFragment: 1 }, 0.1) },
  { id: "so-scale", area: "solara", name: "Scale-Breakers", kind: "bounty", difficulty: 3, faction: "covenant", brief: "Hunt Covenant raiders carrying stolen dragon-bond relics.", attempts: 3, cooldownMin: 35, stages: [kills(7, "Defeat the raiders"), kills(1, "Defeat their captain", "elite")], challenge: NO_DEATH, rewards: R(170, 100, 18, { relicFragment: 2, dragonite: 1 }, 0.1) },
  { id: "so-sunspire", area: "solara", name: "Sunspire Ascent", kind: "parkour", difficulty: 3, faction: "covenant", brief: "A timed climb through fractured sandstone structures.", attempts: 3, cooldownMin: 40, stages: [course(ring(5, 0.4, 0.8), 140, "Climb to the five ledges in order")], challenge: FAST, rewards: R(150, 90, 16, { runeDust: 2, ruinStone: 1 }, 0.1) },
  // Frost Spire
  { id: "fs-whiteout", area: "frostspire", name: "Whiteout Rescue", kind: "side", difficulty: 2, faction: "wardens", brief: "A climbing party is lost in a whiteout.", attempts: 3, cooldownMin: 25, stages: [collect(ring(3, 0.55, 0.6), 420, "Reach the three stranded climbers")], rewards: R(110, 70, 14, { cryoCrystal: 3 }) },
  { id: "fs-shards", area: "frostspire", name: "Frozen-Shard Hunt", kind: "bounty", difficulty: 3, faction: "wardens", brief: "Shard-wolves are gathering around a frozen shard.", attempts: 3, cooldownMin: 30, stages: [kills(7, "Defeat the shard pack"), kills(1, "Defeat the pack leader", "elite")], challenge: NO_DMG, rewards: R(160, 100, 16, { cryoCrystal: 4, zeroCore: 1 }) },
  { id: "fs-vertical", area: "frostspire", name: "Vertical Traverse", kind: "parkour", difficulty: 3, faction: "wardens", brief: "Cross the spire faces against the clock.", attempts: 3, cooldownMin: 40, stages: [course(ring(5, 0.45, 1.6), 150, "Reach the five anchor points in order")], challenge: FAST, rewards: R(140, 90, 16, { cryoCrystal: 2, runeDust: 1 }, 0.1) },
  // Neon Core District
  { id: "ncd-spire", area: "neon-core", name: "Aegis Spire Infiltration", kind: "contract", difficulty: 4, faction: "aegis", brief: "Slip past the Spire's security and reach the vault level.", attempts: 2, cooldownMin: 60, stages: [collect(ring(4, 0.55, 0.3), 360, "Breach the four security nodes"), kills(6, "Deal with the response team")], challenge: NO_DMG, rewards: R(260, 150, 26, { anomalyCore: 1, dataChip: 2 }, 0.18) },
  { id: "ncd-security", area: "neon-core", name: "High-Tier Security Bounty", kind: "bounty", difficulty: 4, faction: "aegis", brief: "A senior enforcer has gone rogue inside the Core.", attempts: 2, cooldownMin: 60, stages: [kills(1, "Take down the enforcer", "elite"), kills(8, "Clear their squad")], challenge: NO_DEATH, rewards: R(280, 160, 28, { anomalyCore: 1, aegisCore: 1 }, 0.18) },
];

/** The Vyrak rematch is NOT a board activity (Vyrak stays a special unique encounter): it only borrows the same real-time limits.
 * Once bonded, the Operator may face the Sky Sovereign again for Dragonite and the measurable challenges, 2 attempts a day with a 60 minute cooldown. */
export const VYRAK_REMATCH: ActivityDef = { id: "vyrak-rematch", area: "solara", name: "Vyrak — Rematch", kind: "contract", difficulty: 4, faction: "covenant", brief: "Face the Sky Sovereign again.", attempts: 2, cooldownMin: 60, stages: [], rewards: R(0, 0, 0, {}, 0) };
export const activityById = (id: string) => ACTIVITIES.find((a) => a.id === id) ?? (id === VYRAK_REMATCH.id ? VYRAK_REMATCH : undefined);
/** stamp a completion (starts the cooldown) for an activity that is not run through stepRun, e.g. the Vyrak rematch */
export function markCompleted<T extends Pick<PlayerProgression, "missionRuns">>(p: T, def: ActivityDef, now = Date.now()): T {
  const rec = p.missionRuns[recKey(def.id)];
  return { ...p, missionRuns: { ...p.missionRuns, [recKey(def.id)]: { day: rec?.day ?? dayKeyUtc(now), count: rec?.count ?? 0, last: now } } };
}
export const activitiesIn = (area: string) => ACTIVITIES.filter((a) => a.area === area);
export const areaOfPoint = (x: number, z: number): string | null => {
  let best: string | null = null, bestD = Infinity;
  for (const [id, a] of Object.entries(AREAS)) { const d = Math.hypot(x - a.x, z - a.z); if (d <= a.radius * 1.2 && d < bestD) { best = id; bestD = d; } }
  return best;
};

/* ------------------------------ real-time limits ------------------------------ */
export const dayKeyUtc = (now: number) => new Date(now).toISOString().slice(0, 10);
const recKey = (id: string) => `act:${id}`;
export const msUntilReset = (now: number) => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now; };

export type ActivityState = { attemptsLeft: number; cooldownLeftMs: number; available: boolean; reason?: string };
export function activityState(p: Pick<PlayerProgression, "missionRuns">, def: ActivityDef, now = Date.now()): ActivityState {
  const rec = p.missionRuns[recKey(def.id)];
  const used = rec && rec.day === dayKeyUtc(now) ? rec.count : 0;
  const attemptsLeft = Math.max(0, def.attempts - used);
  const last = (rec as { last?: number } | undefined)?.last ?? 0;
  // a clock set backwards must not extend or shorten anything: a "last" in the future counts as just now
  const since = last > now ? 0 : now - last;
  const cooldownLeftMs = last ? Math.max(0, def.cooldownMin * 60_000 - since) : 0;
  if (attemptsLeft <= 0) return { attemptsLeft, cooldownLeftMs, available: false, reason: "Daily limit reached" };
  if (cooldownLeftMs > 0) return { attemptsLeft, cooldownLeftMs, available: false, reason: "On cooldown" };
  return { attemptsLeft, cooldownLeftMs, available: true };
}

/* ------------------------------ reputation ------------------------------ */
const repKey = (faction: string) => `rep:${faction}:`;
export const reputationOf = (p: Pick<PlayerProgression, "earnedRewards">, faction: string): number => {
  const k = p.earnedRewards.find((r) => r.startsWith(repKey(faction)));
  return k ? Number(k.slice(repKey(faction).length)) || 0 : 0;
};
export function addReputation<T extends Pick<PlayerProgression, "earnedRewards">>(p: T, faction: string, amount: number): T {
  const total = reputationOf(p, faction) + Math.max(0, Math.floor(amount));
  return { ...p, earnedRewards: [...p.earnedRewards.filter((r) => !r.startsWith(repKey(faction))), `${repKey(faction)}${total}`] };
}

/* ------------------------------ runs ------------------------------ */
export type Run = {
  id: string; startedAt: number; stage: number; stageStartedAt: number; status: "active" | "complete" | "failed"; failReason?: string;
  progress: number; need: number; cp: number; visited: number[]; carrying: boolean; hold: number; killsBase: number; elitesBase: number; bossesBase: number;
  hpMin: number; deaths0: number; diedDuring: boolean; wasHurt: boolean;
};
export function startActivity(p: PlayerProgression, id: string, now = Date.now()): { progression: PlayerProgression; run: Run } | { error: string } {
  const def = activityById(id); if (!def) return { error: "Unknown activity" };
  const st = activityState(p, def, now);
  if (!st.available) return { error: st.reason ?? "Unavailable" };
  const rec = p.missionRuns[recKey(id)];
  const today = rec && rec.day === dayKeyUtc(now) ? rec.count : 0;
  // the attempt is spent the moment the activity starts and is never refunded
  const next = { ...p, missionRuns: { ...p.missionRuns, [recKey(id)]: { ...(rec ?? {}), day: dayKeyUtc(now), count: today + 1, last: (rec as { last?: number } | undefined)?.last ?? 0 } } } as PlayerProgression;
  return { progression: next, run: newRun(def, now) };
}
export const newRun = (def: ActivityDef, now: number): Run => ({ id: def.id, startedAt: now, stage: 0, stageStartedAt: now, status: "active", progress: 0, need: def.stages[0] ? needOf(def.stages[0]) : 0, cp: 0, visited: [], carrying: false, hold: 0, killsBase: -1, elitesBase: -1, bossesBase: -1, hpMin: 100, deaths0: -1, diedDuring: false, wasHurt: false });
function needOf(o: Objective): number { return o.kind === "kills" ? o.count : o.kind === "course" || o.kind === "collect" ? o.points.length : o.kind === "hold" ? o.seconds : 1; }

export type Tick = { x: number; z: number; dt: number; now: number; kills: number; elites: number; bosses: number; hp: number; deaths: number };
export const pointWorld = (area: string, f: readonly [number, number]) => { const a = AREAS[area]!; return { x: a.x + f[0] * a.radius, z: a.z + f[1] * a.radius }; };
export const CHECKPOINT_RADIUS = 7;

/** the world point the player should head for right now (for the marker), or null when the objective is open-ended */
export function currentTarget(def: ActivityDef, run: Run): { x: number; z: number; label: string } | null {
  const o = def.stages[run.stage]; if (!o || run.status !== "active") return null;
  if (o.kind === "course") { const f = o.points[run.cp]; return f ? { ...pointWorld(def.area, f), label: o.label } : null; }
  if (o.kind === "collect") { const i = o.points.findIndex((_, k) => !run.visited.includes(k)); return i >= 0 ? { ...pointWorld(def.area, o.points[i]!), label: o.label } : null; }
  if (o.kind === "hold") return { ...pointWorld(def.area, o.at), label: o.label };
  if (o.kind === "deliver") return { ...pointWorld(def.area, run.carrying ? o.to : o.from), label: o.label };
  return null;
}

/** advance a run by one tick of measurable facts; returns the (mutated) run */
export function stepRun(def: ActivityDef, run: Run, t: Tick): Run {
  if (run.status !== "active") return run;
  if (run.killsBase < 0) { run.killsBase = t.kills; run.elitesBase = t.elites; run.bossesBase = t.bosses; run.deaths0 = t.deaths; }
  if (t.hp < run.hpMin) run.hpMin = t.hp;
  if (t.hp < 99.5 && run.hpMin < 99.5) run.wasHurt = run.hpMin < 99.5;
  if (t.deaths > run.deaths0) run.diedDuring = true;
  const o = def.stages[run.stage]!;
  const elapsed = (t.now - run.stageStartedAt) / 1000;
  const near = (f: readonly [number, number], r = CHECKPOINT_RADIUS) => { const w = pointWorld(def.area, f); return Math.hypot(t.x - w.x, t.z - w.z) <= r; };
  const timed = o.kind === "course" || o.kind === "collect" || o.kind === "deliver";
  if (timed && elapsed > (o as { timeLimit: number }).timeLimit) { run.status = "failed"; run.failReason = "Out of time"; return run; }
  switch (o.kind) {
    case "kills": {
      const n = o.tier === "boss" ? t.bosses - run.bossesBase : o.tier === "elite" ? t.elites - run.elitesBase : t.kills - run.killsBase;
      run.progress = Math.min(o.count, Math.max(0, n));
      if (run.progress >= o.count) advance(def, run, t.now);
      break;
    }
    case "course": {
      const f = o.points[run.cp]; if (f && near(f)) { run.cp++; run.progress = run.cp; }
      if (run.cp >= o.points.length) advance(def, run, t.now);
      break;
    }
    case "collect": {
      o.points.forEach((f, i) => { if (!run.visited.includes(i) && near(f)) run.visited.push(i); });
      run.progress = run.visited.length;
      if (run.visited.length >= o.points.length) advance(def, run, t.now);
      break;
    }
    case "hold": {
      const w = pointWorld(def.area, o.at);
      if (Math.hypot(t.x - w.x, t.z - w.z) <= o.radius) run.hold += t.dt; else run.hold = Math.max(0, run.hold - t.dt * 2);
      run.progress = Math.min(o.seconds, Math.floor(run.hold));
      if (run.hold >= o.seconds) advance(def, run, t.now);
      break;
    }
    case "deliver": {
      if (!run.carrying && near(o.from)) run.carrying = true;
      else if (run.carrying && near(o.to)) { run.progress = 1; advance(def, run, t.now); }
      break;
    }
  }
  return run;
}
function advance(def: ActivityDef, run: Run, now: number) {
  if (run.stage + 1 >= def.stages.length) { run.status = "complete"; return; }
  run.stage++; run.stageStartedAt = now; run.progress = 0; run.need = needOf(def.stages[run.stage]!); run.cp = 0; run.visited = []; run.carrying = false; run.hold = 0;
  const t = run; t.killsBase = -1; // re-baselined on the next tick so kills before this stage never count
}
export const abandonRun = (run: Run): Run => { if (run.status === "active") { run.status = "failed"; run.failReason = "Abandoned"; } return run; };

export function challengeMet(def: ActivityDef, run: Run, now: number): boolean {
  if (!def.challenge) return false;
  if (def.challenge.id === "no-damage") return !run.wasHurt && !run.diedDuring;
  if (def.challenge.id === "no-death") return !run.diedDuring;
  const limit = def.stages.reduce((n, o) => n + ("timeLimit" in o ? o.timeLimit : 0), 0);
  return limit > 0 && (now - run.startedAt) / 1000 <= limit * 0.6;
}

export type Payout = { nex: number; xp: number; rep: number; materials: Partial<Record<MaterialId, number>>; shader: string | null; bonus: boolean };
/** complete a run: pays Nex, XP, reputation, materials and a possible earned-only shader; the optional challenge adds 25% and a better shader chance.
 * Starts the cooldown. Pays at most once per run (the run must be "complete"; callers drop it afterwards). */
export function completeActivity(p: PlayerProgression, def: ActivityDef, run: Run, now = Date.now(), rng: () => number = Math.random): { progression: PlayerProgression; payout: Payout } | { error: string } {
  if (run.status !== "complete" || run.id !== def.id) return { error: "Not complete" };
  const bonus = challengeMet(def, run, now), mult = bonus ? 1.25 : 1;
  const r = def.rewards;
  const rec = p.missionRuns[recKey(def.id)];
  let next: PlayerProgression = { ...p, missionRuns: { ...p.missionRuns, [recKey(def.id)]: { ...(rec ?? { day: dayKeyUtc(now), count: 1 }), last: now } } } as PlayerProgression;
  const nex = Math.round(r.nex * mult), rep = Math.round(r.rep * mult);
  next = { ...next, nexLedger: { ...next.nexLedger, [`activity:${def.id}:${dayKeyUtc(now)}:${rec && rec.day === dayKeyUtc(now) ? rec.count : 1}`]: nex } };
  next = grantXP(next, "MISSION", { scale: (r.xp / 100) * mult }).progression;
  const materials: Payout["materials"] = {};
  const mats = { ...next.materials };
  for (const [id, n] of Object.entries(r.materials) as [MaterialId, number][]) { const amt = Math.round(n * mult); if (amt > 0) { materials[id] = amt; mats[id] = (mats[id] ?? 0) + amt; } }
  next = { ...next, materials: mats };
  next = addReputation(next, def.faction, rep);
  let shader: string | null = null;
  if (rng() < r.shaderChance * (bonus ? 2 : 1)) {
    const pool = ARMOR_SHADERS.filter((s) => !s.price && !ownsShader(next, s.id) && s.source.toLowerCase().includes(sourceHint(def.area)));
    const any = pool.length ? pool : ARMOR_SHADERS.filter((s) => !s.price && !ownsShader(next, s.id) && /neon city races|thalassia|solara|frost spire/i.test(s.source));
    const pick = any[Math.min(any.length - 1, Math.floor(rng() * any.length))];
    if (pick) { next = grantShader(next, pick.id); shader = pick.id; }
  }
  return { progression: next, payout: { nex, xp: Math.round(r.xp * mult), rep, materials, shader, bonus } };
}
const sourceHint = (area: string) => ({ neon: "neon city", thalassia: "thalassia", solara: "solara", frostspire: "frost spire" } as Record<string, string>)[area] ?? "~~none~~";
