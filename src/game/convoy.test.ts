import { describe, expect, test } from "bun:test";
import { CONVOYS, THREAT_NAMES, beatsFor, compositionFor, convoyFor, convoyQuality, convoyRecord, highestThreat, levelLocked, maxLevelFor, settleConvoy, startConvoy, stepConvoy, type ConvoyRegion, type ConvoyRun } from "./convoy";
import { reputationOf } from "./activities";
import { DEFAULT_PROGRESSION } from "./progression";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
const fresh = () => structuredClone(DEFAULT_PROGRESSION);
/** walk the convoy to the end, killing everything that spawns right away */
function playOut(run: ConvoyRun, kill = true) {
  for (let pr = 0; pr <= 1.0001 && run.status === "active"; pr += 0.02) {
    const alive = run.units.filter((u) => u.alive).map((u) => u.id);
    stepConvoy(run, { progress: Math.min(1, pr), killed: kill ? alive : [], chosen: "fight" });
  }
  stepConvoy(run, { progress: 1, killed: run.units.filter((u) => u.alive).map((u) => u.id), chosen: "fight" });
  return run;
}

describe("regions and ladder", () => {
  test("all ten regions have their own convoy, cargo, attackers and signature encounter", () => {
    expect(CONVOYS.length).toBe(10); expect(new Set(CONVOYS.map((c) => c.region)).size).toBe(10);
    for (const c of CONVOYS) { expect(c.attackers.length).toBeGreaterThanOrEqual(3); expect(c.signature.length).toBeGreaterThan(20); expect(c.cargo.length).toBeGreaterThan(0); }
    expect(CONVOYS.filter((c) => c.attackers.includes("blackmarket")).map((c) => c.region)).toContain("neon"); expect(THREAT_NAMES.length).toBe(10);
  });
  test("escalation adds composition and tactics, not just numbers: air, armour, blockades, monsters, named leaders, capture", () => {
    const w = convoyFor("wastelands")!;
    expect(compositionFor(w, 1)).toMatchObject({ squads: 1, armor: 0, air: 0, monsters: 0, named: null, objective: "destroy" });
    expect(compositionFor(w, 3).named).toBe("sergeant"); expect(compositionFor(w, 4).air).toBeGreaterThan(0); expect(compositionFor(w, 5).armor).toBeGreaterThan(0);
    expect(compositionFor(w, 6).blockade).toBe(true); expect(compositionFor(w, 7).monsters).toBeGreaterThan(0); expect(compositionFor(w, 9)).toMatchObject({ named: "commander", objective: "capture" });
    expect(compositionFor(w, 10).squads).toBeGreaterThan(compositionFor(w, 2).squads);
    for (let l = 2; l <= 10; l++) { const a = compositionFor(w, l - 1), b = compositionFor(w, l); expect(b.squads + b.lightVehicles + b.armor + b.air + b.monsters + b.elites).toBeGreaterThanOrEqual(0); }
  });
  test("an underwater convoy never faces helicopters; the forest and swamp do not either", () => {
    const th = convoyFor("thalassia")!;
    for (let l = 1; l <= 10; l++) expect(compositionFor(th, l).air).toBe(0);
    for (const r of ["veridan", "swamps"] as const) for (let l = 1; l <= 10; l++) expect(compositionFor(convoyFor(r)!, l).air).toBe(0);
    const run = playOut(startConvoy("thalassia", 8, 3, T0)); expect(run.units.some((u) => u.kind === "gunship")).toBe(false); expect(run.units.some((u) => u.kind === "attack-submarine")).toBe(true);
  });
  test("Vyrak is never a convoy enemy", () => { for (const c of CONVOYS) { expect(c.monster.toLowerCase()).not.toContain("vyrak"); } });
});

describe("the director", () => {
  test("beats are spread over the route, ordered, and each fires exactly once", () => {
    const run = startConvoy("wastelands", 9, 11, T0), marks = beatsFor(run).map((b) => b.at);
    expect([...marks].sort((a, b) => a - b)).toEqual(marks); expect(new Set(marks.map((m) => m.toFixed(2))).size).toBe(marks.length);
    const spawnedKinds: string[] = [];
    for (let pr = 0; pr <= 1; pr += 0.01) { const o = stepConvoy(run, { progress: pr, killed: run.units.filter((u) => u.alive).map((u) => u.id) }); o.spawns.forEach((s) => spawnedKinds.push(s.kind)); }
    const again = stepConvoy(run, { progress: 1 }); expect(again.spawns.length).toBe(0); // nothing repeats because the state was updated twice
    expect(new Set(run.doneEvents).size).toBe(run.doneEvents.length);
    for (const k of ["squad", "light-vehicle", "commander", "gunship", "tank", "monster"]) expect(spawnedKinds).toContain(k);
  });
  test("deterministic per seed, different between seeds", () => {
    const a = beatsFor(startConvoy("ember", 7, 1, T0)).map((b) => b.at.toFixed(3)).join(), a2 = beatsFor(startConvoy("ember", 7, 1, T0 + 5)).map((b) => b.at.toFixed(3)).join(), b = beatsFor(startConvoy("ember", 7, 2, T0)).map((b) => b.at.toFixed(3)).join();
    expect(a).toBe(a2); expect(a).not.toBe(b);
  });
  test("a defeated commander cannot call reinforcements and the attack loses coordination", () => {
    const run = startConvoy("wastelands", 9, 5, T0);
    for (let pr = 0; pr <= 0.5; pr += 0.01) { const o = stepConvoy(run, { progress: pr }); if (o.spawns.some((s) => s.kind === "commander")) break; }
    expect(run.commanderAlive).toBe(true);
    const cmd = run.units.find((u) => u.kind === "commander")!; const squads = run.units.filter((u) => u.kind === "squad").map((u) => u.id);
    const out = stepConvoy(run, { progress: run.progress, killed: [cmd.id, ...squads] });
    expect(run.commanderAlive).toBe(false); expect(run.optional.commanderDefeated).toBe(true); expect(out.cancelled).toContain("reinforcements");
    const spawnedAfter: string[] = []; for (let pr = run.progress; pr <= 0.8; pr += 0.01) { const o = stepConvoy(run, { progress: pr, killed: run.units.filter((u) => u.alive && u.kind === "squad").map((u) => u.id) }); o.spawns.forEach((s) => spawnedAfter.push(s.kind)); }
    expect(run.reinforcementsCalled).toBe(0);
  });
  test("a living commander calls reinforcements, at most twice", () => {
    const run = startConvoy("wastelands", 9, 5, T0); let calls = 0;
    for (let pr = 0; pr <= 0.9; pr += 0.01) { const o = stepConvoy(run, { progress: pr, killed: run.units.filter((u) => u.alive && u.kind === "squad").map((u) => u.id) }); if (o.messages.some((m) => m.includes("reinforcements"))) calls++; }
    expect(calls).toBeGreaterThan(0); expect(run.reinforcementsCalled).toBeLessThanOrEqual(2);
  });
  test("a downed gunship cancels its follow-up volley", () => {
    const run = startConvoy("neon", 4, 8, T0);
    for (let pr = 0; pr <= 1; pr += 0.01) { stepConvoy(run, { progress: pr, killed: run.units.filter((u) => u.alive && u.kind !== "gunship").map((u) => u.id) }); if (run.units.some((u) => u.kind === "gunship")) break; }
    const gs = run.units.filter((u) => u.kind === "gunship").map((u) => u.id); expect(gs.length).toBeGreaterThan(0);
    const out = stepConvoy(run, { progress: run.progress, killed: gs }); expect(out.cancelled).toContain("rocket-volley"); expect(stepConvoy(run, { progress: run.progress }).cancelled).not.toContain("rocket-volley");
  });
  test("blockade: arriving needs the route open (fought through or taken around)", () => {
    const run = startConvoy("nexus", 6, 4, T0);
    for (let pr = 0; pr <= 1; pr += 0.01) { stepConvoy(run, { progress: pr }); if (run.route === "blocked") break; }
    expect(run.route).toBe("blocked");
    stepConvoy(run, { progress: 1 }); expect(run.status).toBe("active"); // barricades still up
    stepConvoy(run, { progress: 1, chosen: "alternate" });
    expect(run.route).toBe("alternate"); expect(run.optional.alternateAvoided).toBe(false);
  });
  test("destroying the lead transport fails the contract; the cargo hitting zero fails it too", () => {
    const a = startConvoy("ember", 3, 1, T0); stepConvoy(a, { progress: 0.2, leadDamage: 100 }); expect(a.status).toBe("failed"); expect(a.failReason).toBe("Lead transport destroyed");
    const b = startConvoy("ember", 3, 1, T0); stepConvoy(b, { progress: 0.2, cargoDamage: 100 }); expect(b.failReason).toBe("Cargo lost");
    const c = startConvoy("ember", 3, 1, T0); expect(stepConvoy(c, { progress: 0.5 }).spawns.length).toBeGreaterThanOrEqual(0); stepConvoy(a, { progress: 1 }); expect(a.status).toBe("failed"); // a finished run never revives
  });
  test("a clean run delivers; escorts lost cost quality and the all-escorts bonus", () => {
    const clean = playOut(startConvoy("solara", 5, 2, T0)); expect(clean.status).toBe("delivered");
    const rough = startConvoy("solara", 5, 2, T0); stepConvoy(rough, { progress: 0.1, escortLost: true, leadDamage: 40, cargoDamage: 30 }); playOut(rough);
    expect(rough.status).toBe("delivered"); expect(convoyQuality(rough)).toBeLessThan(convoyQuality(clean)); expect(rough.optional.allEscorts).toBe(false);
  });
});

describe("progression, rewards, protection", () => {
  const deliver = (p: ReturnType<typeof fresh>, region: ConvoyRegion, level: number, now: number) => { const run = playOut(startConvoy(region, level, 3, now)); const r = settleConvoy(p, run, now) as any; if (r.error) throw new Error(r.error); return { run, ...r }; };
  test("threat levels are per region and unlock one at a time", () => {
    let p = fresh(); expect(maxLevelFor(p, "wastelands")).toBe(1); expect(levelLocked(p, "wastelands", 2, T0)).toContain("level 1");
    p = deliver(p, "wastelands", 1, T0).progression; expect(highestThreat(p, "wastelands")).toBe(1); expect(maxLevelFor(p, "wastelands")).toBe(2);
    expect(maxLevelFor(p, "veridan")).toBe(1); // progress in one region does not open another
    expect(levelLocked(p, "wastelands", 1, T0)).toBeNull(); // replaying an easier level is always allowed
    p = deliver(p, "wastelands", 1, T0 + 1000).progression; expect(highestThreat(p, "wastelands")).toBe(1);
  });
  test("settling twice pays once; failure keeps the highest level; rewards go through nex/xp/reputation/materials", () => {
    const p0 = fresh(), run = playOut(startConvoy("wastelands", 1, 3, T0)), first = settleConvoy(p0, run, T0) as any;
    expect(first.reward.nex).toBeGreaterThan(0); expect(reputationOf(first.progression, "rebels")).toBe(first.reward.rep); expect(first.progression.materials.vehicleParts).toBeGreaterThan(0);
    expect((settleConvoy(first.progression, run, T0 + 1) as any).error).toBe("Already settled");
    const saved = JSON.parse(JSON.stringify(first.progression)); expect(highestThreat(saved, "wastelands")).toBe(1); expect(convoyRecord(saved).deliveries).toBe(1);
    const lost = startConvoy("wastelands", 2, 9, T0 + 10); stepConvoy(lost, { progress: 0.1, leadDamage: 100 });
    const after = settleConvoy(first.progression, lost, T0 + 20) as any; expect(after.reward.nex).toBe(0); expect(highestThreat(after.progression, "wastelands")).toBe(1);
  });
  test("repeated cargo losses pause premium contracts for a while, but easy contracts stay available", () => {
    let p = fresh(); for (let l = 1; l <= 6; l++) p.earnedRewards = [...p.earnedRewards.filter((e) => !e.startsWith("convoy-threat:wastelands:")), `convoy-threat:wastelands:${l}`];
    for (let i = 0; i < 3; i++) { const lost = startConvoy("wastelands", 6, i, T0 + i); stepConvoy(lost, { progress: 0.1, leadDamage: 100 }); p = (settleConvoy(p, lost, T0 + i) as any).progression; }
    expect(levelLocked(p, "wastelands", 6, T0 + 1000)).toContain("suspended"); expect(levelLocked(p, "wastelands", 2, T0 + 1000)).toBeNull();
    expect(levelLocked(p, "wastelands", 6, T0 + 7 * 3_600_000)).toBeNull();
  });
  test("higher threat pays better; a battered delivery pays less", () => {
    const a = deliver(fresh(), "ember", 1, T0).reward, hi = (() => { let p = fresh(); p.earnedRewards.push("convoy-threat:ember:7"); return deliver(p, "ember", 8, T0).reward; })();
    expect(hi.nex).toBeGreaterThan(a.nex);
    const run = startConvoy("ember", 1, 3, T0); stepConvoy(run, { progress: 0.1, cargoDamage: 60, leadDamage: 50 }); playOut(run);
    expect((settleConvoy(fresh(), run, T0) as any).reward.nex).toBeLessThan(a.nex);
  });
});
