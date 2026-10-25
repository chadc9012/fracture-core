/** Where Astravore's arena stands (Raid 01). Constants only, so terrain.ts, the lair and the arena scenery can share them without
 * an import cycle. The ground inside `r` is graded level (terrain.ts hollowStarWeight) and eases back to the land over `fade`.
 *
 * Raids are instances, never places on the world map (owner, Oct 25 2026: "you can't just walk up and start one"): the arena is
 * parked far outside the world disc in open ocean, where no road, coast or flight reaches it, and the only way in is launching
 * the raid from the director's Raid tab (raid-instances.ts). Lore-wise it is the bottom of the descent under Nexus City. */
export const HOLLOW_STAR_SITE = { x: -2600, z: 2600, r: 66, fade: 30 } as const;
