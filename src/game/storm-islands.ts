/** Storm Islands is an optional hidden sub-area, not a tenth destination (uploaded storm-islands quest foundation +
 * world pass, 2026-10-23). The chain floats over the north-east ocean at STORM_ISLANDS_CENTER; site positions are
 * offsets from it (y is absolute height). StormIslands.tsx builds the islands; the quests below are data only until
 * they are wired into the mission events.
 * This module defines discovery points and quest content without creating a
 * competing progression/reward pipeline. Quest completion must be routed through
 * the existing mission/quest events when the area is wired into gameplay. */
export type StormIslandSite = {
  id: string; name: string; position: readonly [number, number, number];
  kind: 'landing' | 'ruins' | 'outpost' | 'temple' | 'storm-core' | 'nest';
  description: string;
};
export const STORM_ISLAND_SITES: readonly StormIslandSite[] = [
  { id: 'sky-dock', name: 'Broken Sky Dock', position: [0, 120, 0], kind: 'landing', description: 'A battered airship platform and the first safe landing.' },
  { id: 'signal-spire', name: 'Signal Spire', position: [180, 155, -110], kind: 'outpost', description: 'A storm-blinded navigation relay.' },
  { id: 'windward-ruins', name: 'Windward Ruins', position: [-220, 185, -70], kind: 'ruins', description: 'Ancient masonry suspended by unknown forces.' },
  { id: 'thunder-nest', name: 'Thunder Nest', position: [-80, 215, 260], kind: 'nest', description: 'Territory of dangerous stormborne creatures.' },
  { id: 'aether-temple', name: 'Aether Temple', position: [310, 265, 130], kind: 'temple', description: 'The original weather-control sanctuary.' },
  { id: 'eye-of-storm', name: 'Eye of the Storm', position: [30, 320, 410], kind: 'storm-core', description: 'The unstable heart of the island chain.' },
] as const;

export type StormObjective = { id: string; description: string; siteId: string; event: 'discover' | 'interact' | 'defeat' | 'recover' };
export type StormQuest = {
  id: string; title: string; kind: 'main-side-chain' | 'side-mission';
  synopsis: string; objectives: readonly StormObjective[];
  nextQuestId?: string; rewardNote: string;
};
export const STORM_ISLAND_QUESTS: readonly StormQuest[] = [
  { id: 'storm-01', title: 'The Missing Convoy', kind: 'main-side-chain', synopsis: 'Follow the final beacon of a lost airship convoy.', objectives: [
    { id: 'locate-dock', description: 'Find the Broken Sky Dock', siteId: 'sky-dock', event: 'discover' },
    { id: 'recover-manifest', description: 'Recover the flight manifest', siteId: 'sky-dock', event: 'recover' },
  ], nextQuestId: 'storm-02', rewardNote: 'Existing shard/material reward pipeline; amount pending balance.' },
  { id: 'storm-02', title: 'Silence the Static', kind: 'main-side-chain', synopsis: 'Restore the relay before the next storm front.', objectives: [
    { id: 'reach-spire', description: 'Reach the Signal Spire', siteId: 'signal-spire', event: 'discover' },
    { id: 'repair-relay', description: 'Repair the storm relay', siteId: 'signal-spire', event: 'interact' },
  ], nextQuestId: 'storm-03', rewardNote: 'Existing shard/material reward pipeline; amount pending balance.' },
  { id: 'storm-03', title: 'Heart of the Tempest', kind: 'main-side-chain', synopsis: 'Trace the ancient weather engine to its source.', objectives: [
    { id: 'temple', description: 'Explore the Aether Temple', siteId: 'aether-temple', event: 'discover' },
    { id: 'stabilize', description: 'Stabilize the Eye of the Storm', siteId: 'eye-of-storm', event: 'interact' },
  ], rewardNote: 'Unique cosmetic and existing progression rewards; implementation pending.' },
  { id: 'storm-side-01', title: 'Feathers of Thunder', kind: 'side-mission', synopsis: 'Investigate aggressive stormborne wildlife.', objectives: [
    { id: 'find-nest', description: 'Find the Thunder Nest', siteId: 'thunder-nest', event: 'discover' },
    { id: 'clear-nest', description: 'Defeat the nest guardian', siteId: 'thunder-nest', event: 'defeat' },
  ], rewardNote: 'Existing material reward pipeline; implementation pending.' },
  { id: 'storm-side-02', title: 'Echoes Above the Clouds', kind: 'side-mission', synopsis: 'Recover records of the islands before the Fracture.', objectives: [
    { id: 'ruins', description: 'Search the Windward Ruins', siteId: 'windward-ruins', event: 'discover' },
    { id: 'archive', description: 'Recover the ancient archive', siteId: 'windward-ruins', event: 'recover' },
  ], rewardNote: 'Lore archive and existing shard reward pipeline; implementation pending.' },
] as const;

export function stormQuestById(id: string): StormQuest | undefined {
  return STORM_ISLAND_QUESTS.find(q => q.id === id);
}
export function stormSiteById(id: string): StormIslandSite | undefined {
  return STORM_ISLAND_SITES.find(site => site.id === id);
}

/** where the chain floats: open ocean north-east of Nexus City, in sight of the coast */
export const STORM_ISLANDS_CENTER = { x: 980, z: -700 } as const;
export const stormSiteWorld = (s: StormIslandSite) => ({ x: STORM_ISLANDS_CENTER.x + s.position[0], y: s.position[1], z: STORM_ISLANDS_CENTER.z + s.position[2] });
