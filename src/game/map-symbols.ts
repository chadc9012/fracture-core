/** One glyph table for every map surface (atlas pins, filter chips, legend, compass tracker), so the legend can never describe a symbol the map does not draw.
 * Live markers (MarkerKind) and landmark types use different glyphs on purpose: the weapon-evolution ruin marker is ✦, an ancient-ruin landmark is ⌂. */
import type { MarkerKind } from "./waypoints";
import type { LandmarkType } from "./landmarks";

export const MARKER_GLYPH: Record<MarkerKind, string> = { MISSION: "◆", RESOURCE: "⬢", BOSS: "☠", RUIN: "✦", LANDMARK: "▣" };
export const MARKER_NAME: Record<MarkerKind, string> = { MISSION: "Mission signal", RESOURCE: "Resource node", BOSS: "Boss lair", RUIN: "Weapon ruin", LANDMARK: "Landmark" };

export const LANDMARK_GLYPH: Record<LandmarkType, string> = {
  hub: "◉", outpost: "▣", ruin: "⌂", mountain: "▲", volcano: "◭", lake: "◒", river: "≈", forest: "♣", desert: "∴", ocean: "≋", hazard: "⚠", resource: "⬢",
};
export const LANDMARK_NAME: Record<LandmarkType, string> = {
  hub: "City / hub", outpost: "Outpost", ruin: "Ancient ruin", mountain: "Mountain", volcano: "Volcano", lake: "Lake", river: "River / highway", forest: "Forest", desert: "Desert", ocean: "Ocean", hazard: "Hazard zone", resource: "Resource landmark",
};
/** Landmark types that actually exist in the data, in legend order (types nothing uses are not listed). */
export function legendLandmarkTypes(used: readonly LandmarkType[]): LandmarkType[] {
  const order: LandmarkType[] = ["hub", "outpost", "resource", "volcano", "mountain", "river", "lake", "forest", "desert", "ocean", "ruin", "hazard"];
  return order.filter((t) => used.includes(t));
}
