/** The playable strike missions (pure data + helpers). A strike used to exist only as a hub simulation (strikes.ts); each one now also
 * has a site you fight through in the world: the descent engine with exactly three floors, an approach (a combat encounter), a trial
 * (a parkour floor or a puzzle floor, the strike's own) and the boss. They launch from the Director, play on the strike difficulty ladder
 * (Standard → Hero → Legend → Master, mapped to gate ranks D → C → B → A so enemy counts, champions, boss health and the trial's
 * difficulty all scale), and pay the strike bounty (strikes.ts `claimStrikeClear`), never the dungeon bounty. */
import type { SignatureDungeon, RiftRank, TierKind } from "./fracture-gates";

/** what the mode is called on screen. The owner has not picked a name yet: change this one line (and nothing else) to rename it. */
export const STRIKE_MODE_NAME = "Field Ops";

/** strike difficulty tier → the gate rank the run is built at */
export const STRIKE_RANK: Readonly<Record<string, RiftRank>> = { standard: "D", hero: "C", legend: "B", master: "A" };
export const strikeRank = (tierId: string): RiftRank => STRIKE_RANK[tierId] ?? "D";

/** the floors of every strike site: approach, trial, boss */
export type StrikeSite = SignatureDungeon & { kinds: readonly [TierKind, TierKind, TierKind] };
const site = (s: Omit<SignatureDungeon, "regionId" | "sealed" | "floors" | "rank"> & { kinds: StrikeSite["kinds"] }): StrikeSite => ({ ...s, regionId: null, sealed: true, rank: "D", floors: [3, 3] });

export const STRIKE_SITES: readonly StrikeSite[] = [
  site({ id: "strike-slagworks", name: "Slagworks Breach", place: "Ember Reaches", kinds: ["ENCOUNTER", "PARKOUR", "BOSS"],
    look: "A shut-down foundry restarted on its own: catwalks over open slag, furnace halls glowing orange.",
    theme: { fog: "#1a0a05", stone: "#3a2418", trim: "#6b3a1c", glow: "#ff8a3a", light: "#ff6a20" },
    gatekeeper: "Furnace Warden", boss: "Cinder Warden", bossMechanic: "Break the plating while the pour is paused.", depth: 150, areas: ["The Hot Line", "Catwalks", "Furnace Hall", "The Pour"], roster: ["Brutes", "Trackers"] }),
  site({ id: "strike-bloom", name: "Bloom Sanctum", place: "Veridan Forest", kinds: ["ENCOUNTER", "PUZZLE", "BOSS"],
    look: "A mother-bloom grown through an old research dome, seeding it with spore drones.",
    theme: { fog: "#0a1a10", stone: "#2f3a2a", trim: "#4a6a3a", glow: "#8cff9a", light: "#4adf6a" },
    gatekeeper: "Spore Keeper", boss: "Mother Spore", bossMechanic: "Burn the core while the drones respawn.", depth: 150, areas: ["Overgrown Gate", "The Greenhouse", "Vent Controls", "The Core"], roster: ["Spore drones", "Trackers"] }),
  site({ id: "strike-drowned-relay", name: "Drowned Relay", place: "Verdant Swamps", kinds: ["ENCOUNTER", "PARKOUR", "BOSS"],
    look: "A flooded relay tower broadcasting a signal that pulls machines in from the marsh.",
    theme: { fog: "#04121a", stone: "#243038", trim: "#3a5a6a", glow: "#5ad0ff", light: "#3aa8e0" },
    gatekeeper: "Signal Keeper", boss: "Tide Engine", bossMechanic: "Silence the relay's three arrays.", depth: 150, areas: ["The Causeway", "Flooded Floor", "Upper Deck", "The Arrays"], roster: ["Trackers", "Brutes"] }),
  site({ id: "strike-skyline-override", name: "Skyline Override", place: "Nexus City", kinds: ["ENCOUNTER", "PUZZLE", "BOSS"],
    look: "A hijacked rooftop defence grid turning the skyline's own turrets on the streets below.",
    theme: { fog: "#05060f", stone: "#2a2d3a", trim: "#444a66", glow: "#9a7dff", light: "#6a5aff" },
    gatekeeper: "Grid Keeper", boss: "Warden Prime-0", bossMechanic: "Take the grid master offline.", depth: 150, areas: ["Street Level", "Rooftop Run", "Grid Nodes", "The Master Node"], roster: ["Sentinels", "Brutes"] }),
];
export const strikeSiteById = (id: string): StrikeSite | null => STRIKE_SITES.find((s) => s.id === id) ?? null;

/** the id a run is launched under: `<strike>@<tier>` */
export const strikeRunId = (strikeId: string, tierId: string) => `${strikeId}@${tierId}`;
export function parseStrikeRun(id: string): { strikeId: string; tierId: string } | null {
  const [strikeId, tierId] = id.split("@");
  return strikeId && strikeSiteById(strikeId) ? { strikeId, tierId: tierId ?? "standard" } : null;
}

/** the world region a strike's troops come from and its mission launches beside (the sites have no gate of their own) */
export const STRIKE_REGION: Readonly<Record<string, string>> = { "strike-slagworks": "ember", "strike-bloom": "veridan", "strike-drowned-relay": "swamps", "strike-skyline-override": "nexus" };
export const strikeRegionOf = (id: string): string | null => STRIKE_REGION[id] ?? null;
/** the strike difficulty tier a run's gate rank stands for (the inverse of STRIKE_RANK) */
export const tierOfStrikeRank = (rank: RiftRank): string => (Object.entries(STRIKE_RANK).find(([, r]) => r === rank)?.[0] ?? "standard");
