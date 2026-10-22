/** Campaign structure (pure data + one progress function): the five-act story from the owner's campaign document, with
 * every designed mission mapped onto the chapter that is actually playable today, or marked planned. The Campaign tab in
 * the Character screen draws this; nothing here completes a mission or pays anything. Honest by design: a planned mission
 * says so instead of pretending to exist. */
import type { PlayerProgression } from "./progression";
import { endingTierFor, type EndingTier } from "./endings";

export type CampaignMission = { n: number; title: string; region: string; playable: string | null; note?: string };
export type CampaignAct = { id: string; title: string; goal: string; missions: CampaignMission[] };

export const CAMPAIGN: readonly CampaignAct[] = [
  { id: "prologue", title: "Prologue: The Day Reality Died", goal: "The Fracture begins", missions: [{ n: 0, title: "First Resonance", region: "Verdant Forest", playable: "mission-01", note: "The playable opening" }] },
  { id: "act-1", title: "Act I: Awakening", goal: "Discover your Resonance and NOVA", missions: [
    { n: 1, title: "Awakening", region: "Nexus City", playable: "awakening" },
    { n: 2, title: "Broken Signal", region: "Nexus City", playable: "broken-signal" },
    { n: 3, title: "The Survivors", region: "Neon City", playable: null, note: "Living World contracts cover the survivors for now" },
    { n: 4, title: "The Blackout", region: "Nexus City", playable: "blackout-protocol" },
  ] },
  { id: "act-2", title: "Act II: War Expands", goal: "Expose the factions' hidden connections", missions: [
    { n: 5, title: "The Aegis Spire", region: "Neon City", playable: null },
    { n: 6, title: "The Stitched City", region: "Neon City", playable: "stitched-neon-core" },
    { n: 7, title: "The Wasteland Crown", region: "The Wastelands", playable: "convoy-breaker" },
    { n: 8, title: "The Ember Signal", region: "Ember Peaks", playable: "failure-core" },
  ] },
  { id: "act-3", title: "Act III: The Drowned Truth", goal: "Discover what caused the disaster", missions: [
    { n: 9, title: "Descent Protocol", region: "Thalassia", playable: "descent-protocol" },
    { n: 10, title: "The Silent Archive", region: "Thalassia", playable: null },
    { n: 11, title: "The Frozen Memory", region: "Frostspire Mountains", playable: "frozen-beacon" },
    { n: 12, title: "The Shrouded Signal", region: "Shrouded Swamps", playable: "drowned-relay" },
  ] },
  { id: "act-4", title: "Act IV: The System War", goal: "Unite the factions and stop convergence", missions: [
    { n: 13, title: "No Safe Ground", region: "Nexus City", playable: null },
    { n: 14, title: "The Broken Crown", region: "The Wastelands", playable: null, note: "The Hollow Crown and Vael's forge stand where it will happen" },
    { n: 15, title: "The Fractured Moon", region: "Fractured Moon", playable: null },
    { n: 16, title: "The Last Alliance", region: "Neon City", playable: null, note: "The Neon pledge already records your side" },
  ] },
  { id: "act-5", title: "Act V: The Core Breach", goal: "Defeat the Convergence Engine", missions: [
    { n: 17, title: "The Breach", region: "Core Zone", playable: "solar-array", note: "Solar Array Alpha opens the road to the core" },
    { n: 18, title: "Split Paths", region: "Core Zone", playable: "core-node", note: "Your faction choice here decides the ending" },
    { n: 19, title: "The Adaptive War", region: "Core Zone", playable: null },
    { n: 20, title: "The Convergence Engine", region: "Core Zone", playable: "system-core" },
  ] },
];

export const ENDINGS: Record<EndingTier, { title: string; text: string }> = {
  CONTROL: { title: "Control", text: "The Engine is held, the world is stabilised, and someone now decides what reality is allowed to be." },
  CHAOS: { title: "Chaos", text: "The Engine breaks and takes the old order with it. Freedom, at the price of a world that never settles." },
  BALANCE: { title: "Balance (true ending)", text: "The Engine is shut down without being owned. The world stays broken, but it stays yours." },
};

export function campaignProgress(p: Pick<PlayerProgression, "completedMissions" | "corruptionLevel" | "story">) {
  const all = CAMPAIGN.flatMap((a) => a.missions);
  const done = (m: CampaignMission) => !!m.playable && p.completedMissions.includes(m.playable);
  return {
    acts: CAMPAIGN.map((a) => ({ act: a, done: a.missions.filter(done).length, playable: a.missions.filter((m) => m.playable).length, total: a.missions.length })),
    done: all.filter(done).length, playable: all.filter((m) => m.playable).length, total: all.length,
    ending: endingTierFor(p),
  };
}
