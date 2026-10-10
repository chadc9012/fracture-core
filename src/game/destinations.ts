/** Cities that are destinations on the star map but are not regions of their own: they sit inside or beside a region and use its world.
 * Positions come from the same constants as the landmarks (neon-city / thalassia), so the map, compass and Scene cannot disagree. */
import { LANDMARKS } from "./landmarks";
import type { ZoneKind } from "./world";

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
}

const lm = (id: string) => LANDMARKS.find((l) => l.id === id)!;
const neon = lm("neon-city"), thalassia = lm("thalassia");

export const CITY_DESTINATIONS: readonly CityDestination[] = [
  { id: "neon-city", name: "Neon City", sub: "Safe Zone / District", kind: "safe", x: neon.x, z: neon.z, regionId: "nexus", rules: ["Beside the Nexus hub", "Lit district, dense street traffic", neon.history], deployable: true },
  { id: "thalassia", name: "Thalassia", sub: "Open ocean / Drowned city", kind: "fracture", x: thalassia.x, z: thalassia.z, regionId: "swamps", rules: [thalassia.history], deployable: false, blockedReason: "Open-ocean city: there is no landing site. Reach it by diving." },
];

/** Where the player stands after dropping in: a few metres off the centre so the drop never lands on a landmark. */
export const dropPoint = (d: { x: number; z: number }) => ({ x: d.x, z: d.z + 6 });
