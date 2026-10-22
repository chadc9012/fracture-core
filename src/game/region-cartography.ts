/** Director cartographic treatments. Pure presentation metadata: geography and spawn points stay in world data. */
export const REGION_CARTOGRAPHY: Record<string, { subtitle: string; accent: string; terrain: string; pattern: 'grid' | 'contour' | 'current' | 'ridge' | 'fracture' | 'dune' | 'marsh' }> = {
  nexus: { subtitle: 'Civic sectors and transit corridors', accent: '#8ddaff', terrain: 'Urban core', pattern: 'grid' },
  'neon-city': { subtitle: 'Vertical districts and neon transit', accent: '#e98aff', terrain: 'Metropolis', pattern: 'grid' },
  thalassia: { subtitle: 'Submerged districts · Verdant offshore', accent: '#5de9f8', terrain: 'Ocean floor', pattern: 'current' },
  veridan: { subtitle: 'Canopy routes and ancient woodland', accent: '#9be78a', terrain: 'Woodland', pattern: 'contour' },
  frostspire: { subtitle: 'Glacial passes and alpine ridges', accent: '#c2e7ff', terrain: 'Alpine', pattern: 'ridge' },
  ember: { subtitle: 'Volcanic escarpments and lava fields', accent: '#ff946d', terrain: 'Volcanic', pattern: 'fracture' },
  wastelands: { subtitle: 'Scarred highways and abandoned sites', accent: '#d7b9a2', terrain: 'Badlands', pattern: 'fracture' },
  solara: { subtitle: 'Dune passages and desert settlements', accent: '#f4cb70', terrain: 'Desert', pattern: 'dune' },
  swamps: { subtitle: 'Flooded paths and mistbound lowlands', accent: '#a4cf81', terrain: 'Wetlands', pattern: 'marsh' },
};
