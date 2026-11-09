/** The planet globe (owner, Nov 1: "give the map the globe look and make it interactive, where you click on a region and it
 * shows you the full map of that region"). The globe's texture is baked from the canon board's painted globe by
 * scripts/bake-globe.py, which reads the painting as an orthographic view of the near hemisphere centred on latitude 0,
 * longitude 0 (planet.ts GLOBE). This module uses the same projection to put each continent and ocean on the sphere, to
 * turn a tap on the sphere into a continent, and to say which street maps (carto-maps.ts) each continent opens. Pure. */
import { CONTINENTS, GLOBE, type ContinentId } from "./planet";
import type { CartoMapId } from "./carto-maps";

/** the baked texture and the radius the bake reads the painting at (inside its atmosphere rim) */
export const GLOBE_TEXTURE = "/maps/globe/veyra.jpg";
export const SAMPLE_R = GLOBE.r * 0.975;

export type LatLon = { lat: number; lon: number };
const deg = (r: number) => (r * 180) / Math.PI, rad = (d: number) => (d * Math.PI) / 180;

/** a board pixel on the painted globe -> latitude and longitude (degrees); null off the sphere */
export function boardToLatLon(px: number, py: number): LatLon | null {
  const sy = (GLOBE.y - py) / SAMPLE_R;
  if (Math.abs(sy) > 1) return null;
  const lat = Math.asin(sy), cl = Math.cos(lat), sx = (px - GLOBE.x) / (SAMPLE_R * (cl || 1e-6));
  if (Math.abs(sx) > 1) return null;
  return { lat: deg(lat), lon: deg(Math.asin(sx)) };
}
/** latitude/longitude -> a point on the unit sphere in three.js SphereGeometry's frame (longitude 0 at +X, east toward -Z,
 * north +Y), so a texture baked in equirectangular layout lines up with it */
export function latLonToVec(lat: number, lon: number): [number, number, number] {
  const la = rad(lat), lo = rad(lon);
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)];
}
export function vecToLatLon(x: number, y: number, z: number): LatLon {
  const r = Math.hypot(x, y, z) || 1;
  return { lat: deg(Math.asin(Math.max(-1, Math.min(1, y / r)))), lon: deg(Math.atan2(-z, x)) };
}
/** great-circle angle between two points (degrees) */
export function angleBetween(a: LatLon, b: LatLon): number {
  const [ax, ay, az] = latLonToVec(a.lat, a.lon), [bx, by, bz] = latLonToVec(b.lat, b.lon);
  return deg(Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz))));
}

/** each continent on the sphere: where its painted icon sits (the board's pin is the name; the icon is ~28 px above) */
export const CONTINENT_GLOBE: Readonly<Record<ContinentId, LatLon>> = Object.fromEntries(
  CONTINENTS.map((c) => [c.id, boardToLatLon(c.pin.x, c.pin.y - 22)!]),
) as Record<ContinentId, LatLon>;

/** the seven oceans' names on the sphere: the board lists them with a character each (northern, central, southern, eastern,
 * western, the storm belt, the shattered depths); the near side holds the continents, so most oceans wrap round the far side */
export const OCEAN_GLOBE: Readonly<Record<string, LatLon>> = {
  aurora: { lat: 66, lon: 120 },      // the Northern Expanse
  fracture: { lat: -8, lon: 10 },     // the Central Deep, between Nexus City, the Wastelands and Thalassia
  solara: { lat: -62, lon: 40 },      // the Southern Reach
  silent: { lat: 6, lon: 112 },       // the Eastern Expanse
  obsidian: { lat: 8, lon: -112 },    // the Western Deep
  tempest: { lat: 40, lon: 58 },      // the Storm Belt, round the Storm Islands
  echo: { lat: -24, lon: 176 },       // the Shattered Depths
};

/** the continent a tap on the sphere lands on: the nearest icon within reach (degrees), else null (open ocean) */
export function continentAt(p: LatLon, reach = 16): ContinentId | null {
  let best: ContinentId | null = null, bd = reach;
  for (const c of CONTINENTS) { const d = angleBetween(p, CONTINENT_GLOBE[c.id]); if (d < bd) { bd = d; best = c.id; } }
  return best;
}

/** the street maps each continent opens (the first is shown first); none for the lands not in the game yet */
export const CONTINENT_MAPS: Readonly<Record<ContinentId, readonly CartoMapId[]>> = {
  "nexus-city": ["nexus-region", "nexus"], "neon-city": ["neon-city"], "verdant-forest": ["veridan", "riverdale", "old-harrow", "goldenreach"], thalassia: ["thalassia"],
  "frost-spire": ["frostspire", "frostveil"], "scorched-plains": ["solara"], wastelands: ["wastelands"], "crystal-badlands": ["crystal-badlands"],
  "storm-islands": ["storm"], "shattered-reefs": ["shattered-reefs", "azure-isles"], "ember-peaks": ["ember"], "shrouded-swamps": ["swamps"],
};

/** the camera's spin that faces a point: yaw about +Y and pitch, so the globe turns it to the front */
export function faceAngles(p: LatLon): { yaw: number; pitch: number } {
  return { yaw: rad(p.lon), pitch: rad(p.lat) };
}
