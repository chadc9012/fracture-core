/** Where each region sits on the illustrated "Fractured Earth" map (src/assets/fractured-earth-map-v2.jpg), as percentages of the image.
 * The art is a painting, not the terrain: it is used for the destination picker, where only the *region* matters. The in-game tactical map
 * (player position, mission markers) stays on the real terrain raster so it can never disagree with the world. */
export const MAP_ART_ASPECT = 1158 / 791;
export const MAP_ART_SPOTS: Readonly<Record<string, { x: number; y: number }>> = {
  veridan: { x: 19.7, y: 26.9 }, frostspire: { x: 55.1, y: 11.5 }, ember: { x: 19.9, y: 48.2 }, wastelands: { x: 45.4, y: 45.6 },
  solara: { x: 26.6, y: 72.2 }, swamps: { x: 64.3, y: 75 }, nexus: { x: 72.4, y: 51.2 },
};

/** Optional high-resolution master of the same painting. Drop a file at public/maps/fractured-earth-map-4096.jpg (same aspect as the bundled
 * 1158 x 791 art; 4096 px wide is the target) and the hub map uses it automatically; without it the bundled art is shown unchanged.
 * Nothing is upscaled: a missing or wrongly shaped file is simply ignored. */
export const MAP_ART_HIRES_URL = "/maps/fractured-earth-map-4096.jpg";
export const MAP_ART_HIRES_MIN_WIDTH = 2048;
/** A candidate replaces the bundled art only when it is genuinely larger and the same shape (within 1%), so nothing is stretched. */
export function hiresArtUsable(width: number, height: number): boolean {
  if (!(width >= MAP_ART_HIRES_MIN_WIDTH) || !(height > 0)) return false;
  return Math.abs(width / height / MAP_ART_ASPECT - 1) <= 0.01;
}

/** Decorative photo strips around the hub map frame (cropped from the concept picture; never terrain, never interactive). */
export interface MapStrip { id: string; caption: string; edge: "top" | "left" | "bottom"; aspect: number }
export const MAP_STRIPS: readonly MapStrip[] = [
  { id: "sunrise-veridan", caption: "Sunrise · Veridan Forest", edge: "top", aspect: 321 / 158 },
  { id: "sunset-nexus", caption: "Sunset · Nexus City", edge: "top", aspect: 315 / 158 },
  { id: "night-frostspire", caption: "Night · Frostspire Mountains", edge: "top", aspect: 329 / 158 },
  { id: "moonlight-fracture", caption: "Moonlight · Fracture Zone", edge: "top", aspect: 320 / 158 },
  { id: "trees", caption: "Trees", edge: "left", aspect: 141 / 91 },
  { id: "rocks", caption: "Rocks", edge: "left", aspect: 141 / 93 },
  { id: "ocean", caption: "Ocean", edge: "left", aspect: 141 / 92 },
  { id: "lake", caption: "Lake", edge: "left", aspect: 141 / 93 },
  { id: "volcano", caption: "Volcano", edge: "left", aspect: 141 / 113 },
  { id: "flowers", caption: "Flowers", edge: "left", aspect: 141 / 118 },
  { id: "day-solara", caption: "Day · Solara Desert", edge: "bottom", aspect: 317 / 229 },
  { id: "moon-frostspire", caption: "Moon · Frostspire Mountains", edge: "bottom", aspect: 332 / 229 },
  { id: "storm-ember", caption: "Storm · Ember Peaks", edge: "bottom", aspect: 296 / 229 },
  { id: "sunset-wastelands", caption: "Sunset · The Wastelands", edge: "bottom", aspect: 339 / 229 },
];
