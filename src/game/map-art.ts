/** Where each region sits on the illustrated "Fractured Earth" map (src/assets/fractured-earth-map-v2.jpg), as percentages of the image.
 * The art is a painting, not the terrain: it is used for the destination picker, where only the *region* matters. The in-game tactical map
 * (player position, mission markers) stays on the real terrain raster so it can never disagree with the world. */
export const MAP_ART_ASPECT = 1158 / 791;
export const MAP_ART_SPOTS: Readonly<Record<string, { x: number; y: number }>> = {
  veridan: { x: 19.7, y: 26.9 }, frostspire: { x: 55.1, y: 11.5 }, ember: { x: 19.9, y: 48.2 }, wastelands: { x: 45.4, y: 45.6 },
  solara: { x: 26.6, y: 72.2 }, swamps: { x: 64.3, y: 75 }, nexus: { x: 72.4, y: 51.2 },
};
