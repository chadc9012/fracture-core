/** Which ending plays when fd-18 (The System Core) completes. The allegiance chosen in the Core Node
 * (missions/core-node.ts, story choice "faction") decides it; saves that never made that choice fall
 * back to the original rule, read off progression.corruptionLevel. Pure so it can be tested. */
import { factionOf, type Faction } from "./missions/core-node";
import type { PlayerProgression } from "./progression";

export type EndingTier = "CONTROL" | "CHAOS" | "BALANCE";

export const ENDING_FOR_FACTION: Record<Faction, EndingTier> = { controllers: "CONTROL", breakers: "CHAOS", resonants: "BALANCE" };

export function endingTierFor(progression: Pick<PlayerProgression, "corruptionLevel" | "story">): EndingTier {
  const faction = factionOf(progression.story);
  if (faction) return ENDING_FOR_FACTION[faction];
  if (progression.corruptionLevel < 35) return "CONTROL";
  if (progression.corruptionLevel > 65) return "CHAOS";
  return "BALANCE";
}

/** Aftermath lines under the ending: what the chosen side does with the world, and what becomes of NOVA
 * (her trust from the Core Node reveal). Empty for saves that never reached the reveal. */
const FACTION_AFTERMATH: Record<Faction, string> = {
  controllers: "The Controllers raise walls around every stable zone and call it peace. The fractures stop spreading. Nothing new grows in them either.",
  breakers: "The Breakers pour through the open seams. Within a season no map of the world is right for more than a week, and nobody wants it any other way.",
  resonants: "The Resonants walk the old fracture lines and listen. Where they stop, the layers settle into something that has never existed before.",
};

export function aftermathFor(progression: Pick<PlayerProgression, "story">): string[] {
  const faction = factionOf(progression.story);
  if (!faction) return [];
  // trust is clamped at 0, so "told her she lied" with no other warmth leaves it recorded at exactly 0
  const trust = progression.story?.trust["nova"];
  const nova = trust !== undefined && trust >= 10
    ? "NOVA stays. Whatever the Core became, a small part of it still answers when you call her name."
    : trust === 0
      ? "NOVA goes quiet after the Core. Some nights the comms crackle like she's about to say something, and then she doesn't."
      : "NOVA goes back into the Core to keep it steady. She leaves you a message: thank you for carrying it.";
  return [FACTION_AFTERMATH[faction], nova];
}
