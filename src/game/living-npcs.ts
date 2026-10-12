/** Living World NPCs (pure): the people you can talk to in Nexus City and Neon City, the contracts they hand out,
 * the intel informants sell, and every action the talk panel offers. Each action is a pure progression → progression
 * step, so a conversation always changes real state (standing, materials, contracts, revealed stashes) and every
 * payout is once-keyed in `earnedRewards`, which makes replays and cloud merges safe.
 *
 * Contract progress comes from gameplay only (living-progress below): kills inside the city, world events won there,
 * reaching a survey point, materials handed in. Nothing completes from a menu. */
import { CITIES, FACTIONS, adjustRep, districtStatus, districtById, repOf, tierAtLeast, tierOf, type CityId, type FactionId, type LivingState, type RepTier, EMPTY_LIVING } from "./living-world";
import type { MaterialId } from "./inventory";
import type { PlayerProgression } from "./progression";
import { grantXP } from "./xp";

export type NpcRole = "LEADER" | "QUEST" | "INFORMANT";
export type LivingNpc = {
  id: string; name: string; title: string; city: CityId; faction: FactionId; role: NpcRole;
  /** offset in metres from the city centre (north = −z) */
  lx: number; lz: number;
  /** what the civilian body looks like (civilian-models.ts roles) */
  body: "VENDOR" | "ENGINEER" | "MEDIC" | "ARTISAN" | "SCAVENGER" | "OBSERVER";
  greeting: Record<RepTier, string>;
};

export const LIVING_NPCS: readonly LivingNpc[] = [
  { id: "hale", name: "Commander Hale", title: "Warden Commander", city: "nexus", faction: "wardens", role: "LEADER", lx: 7.4, lz: -4.3, body: "OBSERVER",
    greeting: { HOSTILE: "You've drawn Warden fire in my city. Pay for the damage or get out.", WARY: "I'm watching you, Operator. Earn your place.", NEUTRAL: "Nexus holds because people hold the line. Can you?", TRUSTED: "Good to see you, Operator. The perimeter's quieter with you on it.", HONORED: "Warden-friend. Nexus owes you, and I don't forget debts." } },
  { id: "vos", name: "Sergeant Vos", title: "Warden Quartermaster", city: "nexus", faction: "wardens", role: "QUEST", lx: -8.2, lz: 2.2, body: "ENGINEER",
    greeting: { HOSTILE: "Nothing for you here.", WARY: "Work's work. Don't make me regret it.", NEUTRAL: "Outer districts need clearing. Interested?", TRUSTED: "Got a bigger job if you've got the nerve.", HONORED: "Pick any board you like, Operator." } },
  { id: "ines", name: "Ines Varo", title: "Guild Mistress", city: "nexus", faction: "guild", role: "LEADER", lx: 5.7, lz: 21.2, body: "ARTISAN",
    greeting: { HOSTILE: "The Guild doesn't deal with vandals.", WARY: "Trade's slow when people shoot near my stalls.", NEUTRAL: "Every bolt in this city passed through a Guild hand.", TRUSTED: "Our smiths like your work. So do I.", HONORED: "Name what you need. The Guild will find it." } },
  { id: "whisper", name: "Whisper", title: "Information Broker", city: "nexus", faction: "guild", role: "INFORMANT", lx: -11.3, lz: -11.3, body: "SCAVENGER",
    greeting: { HOSTILE: "...", WARY: "Information has a price. Yours just went up.", NEUTRAL: "Everything in Nexus leaves a trace. I sell the traces.", TRUSTED: "I kept something back for you.", HONORED: "For you? The good stuff." } },
  { id: "kiro", name: "Madame Kiro", title: "Syndicate Boss", city: "neon", faction: "syndicate", role: "LEADER", lx: -20, lz: 7, body: "VENDOR",
    greeting: { HOSTILE: "My people have your face. Leave while you still can.", WARY: "You smell like the Spire. Prove me wrong.", NEUTRAL: "The Undercity runs on favours. What's yours?", TRUSTED: "The street knows your name now. Good things only.", HONORED: "Family. Sit. Nobody touches you down here." } },
  { id: "patch", name: "Patch", title: "Syndicate Fixer", city: "neon", faction: "syndicate", role: "QUEST", lx: 4, lz: 10, body: "ENGINEER",
    greeting: { HOSTILE: "Walk on.", WARY: "Small jobs only, until I trust you.", NEUTRAL: "Got work that pays and doesn't ask questions.", TRUSTED: "Kiro says you're solid. I've got a real job.", HONORED: "Anything on the board is yours." } },
  { id: "thorne", name: "Director Thorne", title: "Aegis Director", city: "neon", faction: "aegis", role: "LEADER", lx: 6, lz: -30, body: "MEDIC",
    greeting: { HOSTILE: "You are flagged at every checkpoint in this city.", WARY: "The Directorate tolerates you. For now.", NEUTRAL: "Order is a service, Operator. Someone has to provide it.", TRUSTED: "Your record is clean and useful. I appreciate both.", HONORED: "The Spire is open to you. Few can say that." } },
  { id: "static", name: "Static", title: "Grid Informant", city: "neon", faction: "aegis", role: "INFORMANT", lx: -6, lz: 24, body: "OBSERVER",
    greeting: { HOSTILE: "Connection refused.", WARY: "Paying customers only.", NEUTRAL: "I hear everything the Grid carries. Want some of it?", TRUSTED: "Clean signal for a clean customer.", HONORED: "Priority channel's open for you." } },
  { id: "moreau", name: "Lt. Moreau", title: "Checkpoint Officer", city: "neon", faction: "aegis", role: "QUEST", lx: -7, lz: -31, body: "OBSERVER",
    greeting: { HOSTILE: "Halt. You're not cleared.", WARY: "Contractor work only. Keep your weapon low.", NEUTRAL: "The checkpoint needs hands. Directorate pays on time.", TRUSTED: "I can put you on the priority roster.", HONORED: "Whatever you need, Operator." } },
];
export const npcById = (id: string) => LIVING_NPCS.find((n) => n.id === id);
export const npcWorld = (n: LivingNpc) => ({ x: CITIES[n.city].x + n.lx, z: CITIES[n.city].z + n.lz });
export const TALK_REACH = 3.6;

/** nearest talkable NPC within reach of a world point */
export function npcNear(x: number, z: number): LivingNpc | null {
  let best: LivingNpc | null = null, bestD = TALK_REACH;
  for (const n of LIVING_NPCS) { const p = npcWorld(n); const d = Math.hypot(x - p.x, z - p.z); if (d < bestD) { bestD = d; best = n; } }
  return best;
}

/* ------------------------------------------------------------ contracts ------------------------------------------------------------ */
export type ContractKind = "CULL" | "DEFEND" | "DELIVER" | "SURVEY";
export type Contract = {
  id: string; giver: string; faction: FactionId; city: CityId; kind: ContractKind; title: string; brief: string;
  amount: number; material?: MaterialId;
  /** SURVEY: the point to reach (city-local) */
  lx?: number; lz?: number;
  minTier: RepTier;
  reward: { rep: number; materials: Partial<Record<MaterialId, number>>; xp: number };
};

export const CONTRACTS: readonly Contract[] = [
  { id: "perimeter-sweep", giver: "vos", faction: "wardens", city: "nexus", kind: "CULL", title: "Perimeter Sweep", brief: "Put down 8 hostiles inside Nexus City's districts.", amount: 8, minTier: "WARY", reward: { rep: 12, materials: { reinforcedAlloy: 4 }, xp: 1 } },
  { id: "hold-the-line", giver: "vos", faction: "wardens", city: "nexus", kind: "DEFEND", title: "Hold the Line", brief: "Win 2 Nexus City world events (invasions, distress calls, raids).", amount: 2, minTier: "TRUSTED", reward: { rep: 18, materials: { microCircuits: 6, aegisCore: 1 }, xp: 2 } },
  { id: "salvage-drive", giver: "ines", faction: "guild", city: "nexus", kind: "DELIVER", title: "Salvage Drive", brief: "Hand in 12 Scrap Metal for the Guild workshops.", amount: 12, material: "scrapMetal", minTier: "WARY", reward: { rep: 10, materials: { microCircuits: 5 }, xp: 1 } },
  { id: "shipyard-survey", giver: "ines", faction: "guild", city: "nexus", kind: "SURVEY", title: "Shipyard Survey", brief: "Walk the Shipyard's south gate and log the damage.", amount: 1, lx: 0, lz: 82, minTier: "NEUTRAL", reward: { rep: 8, materials: { dataShards: 3 }, xp: 1 } },
  { id: "street-tax", giver: "patch", faction: "syndicate", city: "neon", kind: "CULL", title: "Street Tax", brief: "Clear 6 hostiles off Neon City's streets. The Syndicate collects.", amount: 6, minTier: "WARY", reward: { rep: 12, materials: { microCircuits: 6 }, xp: 1 } },
  { id: "dead-drop", giver: "patch", faction: "syndicate", city: "neon", kind: "SURVEY", title: "Dead Drop", brief: "Check the dead drop at the east end of the cross street.", amount: 1, lx: 37, lz: 7, minTier: "NEUTRAL", reward: { rep: 8, materials: { dataShards: 4 }, xp: 1 } },
  { id: "checkpoint-sweep", giver: "moreau", faction: "aegis", city: "neon", kind: "CULL", title: "Checkpoint Sweep", brief: "Neutralize 6 hostiles inside Neon City.", amount: 6, minTier: "WARY", reward: { rep: 12, materials: { reinforcedAlloy: 4 }, xp: 1 } },
  { id: "grid-requisition", giver: "moreau", faction: "aegis", city: "neon", kind: "DELIVER", title: "Grid Requisition", brief: "Requisition 8 Micro-Circuits for the Grid relays.", amount: 8, material: "microCircuits", minTier: "NEUTRAL", reward: { rep: 12, materials: { dataShards: 5 }, xp: 1 } },
  { id: "spire-defense", giver: "moreau", faction: "aegis", city: "neon", kind: "DEFEND", title: "Spire Defense", brief: "Win 2 Neon City world events.", amount: 2, minTier: "TRUSTED", reward: { rep: 18, materials: { aegisCore: 1, microCircuits: 6 }, xp: 2 } },
];
export const contractById = (id: string) => CONTRACTS.find((c) => c.id === id);
export const contractPoint = (c: Contract) => (c.lx === undefined || c.lz === undefined ? null : { x: CITIES[c.city].x + c.lx, z: CITIES[c.city].z + c.lz });
export const SURVEY_REACH = 8;
export const MAX_ACTIVE_CONTRACTS = 3;
const doneKey = (id: string) => `living:contract:${id}`;
export const contractDone = (p: Pick<PlayerProgression, "earnedRewards">, id: string) => p.earnedRewards.includes(doneKey(id));

/* ------------------------------------------------------------ intel ------------------------------------------------------------ */
export type Intel = { id: string; seller: string; city: CityId; title: string; rumor: string; cost: { material: MaterialId; amount: number }; lx: number; lz: number; reward: Partial<Record<MaterialId, number>>; shards: number };
export const INTEL: readonly Intel[] = [
  { id: "nexus-arcology-cache", seller: "whisper", city: "nexus", title: "The Arcology Cache", rumor: "A Warden quartermaster hid a crate behind the Arcology blocks before the Fracture. Nobody went back for it.", cost: { material: "scrapMetal", amount: 15 }, lx: -75, lz: -10, reward: { reinforcedAlloy: 6, microCircuits: 4 }, shards: 40 },
  { id: "nexus-spire-signal", seller: "whisper", city: "nexus", title: "The Spire Signal", rumor: "Something under the Spire District keeps pinging an old Vanguard frequency. Someone left a beacon and a stash with it.", cost: { material: "microCircuits", amount: 6 }, lx: 18, lz: -80, reward: { dataShards: 5, tuningCore: 1 }, shards: 60 },
  { id: "neon-grid-stash", seller: "static", city: "neon", title: "Grid Maintenance Stash", rumor: "A Grid tech skimmed parts for years. The stash sits under the north-east pillars.", cost: { material: "microCircuits", amount: 5 }, lx: 34, lz: 28, reward: { microCircuits: 8, vehicleParts: 3 }, shards: 40 },
  { id: "neon-undercity-vault", seller: "static", city: "neon", title: "Undercity Vault", rumor: "The Syndicate moved a vault into the west alleys. The Directorate would love to know. You'd love to get there first.", cost: { material: "dataShards", amount: 4 }, lx: -34, lz: 22, reward: { dataShards: 6, tuningCore: 1 }, shards: 80 },
];
export const intelById = (id: string) => INTEL.find((i) => i.id === id);
export const intelPoint = (i: Intel) => ({ x: CITIES[i.city].x + i.lx, z: CITIES[i.city].z + i.lz });
export const STASH_REACH = 4;
const stashKey = (id: string) => `living:stash:${id}`;

/* ------------------------------------------------------------ actions ------------------------------------------------------------ */
export type NpcAction = { id: string; label: string; detail: string; enabled: boolean; reason?: string };
export type ActionResult = { progression: PlayerProgression; message: string } | { error: string };

const living = (p: PlayerProgression): LivingState => p.living ?? EMPTY_LIVING;
const withLiving = (p: PlayerProgression, l: LivingState): PlayerProgression => ({ ...p, living: l });
const have = (p: PlayerProgression, m: MaterialId) => p.materials[m] ?? 0;
const addMaterials = (p: PlayerProgression, add: Partial<Record<MaterialId, number>>): PlayerProgression => {
  const materials = { ...p.materials };
  for (const [k, v] of Object.entries(add) as [MaterialId, number][]) materials[k] = (materials[k] ?? 0) + v;
  return { ...p, materials };
};
const matLabel = (m: Partial<Record<MaterialId, number>>) => Object.entries(m).map(([k, v]) => `+${v} ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`).join(", ");

export const PLEDGE_KEY = "living.neon.pledge";
export const AMENDS_COST = { material: "scrapMetal" as MaterialId, amount: 20 };
export const COMMEND_TIER: RepTier = "HONORED";

/** Everything the talk panel can offer this NPC right now, with the reason a disabled action is locked. */
export function npcActions(p: PlayerProgression, npc: LivingNpc, now = Date.now()): NpcAction[] {
  const l = living(p);
  const tier = tierOf(l, npc.faction);
  const out: NpcAction[] = [];
  if (tier === "HOSTILE") {
    out.push({ id: `amends:${npc.faction}`, label: "Make amends", detail: `Pay ${AMENDS_COST.amount} scrap metal for the damage (+30 standing)`, enabled: have(p, AMENDS_COST.material) >= AMENDS_COST.amount, reason: `Needs ${AMENDS_COST.amount} scrap metal` });
    return out;
  }
  if (npc.role === "QUEST" || npc.role === "LEADER") {
    for (const c of CONTRACTS.filter((x) => x.giver === npc.id)) {
      if (contractDone(p, c.id)) continue;
      const active = l.contracts[c.id];
      if (active) {
        const ready = c.kind === "DELIVER" ? have(p, c.material!) >= c.amount : active.progress >= c.amount;
        out.push({ id: `turnin:${c.id}`, label: `Turn in: ${c.title}`, detail: c.kind === "DELIVER" ? `Hand over ${c.amount} ${c.material} (you have ${have(p, c.material!)})` : `${Math.min(active.progress, c.amount)}/${c.amount} · ${matLabel(c.reward.materials)}`, enabled: ready, reason: "Not finished yet" });
      } else {
        const tierOk = tierAtLeast(tier, c.minTier);
        const slots = Object.keys(l.contracts).length < MAX_ACTIVE_CONTRACTS;
        out.push({ id: `accept:${c.id}`, label: `Contract: ${c.title}`, detail: `${c.brief} Reward: +${c.reward.rep} standing, ${matLabel(c.reward.materials)}`, enabled: tierOk && slots, reason: !tierOk ? `Requires ${c.minTier.toLowerCase()} standing` : `You already hold ${MAX_ACTIVE_CONTRACTS} contracts` });
      }
    }
  }
  if (npc.role === "INFORMANT") {
    for (const i of INTEL.filter((x) => x.seller === npc.id)) {
      if (l.intel.includes(i.id)) continue;
      const discount = tierAtLeast(tier, "TRUSTED") ? 0.5 : 1;
      const cost = Math.ceil(i.cost.amount * discount);
      out.push({ id: `intel:${i.id}`, label: `Buy intel: ${i.title}`, detail: `${cost} ${i.cost.material}${discount < 1 ? " (trusted price)" : ""}`, enabled: have(p, i.cost.material) >= cost, reason: `Needs ${cost} ${i.cost.material}` });
    }
  }
  if (npc.role === "LEADER" && npc.city === "neon") {
    const pledged = p.story.choices[PLEDGE_KEY];
    if (!pledged) out.push({ id: `pledge:${npc.faction}`, label: `Pledge to the ${FACTIONS[npc.faction].name}`, detail: `+20 with them, −25 with the ${FACTIONS[FACTIONS[npc.faction].rival!].name}. Permanent.`, enabled: tierAtLeast(tier, "TRUSTED"), reason: "Requires trusted standing" });
  }
  if (npc.role === "LEADER" && !p.earnedRewards.includes(`living:commend:${npc.faction}`)) {
    out.push({ id: `commend:${npc.faction}`, label: "Ask for a commendation", detail: "A one-time reward for honored allies", enabled: tierAtLeast(tier, COMMEND_TIER), reason: "Requires honored standing" });
  }
  void now;
  return out;
}

/** Perform a talk-panel action. Refusals change nothing. */
export function performNpcAction(p: PlayerProgression, npcId: string, actionId: string, now = Date.now()): ActionResult {
  const npc = npcById(npcId);
  if (!npc) return { error: "Nobody here" };
  const offered = npcActions(p, npc, now).find((a) => a.id === actionId);
  if (!offered) return { error: "Not available" };
  if (!offered.enabled) return { error: offered.reason ?? "Locked" };
  const [kind, arg] = actionId.split(":") as [string, string];
  let l = living(p);

  if (kind === "amends") {
    const paid = { ...p, materials: { ...p.materials, [AMENDS_COST.material]: have(p, AMENDS_COST.material) - AMENDS_COST.amount } };
    return { progression: withLiving(paid, adjustRep(l, arg as FactionId, 30, false)), message: `${FACTIONS[arg as FactionId].name} accept your payment` };
  }
  if (kind === "accept") {
    const c = contractById(arg)!;
    l = { ...l, contracts: { ...l.contracts, [c.id]: { progress: 0, acceptedAt: now } } };
    return { progression: withLiving(p, l), message: `Contract accepted: ${c.title}` };
  }
  if (kind === "turnin") {
    const c = contractById(arg)!;
    let next = p;
    if (c.kind === "DELIVER") next = { ...next, materials: { ...next.materials, [c.material!]: have(next, c.material!) - c.amount } };
    const { [c.id]: _gone, ...rest } = l.contracts;
    l = adjustRep({ ...l, contracts: rest }, c.faction, c.reward.rep);
    next = addMaterials(withLiving(next, l), c.reward.materials);
    next = { ...next, earnedRewards: [...next.earnedRewards, doneKey(c.id)] };
    next = grantXP(next, "OBJECTIVE", { scale: c.reward.xp }).progression;
    return { progression: next, message: `${c.title} complete · +${c.reward.rep} ${FACTIONS[c.faction].name} · ${matLabel(c.reward.materials)}` };
  }
  if (kind === "intel") {
    const i = intelById(arg)!;
    const cost = Math.ceil(i.cost.amount * (tierAtLeast(tierOf(l, npc.faction), "TRUSTED") ? 0.5 : 1));
    const paid = { ...p, materials: { ...p.materials, [i.cost.material]: have(p, i.cost.material) - cost } };
    l = adjustRep({ ...l, intel: [...l.intel, i.id] }, npc.faction, 3, false);
    return { progression: withLiving(paid, l), message: `Intel: ${i.title}. Marked on your compass.` };
  }
  if (kind === "pledge") {
    const f = arg as FactionId, rival = FACTIONS[f].rival!;
    l = adjustRep(adjustRep(l, f, 20, false), rival, -25, false);
    const story = { ...p.story, choices: { ...p.story.choices, [PLEDGE_KEY]: f }, flags: p.story.flags.includes(`living:pledged:${f}`) ? p.story.flags : [...p.story.flags, `living:pledged:${f}`] };
    return { progression: { ...withLiving(p, l), story }, message: `You stand with the ${FACTIONS[f].name}` };
  }
  if (kind === "commend") {
    const f = arg as FactionId;
    const reward: Partial<Record<MaterialId, number>> = f === "wardens" || f === "aegis" ? { aegisCore: 2, tuningCore: 1 } : { forgeCatalyst: 1, microCircuits: 10 };
    return { progression: { ...addMaterials(p, reward), fractureShards: p.fractureShards + 150, earnedRewards: [...p.earnedRewards, `living:commend:${f}`] }, message: `${FACTIONS[f].name} commendation · ${matLabel(reward)}, +150 shards` };
  }
  return { error: "Not available" };
}

/** The line an NPC opens with: an active event or a fallen district overrides the standing-based greeting. */
export function npcLine(p: PlayerProgression, npc: LivingNpc, ctx: { eventTitle?: string | null | undefined } = {}, now = Date.now()): string {
  const l = living(p);
  if (ctx.eventTitle) return `${ctx.eventTitle} — get out there, Operator. Talk later.`;
  const fallen = ["nexus:spire", "nexus:market", "nexus:shipyard", "nexus:arcology", "neon:spire", "neon:undercity", "neon:market", "neon:grid"]
    .map((id) => districtById(id)!).find((d) => d.city === npc.city && districtStatus(l, d.id, now) === "FALLEN");
  const tier = tierOf(l, npc.faction);
  if (fallen && tier !== "HOSTILE") return `${fallen.name} is still overrun. Until someone takes it back, trade there is dead.`;
  const pledge = p.story.choices[PLEDGE_KEY];
  if (npc.city === "neon" && pledge && npc.role === "LEADER") return pledge === npc.faction ? `${npc.greeting[tier]} You chose well.` : `${npc.greeting[tier]} I know where you pledged.`;
  return npc.greeting[tier];
}

/* ------------------------------------------------------------ gameplay → progress ------------------------------------------------------------ */
/** Player kills inside a city advance that city's CULL contracts. */
export function recordCityKills(p: PlayerProgression, city: CityId, kills: number): PlayerProgression {
  return bumpContracts(p, (c) => c.city === city && c.kind === "CULL", kills);
}
/** A won world event advances that city's DEFEND contracts. */
export function recordEventWin(p: PlayerProgression, city: CityId): PlayerProgression {
  return bumpContracts(p, (c) => c.city === city && c.kind === "DEFEND", 1);
}
function bumpContracts(p: PlayerProgression, match: (c: Contract) => boolean, by: number): PlayerProgression {
  const l = living(p);
  let changed = false;
  const contracts = { ...l.contracts };
  for (const [id, run] of Object.entries(l.contracts)) {
    const c = contractById(id);
    if (!c || !match(c) || run.progress >= c.amount) continue;
    contracts[id] = { ...run, progress: Math.min(c.amount, run.progress + by) };
    changed = true;
  }
  return changed ? withLiving(p, { ...l, contracts }) : p;
}

/** Survey points and revealed stashes: reaching one completes the survey / opens the stash (once). */
export function recordReach(p: PlayerProgression, x: number, z: number): { progression: PlayerProgression; messages: string[] } {
  let next = p;
  const messages: string[] = [];
  const l = living(p);
  for (const [id, run] of Object.entries(l.contracts)) {
    const c = contractById(id);
    const pt = c && c.kind === "SURVEY" ? contractPoint(c) : null;
    if (!c || !pt || run.progress >= c.amount || Math.hypot(x - pt.x, z - pt.z) > SURVEY_REACH) continue;
    const cur = living(next);
    next = withLiving(next, { ...cur, contracts: { ...cur.contracts, [id]: { ...run, progress: c.amount } } });
    messages.push(`${c.title}: surveyed. Return to ${npcById(c.giver)?.name ?? "the contact"}.`);
  }
  for (const id of l.intel) {
    const i = intelById(id);
    if (!i || next.earnedRewards.includes(stashKey(id))) continue;
    const pt = intelPoint(i);
    if (Math.hypot(x - pt.x, z - pt.z) > STASH_REACH) continue;
    next = { ...addMaterials(next, i.reward), fractureShards: next.fractureShards + i.shards, earnedRewards: [...next.earnedRewards, stashKey(id)] };
    messages.push(`${i.title} recovered · ${matLabel(i.reward)}, +${i.shards} shards`);
  }
  return { progression: next, messages };
}

/** Markers the HUD should point at: active survey points and unopened revealed stashes. */
export function livingMarkers(p: PlayerProgression): { id: string; label: string; x: number; z: number; kind: "survey" | "stash" }[] {
  const l = living(p);
  const out: { id: string; label: string; x: number; z: number; kind: "survey" | "stash" }[] = [];
  for (const [id, run] of Object.entries(l.contracts)) { const c = contractById(id); const pt = c && c.kind === "SURVEY" && run.progress < c.amount ? contractPoint(c) : null; if (c && pt) out.push({ id: `survey:${id}`, label: c.title, ...pt, kind: "survey" }); }
  for (const id of l.intel) { const i = intelById(id); if (i && !p.earnedRewards.includes(stashKey(id))) out.push({ id: `stash:${id}`, label: i.title, ...intelPoint(i), kind: "stash" }); }
  return out;
}

export const repSummary = (p: PlayerProgression, city: CityId) => (["wardens", "guild", "syndicate", "aegis"] as FactionId[])
  .filter((f) => FACTIONS[f].city === city).map((f) => ({ faction: FACTIONS[f], rep: repOf(living(p), f), tier: tierOf(living(p), f) }));
