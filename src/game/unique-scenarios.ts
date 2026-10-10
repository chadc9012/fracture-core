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
  /** authored GLB shown instead of the procedural boss body (ScenarioBosses.tsx); the procedural body stays as the fallback while it loads or if it fails */
  model?: { url: string; /** displayed height in metres */ height: number; /** emissive lift from the colour map so glowing parts read in shadow */ glow: number };
  /** a lair that summons this scenario when the player walks in (offsets are fractions of the region radius from its centre) */
  lair?: { dx: number; dz: number };
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
  {
    id: "rime-alpha",
    name: "Hunt: The Rime Alpha",
    regionId: "frostspire",
    bossName: "Rime Alpha",
    drop: "glacierFang",
    briefing: "A crystal-coated alpha that has fed on the Frostspire's cryo seams — its ice plating turns almost every shot aside. It only lowers its guard when it lunges and its coat cracks open.",
    tell: "Its spine-crystals flare teal and the glow sinks into its ribs right before it lunges.",
    outsideWindowMult: 0.07,
    rewardCredits: 900,
    model: { url: "/models/bosses/frost-wolf.glb", height: 5.2, glow: 0.45 },
    lair: { dx: -0.5, dz: 0.45 },
  },
  {
    id: "dark-knight",
    name: "Duel: The Dark Knight",
    regionId: "wastelands",
    bossName: "The Dark Knight",
    drop: "nullPlate",
    briefing: "A lone armored sentinel with a null-field lattice reactor in its chest. Its plating shrugs off nearly everything — only the moment its reactor vents to recharge leaves a gap.",
    tell: "The chest reactor and arm-guards flash red as the knight raises its staff, then the reactor vents.",
    outsideWindowMult: 0.05,
    rewardCredits: 1000,
    model: { url: "/models/bosses/dark-knight.glb", height: 7.4, glow: 0.3 },
    lair: { dx: -0.5, dz: 0.45 },
  },
];

/** Scenarios that have their own lair marker (the rest are summoned by a region, the debug key or a mission). */
export const LAIR_SCENARIOS = UNIQUE_SCENARIOS.filter((s) => s.lair);

export function scenarioFor(regionId: string): UniqueScenario | undefined {
  // lair scenarios are summoned from their lair, not as a region's fallback boss
  return UNIQUE_SCENARIOS.find((s) => s.regionId === regionId && !s.lair);
}

export function scenarioById(id: string): UniqueScenario | undefined {
  return UNIQUE_SCENARIOS.find((s) => s.id === id);
}
