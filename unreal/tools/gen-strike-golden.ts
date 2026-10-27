/**
 * Records golden strikes, the difficulty ladder, the encounter engine and World Boss raids from the web build's real raid-stages.ts,
 * difficulty-ladder.ts, strikes.ts and world-boss.ts for the C++ port's test (Plugins/WorldFractureCore/Tests/StrikeCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs strike
 *
 * Fields are tab-separated; a definition's own fields are joined by \x1f, its stages by \x1e, a stage's phases / routes by \x1d,
 * and their fields by \x1c.
 *   SD strike                 every authored strike, field for field
 *   TR kind -> tiers          RC -> raid challenges
 *   D def                     the definition later lines run on
 *   SC kind tier mod -> scaled|peak      (then the scaled definition is current)
 *   RN -> run    A / L / C route / GO -> run      (A advance, L lose a life, C choose a route, GO launch)
 *   P save    CL strike tier now -> paid|first|save    PO strike tier now -> key|nex|first    TU tier -> unlocked
 *   CC strike tier now -> canClaim    HU kind ids -> highest tier    WK now -> weekly strike|weekly challenge|mults
 *   WB now -> current|next|banner    PW raid -> paid|save    RS site rx rz radius water -> x|z
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { advanceEncounter, chooseEncounterRoute, createEncounterRun, loseEncounterLife, type EncounterDefinition, type EncounterRun } from "../../src/game/raid-stages";
import { DUNGEONS } from "../../src/game/dungeons";
import { RAID_CHALLENGES, flawlessPeak, highestUnlocked, scaleEncounter, tierById, tiersOf, weeklyMult, weeklyRaidChallenge, type LadderKind } from "../../src/game/difficulty-ladder";
import { STRIKES, STRIKE_IDS, canClaimStrike, claimStrikeClear, strikePayout, strikeTierUnlocked, weeklyStrike } from "../../src/game/strikes";
import { RAID_SITES, payWorldBoss, raidSiteWorld, worldBossAt, worldBossBanner, type WorldBossRaid } from "../../src/game/world-boss";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "strike_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0x5e7a1;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const F = "\x1f", S = "\x1e", I = "\x1d", J = "\x1c";
type AnyDef = EncounterDefinition & { region?: string; identity?: string; hazard?: string; boss?: string; duration?: string; signature?: { name: string; type: string; perk: string; repeatTraits: readonly string[] } };

const stage = (s: EncounterDefinition["stages"][number]) => [s.id, s.name, s.type, s.objective, n(s.target), b(s.checkpoint), s.hazardLabel ?? "", s.hazardPerStep === undefined ? "~" : n(s.hazardPerStep),
  (s.bossPhases ?? []).map((p) => [p.name, n(p.threshold), p.mechanic, p.counter].join(J)).join(I), (s.routes ?? []).map((r) => [r.id, r.name, r.tradeoff].join(J)).join(I), (s.enemies ?? []).join(J), s.reward ?? ""].join(F);
const def = (d: AnyDef) => [d.id, d.name, d.activity, n(d.maxLives), b(!!d.noCheckpointRelief), b(!!d.blackout), d.damageMult === undefined ? "~" : n(d.damageMult)].join(F) + S + d.stages.map(stage).join(S);
const flavour = (d: AnyDef) => [d.region, d.identity, d.hazard, d.boss, d.duration, d.signature!.name, d.signature!.type, d.signature!.perk, d.signature!.repeatTraits.join(J)].join(F);
const run = (r: EncounterRun) => [r.status, n(r.stageIndex), n(r.progress), n(r.lives), n(r.hazard), r.message, r.selectedRoute ?? "~", n(r.bossPhase), n(r.livesUsed), r.stagePerformance.map((p) => [p.name, n(p.objectives), n(p.hazard)].join(J)).join(I) || "~", n(r.damage), n(r.support)].join(F);
const kv = (m: Record<string, number | undefined> | undefined) => Object.keys(m ?? {}).filter((k) => m![k] !== undefined).sort().map((k) => `${k}=${n(m![k]!)}`).join(",") || "~";
const ps = (p: PlayerProgression) => [p.earnedRewards.join(",") || "~", kv(p.nexLedger), p.pocketClass ?? "~", n(p.fractureShards), n(p.xp), n(p.level), n(p.calibrationTokens), n(p.novaLevel), p.novaUnlocks.join(",") || "~", kv(p.dungeonClears), kv(p.materials as Record<string, number>)].join("|");
const raid = (r: WorldBossRaid) => [r.id, r.site.region, r.site.name, r.site.boss, n(r.startsAt), n(r.endsAt), b(r.live)].join(F);

// ---- the authored data ----
for (const s of STRIKES) out("SD", def(s), flavour(s));
for (const kind of ["strike", "raid"] as LadderKind[]) out("TR", kind, tiersOf(kind).map((t) => [t.id, t.name, n(t.rank), n(t.peak), n(t.enemyScale), n(t.bossHealthScale), n(t.livesDelta), n(t.payMult), n(t.power), t.blurb].join(J)).join(I));
out("RC", RAID_CHALLENGES.map((c) => [c.id, c.name, c.effect].join(J)).join(I));

// ---- scaling and runs: every strike and dungeon at every tier of both ladders, with each raid challenge ----
// tuneHazard memoises on a key without the blackout / damage flags; skip the scalings whose key an earlier, different call already took
const KEYS = new Map<string, string>();
const tuneKey = (d: EncounterDefinition, tier: { rank: number; name: string; peak: number; livesDelta: number; enemyScale: number; bossHealthScale: number }, mod: string) => {
  const structural = tier.rank === 0 ? d : { ...d, name: `${d.name} · ${tier.name}`, maxLives: Math.max(1, d.maxLives + tier.livesDelta), stages: d.stages.map((s) => ({ ...s, target: Math.max(s.target, Math.round(s.target * (s.type === "BOSS_FIGHT" ? 1 + (tier.bossHealthScale - 1) * 0.35 : 1 + (tier.enemyScale - 1) * 0.5))) })) };
  const lives = mod === "glass" ? Math.max(1, structural.maxLives - 2) : structural.maxLives;
  const targets = structural.stages.map((s) => (mod === "iron-boss" && s.type === "BOSS_FIGHT" ? Math.round(s.target * 1.4) : mod === "swarm" && s.type !== "BOSS_FIGHT" ? Math.round(s.target * 1.3) : s.target));
  const bump = { "no-revive": 4, "short-fuse": 4, "iron-boss": 3, swarm: 3 }[mod] ?? 0;
  return `${tier.rank <= 0 && !mod ? 1 : 0}|${d.id}|${structural.name}|${lives}|${mod === "no-revive" || d.noCheckpointRelief ? 1 : 0}|${targets.join(",")}|${Math.min(98, tier.peak + bump)}`;
};
const ENCOUNTERS: AnyDef[] = [...STRIKES, ...DUNGEONS];
for (const d of ENCOUNTERS) {
  out("D", def(d));
  for (const kind of ["strike", "raid"] as LadderKind[]) for (const t of tiersOf(kind)) for (const mod of ["", ...RAID_CHALLENGES.map((c) => c.id)]) {
    if (mod && rand() < 0.6) continue;
    if (d.activity === "RAID" && t.rank === 0 && !mod) { /* untouched: still recorded */ }
    const key = tuneKey(d, t, mod), was = KEYS.get(key);
    if (was !== undefined && was !== mod) continue;
    KEYS.set(key, mod);
    const scaled = scaleEncounter(d, t, mod || undefined);
    out("SC", kind, t.id, mod || "~", def(scaled), flawlessPeak(scaled));
    // a few runs on the scaled definition
    for (let k = 0; k < 3; k++) {
      let r = createEncounterRun(scaled);
      out("RN", run(r));
      for (let step = 0; step < 60 && r.status !== "COMPLETE" && r.status !== "WIPED"; step++) {
        const x = rand();
        const routes = scaled.stages[r.stageIndex]?.routes ?? [];
        if (r.status === "READY" || x < 0.03) { r = { ...r, status: "ACTIVE", message: `Entered ${scaled.stages[r.stageIndex]?.name ?? scaled.name}.` }; out("GO", run(r)); }
        else if (x < 0.82) { r = advanceEncounter(scaled, r); out("A", run(r)); }
        else if (x < 0.9) { r = loseEncounterLife(scaled, r); out("L", run(r)); }
        else { const id = routes.length && rand() < 0.8 ? pick(routes).id : pick(["upper-aqueduct", "a-b-c", "x"]); r = chooseEncounterRoute(r, id); out("C", id, run(r)); }
      }
      if (rand() < 0.3) { r = advanceEncounter(scaled, r); out("A", run(r)); r = loseEncounterLife(scaled, r); out("L", run(r)); }
    }
  }
}

// ---- claims and the ladder ----
const TIERS = ["standard", "hero", "legend", "master", "nope"];
const OPS = ["TITAN", "HUNTER", "WARLOCK"];
let now = Date.UTC(2026, 0, 3, 22);
for (let t = 0; t < 400; t++) {
  let p: PlayerProgression = { ...structuredClone(DEFAULT_PROGRESSION), earnedRewards: rand() < 0.2 ? ["Override Key", "x", "x"] : [], nexLedger: {}, pocketClass: pick(OPS), fractureShards: pick([0, 120, 500]), xp: pick([0, 390, 1200]), level: pick([1, 3, 9]), calibrationTokens: 2, novaLevel: pick([0, 9.99, 24.5]), novaUnlocks: [], dungeonClears: {}, materials: {} as PlayerProgression["materials"] };
  out("P", ps(p));
  for (let k = 0; k < 30; k++) {
    now += pick([1, 3_600_000, 86_400_000, 5 * 86_400_000, Math.floor(rand() * 3e8)]);
    const r = rand(), sid = rand() < 0.95 ? pick(STRIKE_IDS) : "strike-none", tier = pick(TIERS);
    if (r < 0.1) p = { ...p, pocketClass: pick(OPS) }, out("OP", p.pocketClass);
    if (r < 0.5) { const c = claimStrikeClear(p, sid, tier, now); out("CL", sid, tier, now, [n(c.paid), b(c.first), ps(c.progression)].join(F)); p = c.progression; }
    else if (r < 0.65) { const po = strikePayout(p, sid, tier, now); out("PO", sid, tier, now, po ? [po.key, n(po.nex), b(po.first)].join(F) : "~"); }
    else if (r < 0.75) { out("CC", sid, tier, now, b(canClaimStrike(p, sid, tier, now))); out("TU", tier, b(strikeTierUnlocked(p, tier))); }
    else if (r < 0.85) { const kind = pick(["strike", "raid"] as LadderKind[]); const ids = pick([STRIKE_IDS, ["hollow-star"], [sid]]); if (kind === "raid" && rand() < 0.3) { p = { ...p, dungeonClears: { ...p.dungeonClears, [ids[0]!]: pick([0, 1]) } }; out("DC", ids[0]!, p.dungeonClears![ids[0]!]!); } if (kind === "raid" && rand() < 0.4) { p = { ...p, earnedRewards: [...p.earnedRewards, `tier-clear:${ids[0]}:${pick(["normal", "heroic", "mastery"])}`] }; out("EK", p.earnedRewards[p.earnedRewards.length - 1]!); } out("HU", kind, ids.join(","), highestUnlocked(p, kind, ids).id); }
    else { const ws = weeklyStrike(now); out("WK", now, [ws.id, weeklyRaidChallenge(now).id, ...tiersOf("strike").map((tt) => n(weeklyMult("strike", tt, true, false))), n(weeklyMult("raid", tierById("raid", "heroic"), true, true))].join(F)); }
  }
}

// ---- World Boss raids ----
const ground = (x: number, z: number) => (Math.abs(x) % 23) + (Math.abs(z) % 11) - 12;
let wbNow = Date.UTC(2026, 9, 25, 3, 7);
for (let t = 0; t < 3000; t++) {
  wbNow += pick([1, 59_999, 60_000, 60_001, 15 * 60_000, Math.floor(rand() * 9e6)]);
  const { current, next } = worldBossAt(wbNow);
  out("WB", wbNow, [raid(current), raid(next), worldBossBanner(wbNow)].join(S));
}
// the window's exact edges: a raid is live from its start (inclusive) to its end (exclusive)
for (let t = 0; t < 300; t++) {
  const k = 735_000 + Math.floor(rand() * 2000), at = k * 2_400_000 + pick([-1, 0, 1, 899_999, 900_000, 900_001]);
  out("WB", at, [raid(worldBossAt(at).current), raid(worldBossAt(at).next), worldBossBanner(at)].join(S));
}
for (let t = 0; t < 300; t++) {
  let p: PlayerProgression = { ...structuredClone(DEFAULT_PROGRESSION), nexLedger: {}, materials: (rand() < 0.5 ? { reinforcedAlloy: 3 } : {}) as PlayerProgression["materials"] };
  out("P", ps(p));
  for (let k = 0; k < 6; k++) { const id = `wb-${pick([0, 1, 2, 7, 296123])}`; const before = p; p = payWorldBoss(p, id); out("PW", id, [b(p !== before), ps(p)].join(F)); }
}
for (let t = 0; t < 2000; t++) {
  const si = Math.floor(rand() * RAID_SITES.length), rx = Math.round((rand() - 0.5) * 1600), rz = Math.round((rand() - 0.5) * 1600), radius = pick([90, 140, 182, 260.5]), water = pick([-20, -3, 0, 2.5, 8]);
  const at = raidSiteWorld(RAID_SITES[si]!, { x: rx, z: rz, radius }, ground, water);
  out("RS", si, rx, rz, radius, water, `${n(at.x)}|${n(at.z)}`);
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`strike golden: ${lines.length} lines -> ${OUT}`);
