/** Strikes (pure): short three-stage fireteam missions, the quick, repeatable cousins of dungeons and raids. Each is a
 * dungeon-engine definition (so the Operations hub runs it like any other encounter) with an approach, a push and a boss. They
 * play on the strike difficulty ladder (difficulty-ladder.ts: Standard → Hero → Legend → Master), pay Nex by tier
 * (activity-payouts.ts, "strike" class: less than a dungeon, more than a side quest), and one strike each week is the Ordeal,
 * which pays extra from Hero up. One payout per strike per tier per day, and every clear is remembered per tier. */
import type { DungeonDefinition } from "./dungeons";
import type { PlayerProgression } from "./progression";
import { grantXP } from "./xp";
import { payInto, payoutFor } from "./activity-payouts";
import { STRIKE_TIERS, recordTierClear, tierById, tierTarget, tierUnlocked, weekIndex, weeklyMult } from "./difficulty-ladder";

const strike = (id: string, name: string, region: string, identity: string, hazard: string, boss: string, gear: string, perk: string, stages: DungeonDefinition["stages"], traits: readonly string[]): DungeonDefinition => ({
  id, name, activity: "STRIKE", region, privateInstance: true, squad: { min: 1, max: 3 }, duration: "10–20 min", maxLives: 3,
  identity, hazard, boss, signature: { name: gear, type: id.length % 2 ? "WEAPON" : "ARMOR", perk, repeatTraits: traits }, stages,
});

export const STRIKES: readonly DungeonDefinition[] = [
  strike("strike-slagworks", "Strike · Slagworks Breach", "Ember Reaches", "A shut-down foundry has restarted on its own, and the slag lines are feeding something at the bottom.", "Molten overflow", "Cinder Warden", "Slagbreaker Coil", "Kills near molten channels feed a short heat surge.",
    [
      { id: "slag-approach", name: "The Hot Line", type: "TRAVERSAL_COMBAT", objective: "Cross the catwalks before the overflow gates open", target: 4, checkpoint: true, hazardLabel: "OVERFLOW", enemies: ["Brute", "Tracker"] },
      { id: "slag-push", name: "Furnace Hall", type: "COMBAT", objective: "Clear the hall and shut down two furnaces", target: 5, checkpoint: true, hazardLabel: "OVERFLOW", enemies: ["Brute", "Sentinel"] },
      { id: "slag-boss", name: "Cinder Warden", type: "BOSS_FIGHT", objective: "Break the Warden's plating while the pour is paused", target: 6, checkpoint: false, hazardLabel: "OVERFLOW", enemies: ["Cinder Warden"],
        bossPhases: [
          { name: "Phase I · Plated", threshold: 100, mechanic: "The Warden sweeps the walkway with heat lances.", counter: "Stay off the lit lanes and hit the vents." },
          { name: "Phase II · Pour", threshold: 50, mechanic: "Slag floods one half of the arena at a time.", counter: "Rotate to the dry half and strip the plating." },
        ], reward: "Slagbreaker Coil" },
    ], ["Heat Sink", "Overpour", "Quenched Rounds"]),
  strike("strike-bloom", "Strike · Bloom Sanctum", "Veridan Forest", "A mother-bloom has grown through an old research dome and is seeding it with spore drones.", "Spore density", "Mother Spore", "Bloomveil Mantle", "Healing leaves a lingering spore cloud that slows enemies.",
    [
      { id: "bloom-approach", name: "Overgrown Gate", type: "SYNC_TRAVERSAL", objective: "Cut three root locks together", target: 3, checkpoint: true, hazardLabel: "SPORES", enemies: ["Tracker"] },
      { id: "bloom-push", name: "The Greenhouse", type: "PUZZLE_COMBAT", objective: "Defend the vent controls while the spores thin", target: 5, checkpoint: true, hazardLabel: "SPORES", enemies: ["Sentinel", "Tracker"] },
      { id: "bloom-boss", name: "Mother Spore", type: "BOSS_FIGHT", objective: "Burn the core while the drones respawn", target: 6, checkpoint: false, hazardLabel: "SPORES", enemies: ["Mother Spore"],
        bossPhases: [
          { name: "Phase I · Seeding", threshold: 100, mechanic: "Drones carry spore seeds to the walls.", counter: "Pop drones before they land." },
          { name: "Phase II · Bloom", threshold: 50, mechanic: "The core opens and releases a wide cloud.", counter: "Shoot it through the cloud, then clear out." },
        ], reward: "Bloomveil Mantle" },
    ], ["Spore Wake", "Green Thumb", "Slow Bloom"]),
  strike("strike-drowned-relay", "Strike · Drowned Relay", "Verdant Swamps", "A flooded relay tower is broadcasting a signal that pulls machines in from across the marsh.", "Rising water", "Tide Engine", "Relay Breaker", "Precision hits ring a pulse that staggers nearby machines.",
    [
      { id: "relay-approach", name: "The Causeway", type: "COMBAT", objective: "Hold the causeway against the signal's pull", target: 5, checkpoint: true, hazardLabel: "WATER", enemies: ["Tracker", "Brute"] },
      { id: "relay-push", name: "Flooded Floor", type: "TRAVERSAL_COMBAT", objective: "Reach the upper deck as the water rises", target: 5, checkpoint: true, hazardLabel: "WATER", enemies: ["Sentinel"] },
      { id: "relay-boss", name: "Tide Engine", type: "BOSS_FIGHT", objective: "Silence the relay's three arrays", target: 6, checkpoint: false, hazardLabel: "WATER", enemies: ["Tide Engine"],
        bossPhases: [
          { name: "Phase I · Broadcast", threshold: 100, mechanic: "The Engine pulses in a rising ring.", counter: "Jump the ring and shoot the first array." },
          { name: "Phase II · Surge", threshold: 50, mechanic: "The deck floods and arrays move.", counter: "Stay high, finish the last two arrays." },
        ], reward: "Relay Breaker" },
    ], ["Ring Echo", "High Water", "Tuned Rounds"]),
  strike("strike-skyline-override", "Strike · Skyline Override", "Nexus City", "A hijacked rooftop defence grid is turning the skyline's own turrets on the streets below.", "Turret grid", "Warden Prime-0", "Override Key", "Defeated turrets turn into a short-lived ally decoy.",
    [
      { id: "sky-approach", name: "Street Level", type: "COMBAT", objective: "Fight up to the lift lobby", target: 4, checkpoint: true, hazardLabel: "GRID", enemies: ["Sentinel", "Brute"] },
      { id: "sky-push", name: "Rooftop Run", type: "SYNC_TRAVERSAL", objective: "Hack three grid nodes across the rooftops", target: 3, checkpoint: true, hazardLabel: "GRID", enemies: ["Sentinel"] },
      { id: "sky-boss", name: "Warden Prime-0", type: "BOSS_FIGHT", objective: "Take the grid master offline", target: 6, checkpoint: false, hazardLabel: "GRID", enemies: ["Warden Prime-0"],
        bossPhases: [
          { name: "Phase I · Lock-on", threshold: 100, mechanic: "Turrets paint the team and fire in volleys.", counter: "Break line of sight between volleys." },
          { name: "Phase II · Override", threshold: 50, mechanic: "The Warden pulls the grid into its own shield.", counter: "Kill the feed nodes, then focus the Warden." },
        ], reward: "Override Key" },
    ], ["Ghost Grid", "Decoy Drop", "Clean Break"]),
];
export const STRIKE_IDS: readonly string[] = STRIKES.map((s) => s.id);
export const isStrike = (id: string) => STRIKE_IDS.includes(id);

/** this week's Ordeal strike: one strike, rotating weekly, pays extra from Hero up */
export const weeklyStrike = (now: number): DungeonDefinition => STRIKES[((weekIndex(now) % STRIKES.length) + STRIKES.length) % STRIKES.length]!;

export const strikeClaimKey = (strikeId: string, tierId: string, now: number) => `strike-claim:${strikeId}:${tierId}:${new Date(now).toISOString().slice(0, 10)}`;
export const canClaimStrike = (p: Pick<PlayerProgression, "earnedRewards">, strikeId: string, tierId: string, now = Date.now()) => !p.earnedRewards.includes(strikeClaimKey(strikeId, tierId, now));
/** a strike is playable at a tier once the tier before it has been cleared in any strike */
export const strikeTierUnlocked = (p: Pick<PlayerProgression, "earnedRewards">, tierId: string) => tierUnlocked(p, "strike", STRIKE_IDS, tierId);

/** the Nex a clear would pay right now (null when today's is taken), including this week's Ordeal bonus */
export function strikePayout(p: Pick<PlayerProgression, "nexLedger">, strikeId: string, tierId: string, now = Date.now()) {
  const tier = tierById("strike", tierId);
  return payoutFor(p.nexLedger, "strike", tierTarget("strike", strikeId, tierId), now, tier.payMult * weeklyMult("strike", tier, weeklyStrike(now).id === strikeId, false));
}

/** claim a strike clear: tier payout in Nex (once per strike per tier per day), shards by tier, discovery XP, the signature gear's name, and the tier clear is recorded to unlock the next tier */
export function claimStrikeClear(p: PlayerProgression, strikeId: string, tierId: string, now = Date.now()): { progression: PlayerProgression; paid: number; first: boolean } {
  const def = STRIKES.find((s) => s.id === strikeId);
  if (!def || !strikeTierUnlocked(p, tierId) || !canClaimStrike(p, strikeId, tierId, now)) return { progression: p, paid: 0, first: false };
  const tier = tierById("strike", tierId);
  const mult = tier.payMult * weeklyMult("strike", tier, weeklyStrike(now).id === strikeId, false);
  const withKeys: PlayerProgression = { ...p, earnedRewards: Array.from(new Set([...p.earnedRewards, def.signature.name, strikeClaimKey(strikeId, tierId, now)])), fractureShards: p.fractureShards + 12 * (1 + tier.rank) };
  const recorded = recordTierClear(withKeys, strikeId, tierId);
  const paid = payInto(recorded, "strike", tierTarget("strike", strikeId, tierId), now, mult);
  return { progression: grantXP(paid.progression, "DISCOVERY", { scale: 1 + tier.rank * 0.5 }).progression, paid: paid.paid, first: paid.first };
}
export { STRIKE_TIERS };
