/** World Boss raids (owner's world-boss brief, Oct 25: massive cross-biome boss raids where the factions unite against a regional
 * titan). On a fixed real-time schedule a region's boss rises as an empowered World Boss at an open site in that region; it
 * stays up for its window, the whole map is told where, and killing it pays a raid-sized purse once per raid.
 *
 * Pure schedule and rewards; Scene summons the boss (sim.summonBoss) when you come near during the window, tags it, and
 * reports the kill; GameCanvas pays through the ledger key `worldboss:<raid id>` so a raid never pays twice, even across
 * cloud merges. Deterministic from the clock, so every device agrees which raid is up. */
import type { MaterialId } from "./inventory";

/** a raid every PERIOD minutes, live for WINDOW minutes */
export const WORLD_BOSS = { periodMin: 40, windowMin: 15, /** health multiplier over the region boss */ hpScale: 4, /** come this close to wake it (m) */ wakeRange: 140 } as const;

export type RaidSite = { region: string; name: string; boss: string; /** fraction of the region radius from its centre, and bearing (rad) */ out: number; bearing: number };
/** where each region's titan rises (open ground away from the region centre's set pieces) */
export const RAID_SITES: readonly RaidSite[] = [
  { region: "wastelands", name: "Grid-Iron Flats", boss: "The Rust Colossus", out: 0.55, bearing: 2.4 },
  { region: "veridan", name: "Old-Growth Hollow", boss: "The Verdant Effigy", out: 0.5, bearing: 0.9 },
  { region: "frostspire", name: "Whiteout Shelf", boss: "The Frost Titan", out: 0.55, bearing: 3.6 },
  { region: "ember", name: "Caldera Rim", boss: "The Magma Overseer", out: 0.5, bearing: 5.2 },
  { region: "solara", name: "Glass Dunes", boss: "The Sun-Scorched Behemoth", out: 0.55, bearing: 1.7 },
  { region: "swamps", name: "Drowned Causeway", boss: "The Mire Leviathan", out: 0.5, bearing: 4.4 },
];

export type WorldBossRaid = { id: string; site: RaidSite; startsAt: number; endsAt: number; live: boolean };
const PERIOD = WORLD_BOSS.periodMin * 60_000, WINDOW = WORLD_BOSS.windowMin * 60_000;

/** the raid for the period containing `now` (live or not), and the next one */
export function worldBossAt(now: number): { current: WorldBossRaid; next: WorldBossRaid } {
  const k = Math.floor(now / PERIOD);
  const mk = (i: number): WorldBossRaid => {
    const site = RAID_SITES[((i % RAID_SITES.length) + RAID_SITES.length) % RAID_SITES.length]!, startsAt = i * PERIOD;
    return { id: `wb-${i}`, site, startsAt, endsAt: startsAt + WINDOW, live: now >= startsAt && now < startsAt + WINDOW };
  };
  return { current: mk(k), next: mk(k + 1) };
}

/** the purse for felling a world boss */
export const WORLD_BOSS_REWARD: { nex: number; xp: number; materials: Partial<Record<MaterialId, number>> } = { nex: 2500, xp: 1500, materials: { fractureCore: 1, reinforcedAlloy: 8, forgeCatalyst: 2 } };
export const worldBossKey = (raidId: string) => `worldboss:${raidId}`;

/** apply the reward once (ledger key + materials); unchanged when this raid already paid */
export function payWorldBoss<P extends { nexLedger?: Record<string, number>; materials: Partial<Record<MaterialId, number>> }>(p: P, raidId: string): P {
  const key = worldBossKey(raidId), ledger = p.nexLedger ?? {};
  if (key in ledger) return p;
  const materials = { ...p.materials };
  for (const [m, n] of Object.entries(WORLD_BOSS_REWARD.materials) as [MaterialId, number][]) materials[m] = (materials[m] ?? 0) + n;
  return { ...p, nexLedger: { ...ledger, [key]: WORLD_BOSS_REWARD.nex }, materials };
}

/** minutes until a raid starts or ends, for the HUD banner */
export function worldBossBanner(now: number): string {
  const { current, next } = worldBossAt(now);
  if (current.live) return `WORLD BOSS · ${current.site.boss} has risen at ${current.site.name} · ${Math.ceil((current.endsAt - now) / 60_000)} min left · the factions stand together`;
  return `Next world boss: ${next.site.boss} · ${next.site.name} in ${Math.ceil((next.startsAt - now) / 60_000)} min`;
}

/** a raid site's world position: out from its region's centre, pulled back toward the centre until it stands on dry land */
export function raidSiteWorld(site: RaidSite, region: { x: number; z: number; radius: number }, ground: (x: number, z: number) => number, water: number): { x: number; z: number } {
  let x = region.x + Math.cos(site.bearing) * region.radius * site.out, z = region.z + Math.sin(site.bearing) * region.radius * site.out;
  for (let i = 0; i < 16 && ground(x, z) < water + 1.5; i++) { x += (region.x - x) * 0.15; z += (region.z - z) * 0.15; }
  return { x, z };
}
