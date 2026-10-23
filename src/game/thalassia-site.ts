import { scaleSite } from "./world";
/** Where Thalassia sits in the open ocean (shared by the city set-dressing, the System Core dive and the Drowned Monarch lair). Authored at (-97,-208) in the original-size world; it scales out from the origin with the map. */
import { WORLD_RADIUS } from "./world";
/** Scene lets you past the world-bounds clamp within Thalassia's city radius (85 m, thalassia-sectors CITY_RADIUS) plus an 80 m
 * approach; the city is pulled in along its bearing until that zone overlaps the world disc by at least 40 m, at any map scale. */
const EXEMPT = 85 + 80;
const AUTHORED = scaleSite(-20, 225);
const authoredDist = Math.hypot(AUTHORED.x, AUTHORED.z);
const dist = Math.min(authoredDist, WORLD_RADIUS - 6 + EXEMPT - 40);
export const THALASSIA_CENTER = { x: (AUTHORED.x / authoredDist) * dist, z: (AUTHORED.z / authoredDist) * dist };
