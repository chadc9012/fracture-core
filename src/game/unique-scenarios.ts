/**
 * Unique Scenarios (Shangri-La Frontier-inspired): named one-off encounters with a real
 * mechanical gimmick instead of just reskinned stats — "this can't be brute-forced" the way the
 * show's own trash-game boss fights work. v1's gimmick rides directly on boss-poise.ts: a
 * scenario boss shrugs off almost all damage outside its weak-point/stagger window, so clearing
 * it means actually working the poise mechanic rather than just out-DPSing a flat health bar.
 *
 * Solara currently has no catalog boss in encounters.ts (its entry has no `boss` field) — sim.ts's
 * summonBoss() falls back to the matching scenario here when a region has none, so this slots in
 * without any new trigger plumbing: the existing "B" debug summon and Emergency Quest spawner
 * both already call summonBoss() for whatever region they're given.
 */

export type UniqueScenario = {
  id: string;
  name: string;
  regionId: string;
  bossName: string;
  drop: string;
  /** shown once, the moment it's summoned — why normal tactics won't work */
  briefing: string;
  tell: string;
  /** damage multiplier applied to hits landing OUTSIDE a weak-point/stagger window — the gimmick */
  outsideWindowMult: number;
  rewardCredits: number;
};

export const UNIQUE_SCENARIOS: readonly UniqueScenario[] = [
  {
    id: "unbroken-glass",
    name: "Anomaly: The Unbroken Glass",
    regionId: "solara",
    bossName: "The Unbroken Glass",
    drop: "anomalyCarbon",
    briefing: "A standing-wave anomaly in the Glass Flats, hardened against direct damage — NOVA can't find a brute-force angle. It only yields the instant its own resonance destabilizes.",
    tell: "Light fractures across its shell in a slow pulse right before it destabilizes.",
    outsideWindowMult: 0.08,
    rewardCredits: 600,
  },
  {
    id: "system-core",
    name: "The System Core",
    regionId: "thalassia",
    bossName: "The System Core",
    drop: "fractureCore",
    briefing: "Thalassia has no catalog boss of its own — this is the Deepmind's real core, and it's not a health bar you can just grind down. It only opens up the instant its own containment locks force a stagger.",
    tell: "Its shell splits along three seams right before the stagger window opens.",
    outsideWindowMult: 0.06,
    rewardCredits: 1200,
  },
];

export function scenarioFor(regionId: string): UniqueScenario | undefined {
  return UNIQUE_SCENARIOS.find((s) => s.regionId === regionId);
}

export function scenarioById(id: string): UniqueScenario | undefined {
  return UNIQUE_SCENARIOS.find((s) => s.id === id);
}
