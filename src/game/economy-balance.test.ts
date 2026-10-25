import { PAYOUTS } from "./activity-payouts";
/** Economy balance guards (the October audit): every number here was a player-facing exploit or a dead reward before. */
import { describe, expect, test } from "bun:test";
import { ACTIVITIES, KILLBOX_FULL_PAY, activityById, completeActivity, startActivity, type Run } from "./activities";
import { DEFAULT_PROGRESSION, rewardMission } from "./progression";
import { XP_PER_LEVEL, xpRequiredForLevel } from "./xp";
import { MISSION_IDS, applyMissionCompletion } from "./missions/persistence";
import { SOURCE_POWER, completionWeapon, missionWeaponPower } from "./weapon-loot";
import { GEAR_POWER } from "./loot-caches";
import { GEAR_LEVEL_MAX, WEAPON_DAMAGE_CAP, upgradeGear, weaponDamageMultiplier } from "./inventory";
import { canClaimDungeon, claimDungeonClear } from "./dungeon-claims";
import { DUNGEONS } from "./dungeons";
import { nexBalance } from "./nex";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
const fresh = () => structuredClone(DEFAULT_PROGRESSION);
const STARTING_PRIMARY = 135;

function runOnce(p: typeof DEFAULT_PROGRESSION, id: string, at: number) {
  const def = activityById(id)!;
  const s = startActivity(p, def.id, at); if ("error" in s) throw new Error(s.error);
  const run: Run = { ...s.run, status: "complete" };
  const done = completeActivity(s.progression, def, run, at + 1000, () => 0.99);
  if ("error" in done) throw new Error(done.error);
  return done;
}
const totalXp = (p: { level: number; xp: number }) => { let t = p.xp; for (let l = 1; l < p.level; l++) t += xpRequiredForLevel(l); return t; };

describe("activity payouts", () => {
  test("an activity pays exactly its listed XP (it paid 12× before)", () => {
    const def = ACTIVITIES.find((a) => a.kind === "side" && !a.minRep)!;
    const before = fresh();
    const { progression, payout } = runOnce(before, def.id, T0);
    expect(totalXp(progression) - totalXp(before)).toBe(payout.xp);
    expect(payout.xp).toBeLessThanOrEqual(Math.round(def.rewards.xp * 1.25 * 1.5));
  });
  test("Killbox stays unlimited, but only the first few wins a day pay in full", () => {
    let p = fresh(); const pays: number[] = [];
    for (let i = 0; i < KILLBOX_FULL_PAY + 2; i++) { const r = runOnce(p, "crucible-duel", T0 + i * 60_000); p = r.progression; pays.push(r.payout.nex); }
    expect(pays[0]).toBeGreaterThan(0);
    expect(pays[KILLBOX_FULL_PAY]!).toBeLessThan(pays[0]! / 5);
  });
  test("forge catalyst from a repeatable activity is paid on the first completion only", () => {
    const def = ACTIVITIES.find((a) => (a.rewards.materials as Record<string, number>)["forgeCatalyst"])!;
    expect(def).toBeTruthy();
    const first = runOnce(fresh(), def.id, T0);
    const second = runOnce(first.progression, def.id, T0 + 2 * 3600_000);
    expect(first.payout.materials.forgeCatalyst).toBeGreaterThan(0);
    expect(second.payout.materials.forgeCatalyst ?? 0).toBe(0);
  });
});

describe("levels across the campaign", () => {
  test("the campaign's first clears land the player around level 10-12, not 22", () => {
    let p = rewardMission(fresh(), "mission-01", {}, T0);
    for (const id of MISSION_IDS) p = applyMissionCompletion(p, id);
    expect(XP_PER_LEVEL).toBe(400);
    expect(p.level).toBeGreaterThanOrEqual(9);
    expect(p.level).toBeLessThanOrEqual(12);
  });
  test("wasteland side activities pay a fraction of a mission and taper hard", () => {
    let p = fresh();
    const xpAt = (q: typeof p) => totalXp(q);
    const gains: number[] = [];
    for (let i = 0; i < 6; i++) { const before = xpAt(p); p = rewardMission(p, "side-rally-test", {}, T0 + i * 60_000); gains.push(xpAt(p) - before); }
    expect(gains[0]!).toBeLessThanOrEqual(600);
    expect(gains[5]!).toBeLessThanOrEqual(60);
  });
});

describe("gear power ladder", () => {
  test("drops and rewards are worth picking up over the starting rifle, and stay under S tier", () => {
    for (const v of Object.values(SOURCE_POWER)) { expect(v).toBeGreaterThan(STARTING_PRIMARY); expect(v).toBeLessThanOrEqual(340); }
    for (const v of Object.values(GEAR_POWER)) expect(v).toBeLessThanOrEqual(340);
    expect(missionWeaponPower("awakening")).toBeGreaterThan(STARTING_PRIMARY);
    expect(missionWeaponPower("system-core")).toBeGreaterThan(missionWeaponPower("broken-signal"));
    expect(completionWeapon("mission", "system-core").power).toBe(missionWeaponPower("system-core"));
  });
  test("upgrades stop at level 10 and weapon damage is capped", () => {
    const item = { ...fresh().inventory[0]!, id: "cap-test", level: GEAR_LEVEL_MAX };
    const rich = { ...fresh(), inventory: [item], materials: new Proxy({}, { get: () => 9999 }) as typeof DEFAULT_PROGRESSION.materials };
    expect(upgradeGear(rich, "cap-test").inventory[0]!.level).toBe(GEAR_LEVEL_MAX);
    expect(weaponDamageMultiplier(10_000)).toBe(WEAPON_DAMAGE_CAP);
    expect(weaponDamageMultiplier(100)).toBe(1);
  });
});

describe("dungeon claims", () => {
  test("one claim per dungeon per day; a later day pays the repeat rate", () => {
    const d = DUNGEONS[0]!;
    const day1 = claimDungeonClear(fresh(), d.id, d.signature.name, T0);
    expect(day1.dungeonClears[d.id]).toBe(1);
    expect(canClaimDungeon(day1, d.id, T0 + 1000)).toBe(false);
    expect(claimDungeonClear(day1, d.id, d.signature.name, T0 + 1000)).toBe(day1);
    const day2 = claimDungeonClear(day1, d.id, d.signature.name, T0 + 86_400_000);
    expect(day2.dungeonClears[d.id]).toBe(2);
    expect(day2.fractureShards - day1.fractureShards).toBeLessThan(day1.fractureShards - fresh().fractureShards);
    expect(nexBalance(day2.nexLedger) - nexBalance(day1.nexLedger)).toBe(PAYOUTS.dungeon.repeat); // repeat bounty, less than the first
  });
});
