// Boss pacing guard (Oct 25 2026). Every boss is fought in the real sim by a player standing 25 m off with an auto rifle
// (1.3 damage every 0.12 s, aimed at the chest, never dodging). Before this pass bosses died in 3-8 s without attacking,
// sustained fire kept them staggered ~80% of the time, and bullets' knockback shoved them out of their own fight, so the
// finale-gated ones stalled at their hp floor forever. See boss-poise.ts (BOSS_HP, POISE_PER_DAMAGE, POISE_REFRACTORY,
// BOSS_KNOCK_MASS).
// @ts-ignore bun:test has no types in this project's tsconfig
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { createSim, fireBullet, stepSim, summonScenarioBoss, summonBoss } = await import("./sim");
const { UNIQUE_SCENARIOS, scenarioById } = await import("./unique-scenarios");
const { ENCOUNTERS } = await import("./scenario-encounters");
const { walkHeight } = await import("./terrain");
const { hitPoise, INITIAL_POISE, isStaggered, POISE_REFRACTORY, POISE_MAX } = await import("./boss-poise");

let clock = 1000;
let spy: { mockRestore: () => void };
beforeEach(() => { clock = 1000; spy = spyOn(performance, "now").mockImplementation(() => clock * 1000); });
afterEach(() => spy.mockRestore());

const BX = 3000, BZ = 3000, DT = 0.05, CAP = 400, DIST = 25;
function fight(id: string | null, region = "wastelands") {
  const sim = createSim();
  for (const m of sim.machines) m.alive = false;
  for (const t of sim.trucks) t.alive = false;
  if (id) summonScenarioBoss(sim, scenarioById(id)!, BX, BZ); else summonBoss(sim, region, BX, BZ);
  const boss = sim.machines.find((m) => m.alive && m.boss)!;
  const px = BX + DIST, pz = BZ, eye = walkHeight(px, pz) + 1.7;
  let t = 0, fireCool = 0, staggered = 0, finales = 0, maxDrift = 0;
  const tells: number[] = [], seen = new Set<number>();
  while (t < CAP && boss.alive) {
    clock += DT; t += DT; fireCool -= DT;
    if (fireCool <= 0) {
      fireCool = 0.12;
      const cy = Math.max(walkHeight(boss.x, boss.z), boss.y - 2.2 * boss.scale) + 1.2 * boss.scale;
      fireBullet(sim, px, eye, pz, Math.atan2(boss.x - px, boss.z - pz), false, Math.atan2(cy - eye, Math.hypot(boss.x - px, boss.z - pz)), 1.3, 1, 0.6);
    }
    stepSim(sim, { px, pz, dt: DT, night: 0.5, inVehicle: false, py: eye, pspeed: 0, stance: "STAND" });
    sim.hp = 100;
    if (boss.poiseState && isStaggered(boss.poiseState, clock)) staggered += DT;
    maxDrift = Math.max(maxDrift, Math.hypot(boss.x - px, boss.z - pz));
    for (const e of sim.encounterEvents) {
      if (seen.has(e.id)) continue; seen.add(e.id);
      if (e.kind === "TELL") tells.push(t);
      if (e.kind === "FINALE") finales++;
    }
  }
  const gaps = tells.slice(1).map((v, i) => v - tells[i]!);
  return { killed: !boss.alive, time: t, tells, maxGap: gaps.length ? Math.max(...gaps) : Infinity, finales, staggeredShare: staggered / t, maxDrift };
}

describe("boss pacing", () => {
  it("poise: a stagger is followed by a recovery in which sustained fire builds no poise", () => {
    let st = INITIAL_POISE, now = 0;
    while (!isStaggered(st, now)) { st = hitPoise(st, 20, now).state; now += 0.1; }
    const stagEnd = st.staggerUntil;
    st = hitPoise(st, 50, stagEnd + 0.1).state;
    expect(st.poise).toBe(0);
    st = hitPoise(st, 50, stagEnd + POISE_REFRACTORY + 0.1).state;
    expect(st.poise).toBe(50);
    expect(POISE_MAX).toBe(100);
  });
  for (const s of UNIQUE_SCENARIOS) {
    it(`${s.id}: a real fight — not a 3-second melt, never a stall, not stagger-locked, and it stays in its arena`, () => {
      const r = fight(s.id);
      expect(r.killed, "killed within the cap (finale-gated fights used to stall at their floor)").toBe(true);
      expect(r.time).toBeGreaterThan(40);
      expect(r.time).toBeLessThan(CAP);
      expect(r.staggeredShare).toBeLessThan(0.35);
      expect(r.maxDrift, "bullets no longer shove the boss out of its fight").toBeLessThan(60);
      if (ENCOUNTERS[s.id]) {
        // a scripted encounter keeps attacking: a wind-up at least every 10 s, and its finale opens when it has one
        expect(r.tells.length).toBeGreaterThan(r.time / 10);
        expect(r.maxGap).toBeLessThan(10);
        if (ENCOUNTERS[s.id]!.phases.some((p) => p.finale)) expect(r.finales).toBeGreaterThan(0);
      }
    });
  }
  for (const region of ["wastelands", "ember"]) {
    it(`regional boss (${region}): about half a minute of fire`, () => {
      const r = fight(null, region);
      expect(r.killed).toBe(true);
      expect(r.time).toBeGreaterThan(20);
      expect(r.time).toBeLessThan(90);
    });
  }
});
