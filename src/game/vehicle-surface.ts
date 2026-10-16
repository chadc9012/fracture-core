/** Ground grip under a vehicle (pure): road/concrete in the cities best, then grass/gravel, sand, snow, mud; ice on
 * high Frostspire ground. Steep slopes cut grip further. */
export type Surface = "ROAD" | "GRASS" | "GRAVEL" | "SAND" | "SNOW" | "ICE" | "MUD" | "WATER";
export const SURFACE_GRIP: Record<Surface, number> = { ROAD: 1, GRASS: 0.85, GRAVEL: 0.82, SAND: 0.7, SNOW: 0.62, MUD: 0.55, ICE: 0.35, WATER: 1 };

export function surfaceAt(regionId: string | undefined, height: number, waterLevel: number): Surface {
  if (height < waterLevel - 0.2) return "WATER";
  switch (regionId) {
    case "nexus": return "ROAD";
    case "solara": return "SAND";
    case "swamps": return "MUD";
    case "frostspire": return height > 40 ? "ICE" : "SNOW";
    case "ember": case "wastelands": return "GRAVEL";
    default: return "GRASS";
  }
}
export function surfaceGrip(s: Surface, slope: number) {
  return Math.max(0.2, SURFACE_GRIP[s] * (1 - Math.min(1, slope) * 0.6));
}
