/** Map game flow (pure): what you can pick on the star map inside each region, the pre-launch rules (challenge level) and
 * regional patrols with a daily cap. The map only lists things that already exist in the world (story chapters, cities and
 * safe zones, boss lairs, resource sites, Living World contracts and stashes) and "launching" one is a drop next to it
 * through the existing transit; nothing here starts a second mission system.
 *
 * Saved state: `progression.challenge` (a choice, newer copy wins) and `progression.patrol` (the one patrol in progress).
 * Patrol payouts go through rewardMission with a `side-patrol-*` id, so the daily repeat taper and first-clear rules apply. */
import { REGIONS, ZONE_COLOR, type Region } from "./world";
import { CHRONICLE } from "./retention";
import { lairRevealed } from "./vyrak-site";
import { BOSS_LAIRS, RESOURCE_SITES, SCENARIO_LAIRS } from "./waypoints";
import { CITY_DESTINATIONS, dropPoint } from "./destinations";
import { CITIES, cityAt } from "./living-world";
import { livingMarkers } from "./living-npcs";
import { rewardMission, type PlayerProgression } from "./progression";
import type { MaterialId } from "./inventory";
import { TRAITS } from "./nemesis";
import { HOLLOW_CROWN, forgeStage } from "./godforge";
import { GARAGES } from "./fleet";
import { ARENA, RUST_RUN, VAULT_GATE, legionRank } from "./wasteland-activities";

export type ActivityKind = "STORY" | "SAFE_ZONE" | "BOSS" | "NEMESIS" | "RESOURCE" | "CONTRACT" | "STASH" | "PATROL" | "ACTIVITY";
export type ActivityStatus = "NEXT" | "AVAILABLE" | "DONE" | "LOCKED";
export type Activity = {
  id: string; kind: ActivityKind; name: string; detail: string; regionId: string;
  x: number; z: number; status: ActivityStatus; lockReason?: string;
  /** where the drop lands (off the activity's own trigger radius); `y` = arrive at that depth already diving (Thalassia) */
  drop: { x: number; z: number; y?: number };
};

export const ACTIVITY_LABEL: Record<ActivityKind, string> = { STORY: "Story", SAFE_ZONE: "Safe zone", BOSS: "Boss lair", RESOURCE: "Resource site", CONTRACT: "Contract", STASH: "Hidden stash", PATROL: "Patrol", NEMESIS: "Nemesis", ACTIVITY: "Activity" };
export const ACTIVITY_COLOR: Record<ActivityKind, string> = { STORY: "#ffd166", SAFE_ZONE: ZONE_COLOR.safe, BOSS: "#ff4d5e", RESOURCE: "#4de3b0", CONTRACT: "#7ef2b0", STASH: "#ffb23e", PATROL: "#66e0ff", NEMESIS: "#ff2e63", ACTIVITY: "#ff9b3c" };

const off = (x: number, z: number, d: number, from: { x: number; z: number }) => {
  const dx = from.x - x, dz = from.z - z, len = Math.hypot(dx, dz) || 1;
  return { x: x + (dx / len) * d, z: z + (dz / len) * d };
};

/* ------------------------------------------------------------ patrols ------------------------------------------------------------ */
export type PatrolRun = { regionId: string; kills: number; need: number; day: string };
export const PATROL_KILLS = 12;
export const PATROL_DAILY_CAP = 3;
export const patrolId = (regionId: string) => `side-patrol-${regionId}`;
const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);
/** patrols finished today across every region */
export const patrolsToday = (p: Pick<PlayerProgression, "missionRuns">, now = Date.now()) =>
  Object.entries(p.missionRuns).reduce((n, [id, run]) => n + (id.startsWith("side-patrol-") && run.day === dayKey(now) ? run.count : 0), 0);
export const PATROL_MATERIALS: Record<string, Partial<Record<MaterialId, number>>> = {
  veridan: { sporeFiber: 4, scrapMetal: 6 }, ember: { thermalShards: 4, scrapMetal: 6 }, wastelands: { scrapMetal: 10, fuel: 4 },
  frostspire: { cryoCrystal: 4, scrapMetal: 6 }, swamps: { bioCatalyst: 3, sporeFiber: 3 }, nexus: { microCircuits: 5, scrapMetal: 6 }, solara: { anomalyCarbon: 4, scrapMetal: 6 },
};

export function startPatrol(p: PlayerProgression, regionId: string, now = Date.now()): { progression: PlayerProgression } | { error: string } {
  if (!REGIONS.some((r) => r.id === regionId)) return { error: "Unknown region" };
  if (patrolsToday(p, now) >= PATROL_DAILY_CAP) return { error: `Patrol cap reached (${PATROL_DAILY_CAP} per day). Resets at 00:00 UTC.` };
  if (p.patrol && p.patrol.regionId === regionId && p.patrol.day === dayKey(now)) return { progression: p };
  return { progression: { ...p, patrol: { regionId, kills: 0, need: PATROL_KILLS, day: dayKey(now) } } };
}

/** Player kills in a region advance a patrol there; the last one pays through rewardMission (scaled by the challenge). */
export function recordPatrolKills(p: PlayerProgression, regionId: string, kills: number, now = Date.now()): { progression: PlayerProgression; message?: string } {
  const run = p.patrol;
  if (!run || run.regionId !== regionId || kills <= 0) return { progression: p };
  const total = Math.min(run.need, run.kills + kills);
  if (total < run.need) return { progression: { ...p, patrol: { ...run, kills: total } } };
  if (patrolsToday(p, now) >= PATROL_DAILY_CAP) return { progression: { ...p, patrol: null }, message: "Patrol complete, but today's patrol cap is reached: no payout" };
  const mult = CHALLENGES[p.challenge ?? "STANDARD"].reward;
  const mats: Partial<Record<MaterialId, number>> = {};
  for (const [k, v] of Object.entries(PATROL_MATERIALS[regionId] ?? { scrapMetal: 6 }) as [MaterialId, number][]) mats[k] = Math.round(v * mult);
  const paid = rewardMission({ ...p, patrol: null }, patrolId(regionId), mats, now);
  const name = REGIONS.find((r) => r.id === regionId)?.name ?? regionId;
  return { progression: paid, message: `${name} patrol complete · ${Object.entries(paid.lastMissionReward?.materials ?? {}).map(([k, v]) => `+${v} ${k}`).join(", ")}` };
}

/* ------------------------------------------------------------ challenge ------------------------------------------------------------ */
export type ChallengeId = "STANDARD" | "HARD" | "VERY_HARD";
export const CHALLENGES: Record<ChallengeId, { label: string; enemyHp: number; enemyDamage: number; reward: number; minLevel: number; blurb: string }> = {
  STANDARD: { label: "Standard", enemyHp: 1, enemyDamage: 1, reward: 1, minLevel: 1, blurb: "The world as tuned." },
  HARD: { label: "Hard", enemyHp: 1.4, enemyDamage: 1.3, reward: 1.25, minLevel: 8, blurb: "Enemies have +40% health and hit 30% harder. +25% XP and patrol pay." },
  VERY_HARD: { label: "Very hard", enemyHp: 1.8, enemyDamage: 1.6, reward: 1.5, minLevel: 15, blurb: "Enemies have +80% health and hit 60% harder. +50% XP and patrol pay." },
};
export const CHALLENGE_ORDER: readonly ChallengeId[] = ["STANDARD", "HARD", "VERY_HARD"];
export function setChallenge(p: PlayerProgression, id: ChallengeId): { progression: PlayerProgression } | { error: string } {
  const c = CHALLENGES[id];
  if (!c) return { error: "Unknown challenge" };
  if (p.level < c.minLevel) return { error: `${c.label} unlocks at level ${c.minLevel}` };
  return { progression: p.challenge === id ? p : { ...p, challenge: id } };
}

/* ------------------------------------------------------------ activities ------------------------------------------------------------ */
/** Everything the map offers in one region, in a stable order (story first). */
export function regionActivities(p: PlayerProgression, regionId: string, now = Date.now()): Activity[] {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return [];
  const out: Activity[] = [];
  const centre = { x: region.x, z: region.z };
  const next = CHRONICLE.find((c) => !p.completedMissions.includes(c.id));
  CHRONICLE.filter((c) => c.region === region.name).forEach((c, i) => {
    // Future chapters must not leak their title, coordinates or icon into the Director.
    // Completed chapters remain available for replay; only the next chapter is revealed.
    if (!p.completedMissions.includes(c.id) && next?.id !== c.id) return;
    const done = p.completedMissions.includes(c.id);
    const isNext = next?.id === c.id;
    const a = (i * 2.1) % (Math.PI * 2), r = region.radius * 0.25;
    const x = region.x + Math.cos(a) * r, z = region.z + Math.sin(a) * r;
    out.push({ id: `story:${c.id}`, kind: "STORY", name: c.title, detail: done ? "Completed: replay at a reduced payout" : isNext ? "Your next chapter: deploy to begin" : "Comes later in the story", regionId, x, z,
      status: done ? "DONE" : isNext ? "NEXT" : "LOCKED", ...(done || isNext ? {} : { lockReason: `Finish "${next?.title ?? "the previous chapter"}" first` }), drop: { x, z: z + 6 } });
  });
  if (region.kind === "safe") out.push({ id: `safe:${region.id}`, kind: "SAFE_ZONE", name: region.name, detail: "Safe zone: fast healing, vendors, no hostile spawns", regionId, x: region.x, z: region.z, status: "AVAILABLE", drop: { x: region.x, z: region.z + 6 } });
  for (const c of CITY_DESTINATIONS.filter((d) => d.regionId === regionId)) out.push({ id: `city:${c.id}`, kind: "SAFE_ZONE", name: c.name, detail: c.deployable ? c.sub : c.blockedReason ?? c.sub, regionId, x: c.x, z: c.z, status: c.deployable ? "AVAILABLE" : "LOCKED", ...(c.deployable ? {} : { lockReason: c.blockedReason ?? "No landing site" }), drop: dropPoint(c) });
  for (const l of [...BOSS_LAIRS, ...SCENARIO_LAIRS.filter((l) => lairRevealed(p, l.scenarioId))].filter((m) => m.regionId === regionId)) {
    // a lair inside a submerged city (the Drowned Monarch in Thalassia) is reached the way the city is: by submersible
    const sub = CITY_DESTINATIONS.find((c) => c.arrival === "submersible" && Math.hypot(c.x - l.x, c.z - l.z) < 250);
    out.push({ id: `boss:${l.id}`, kind: "BOSS", name: l.label, detail: sub ? `Boss lair in ${sub.name}: submersible arrival, then dive to it` : "Boss lair: walk in to start the fight", regionId, x: l.x, z: l.z, status: "AVAILABLE", drop: sub ? dropPoint(sub) : off(l.x, l.z, 18, centre) });
  }
  for (const n of (p.nemeses ?? []).filter((x) => x.status === "ALIVE" && x.regionId === regionId)) {
    out.push({ id: `nemesis:${n.id}`, kind: "NEMESIS", name: `${n.name} ${n.epithet}`, detail: `Rank ${n.rank} ${n.profile} · ${n.traits.map((t) => TRAITS[t].label).join(", ")} · killed you ${n.kills}× · hunts you on arrival`, regionId, x: region.x, z: region.z, status: "AVAILABLE", drop: { x: region.x + region.radius * 0.35, z: region.z - region.radius * 0.2 } });
  }
  if (regionId === "wastelands") {
    const stage = forgeStage(p);
    if (stage !== "SEALED") out.push({ id: "forge:hollow-crown", kind: stage === "DOOR" ? "BOSS" : "SAFE_ZONE", name: stage === "DOOR" ? "The Hollow Crown" : "Vael's Godforge", detail: stage === "DOOR" ? "The Forgewright's door is open. The Furnace Guardian waits inside." : "Vael forges Godforged relics and binds runes", regionId, x: HOLLOW_CROWN.x, z: HOLLOW_CROWN.z, status: "AVAILABLE", drop: { x: HOLLOW_CROWN.x, z: HOLLOW_CROWN.z - HOLLOW_CROWN.radius - 8 } });
  }
  if (regionId === "wastelands") {
    // wasteland-activities.ts: drops land just outside each start so walking/driving in is what starts it
    const legion = legionRank(p), best = p.records?.["rust-run"], pit = p.records?.["mash-pit"];
    out.push({ id: "act:vault", kind: "ACTIVITY", name: "Defense contract · Sub-Terra Perimeter", detail: `Hold the vault gate against three raider waves. Legion rank: ${legion}`, regionId, x: VAULT_GATE.x, z: VAULT_GATE.z, status: p.completedMissions.includes("side-vault-defense") ? "DONE" : "AVAILABLE", drop: { x: VAULT_GATE.x - VAULT_GATE.radius - 10, z: VAULT_GATE.z } });
    out.push({ id: "act:rally", kind: "ACTIVITY", name: "Rust Run rally", detail: `Vehicle time trial through ${RUST_RUN.checkpoints.length} checkpoints${best !== undefined ? ` · best ${best.toFixed(1)} s` : ""}`, regionId, x: RUST_RUN.start.x, z: RUST_RUN.start.z, status: "AVAILABLE", drop: { x: RUST_RUN.start.x - 16, z: RUST_RUN.start.z + 10 } });
    out.push({ id: "act:derby", kind: "ACTIVITY", name: "The Mash-Pit derby", detail: `Drive in and wreck buggies for 75 s${pit !== undefined ? ` · best ${pit} wrecks` : ""}`, regionId, x: ARENA.x, z: ARENA.z, status: "AVAILABLE", drop: { x: ARENA.x, z: ARENA.z + ARENA.radius + 10 } });
  }
  for (const g of Object.values(GARAGES)) {
    if (g.mapRegion !== regionId) continue;
    const ownedBase = (p.fleet?.garages ?? []).includes(g.id);
    out.push({ id: `garage:${g.id}`, kind: "SAFE_ZONE", name: g.name, detail: ownedBase ? "Your garage: tune, paint and switch vehicles" : "Garage base for sale: buy it to unlock its vehicles", regionId, x: g.x, z: g.z, status: "AVAILABLE", drop: g.deckY !== undefined ? { x: g.x + 5, z: g.z, y: g.deckY + 1.6 } : { x: g.x, z: g.z + 8 } });
  }
  for (const s of RESOURCE_SITES.filter((m) => m.regionId === regionId)) out.push({ id: `res:${s.id}`, kind: "RESOURCE", name: s.label, detail: `Gather ${s.material}`, regionId, x: s.x, z: s.z, status: "AVAILABLE", drop: off(s.x, s.z, 6, centre) });
  for (const m of livingMarkers(p)) {
    const city = cityAt(m.x, m.z);
    if (!city || regionId !== "nexus") continue; // both cities sit in the Nexus region
    out.push({ id: `living:${m.id}`, kind: m.kind === "stash" ? "STASH" : "CONTRACT", name: m.label, detail: `${CITIES[city].name} · ${m.kind === "stash" ? "revealed by an informant" : "survey point for an active contract"}`, regionId, x: m.x, z: m.z, status: "AVAILABLE", drop: off(m.x, m.z, 10, CITIES[city]) });
  }
  if (region.kind !== "safe") {
    const cap = patrolsToday(p, now) >= PATROL_DAILY_CAP;
    const active = p.patrol?.regionId === regionId ? p.patrol : null;
    out.push({ id: `patrol:${regionId}`, kind: "PATROL", name: `${region.name} patrol`, detail: active ? `In progress · ${active.kills}/${active.need} hostiles` : `Defeat ${PATROL_KILLS} hostiles in ${region.name} · ${patrolsToday(p, now)}/${PATROL_DAILY_CAP} patrols today`, regionId, x: region.x, z: region.z,
      status: cap && !active ? "LOCKED" : "AVAILABLE", ...(cap && !active ? { lockReason: `Daily patrol cap reached (${PATROL_DAILY_CAP})` } : {}), drop: { x: region.x + region.radius * 0.3, z: region.z } });
  }
  return out;
}

/** Counts per region for the map's node badges. */
export function regionSummary(p: PlayerProgression, r: Region, now = Date.now()) {
  const acts = regionActivities(p, r.id, now);
  return { next: acts.some((a) => a.status === "NEXT"), bosses: acts.filter((a) => a.kind === "BOSS").length, open: acts.filter((a) => a.status !== "LOCKED" && a.status !== "DONE").length };
}
