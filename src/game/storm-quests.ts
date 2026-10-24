/** Storm Islands gameplay (pure): the floating islands are standable ground, and the five quests in storm-islands.ts run
 * on it. Progress lives in progression.earnedRewards (`storm-obj:<quest>:<objective>`, union-merged so it is never lost),
 * and finishing a quest pays through the one reward path, rewardMission (`side-storm-…`, the side-contract rules).
 * The islands stay a secret sub-area: nothing about them shows until you have been within sight of the chain
 * (`storm:found`). Reaching them takes an aircraft, or the Sky Dock once found (a landing zone). */
import { STORM_ISLAND_QUESTS, STORM_ISLAND_SITES, stormSiteWorld, STORM_ISLANDS_CENTER, type StormIslandSite, type StormQuest } from "./storm-islands";
import { rewardMission, type PlayerProgression } from "./progression";
import type { MaterialId } from "./inventory";

/** walkable cap of each island (the grassy top StormIslands.tsx draws): centre, radius, surface height */
export const islandRadius = (site: StormIslandSite) => { const i = STORM_ISLAND_SITES.indexOf(site); return site.kind === "storm-core" ? 42 : site.kind === "temple" ? 35 : 24 + i * 2; };
export const islandTop = (site: StormIslandSite) => stormSiteWorld(site).y + 2.9;

/** the island surface under (x, z) for someone at height `feetY`: only when standing on or dropping onto it (never lifts a
 * boat or a diver up from the sea far below) */
export function stormGroundAt(x: number, z: number, feetY: number): number {
  for (const s of STORM_ISLAND_SITES) {
    const w = stormSiteWorld(s), top = islandTop(s);
    if (Math.hypot(x - w.x, z - w.z) <= islandRadius(s) * 0.96 && feetY >= top - 3) return top;
  }
  return -Infinity;
}
/** the island someone is standing on (within 4 m of its surface) */
export function stormSiteAt(x: number, z: number, feetY: number): StormIslandSite | null {
  for (const s of STORM_ISLAND_SITES) {
    const w = stormSiteWorld(s);
    if (Math.hypot(x - w.x, z - w.z) <= islandRadius(s) && Math.abs(feetY - islandTop(s)) < 4) return s;
  }
  return null;
}

export const FOUND_KEY = "storm:found";
export const SIGHT_RANGE = 900;
export const sighted = (x: number, z: number) => Math.hypot(x - STORM_ISLANDS_CENTER.x, z - STORM_ISLANDS_CENTER.z) <= SIGHT_RANGE;
export const islandsFound = (p: Pick<PlayerProgression, "earnedRewards">) => p.earnedRewards.includes(FOUND_KEY);
export const objKey = (q: string, o: string) => `storm-obj:${q}:${o}`;
export const stormMissionId = (q: string) => `side-${q}`;
/** the Sky Dock's landing point, a fast-travel drop once the islands are found */
export const SKY_DOCK_DROP = (() => { const s = STORM_ISLAND_SITES.find((x) => x.id === "sky-dock")!, w = stormSiteWorld(s); return { x: w.x - 6, z: w.z + 4, y: islandTop(s) + 1.6 }; })();

export type StormQuestStatus = { quest: StormQuest; state: "LOCKED" | "ACTIVE" | "DONE"; next: StormQuest["objectives"][number] | null; done: number };
const isDone = (p: Pick<PlayerProgression, "earnedRewards">, q: StormQuest) => q.objectives.every((o) => p.earnedRewards.includes(objKey(q.id, o.id)));
/** each quest: the chain unlocks one after the other; the side missions open after the first chain quest */
export function stormQuests(p: Pick<PlayerProgression, "earnedRewards">): StormQuestStatus[] {
  const found = islandsFound(p);
  return STORM_ISLAND_QUESTS.map((q) => {
    const prev = STORM_ISLAND_QUESTS.find((x) => x.nextQuestId === q.id);
    const open = found && (q.kind === "side-mission" ? isDone(p, STORM_ISLAND_QUESTS[0]!) : !prev || isDone(p, prev));
    const done = q.objectives.filter((o) => p.earnedRewards.includes(objKey(q.id, o.id))).length;
    const finished = done === q.objectives.length;
    return { quest: q, state: finished ? "DONE" : open ? "ACTIVE" : "LOCKED", next: finished ? null : q.objectives.find((o) => !p.earnedRewards.includes(objKey(q.id, o.id))) ?? null, done };
  });
}

/** guardian fight at the Thunder Nest: hostiles to defeat while standing on the nest */
export const NEST_KILLS = 6;
const PAY: Readonly<Record<string, Partial<Record<MaterialId, number>>>> = {
  "storm-01": { scrapMetal: 8, microCircuits: 3 }, "storm-02": { microCircuits: 5, dataShards: 2 }, "storm-03": { dataShards: 4, anomalyCarbon: 4 },
  "storm-side-01": { bioCatalyst: 4, thermalShards: 3 }, "storm-side-02": { dataShards: 3, anomalyCarbon: 2 },
};

export type StormContext = { site: string | null; action: "arrive" | "interact" | "kills"; nestKills?: number };
/** what an action on an island does: completes the matching objective of every active quest, pays a finished quest.
 * Returns the same progression when nothing changes. */
export function stormStep(p: PlayerProgression, ctx: StormContext, now = Date.now()): { progression: PlayerProgression; messages: string[] } {
  if (!ctx.site) return { progression: p, messages: [] };
  let next = p;
  const messages: string[] = [];
  for (const st of stormQuests(p)) {
    const o = st.next;
    if (st.state !== "ACTIVE" || !o || o.siteId !== ctx.site) continue;
    const ok = o.event === "discover" ? true : o.event === "defeat" ? ctx.action === "kills" && (ctx.nestKills ?? 0) >= NEST_KILLS : ctx.action === "interact";
    if (!ok) continue;
    next = { ...next, earnedRewards: [...next.earnedRewards, objKey(st.quest.id, o.id)] };
    messages.push(`${st.quest.title}: ${o.description} ✓`);
    if (isDone(next, st.quest)) { next = rewardMission(next, stormMissionId(st.quest.id), PAY[st.quest.id] ?? { scrapMetal: 6 }, now); messages.push(`${st.quest.title} complete`); }
  }
  return { progression: next, messages };
}
/** the prompt to show while standing on an island: the objective that needs a button press here, if any */
export function stormPrompt(p: Pick<PlayerProgression, "earnedRewards">, site: string | null): { quest: string; text: string } | null {
  if (!site) return null;
  for (const st of stormQuests(p)) if (st.state === "ACTIVE" && st.next && st.next.siteId === site && (st.next.event === "interact" || st.next.event === "recover")) return { quest: st.quest.title, text: st.next.description };
  return null;
}

/** the chain hangs past the world's rim: high above the sea near it is in bounds (Scene skips its rim clamp here), so an
 * aircraft can reach the islands and you can stand on them; low over the water you are clamped back like anywhere else */
export const STORM_AIRSPACE = { radius: 650, minY: 60 } as const;
export const inStormAirspace = (x: number, y: number, z: number) => y >= STORM_AIRSPACE.minY && Math.hypot(x - STORM_ISLANDS_CENTER.x, z - STORM_ISLANDS_CENTER.z) <= STORM_AIRSPACE.radius;
