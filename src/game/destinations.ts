/** Cities that are destinations on the star map but are not regions of their own: they sit inside or beside a region and use its world.
 * Positions come from the same constants as the landmarks (neon-city / thalassia), so the map, compass and Scene cannot disagree. */
import { LANDMARKS } from "./landmarks";
import type { ZoneKind } from "./world";
import { DOCK_DECK_Y, airlockSite } from "./thalassia-sectors";

export interface CityDestination {
  id: string;
  name: string;
  sub: string;
  kind: ZoneKind;
  x: number;
  z: number;
  /** region whose sector intel (hazard, rules) applies around the city */
  regionId: string;
  rules: string[];
  /** false = no landing site (the city is not reachable by dropping in) */
  deployable: boolean;
  /** shown instead of the deploy button when not deployable */
  blockedReason?: string;
  /** "submersible": the drop is a sub breaching the Sentry Dock seal — you arrive at depth, already diving */
  arrival?: "drop" | "submersible";
}

const lm = (id: string) => LANDMARKS.find((l) => l.id === id)!;
const neon = lm("neon-city"), thalassia = lm("thalassia");

export const CITY_DESTINATIONS: readonly CityDestination[] = [
  { id: "neon-city", name: "Neon City", sub: "Safe Zone / District", kind: "safe", x: neon.x, z: neon.z, regionId: "nexus", rules: ["Beside the Nexus hub", "Lit district, dense street traffic", neon.history], deployable: true },
  { id: "thalassia", name: "Thalassia", sub: "Containment Rift / Submerged", kind: "fracture", x: thalassia.x, z: thalassia.z, regionId: "veridan", rules: ["Offshore from Verdant Forest · submersible arrival at the Sentry Dock airlock", "Crush depth below the city · electrified coolant in the Abyssal Ring", thalassia.history], deployable: true, arrival: "submersible" },
];

/** Where the player stands after dropping in: a few metres off the centre so the drop never lands on a landmark. */
export const dropPoint = (d: { x: number; z: number; arrival?: CityDestination["arrival"] }): { x: number; z: number; y?: number } =>
  d.arrival === "submersible" ? { x: airlockSite().x + 5, z: airlockSite().z, y: DOCK_DECK_Y + 1.6 } : { x: d.x, z: d.z + 6 };
