/** Nemesis bosses (pure): an enemy that kills you is promoted. It gets a name, a rank, a strength and a weakness,
 * remembers where it beat you, and later ambushes you in its region. Killing it ends it unless it is a Survivor, which
 * comes back once, scarred and stronger. Each kill of a nemesis pays once per (id, life); dying to it ranks it up.
 *
 * Saved as `progression.nemeses` (merge by id: SLAIN wins, rank/kills/returns max). Scene/sim only spawn, tag and report;
 * every decision is here. Local single-player only. */
import type { MaterialId } from "./inventory";
import type { DamageElement } from "./scenario-gimmicks";

export type NemesisTrait = "IRON_HIDE" | "BRUTAL" | "SURVIVOR" | "FIRE_SCARRED" | "FROST_SCARRED" | "ARC_SCARRED" | "VENGEFUL";
export const TRAITS: Record<NemesisTrait, { label: string; text: string; kind: "strength" | "weakness" }> = {
  IRON_HIDE: { label: "Iron Hide", text: "+40% health", kind: "strength" },
  BRUTAL: { label: "Brutal", text: "Hits 30% harder", kind: "strength" },
  SURVIVOR: { label: "Survivor", text: "Comes back once after you kill it", kind: "strength" },
  VENGEFUL: { label: "Vengeful", text: "Gains two ranks when it kills you", kind: "strength" },
  FIRE_SCARRED: { label: "Fire-scarred", text: "Takes double damage from thermal", kind: "weakness" },
  FROST_SCARRED: { label: "Frost-scarred", text: "Takes double damage from cryo", kind: "weakness" },
  ARC_SCARRED: { label: "Arc-scarred", text: "Takes double damage from arc", kind: "weakness" },
};
const STRENGTHS: NemesisTrait[] = ["IRON_HIDE", "BRUTAL", "SURVIVOR", "VENGEFUL"];
const WEAKNESSES: NemesisTrait[] = ["FIRE_SCARRED", "FROST_SCARRED", "ARC_SCARRED"];
export const WEAK_ELEMENT: Partial<Record<NemesisTrait, DamageElement>> = { FIRE_SCARRED: "THERMAL", FROST_SCARRED: "CRYO", ARC_SCARRED: "ARC" };

export type Nemesis = {
  id: string; name: string; epithet: string; profile: string; regionId: string;
  rank: number; traits: NemesisTrait[];
  /** times it killed the player; times it came back */
  kills: number; returns: number;
  status: "ALIVE" | "SLAIN";
  createdAt: number; lastSeenAt: number;
  /** the line it opens with, built from how it last beat you */
  grudge: string;
};

export const MAX_RANK = 5, MAX_ALIVE = 6;
const NAMES = ["Krag", "Vesh", "Ultor", "Maro", "Sable", "Dregg", "Ister", "Koba", "Ravik", "Thane", "Oru", "Zell", "Brask", "Nyl", "Gorran", "Hask"];
const EPITHETS = ["the Unbroken", "Bone-Saw", "the Patient", "Ash-Tongue", "the Collector", "Red Mile", "the Echo", "Iron Jaw", "Ninefold", "the Quiet", "Wire-Hand", "the Last Shot"];

/** what the sim knows about the machine that landed the killing blow */
export type KillerSnapshot = { profile: string; zone: string; elite: boolean; boss: boolean; nemesis?: string | undefined };

const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

/** Who can become a nemesis: ordinary troops and elites (never bosses or scripted-mission machines, which have their own stories). */
export const canPromote = (k: KillerSnapshot | null | undefined): k is KillerSnapshot => !!k && !k.boss && !!k.profile && k.profile !== "Hostile";

/** The player died to `killer`. Returns the new list and what to announce. */
export function onPlayerKilled(list: readonly Nemesis[], killer: KillerSnapshot | null | undefined, regionName: string, now: number): { list: Nemesis[]; line: string | null } {
  if (!killer) return { list: [...list], line: null };
  if (killer.nemesis) {
    const n = list.find((x) => x.id === killer.nemesis && x.status === "ALIVE");
    if (!n) return { list: [...list], line: null };
    const up = n.traits.includes("VENGEFUL") ? 2 : 1;
    const next: Nemesis = { ...n, rank: Math.min(MAX_RANK, n.rank + up), kills: n.kills + 1, lastSeenAt: now, grudge: `Twice now${n.kills > 0 ? `, ${n.kills + 1} times` : ""}. ${regionName} is mine, Operator.` };
    return { list: list.map((x) => (x.id === n.id ? next : x)), line: `${n.name} ${n.epithet} grows stronger (rank ${next.rank})` };
  }
  if (!canPromote(killer)) return { list: [...list], line: null };
  if (list.filter((x) => x.status === "ALIVE").length >= MAX_ALIVE) return { list: [...list], line: null };
  const seed = hash(`${killer.profile}|${killer.zone}|${now}`);
  // names stay unique among nemeses you have met (alive or slain), so the map and alerts never show two "Ravik"s
  const taken = new Set(list.map((x) => x.name));
  let ni = seed % NAMES.length;
  for (let k = 0; k < NAMES.length && taken.has(NAMES[ni]!); k++) ni = (ni + 1) % NAMES.length;
  const name = NAMES[ni]!, epithet = EPITHETS[(seed >>> 8) % EPITHETS.length]!;
  const strength = STRENGTHS[(seed >>> 4) % STRENGTHS.length]!, weakness = WEAKNESSES[(seed >>> 12) % WEAKNESSES.length]!;
  const n: Nemesis = {
    id: `nem-${now.toString(36)}-${(seed % 1679616).toString(36)}`, name, epithet, profile: killer.profile, regionId: killer.zone,
    rank: killer.elite ? 2 : 1, traits: [strength, weakness], kills: 1, returns: 0, status: "ALIVE", createdAt: now, lastSeenAt: now,
    grudge: `Remember me? ${regionName}. You went down hard.`,
  };
  return { list: [...list, n], line: `A ${killer.profile} who killed you has become a nemesis: ${name} ${epithet}` };
}

/** The player killed a nemesis. A Survivor comes back once (scarred, +1 rank); everyone else is slain for good. */
export function onNemesisKilled(list: readonly Nemesis[], id: string, now: number): { list: Nemesis[]; line: string | null; slain: Nemesis | null; returned: boolean } {
  const n = list.find((x) => x.id === id && x.status === "ALIVE");
  if (!n) return { list: [...list], line: null, slain: null, returned: false };
  if (n.traits.includes("SURVIVOR") && n.returns === 0) {
    const back: Nemesis = { ...n, returns: 1, rank: Math.min(MAX_RANK, n.rank + 1), traits: n.traits.filter((t) => t !== "SURVIVOR"), lastSeenAt: now, grudge: "You thought that was the end? Look at what you did to my face." };
    return { list: list.map((x) => (x.id === id ? back : x)), line: `${n.name} ${n.epithet} crawled away. It will be back.`, slain: n, returned: true };
  }
  const dead: Nemesis = { ...n, status: "SLAIN", lastSeenAt: now };
  return { list: list.map((x) => (x.id === id ? dead : x)), line: `${n.name} ${n.epithet} is dead.`, slain: n, returned: false };
}

/** Combat numbers for a nemesis of this rank (applied by sim at spawn and by hurtPlayer / damage mods). */
export function nemesisStats(n: Pick<Nemesis, "rank" | "traits">): { hp: number; damage: number; scale: number } {
  const hp = 8 * (1 + 0.6 * (n.rank - 1)) * (n.traits.includes("IRON_HIDE") ? 1.4 : 1);
  return { hp, damage: (1 + 0.15 * (n.rank - 1)) * (n.traits.includes("BRUTAL") ? 1.3 : 1), scale: 1.5 + 0.12 * n.rank };
}
export const weaknessMult = (n: Pick<Nemesis, "traits"> | undefined, element: DamageElement | undefined) =>
  n && element && n.traits.some((t) => WEAK_ELEMENT[t] === element) ? 2 : 1;

/** Reward for killing it (once per id and life): scales with rank. */
export function nemesisReward(n: Pick<Nemesis, "rank">): { materials: Partial<Record<MaterialId, number>>; shards: number } {
  const materials: Partial<Record<MaterialId, number>> = { reinforcedAlloy: 2 * n.rank, dataShards: n.rank };
  if (n.rank >= 3) materials.forgeCatalyst = 1;
  if (n.rank >= 5) materials.fractureCore = 1;
  return { materials, shards: 40 * n.rank };
}
export const rewardKey = (n: Pick<Nemesis, "id" | "returns">, life: number) => `nemesis:${n.id}:${life}`;

/* ------------------------------------------------------------ ambush timing ------------------------------------------------------------ */
/** seconds the player must spend in the region (out of missions) before the nemesis shows, and between ambushes */
export const AMBUSH_AFTER = 60, AMBUSH_COOLDOWN = 240;
/** The nemesis that should ambush now, or null. Highest rank first; a map drop to its activity sets `summoned` and skips the wait. */
export function ambushDue(list: readonly Nemesis[], regionId: string | null, secondsInRegion: number, sinceLastAmbush: number, summoned: string | null): Nemesis | null {
  if (!regionId) return null;
  const here = list.filter((n) => n.status === "ALIVE" && n.regionId === regionId).sort((a, b) => b.rank - a.rank);
  const forced = summoned ? here.find((n) => n.id === summoned) : undefined;
  if (forced && secondsInRegion > 4) return forced;
  if (!here.length || secondsInRegion < AMBUSH_AFTER || sinceLastAmbush < AMBUSH_COOLDOWN) return null;
  return here[0]!;
}

/* ------------------------------------------------------------ save ------------------------------------------------------------ */
const TRAIT_IDS = Object.keys(TRAITS) as NemesisTrait[];
export function normalizeNemeses(raw: unknown): Nemesis[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): Nemesis[] => {
    if (!r || typeof r !== "object") return [];
    const n = r as Partial<Nemesis>;
    if (typeof n.id !== "string" || typeof n.name !== "string" || typeof n.regionId !== "string") return [];
    return [{
      id: n.id, name: n.name, epithet: typeof n.epithet === "string" ? n.epithet : "", profile: typeof n.profile === "string" ? n.profile : "Hostile", regionId: n.regionId,
      rank: Math.max(1, Math.min(MAX_RANK, Number(n.rank) || 1)), traits: Array.isArray(n.traits) ? n.traits.filter((t): t is NemesisTrait => TRAIT_IDS.includes(t as NemesisTrait)) : [],
      kills: Math.max(0, Number(n.kills) || 0), returns: Math.max(0, Number(n.returns) || 0), status: n.status === "SLAIN" ? "SLAIN" : "ALIVE",
      createdAt: Number(n.createdAt) || 0, lastSeenAt: Number(n.lastSeenAt) || 0, grudge: typeof n.grudge === "string" ? n.grudge : "",
    }];
  });
}
/** merge by id: SLAIN wins, higher rank/kills/returns win, the copy seen last keeps its words and traits */
export function mergeNemeses(a: readonly Nemesis[], b: readonly Nemesis[]): Nemesis[] {
  const out = new Map<string, Nemesis>();
  for (const n of [...a, ...b]) {
    const o = out.get(n.id);
    if (!o) { out.set(n.id, n); continue; }
    const newer = n.lastSeenAt >= o.lastSeenAt ? n : o;
    out.set(n.id, { ...newer, status: o.status === "SLAIN" || n.status === "SLAIN" ? "SLAIN" : "ALIVE", rank: Math.max(o.rank, n.rank), kills: Math.max(o.kills, n.kills), returns: Math.max(o.returns, n.returns) });
  }
  return [...out.values()];
}

/* ------------------------------------------------------------ progression glue ------------------------------------------------------------ */
type NemesisSave = { nemeses: Nemesis[]; earnedRewards: string[]; materials: Partial<Record<MaterialId, number>>; fractureShards: number };
/** The player died to `killer`: promote it or rank it up. */
export function applyPlayerDeath<P extends NemesisSave>(p: P, killer: KillerSnapshot, regionName: string, now: number): { progression: P; line: string | null } {
  const r = onPlayerKilled(p.nemeses ?? [], killer, regionName, now);
  return { progression: r.line ? { ...p, nemeses: r.list } : p, line: r.line };
}
/** The player killed a nemesis: end it (or let a Survivor crawl away) and pay once per id and life. */
export function applyNemesisKill<P extends NemesisSave>(p: P, id: string, now: number): { progression: P; line: string | null } {
  const before = (p.nemeses ?? []).find((n) => n.id === id && n.status === "ALIVE");
  if (!before) return { progression: p, line: null };
  const r = onNemesisKilled(p.nemeses, id, now);
  const key = rewardKey(before, before.returns);
  if (p.earnedRewards.includes(key)) return { progression: { ...p, nemeses: r.list }, line: r.line };
  const pay = nemesisReward(before);
  const materials = { ...p.materials };
  for (const [k, v] of Object.entries(pay.materials) as [MaterialId, number][]) materials[k] = (materials[k] ?? 0) + v;
  const paid = Object.entries(pay.materials).map(([k, v]) => `+${v} ${k}`).join(", ");
  return { progression: { ...p, nemeses: r.list, materials, fractureShards: p.fractureShards + pay.shards, earnedRewards: [...p.earnedRewards, key] }, line: `${r.line} ${paid}, +${pay.shards} shards` };
}
