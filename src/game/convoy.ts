/** Global convoy warfare: the DIRECTOR and the persistent rules. Pure state machine, no rendering.
 * Every region has its own convoy contract (cargo, who attacks, what the signature encounter is) and its own 10-step threat ladder. The director picks
 * encounters from a pool by region, threat level, route and what the player actually did: a destroyed helicopter never fires its next volley, a dead
 * commander never calls reinforcements, and a finished phase never fires twice. Escalation changes composition and tactics (more squads, armour, air,
 * monsters, capture objectives), never just enemy health.
 *
 * NOT here: convoy vehicles driving the road, enemy spawning/AI in the world, helicopter/tank/monster behaviours, mounted weapons and the underwater
 * versions of any of it. This module decides WHAT happens and WHEN, tracks convoy condition, and settles rewards; the world layer still has to
 * spawn and animate the units it asks for. So this is a tested director, not a playable convoy mission. */
import { addReputation } from "./activities";
import type { MaterialId } from "./inventory";
import type { PlayerProgression } from "./progression";

export type ConvoyRegion = "veridan" | "neon" | "nexus" | "thalassia" | "ember" | "wastelands" | "swamps" | "solara" | "frostspire" | "neon-core";
export type Attacker = "army" | "rebels" | "blackmarket" | "hunters" | "monsters";
export type ConvoyDef = { region: ConvoyRegion; name: string; cargo: readonly string[]; destinations: readonly string[]; attackers: readonly Attacker[]; signature: string; faction: string; air: boolean; underwater: boolean; sergeant: string; commander: string; monster: string; armor: string; material: MaterialId };
const D = (d: ConvoyDef) => d;
export const CONVOYS: readonly ConvoyDef[] = [
  D({ region: "veridan", name: "Canopy Relief", cargo: ["research team", "medical transport", "military supplies"], destinations: ["research facility", "civilian settlement"], attackers: ["army", "rebels", "monsters"], signature: "A monster ambush forces the convoy off its route into a dangerous forest passage.", faction: "wardens", air: false, underwater: false, sergeant: "Sergeant Voss", commander: "Commander Hale", monster: "Grove Stalker", armor: "rogue walker", material: "bioCatalyst" }),
  D({ region: "neon", name: "Neon Run", cargo: ["technology", "weapons", "Nex", "black-market cargo"], destinations: ["black-market depot", "faction headquarters"], attackers: ["blackmarket", "rebels", "hunters"], signature: "A helicopter pursues the convoy across the elevated roads while rival racers try to intercept the cargo.", faction: "syndicate", air: true, underwater: false, sergeant: "Crew Boss Kade", commander: "The Broker", monster: "Glitch Hound", armor: "armoured van", material: "microCircuits" }),
  D({ region: "nexus", name: "Grid Convoy", cargo: ["military hardware", "security transport", "sensitive technology"], destinations: ["military outpost", "research facility"], attackers: ["army", "hunters", "blackmarket"], signature: "An armoured column blockades the road while aerial units strike from above.", faction: "aegis", air: true, underwater: false, sergeant: "Captain Ilex", commander: "Warden-General Rook", monster: "Rogue Sentinel", armor: "strike tank", material: "reinforcedAlloy" }),
  D({ region: "thalassia", name: "Deep Carrier", cargo: ["cargo carrier", "submersible", "research vessel"], destinations: ["underwater station"], attackers: ["rebels", "blackmarket", "monsters"], signature: "A deep-sea monster attacks the convoy while enemy submarines try to seize its cargo.", faction: "tidewardens", air: false, underwater: true, sergeant: "Dive-Sergeant Maro", commander: "Admiral Venn", monster: "Abyssal Leviathan", armor: "attack submarine", material: "abyssCore" }),
  D({ region: "ember", name: "Magma Haul", cargo: ["weapons", "fuel", "heavy equipment"], destinations: ["military outpost", "faction headquarters"], attackers: ["army", "rebels", "monsters"], signature: "A tank-led assault pins the convoy while a massive creature emerges near the route.", faction: "forgeborn", air: true, underwater: false, sergeant: "Foreman Dray", commander: "Warlord Cinder", monster: "Cinder-Brute", armor: "siege tank", material: "magmaCore" }),
  D({ region: "wastelands", name: "Dust Runner", cargo: ["supplies", "vehicles", "weapons", "salvage"], destinations: ["rebel trade port", "civilian settlement"], attackers: ["rebels", "blackmarket", "army", "monsters"], signature: "Helicopters, tanks and a hostile warband attack across a contested desert highway.", faction: "rebels", air: true, underwater: false, sergeant: "Sergeant Rask", commander: "Warlord Kharn", monster: "Dune Wyrm", armor: "battle tank", material: "vehicleParts" }),
  D({ region: "swamps", name: "Fog Convoy", cargo: ["medical supplies", "extraction transport", "rare biological materials"], destinations: ["civilian settlement", "research facility"], attackers: ["rebels", "blackmarket", "monsters"], signature: "The convoy is trapped in a narrow passage while monsters attack from the wetlands.", faction: "wardens", air: false, underwater: false, sergeant: "Marshal Teng", commander: "Captain Sorrow", monster: "Bog Colossus", armor: "swamp crawler", material: "bioCatalyst" }),
  D({ region: "solara", name: "Glass Road", cargo: ["rare technology", "military equipment", "supplies"], destinations: ["civilian settlement", "faction headquarters"], attackers: ["army", "rebels", "hunters", "monsters"], signature: "An armoured ambush forces the convoy toward a dangerous route where a major monster encounter can erupt. (Vyrak is never a convoy enemy.)", faction: "covenant", air: true, underwater: false, sergeant: "Raider-Sergeant Zahl", commander: "Sun-Warlord Imar", monster: "Dune Scorpion", armor: "sand tank", material: "relicFragment" }),
  D({ region: "frostspire", name: "Whiteout Haul", cargo: ["personnel", "weapons", "energy cells"], destinations: ["military outpost", "research facility"], attackers: ["army", "rebels", "monsters"], signature: "A snowstorm reduces visibility as enemy armour attacks and a creature stalks the convoy.", faction: "wardens", air: true, underwater: false, sergeant: "Sergeant Holm", commander: "Commander Frost", monster: "Glacier Stalker", armor: "tracked tank", material: "cryoCrystal" }),
  D({ region: "neon-core", name: "Core Shipment", cargo: ["classified technology", "experimental weapons", "corporate assets"], destinations: ["faction headquarters", "research facility"], attackers: ["army", "blackmarket", "hunters"], signature: "A coordinated assault of elite infantry, heavy armour and aerial support tries to capture the shipment.", faction: "aegis", air: true, underwater: false, sergeant: "Enforcer Lyr", commander: "Director Vael", monster: "Rogue Machine", armor: "armoured transport", material: "anomalyCore" }),
];
export const convoyFor = (region: string) => CONVOYS.find((c) => c.region === region);

/* ------------------------------ threat ladder ------------------------------ */
export type Composition = { squads: number; lightVehicles: number; armor: number; air: number; monsters: number; elites: number; named: "sergeant" | "commander" | null; blockade: boolean; objective: "destroy" | "disable" | "capture"; phases: number };
export const THREAT_NAMES = ["Scout Attack", "Organized Resistance", "Elite Interception", "Pursuit", "Heavy Assault", "Coordinated Blockade", "Monster Threat", "Combined Forces", "Enemy Commander", "Regional Warzone"] as const;
const LADDER: readonly Omit<Composition, "air" | "objective">[] = [
  { squads: 1, lightVehicles: 0, armor: 0, monsters: 0, elites: 0, named: null, blockade: false, phases: 1 },
  { squads: 3, lightVehicles: 1, armor: 0, monsters: 0, elites: 0, named: null, blockade: false, phases: 2 },
  { squads: 3, lightVehicles: 1, armor: 0, monsters: 0, elites: 4, named: "sergeant", blockade: false, phases: 2 },
  { squads: 3, lightVehicles: 3, armor: 0, monsters: 0, elites: 2, named: null, blockade: false, phases: 3 },
  { squads: 4, lightVehicles: 2, armor: 1, monsters: 0, elites: 2, named: null, blockade: false, phases: 3 },
  { squads: 5, lightVehicles: 2, armor: 2, monsters: 0, elites: 3, named: null, blockade: true, phases: 3 },
  { squads: 3, lightVehicles: 1, armor: 1, monsters: 2, elites: 2, named: null, blockade: false, phases: 3 },
  { squads: 6, lightVehicles: 3, armor: 3, monsters: 2, elites: 6, named: null, blockade: true, phases: 4 },
  { squads: 6, lightVehicles: 3, armor: 3, monsters: 1, elites: 8, named: "commander", blockade: true, phases: 4 },
  { squads: 10, lightVehicles: 4, armor: 4, monsters: 3, elites: 12, named: "commander", blockade: true, phases: 5 },
];
/** composition for a region at a level. Air units only where the region allows them (never under water, never in the forest or swamp canopy) */
export function compositionFor(def: ConvoyDef, level: number): Composition {
  const l = LADDER[Math.max(1, Math.min(10, level)) - 1]!, wantsAir = level === 4 || level >= 8 || (level === 5 && def.region === "wastelands");
  const air = def.air && wantsAir ? (level >= 8 ? 2 : 1) : 0;
  const armor = def.underwater ? (level >= 5 ? Math.max(1, l.armor) : 0) : l.armor; // submarines instead of tanks
  const monsters = l.monsters > 0 ? l.monsters : def.underwater && level >= 4 ? 1 : 0; // deep water always has something watching from level 4
  return { ...l, armor, monsters, air, objective: level >= 9 ? "capture" : level >= 5 ? "disable" : "destroy" };
}

/* ------------------------------ run state ------------------------------ */
export type Unit = { id: number; kind: string; group: Attacker | "named"; hp: number; alive: boolean; phase: number };
export type RouteStatus = "clear" | "blocked" | "alternate";
export type ConvoyRun = {
  id: string; region: ConvoyRegion; level: number; seed: number; startedAt: number; progress: number; destination: string; cargo: string; phase: number; doneEvents: string[]; units: Unit[]; nextUnit: number;
  lead: number; escorts: number; cargoIntegrity: number; cohesion: number; escortStrength: number; route: RouteStatus; commanderAlive: boolean; sergeantAlive: boolean; reinforcementsCalled: number;
  log: string[]; status: "active" | "delivered" | "failed"; failReason?: string; vehiclesLost: number; optional: { allEscorts: boolean; commanderDefeated: boolean; alternateAvoided: boolean };
};
const rng = (seed: number) => () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6d2b79f5) >>> 0; return seed / 4294967296; };
const pick = <T,>(r: () => number, a: readonly T[]) => a[Math.floor(r() * a.length)]!;
export function startConvoy(region: ConvoyRegion, level: number, seed: number, now: number): ConvoyRun {
  const def = convoyFor(region)!, r = rng(seed ^ level * 7919);
  return { id: `convoy:${region}:${level}:${now}`, region, level, seed, startedAt: now, progress: 0, destination: pick(r, def.destinations), cargo: pick(r, def.cargo), phase: 0, doneEvents: [], units: [], nextUnit: 1, lead: 100, escorts: 2 + (level > 5 ? 1 : 0), cargoIntegrity: 100, cohesion: 100, escortStrength: 100, route: "clear", commanderAlive: false, sergeantAlive: false, reinforcementsCalled: 0, log: [], status: "active", vehiclesLost: 0, optional: { allEscorts: true, commanderDefeated: false, alternateAvoided: true } };
}
export type Spawn = { kind: string; group: Attacker | "named"; count: number; unitIds: number[] };
export type DirectorInput = { progress: number; killed?: readonly number[]; leadDamage?: number; cargoDamage?: number; escortLost?: boolean; chosen?: "fight" | "alternate" };
export type DirectorOut = { spawns: Spawn[]; messages: string[]; cancelled: string[] };

/** the beats a run goes through, in order. Each fires once, at its progress mark, and only if the state still makes sense */
function beats(def: ConvoyDef, level: number, comp: Composition, seed: number): { id: string; at: number; kind: "squads" | "light" | "armor" | "air" | "monster" | "named" | "blockade" | "elites" | "final"; text: string }[] {
  const r = rng(seed ^ 0xabc), mainGroups = def.attackers.filter((a) => a !== "monsters"), groups = mainGroups[Math.floor(r() * (mainGroups.length || 1))] ?? "rebels";
  type B = { id: string; kind: "squads" | "light" | "armor" | "air" | "monster" | "named" | "blockade" | "elites" | "final"; text: string };
  const list: B[] = [{ id: "scouts", kind: "squads", text: groups === "blackmarket" ? "Smugglers spot the convoy and radio ahead." : groups === "army" ? "A patrol reports the convoy's position." : "Scouts spot the convoy and report its position." }];
  if (comp.lightVehicles) list.push({ id: "pursuit", kind: "light", text: "Fast vehicles break from cover and close on the rear." });
  if (comp.named) list.push({ id: "named", kind: "named", text: `${comp.named === "commander" ? def.commander : def.sergeant} takes personal command of the interception.` });
  if (comp.air) list.push({ id: "air", kind: "air", text: "Rotor noise from behind: a gunship is on the convoy." });
  if (comp.blockade) list.push({ id: "blockade", kind: "blockade", text: "The road ahead is blocked. Fight through, or take the alternate route." });
  if (comp.armor) list.push({ id: "armor", kind: "armor", text: def.underwater ? "An attack submarine cuts across the lane." : `A ${def.armor} rolls out to block the road.` });
  if (comp.monsters) list.push({ id: "monster", kind: "monster", text: `${def.monster} appears and attacks anything near it, from either side.` });
  // order is the escalation order; spread over the route so no two beats share a mark, with a small seeded wobble
  const out = list.map((b, i) => ({ ...b, at: 0.1 + ((i + 0.5) / list.length) * 0.78 + (r() - 0.5) * 0.02 }));
  if (level >= 5) out.push({ id: "final", kind: "final", at: 0.95, text: "A last attack hits at the destination." });
  return out.sort((x, y) => x.at - y.at);
}
export const beatsFor = (run: ConvoyRun) => beats(convoyFor(run.region)!, run.level, compositionFor(convoyFor(run.region)!, run.level), run.seed);

function addUnits(run: ConvoyRun, kind: string, group: Attacker | "named", count: number, hp = 1): Spawn {
  const ids: number[] = []; for (let i = 0; i < count; i++) { const id = run.nextUnit++; run.units.push({ id, kind, group, hp, alive: true, phase: run.phase }); ids.push(id); }
  return { kind, group, count, unitIds: ids };
}
const alive = (run: ConvoyRun, kind: string) => run.units.filter((u) => u.alive && u.kind === kind);

/** advance the director. Idempotent per beat; reacts to kills, damage and the route choice. */
export function stepConvoy(run: ConvoyRun, input: DirectorInput): DirectorOut {
  const out: DirectorOut = { spawns: [], messages: [], cancelled: [] };
  if (run.status !== "active") return out;
  const def = convoyFor(run.region)!, comp = compositionFor(def, run.level);
  run.progress = Math.max(run.progress, Math.min(1, input.progress));
  for (const id of input.killed ?? []) { const u = run.units.find((x) => x.id === id); if (u && u.alive) u.alive = false; }
  if (input.leadDamage) run.lead = Math.max(0, run.lead - input.leadDamage);
  if (input.cargoDamage) run.cargoIntegrity = Math.max(0, run.cargoIntegrity - input.cargoDamage);
  if (input.escortLost) { run.escorts = Math.max(0, run.escorts - 1); run.vehiclesLost++; run.optional.allEscorts = false; run.escortStrength = Math.max(0, run.escortStrength - 30); run.cohesion = Math.max(0, run.cohesion - 15); }
  if (input.chosen === "alternate" && run.route === "blocked") { run.route = "alternate"; run.optional.alternateAvoided = false; out.messages.push("Taking the alternate route."); }
  else if (input.chosen === "fight" && run.route === "blocked") run.route = "clear";
  // named leaders: a dead commander calls no reinforcements (and cancels the capture attempt)
  if (run.commanderAlive && alive(run, "commander").length === 0) { run.commanderAlive = false; run.optional.commanderDefeated = true; out.messages.push(`${def.commander} is down. The attack loses its coordination.`); out.cancelled.push("reinforcements"); }
  if (run.sergeantAlive && alive(run, "sergeant").length === 0) { run.sergeantAlive = false; out.messages.push(`${def.sergeant} is down. No more radio calls.`); out.cancelled.push("reinforcements"); }
  // failure
  if (run.lead <= 0) { run.status = "failed"; run.failReason = "Lead transport destroyed"; return out; }
  if (run.cargoIntegrity <= 0) { run.status = "failed"; run.failReason = "Cargo lost"; return out; }
  // beats that are due
  for (const b of beats(def, run.level, comp, run.seed)) {
    if (run.doneEvents.includes(b.id) || run.progress < b.at) continue;
    // an air beat is skipped for good if the gunship was already shot down; reinforcement beats are skipped if their caller is dead
    run.doneEvents.push(b.id); run.phase++;
    const msg = (t: string) => { out.messages.push(t); run.log.push(t); };
    msg(b.text);
    if (b.kind === "squads") for (let i = 0; i < comp.squads; i++) out.spawns.push(addUnits(run, "squad", pick(rng(run.seed + i + run.phase), def.attackers.filter((a) => a !== "monsters") as readonly Attacker[]), 4));
    else if (b.kind === "light") out.spawns.push(addUnits(run, "light-vehicle", def.attackers.includes("blackmarket") ? "blackmarket" : "rebels", comp.lightVehicles, 2));
    else if (b.kind === "named") { const k = comp.named!; out.spawns.push(addUnits(run, k, "named", 1, k === "commander" ? 6 : 3)); if (k === "commander") run.commanderAlive = true; else run.sergeantAlive = true; if (comp.elites) out.spawns.push(addUnits(run, "elite", "army", Math.min(comp.elites, 6), 2)); }
    else if (b.kind === "air") { out.spawns.push(addUnits(run, "gunship", "army", comp.air, 4)); }
    else if (b.kind === "armor") out.spawns.push(addUnits(run, def.underwater ? "attack-submarine" : "tank", "army", comp.armor, 5));
    else if (b.kind === "blockade") { run.route = "blocked"; out.spawns.push(addUnits(run, "barricade", "army", 2, 3)); }
    else if (b.kind === "monster") out.spawns.push(addUnits(run, "monster", "monsters", comp.monsters, 6));
    else if (b.kind === "final") out.spawns.push(addUnits(run, "final-wave", def.attackers[0]!, Math.max(2, Math.floor(comp.squads / 2)), 3));
  }
  // reinforcements: only while a leader lives, at most twice, and only if the fight has been won so far (otherwise the player is already overwhelmed)
  if ((run.sergeantAlive || run.commanderAlive) && run.reinforcementsCalled < (comp.named === "commander" ? 2 : 1) && alive(run, "squad").length === 0 && run.doneEvents.includes("named") && !run.doneEvents.includes(`reinf-${run.reinforcementsCalled}`)) {
    run.doneEvents.push(`reinf-${run.reinforcementsCalled}`); run.reinforcementsCalled++;
    out.messages.push("A radio call: reinforcements are on the way."); out.spawns.push(addUnits(run, "squad", "army", 2, 4));
  }
  // a gunship that was shot down never fires again: cancel anything still tied to it
  if (run.doneEvents.includes("air") && alive(run, "gunship").length === 0 && !run.doneEvents.includes("air-down")) { run.doneEvents.push("air-down"); out.messages.push("The gunship is down."); out.cancelled.push("rocket-volley"); }
  // arrival: needs the route to be open (or the alternate taken), the lead alive and, at capture level, a living commander must not have seized the cargo
  const blocked = run.route === "blocked" && alive(run, "barricade").length > 0;
  if (run.progress >= 1 && !blocked) {
    if (comp.objective === "capture" && run.commanderAlive && alive(run, "squad").length > 2) { run.cargoIntegrity = Math.max(0, run.cargoIntegrity - 40); out.messages.push("The commander's team seizes part of the cargo at the gate."); }
    run.status = run.cargoIntegrity > 0 ? "delivered" : "failed"; if (run.status === "failed") run.failReason = "Cargo lost";
  }
  return out;
}

/* ------------------------------ persistence, unlocks, rewards ------------------------------ */
type Store = Pick<PlayerProgression, "earnedRewards">;
const highKey = (r: string) => `convoy-threat:${r}:`;
const countKey = (name: string) => `convoy-count:${name}:`;
const count = (p: Store, name: string) => { const k = p.earnedRewards.find((e) => e.startsWith(countKey(name))); return k ? Number(k.slice(countKey(name).length)) : 0; };
const setCount = <T extends Store>(p: T, name: string, v: number): T => ({ ...p, earnedRewards: [...p.earnedRewards.filter((e) => !e.startsWith(countKey(name))), `${countKey(name)}${v}`] });
export function highestThreat(p: Store, region: string): number { const k = p.earnedRewards.find((e) => e.startsWith(highKey(region))); return k ? Number(k.slice(highKey(region).length)) : 0; }
/** a level opens once the one below it was delivered in THIS region; lower levels stay replayable */
export const maxLevelFor = (p: Store, region: string) => Math.min(10, highestThreat(p, region) + 1);
export function levelLocked(p: Store, region: string, level: number, now: number): string | null {
  if (level > maxLevelFor(p, region)) return `Deliver a threat level ${level - 1} convoy in this region first`;
  const until = count(p, `suspended:${region}`); if (level >= 6 && until > now) return `Premium contracts suspended after repeated losses (back in ${Math.ceil((until - now) / 60000)} min)`;
  return null;
}
export type ConvoyReward = { nex: number; xp: number; rep: number; materials: Partial<Record<MaterialId, number>>; quality: number; optional: string[]; levelUp: boolean; suspended: boolean };
const LOSS_STREAK = 3, SUSPEND_MS = 6 * 3_600_000;
export function convoyQuality(run: ConvoyRun): number { return Math.round(Math.max(0, Math.min(1, (run.cargoIntegrity * 0.5 + run.lead * 0.2 + run.cohesion * 0.15 + run.escortStrength * 0.15) / 100)) * 100) / 100; }
/** Settle a finished run exactly once (the run id is the ledger key). A damaged delivery pays less; a failure keeps your highest level and only pauses premium work after a streak. */
export function settleConvoy(p: PlayerProgression, run: ConvoyRun, now: number): { progression: PlayerProgression; reward: ConvoyReward } | { error: string } {
  if (run.status === "active") return { error: "Not finished" };
  if (p.nexLedger[run.id] !== undefined) return { error: "Already settled" };
  const def = convoyFor(run.region)!;
  if (run.status === "failed") {
    const streak = count(p, `loss-streak:${run.region}`) + 1; let next = setCount(p, `loss-streak:${run.region}`, streak);
    next = { ...next, nexLedger: { ...next.nexLedger, [run.id]: 0 } };
    const suspended = streak >= LOSS_STREAK; if (suspended) next = setCount(setCount(next, `loss-streak:${run.region}`, 0), `suspended:${run.region}`, now + SUSPEND_MS);
    return { progression: next, reward: { nex: 0, xp: 0, rep: 0, materials: {}, quality: 0, optional: [], levelUp: false, suspended } };
  }
  const q = convoyQuality(run), L = run.level, optional: string[] = [];
  if (run.optional.allEscorts) optional.push("All escort vehicles survived"); if (run.optional.commanderDefeated) optional.push("Enemy commander defeated"); if (run.optional.alternateAvoided && L >= 6) optional.push("Held the assigned route");
  const bonus = 1 + optional.length * 0.1, nex = Math.round((90 + L * 55) * q * bonus), xp = Math.round((60 + L * 30) * q), rep = Math.round((8 + L * 3) * q * bonus);
  const materials: Partial<Record<MaterialId, number>> = { [def.material]: Math.max(1, Math.round((1 + L / 2) * q)) };
  let next: PlayerProgression = { ...p, nexLedger: { ...p.nexLedger, [run.id]: nex } };
  const levelUp = L > highestThreat(next, run.region);
  if (levelUp) next = { ...next, earnedRewards: [...next.earnedRewards.filter((e) => !e.startsWith(highKey(run.region))), `${highKey(run.region)}${L}`] };
  next = setCount(next, `loss-streak:${run.region}`, 0);
  next = setCount(next, "deliveries", count(next, "deliveries") + 1); next = setCount(next, "cargo-saved", count(next, "cargo-saved") + Math.round(run.cargoIntegrity)); if (run.optional.commanderDefeated) next = setCount(next, "commanders", count(next, "commanders") + 1);
  next = addReputation(next, def.faction, rep);
  const mats = { ...next.materials }; for (const [k, v] of Object.entries(materials) as [MaterialId, number][]) mats[k] = (mats[k] ?? 0) + v; next = { ...next, materials: mats };
  return { progression: next, reward: { nex, xp, rep, materials, quality: q, optional, levelUp, suspended: false } };
}
export const convoyRecord = (p: Store) => ({ deliveries: count(p, "deliveries"), cargoSaved: count(p, "cargo-saved"), commandersDefeated: count(p, "commanders"), highest: Object.fromEntries(CONVOYS.map((c) => [c.region, highestThreat(p, c.region)])) });

/** Board listing: one row per region with every threat level and why it is locked (null = available). Pure; the UI/world layer consumes it. */
export type ConvoyBoardRow = { region: ConvoyRegion; name: string; attackers: readonly Attacker[]; highest: number; levels: { level: number; title: string; locked: string | null }[] };
export function convoyBoard(p: Store, now: number): ConvoyBoardRow[] {
  return CONVOYS.map((c) => ({ region: c.region, name: c.name, attackers: c.attackers, highest: highestThreat(p, c.region), levels: THREAT_NAMES.map((title, i) => ({ level: i + 1, title, locked: levelLocked(p, c.region, i + 1, now) })) }));
}
