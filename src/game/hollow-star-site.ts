/** Where Astravore's arena stands (Raid 01). Constants only, so terrain.ts, the lair and the arena scenery can share them without
 * an import cycle. The ground inside `r` is graded level (terrain.ts hollowStarWeight) and eases back to the land over `fade`. */
export const HOLLOW_STAR_SITE = { x: -180, z: -380, r: 66, fade: 30 } as const;
