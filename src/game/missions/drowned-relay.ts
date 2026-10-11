/** Swamp story mission — "The Drowned Relay": upgrades fd-05 ("Crossing the Shrouded Swamps"),
 * which used to be only a 90 s survive timer, into the zone's first authored story beat (campaign
 * tracker §8, "Swamp story mission (using KV-Unit boss)").
 *
 * Story: Broken Signal's restored relay pointed somewhere past the treeline. The trace ends in the
 * Shrouded Swamps at a Vanguard relay mast that sank when the Fracture hit; the swamp grew over it,
 * and the spore-mass has been feeding on its power ever since. What has been "watching you cross"
 * is the relay's old defender, the Kraken-Vanguard (KV-Unit) — a Vanguard war-frame the swamp
 * fused with. Purging the relay shows the signal was never the swamp's: it was routed *through*
 * the relay towards Neon City, which is where Blackout Protocol picks the thread up.
 *
 * Same ANCHOR/ARRIVED/CLEAR/HACK/ACK shape as the other machines so Scene/GameCanvas wire it the
 * same way. The KV-Unit is the swamps' existing catalog boss (encounters.ts), summoned through the
 * normal summonBoss() path with `{ mission: true }`, so CLEAR detection is the usual
 * "no mission-tagged machine alive" check. Pure: no React, no randomness. */
export type MissionState = "IDLE" | "TRIGGERED" | "WADING" | "COMBAT_1" | "PURGING" | "BOSS" | "COMPLETE" | "WORLD_UPDATE";
export type MissionEvent =
  | { type: "START" }
  | { type: "ANCHOR"; x: number; z: number }
  | { type: "ARRIVED" }
  | { type: "CLEAR" }
  | { type: "HACK"; progress: number }
  | { type: "ACK" };

export type MissionRun = {
  id: "drowned-relay";
  state: MissionState;
  target: { x: number; z: number } | null;
  hack: number;
  nova: string;
};

export const DROWNED_RELAY: MissionRun = { id: "drowned-relay", state: "IDLE", target: null, hack: 0, nova: "" };

/** Where the relay sank, as an offset from the swamps' centre in units of the region radius. Kept
 * well away from the KV-Unit's walk-in lair (waypoints.ts BOSS_LAIRS: +0.6, -0.55) so walking to
 * the relay never also triggers the free-roam lair summon. */
export const RELAY_OFFSET = { dx: -0.25, dz: 0.2 } as const;

/** The relay position for a region centre/radius (pure, so Scene and tests agree). */
export function relaySite(region: { x: number; z: number; radius: number }): { x: number; z: number } {
  return { x: region.x + region.radius * RELAY_OFFSET.dx, z: region.z + region.radius * RELAY_OFFSET.dz };
}

/** In-world objective line (not a menu) for each state. */
export const OBJECTIVE: Record<MissionState, string> = {
  IDLE: "",
  TRIGGERED: "The trace ends somewhere in the fog",
  WADING: "Wade out to the drowned relay",
  COMBAT_1: "The reeds are moving — survive the ambush",
  PURGING: "Purge the spore-mass from the relay channels",
  BOSS: "Bring down the Kraken-Vanguard",
  COMPLETE: "Relay purged",
  WORLD_UPDATE: "The signal runs on toward Neon City",
};

export function advanceMission(m: MissionRun, e: MissionEvent): MissionRun {
  switch (m.state) {
    case "IDLE":
      return e.type === "START"
        ? { ...m, state: "TRIGGERED", nova: "The relay you fixed pointed past the treeline. I followed it into the swamp and lost it in the fog. Something out there is soaking up the signal." }
        : m;
    case "TRIGGERED":
      return e.type === "ANCHOR"
        ? { ...m, state: "WADING", target: { x: e.x, z: e.z }, nova: "Got it. An old Vanguard relay mast, half sunk. The swamp grew over it and it's still drawing power. Watch the reeds on the way in." }
        : m;
    case "WADING":
      return e.type === "ARRIVED"
        ? { ...m, state: "COMBAT_1", nova: "Contact, all around you. The spore-walkers nest on the relay's power. Hold your ground." }
        : m;
    case "COMBAT_1":
      return e.type === "CLEAR"
        ? { ...m, state: "PURGING", nova: "They're down. The relay's channels are choked with spore-mass. Match each channel to the carrier pulse and burn it clean." }
        : m;
    case "PURGING":
      if (e.type !== "HACK") return m;
      if (e.progress >= 100) return { ...m, hack: 100, state: "BOSS", nova: "Channels are clear, and something under the water just lost its food. That's what was watching you. Kraken-Vanguard, incoming." };
      return { ...m, hack: e.progress };
    case "BOSS":
      return e.type === "CLEAR" ? { ...m, state: "COMPLETE", nova: "It's down. It used to be a Vanguard war-frame before the swamp took it. The relay's transmitting clean now." } : m;
    case "COMPLETE":
      return e.type === "ACK"
        ? { ...m, state: "WORLD_UPDATE", target: null, nova: "The signal didn't start here. The relay was only passing it along, straight to Neon City. Whoever is sending it is in there." }
        : m;
    default:
      return m;
  }
}

/** The relay-purge minigame (overlay). Three channels; each has one carrier frequency out of four.
 * A correct pick locks that channel; a wrong pick only resets that channel's attempt (no global
 * reset — the swamp is already hostile enough). Progress is the share of locked channels. */
export const PURGE_CHANNELS = 3;
export const PURGE_FREQUENCIES = ["31.4", "47.0", "62.8", "88.1"] as const;

/** Deterministic carrier per channel from a seed (the overlay passes a per-run seed). */
export function carrierFor(seed: number, channel: number): number {
  const h = Math.imul((seed | 0) ^ (channel + 1) * 0x9e3779b1, 0x85ebca6b) >>> 0;
  return h % PURGE_FREQUENCIES.length;
}

export type PurgeState = { locked: boolean[]; misses: number };
export const PURGE_START: PurgeState = { locked: Array.from({ length: PURGE_CHANNELS }, () => false), misses: 0 };

export function pickFrequency(s: PurgeState, seed: number, channel: number, freq: number): PurgeState {
  if (channel < 0 || channel >= PURGE_CHANNELS || s.locked[channel]) return s;
  if (carrierFor(seed, channel) !== freq) return { ...s, misses: s.misses + 1 };
  return { ...s, locked: s.locked.map((v, i) => (i === channel ? true : v)) };
}

export const purgeProgress = (s: PurgeState) => Math.round((s.locked.filter(Boolean).length / PURGE_CHANNELS) * 100);
