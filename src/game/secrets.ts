/** Living Secret World (pure): hidden things that only answer under the right conditions — at night, in a storm, after
 * you have killed a nemesis, once you have pledged in Neon City — plus the three Forgewright fragments that lead to the
 * Hollow Crown (godforge.ts). Nothing is marked on the map: NOVA hums when you are close, a faint shimmer shows within
 * reach, and the find pays once (ledger `secret:<id>` in earnedRewards, union-merged). Lore goes to story collectibles.
 * Scene feeds position + conditions through living-runtime; this module decides. */
import { REGIONS } from "./world";
import type { MaterialId } from "./inventory";

export type SecretCondition = "ALWAYS" | "NIGHT" | "STORM" | "NEMESIS_SLAIN" | "PLEDGED" | "FRAGMENTS";
export type Secret = {
  id: string; regionId: string; name: string;
  /** position as a fraction of the region radius from its centre (north = −z) */
  fx: number; fz: number;
  condition: SecretCondition;
  /** what NOVA says when you are near but the condition does not hold */
  locked: string;
  lore: string;
  reward: Partial<Record<MaterialId, number>>; shards: number;
};

export const CONDITION_TEXT: Record<SecretCondition, string> = {
  ALWAYS: "", NIGHT: "Only at night", STORM: "Only in a storm", NEMESIS_SLAIN: "After you kill a nemesis", PLEDGED: "After you pledge in Neon City", FRAGMENTS: "After all three Forgewright fragments",
};

export const SECRETS: readonly Secret[] = [
  // the Forgewright's mark (godforge.ts stage I): one in each of the three hardest regions
  { id: "forge-mark-1", regionId: "frostspire", name: "Forgewright's Mark: Ice", fx: -0.42, fz: 0.31, condition: "ALWAYS", locked: "", lore: "A hammer-and-crown sigil cut into blue ice. Beneath it: \"The fire went down, not out.\"", reward: { cryoCrystal: 3 }, shards: 30 },
  { id: "forge-mark-2", regionId: "ember", name: "Forgewright's Mark: Ash", fx: 0.36, fz: -0.4, condition: "ALWAYS", locked: "", lore: "The same sigil, fused into obsidian. \"Three marks to find the door. The Crown sleeps under the broken ground.\"", reward: { thermalShards: 3 }, shards: 30 },
  { id: "forge-mark-3", regionId: "wastelands", name: "Forgewright's Mark: Rust", fx: -0.3, fz: -0.45, condition: "ALWAYS", locked: "", lore: "Scratched into a pre-war blast door. \"Vael kept the last forge. Bring the Heart and she will open it.\"", reward: { scrapMetal: 10 }, shards: 30 },
  // conditional finds
  { id: "moon-shrine", regionId: "veridan", name: "Moonlit Shrine", fx: 0.5, fz: 0.2, condition: "NIGHT", locked: "NOVA: Something here only wakes under the moon.", lore: "A ring of standing stones that hums with Resonance at night. Someone left an offering for the Operators who never came back.", reward: { sporeFiber: 4, tuningCore: 1 }, shards: 40 },
  { id: "storm-relay", regionId: "solara", name: "Storm Relay", fx: -0.5, fz: 0.25, condition: "STORM", locked: "NOVA: A dead relay. It would need a lot of power to wake.", lore: "The lightning wakes an Authority relay long enough to play one message: \"Containment was never the goal.\"", reward: { anomalyCarbon: 4, dataShards: 3 }, shards: 50 },
  { id: "trophy-cairn", regionId: "wastelands", name: "Trophy Cairn", fx: 0.45, fz: 0.35, condition: "NEMESIS_SLAIN", locked: "NOVA: Raider trophies. They only respect someone who has killed one of their champions.", lore: "Helmets of fallen raider champions. Yours is the newest name scratched under them.", reward: { reinforcedAlloy: 5, forgeCatalyst: 1 }, shards: 60 },
  { id: "drowned-bell", regionId: "swamps", name: "Drowned Bell", fx: 0.2, fz: -0.5, condition: "NIGHT", locked: "NOVA: A bell under the water. It rings at night, they say.", lore: "The bell rings once as you touch it. Somewhere far below, something in Thalassia answers.", reward: { bioCatalyst: 3 }, shards: 40 },
  { id: "syndicate-ledger", regionId: "nexus", name: "Undercity Ledger", fx: 0.2, fz: 0.6, condition: "PLEDGED", locked: "NOVA: A locked ledger. Only someone sworn to a Neon faction would know the code.", lore: "A ledger of who the Syndicate and the Directorate both pay. The same name is on both sides: the Fuel King.", reward: { microCircuits: 6, dataShards: 4 }, shards: 50 },
];
export const secretById = (id: string) => SECRETS.find((s) => s.id === id);
export function secretPoint(s: Pick<Secret, "regionId" | "fx" | "fz">) {
  const r = REGIONS.find((x) => x.id === s.regionId)!;
  return { x: r.x + s.fx * r.radius, z: r.z + s.fz * r.radius };
}
export const SECRET_REACH = 4, SECRET_HUM = 60, SECRET_SHIMMER = 25;
export const secretKey = (id: string) => `secret:${id}`;
export const FORGE_MARKS = ["forge-mark-1", "forge-mark-2", "forge-mark-3"] as const;

export type SecretContext = { night: boolean; storm: boolean; nemesisSlain: boolean; pledged: boolean; earned: readonly string[] };
export function conditionHolds(c: SecretCondition, ctx: SecretContext): boolean {
  switch (c) {
    case "ALWAYS": return true;
    case "NIGHT": return ctx.night;
    case "STORM": return ctx.storm;
    case "NEMESIS_SLAIN": return ctx.nemesisSlain;
    case "PLEDGED": return ctx.pledged;
    case "FRAGMENTS": return FORGE_MARKS.every((m) => ctx.earned.includes(secretKey(m)));
  }
}

/** What the player senses at (x,z): the nearest unfound secret within hum range, whether it is in reach and whether it answers now. */
export function senseSecret(x: number, z: number, ctx: SecretContext): { secret: Secret; dist: number; open: boolean } | null {
  let best: { secret: Secret; dist: number; open: boolean } | null = null;
  for (const s of SECRETS) {
    if (ctx.earned.includes(secretKey(s.id))) continue;
    const p = secretPoint(s), d = Math.hypot(x - p.x, z - p.z);
    if (d > SECRET_HUM || (best && d >= best.dist)) continue;
    best = { secret: s, dist: d, open: conditionHolds(s.condition, ctx) };
  }
  return best;
}

type SecretSave = { earnedRewards: string[]; materials: Partial<Record<MaterialId, number>>; fractureShards: number; story: { collectibles: string[] } };
/** Claim a secret (once). Refuses when it is not answering yet. */
export function claimSecret<P extends SecretSave>(p: P, id: string, ctx: Omit<SecretContext, "earned">): { progression: P; message: string } | { error: string } {
  const s = secretById(id);
  if (!s) return { error: "Nothing here" };
  if (p.earnedRewards.includes(secretKey(id))) return { error: "Already found" };
  if (!conditionHolds(s.condition, { ...ctx, earned: p.earnedRewards })) return { error: s.locked || CONDITION_TEXT[s.condition] };
  const materials = { ...p.materials };
  for (const [k, v] of Object.entries(s.reward) as [MaterialId, number][]) materials[k] = (materials[k] ?? 0) + v;
  const collectibles = p.story.collectibles.includes(`secret:${id}`) ? p.story.collectibles : [...p.story.collectibles, `secret:${id}`];
  return {
    progression: { ...p, materials, fractureShards: p.fractureShards + s.shards, earnedRewards: [...p.earnedRewards, secretKey(id)], story: { ...p.story, collectibles } },
    message: `Secret found: ${s.name}. ${s.lore}`,
  };
}
export const secretsFound = (p: { earnedRewards: readonly string[] }) => SECRETS.filter((s) => p.earnedRewards.includes(secretKey(s.id))).length;
