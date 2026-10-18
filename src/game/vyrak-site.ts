/** How the player finds Vyrak (design doc: hidden encounter discovery). There is no marker at first. Two world clues exist (a carved
 * inscription in Solara and the ranger's campfire in the Wastelands), and walking close to the hidden lair is a third route to the
 * same clue count. Two clues discover the encounter (encounter-journal.ts); only then does the lair appear on maps and summon the fight.
 * Operators share discovery (account-wide) but each still has to win the fight for their own bond. */
import { REGIONS } from "./world";
import { isDiscovered } from "./encounter-journal";
import type { PlayerProgression } from "./progression";
import { SCENARIO_LAIRS } from "./waypoints";

export type ClueSite = { clueId: string; label: string; regionId: string; /** fractions of the region radius from its centre */ dx: number; dz: number; found: string };
export const VYRAK_CLUE_SITES: readonly ClueSite[] = [
  { clueId: "inscription", label: "Weathered carving", regionId: "solara", dx: -0.35, dz: 0.3, found: "A carving of a winged shape above a split mountain. Beneath it: \"It tests courage, not strength.\"" },
  { clueId: "ember", label: "Ranger's last campfire", regionId: "wastelands", dx: 0.3, dz: -0.35, found: "A ranger's journal: \"A dragon that remembers the world before the Fracture. It waits beyond the desert where the mountain is scarred.\"" },
];
export const CLUE_RADIUS = 5, LAIR_SENSE_RADIUS = 60;

export function clueSiteWorld(s: ClueSite): { x: number; z: number } {
  const r = REGIONS.find((x) => x.id === s.regionId)!;
  return { x: r.x + r.radius * s.dx, z: r.z + r.radius * s.dz };
}
export const nearClueSite = (x: number, z: number): ClueSite | null => VYRAK_CLUE_SITES.find((s) => { const w = clueSiteWorld(s); return Math.hypot(w.x - x, w.z - z) <= CLUE_RADIUS; }) ?? null;
export const vyrakLair = () => SCENARIO_LAIRS.find((l) => l.scenarioId === "vyrak") ?? null;
/** near enough to the hidden lair to sense it: grants the "site" clue */
export const nearHiddenLair = (x: number, z: number): boolean => { const l = vyrakLair(); return !!l && Math.hypot(l.x - x, l.z - z) <= LAIR_SENSE_RADIUS; };

/** the lair is hidden (no marker, no summon) until the account has discovered it */
export const lairRevealed = (p: Pick<PlayerProgression, "earnedRewards">, scenarioId: string): boolean => scenarioId !== "vyrak" || isDiscovered(p, "vyrak");
