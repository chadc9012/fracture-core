/** The world's history: what happened before the story began. Pure data + lookups. Landmarks carry the local
 * detail (landmarks.ts); this file is the spine they hang from and the text the atlas shows. Reading or
 * discovering story text never grants rewards or sets quest flags. */
import { LANDMARKS, isLandmarkKnown, landmarksIn, type Landmark } from "./landmarks";
import type { PlayerProgression } from "./progression";

export interface Era { id: string; name: string; summary: string }

export const ERAS: Era[] = [
  { id: "before", name: "Before the Fracture", summary: "A connected coast of trade cities, survey crews and Foundry works, held together by the Aether grid." },
  { id: "fracture", name: "The Fracture", summary: "The grid failed everywhere at once. The sky split, ground tore along seams, and each biome was bent by a different tear." },
  { id: "after", name: "The Long Quiet", summary: "Survivors gathered in the Nexus. Outposts went silent, machines kept running, and the regions drifted apart." },
];

export const REGION_HISTORY: Record<string, string> = {
  nexus: "Refugees raised the Nexus around the old transit plaza. It is the only place the grid still answers.",
  veridan: "Survey crews entered Veridan to map the tears. The forest closed behind them.",
  ember: "The Foundry Guild's forges woke the mountain. Its fire now does the work of the guild.",
  frostspire: "The summit array answered the Fracture signal and froze the peaks around it.",
  wastelands: "Supply roads from the coast were cut and re-cut by raiders, salvagers and convoys.",
  solara: "The mirror fields still gather light after the cities under them went dark.",
  swamps: "The coast flooded, and the water carries echoes of what was lost beneath it.",
};

export const regionHistory = (regionId: string): string => REGION_HISTORY[regionId] ?? "";

export interface StoryEntry { landmark: Landmark; known: boolean }

/** Lore for a region, with each landmark's history hidden until discovered (unknown ones show only a placeholder name). */
export function regionStory(p: Pick<PlayerProgression, "earnedRewards">, regionId: string): StoryEntry[] {
  return landmarksIn(regionId).map((landmark) => ({ landmark, known: isLandmarkKnown(p, landmark.id) }));
}

export const discoveredCount = (p: Pick<PlayerProgression, "earnedRewards">) => LANDMARKS.filter((l) => isLandmarkKnown(p, l.id)).length;
