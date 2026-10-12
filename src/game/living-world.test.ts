import { describe, expect, mock, test } from "bun:test";
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
import { CITIES, DISTRICTS, EMPTY_LIVING, adjustRep, cityAt, districtOf, districtStatus, livingShopTerms, mergeLiving, normalizeLiving, recordDistrict, repOf, repTier, tierOf } from "./living-world";
import { CONTRACTS, INTEL, LIVING_NPCS, contractPoint, intelPoint, npcActions, npcLine, npcNear, npcWorld, performNpcAction, recordCityKills, recordReach, livingMarkers, PLEDGE_KEY } from "./living-npcs";
import { createLivingDirector, resolveLivingEvent, stepLivingDirector, pickEvent, EVENT_RULES, FRACTURE_HOLD, type DirectorInput } from "./living-events";
import { createGuards, stepGuards, WARN_SECONDS } from "./city-patrols";
import { spawnCivilian, stepCivilian, PANIC_RADIUS } from "./civilians";
import { DEFAULT_PROGRESSION, normalizeProgression, type PlayerProgression } from "./progression";
import { REGIONAL_SHOPS, shopLock, shopOffers, shopPriceMult } from "./regional-shops";
import { buildings } from "./nexus-districts";
import { mulberry32 } from "./rng";

const { mergeProgression } = await import("./cloud-save");
const base = (): PlayerProgression => ({ ...DEFAULT_PROGRESSION, materials: {}, earnedRewards: [], living: EMPTY_LIVING });
const ok = (r: ReturnType<typeof performNpcAction>) => { if ("error" in r) throw new Error(r.error); return r.progression; };
const NOW = 1_800_000_000_000;

describe("cities and districts", () => {
  test("Nexus City and Neon City are separate places", () => {
    expect(cityAt(CITIES.nexus.x, CITIES.nexus.z)).toBe("nexus");
    expect(cityAt(CITIES.neon.x, CITIES.neon.z)).toBe("neon");
    expect(Math.hypot(CITIES.neon.x - CITIES.nexus.x, CITIES.neon.z - CITIES.nexus.z)).toBeGreaterThan(CITIES.nexus.radius + CITIES.neon.radius);
    expect(cityAt(CITIES.nexus.x + 500, CITIES.nexus.z)).toBeNull();
  });
  test("every district anchor reports its own district", () => {
    for (const d of DISTRICTS) expect(districtOf(d.x, d.z)?.id).toBe(d.id);
  });
});

describe("reputation", () => {
  test("tiers and rival spill-over in Neon City only", () => {
    expect(repTier(-50)).toBe("HOSTILE"); expect(repTier(0)).toBe("NEUTRAL"); expect(repTier(30)).toBe("TRUSTED"); expect(repTier(80)).toBe("HONORED");
    const s = adjustRep(EMPTY_LIVING, "syndicate", 20);
    expect(repOf(s, "syndicate")).toBe(20); expect(repOf(s, "aegis")).toBe(-10);
    const n = adjustRep(EMPTY_LIVING, "wardens", 20);
    expect(repOf(n, "guild")).toBe(0);
  });
  test("merge never loses gained or lost standing and keeps the newest district outcome", () => {
    const a = recordDistrict(adjustRep(EMPTY_LIVING, "wardens", 30), "nexus:market", "FAILED", NOW);
    const b = recordDistrict(adjustRep(EMPTY_LIVING, "wardens", -10), "nexus:market", "WON", NOW + 5);
    const m = mergeLiving(a, b);
    expect(m.gain.wardens).toBe(30); expect(m.loss.wardens).toBe(10);
    expect(districtStatus(m, "nexus:market", NOW + 10)).toBe("SECURED");
    expect(mergeLiving(b, a)).toEqual(m);
  });
  test("old saves gain an empty living record; cloud merge carries it", () => {
    const old = normalizeProgression({ ...DEFAULT_PROGRESSION, living: undefined });
    expect(old.living).toEqual(EMPTY_LIVING);
    const local = { ...base(), living: adjustRep(EMPTY_LIVING, "aegis", 12) };
    const cloud = { ...base(), living: { ...EMPTY_LIVING, intel: ["neon-grid-stash"] } };
    const m = mergeProgression(local, cloud, true);
    expect(repOf(m.living, "aegis")).toBe(12); expect(m.living.intel).toContain("neon-grid-stash");
    expect(normalizeLiving({ gain: { wardens: "x", guild: 5 }, districts: { bogus: { securedAt: 1 } } })).toEqual({ ...EMPTY_LIVING, gain: { guild: 5 } });
  });
});

describe("shops follow standing and district status", () => {
  const armory = REGIONAL_SHOPS.find((s) => s.id === "nexus-armory")!;
  test("hostile faction refuses trade; fallen district closes it; trusted gets a discount", () => {
    const p = { ...base(), level: 10 };
    expect(shopLock(armory, p, NOW)).toBeNull();
    expect(shopLock(armory, { ...p, living: adjustRep(EMPTY_LIVING, "wardens", -60) }, NOW)).toContain("Hostile");
    const district = districtOf(armory.x, armory.z)!;
    expect(shopLock(armory, { ...p, living: recordDistrict(EMPTY_LIVING, district.id, "FAILED", NOW) }, NOW)).toContain("overrun");
    const trusted = { ...p, living: adjustRep(EMPTY_LIVING, "wardens", 30) };
    expect(shopPriceMult(armory, trusted, NOW)).toBeCloseTo(0.9);
    const full = shopOffers(armory, 100), cheap = shopOffers(armory, 100, 0.9);
    expect(cheap.map((o) => o.key)).toEqual(full.map((o) => o.key));
    expect(cheap.reduce((a, o) => a + o.price, 0)).toBeLessThan(full.reduce((a, o) => a + o.price, 0));
  });
  test("shops outside the cities are untouched", () => {
    const trader = REGIONAL_SHOPS.find((s) => s.id === "waste-trader")!;
    expect(livingShopTerms(adjustRep(EMPTY_LIVING, "wardens", -90), trader, NOW)).toEqual({ lock: null, priceMult: 1 });
  });
});

describe("NPCs and contracts", () => {
  test("every NPC is reachable from its own spot and stands in its own city", () => {
    for (const n of LIVING_NPCS) { const p = npcWorld(n); expect(npcNear(p.x, p.z)?.id).toBe(n.id); expect(cityAt(p.x, p.z)).toBe(n.city); }
  });
  test("survey points, stashes and Nexus NPCs are not inside Nexus district buildings", () => {
    const bs = buildings();
    const inside = (x: number, z: number) => bs.some((b) => { const dx = x - b.x, dz = z - b.z, c = Math.cos(-b.yaw), s = Math.sin(-b.yaw); return Math.abs(dx * c - dz * s) < b.w / 2 + 1.5 && Math.abs(dx * s + dz * c) < b.d / 2 + 1.5; });
    const pts = [...CONTRACTS.map(contractPoint).filter(Boolean), ...INTEL.map(intelPoint), ...LIVING_NPCS.map(npcWorld)] as { x: number; z: number }[];
    for (const p of pts) expect(inside(p.x, p.z)).toBe(false);
  });
  test("a CULL contract only completes from kills in its own city, then pays once", () => {
    const vos = LIVING_NPCS.find((n) => n.id === "vos")!;
    let p = ok(performNpcAction(base(), "vos", "accept:perimeter-sweep", NOW));
    expect(npcActions(p, vos).find((a) => a.id === "turnin:perimeter-sweep")?.enabled).toBe(false);
    p = recordCityKills(p, "neon", 20);
    expect(p.living.contracts["perimeter-sweep"]!.progress).toBe(0);
    p = recordCityKills(p, "nexus", 5); p = recordCityKills(p, "nexus", 5);
    expect(p.living.contracts["perimeter-sweep"]!.progress).toBe(8);
    p = ok(performNpcAction(p, "vos", "turnin:perimeter-sweep", NOW));
    expect(repOf(p.living, "wardens")).toBe(12);
    expect(p.materials.reinforcedAlloy).toBe(4);
    expect(p.xp + (p.level - 1) * 100).toBeGreaterThan(0);
    expect(npcActions(p, vos).some((a) => a.id.endsWith("perimeter-sweep"))).toBe(false);
    expect("error" in performNpcAction(p, "vos", "turnin:perimeter-sweep", NOW)).toBe(true);
  });
  test("DELIVER takes the materials; locked contracts refuse", () => {
    let p: PlayerProgression = { ...base(), materials: { scrapMetal: 15 } };
    expect("error" in performNpcAction(p, "vos", "accept:hold-the-line", NOW)).toBe(true); // needs trusted
    p = ok(performNpcAction(p, "ines", "accept:salvage-drive", NOW));
    p = ok(performNpcAction(p, "ines", "turnin:salvage-drive", NOW));
    expect(p.materials.scrapMetal).toBe(3); expect(p.materials.microCircuits).toBe(5);
  });
  test("intel reveals a stash that opens once when you reach it", () => {
    let p: PlayerProgression = { ...base(), materials: { scrapMetal: 20 } };
    p = ok(performNpcAction(p, "whisper", "intel:nexus-arcology-cache", NOW));
    expect(livingMarkers(p).map((m) => m.id)).toContain("stash:nexus-arcology-cache");
    const at = intelPoint(INTEL[0]!);
    const r1 = recordReach(p, at.x, at.z);
    expect(r1.messages.length).toBe(1);
    expect(r1.progression.fractureShards).toBe(p.fractureShards + 40);
    expect(recordReach(r1.progression, at.x, at.z).messages.length).toBe(0);
    expect(livingMarkers(r1.progression).length).toBe(0);
  });
  test("SURVEY completes by walking there", () => {
    let p = ok(performNpcAction(base(), "patch", "accept:dead-drop", NOW));
    const pt = contractPoint(CONTRACTS.find((c) => c.id === "dead-drop")!)!;
    p = recordReach(p, pt.x + 2, pt.z).progression;
    p = ok(performNpcAction(p, "patch", "turnin:dead-drop", NOW));
    expect(repOf(p.living, "syndicate")).toBe(8); expect(repOf(p.living, "aegis")).toBe(-4);
  });
  test("the Neon pledge is one decision: it needs trust and closes the rival's offer", () => {
    let p: PlayerProgression = { ...base(), living: adjustRep(adjustRep(EMPTY_LIVING, "syndicate", 30, false), "aegis", 30, false) };
    p = ok(performNpcAction(p, "kiro", "pledge:syndicate", NOW));
    expect(p.story.choices[PLEDGE_KEY]).toBe("syndicate");
    expect(repOf(p.living, "aegis")).toBe(5);
    expect(npcActions(p, LIVING_NPCS.find((n) => n.id === "thorne")!).some((a) => a.id.startsWith("pledge"))).toBe(false);
    expect(npcLine(p, LIVING_NPCS.find((n) => n.id === "thorne")!)).toContain("where you pledged");
  });
  test("hostile standing only offers amends, which restore trade", () => {
    let p: PlayerProgression = { ...base(), materials: { scrapMetal: 25 }, living: adjustRep(EMPTY_LIVING, "wardens", -45) };
    const acts = npcActions(p, LIVING_NPCS.find((n) => n.id === "vos")!);
    expect(acts.map((a) => a.id)).toEqual(["amends:wardens"]);
    p = ok(performNpcAction(p, "vos", "amends:wardens", NOW));
    expect(tierOf(p.living, "wardens")).not.toBe("HOSTILE");
  });
});

describe("world events", () => {
  const inp = (o: Partial<DirectorInput>): DirectorInput => ({ dt: 1, now: NOW, rnd: mulberry32(3), px: CITIES.nexus.x, pz: CITIES.nexus.z, alive: true, city: "nexus", blocked: false, tagAlive: 0, playerKills: 0, fallen: [], ...o });
  test("nothing starts outside a city or while blocked", () => {
    let d = { ...createLivingDirector(), next: 0.5 };
    expect(stepLivingDirector(d, inp({ city: null })).started).toBeUndefined();
    expect(stepLivingDirector(d, inp({ blocked: true })).started).toBeUndefined();
    const s = stepLivingDirector(d, inp({}));
    expect(s.started?.city).toBe("nexus");
    d = s.director;
    expect(d.current?.phase).toBe("WARNING");
  });
  test("warning → active → won only when cleared with player kills", () => {
    const ev = pickEvent("nexus", () => 0, [], NOW, 1); // first kind = INVASION
    expect(ev.kind).toBe("INVASION");
    let d = { next: 0, serial: 1, current: ev };
    let s = stepLivingDirector(d, inp({ dt: EVENT_RULES.INVASION.warn + 0.1 }));
    expect(s.activated?.phase).toBe("ACTIVE");
    d = { ...s.director, current: { ...s.director.current!, spawned: true } };
    expect(stepLivingDirector(d, inp({ tagAlive: 3 })).resolved).toBeUndefined();
    s = stepLivingDirector(d, inp({ tagAlive: 0, playerKills: 4 }));
    expect(s.resolved?.outcome).toBe("WON");
    // cleared by the city patrols alone: no reward, but no district loss either
    const patrols = stepLivingDirector(d, inp({ tagAlive: 0, playerKills: 0 }));
    expect(patrols.resolved?.outcome).toBe("FAILED");
    const r = resolveLivingEvent(base(), patrols.resolved!.event, "FAILED", NOW);
    expect(r.progression.living.districts).toEqual({});
    expect(r.progression.materials).toEqual({});
  });
  test("leaving the city or running out of time fails it", () => {
    const d = { next: 0, serial: 1, current: { ...pickEvent("neon", () => 0.1, [], NOW, 1), phase: "ACTIVE" as const, timer: 50, spawned: true } };
    expect(stepLivingDirector(d, inp({ px: CITIES.neon.x + 400, pz: CITIES.neon.z, city: null, tagAlive: 2 })).resolved?.outcome).toBe("FAILED");
    expect(stepLivingDirector({ ...d, current: { ...d.current, timer: 0.5 } }, inp({ px: CITIES.neon.x, pz: CITIES.neon.z, city: "neon", tagAlive: 2 })).resolved?.outcome).toBe("FAILED");
  });
  test("a fracture is won by holding the rift", () => {
    const fr = { ...pickEvent("neon", () => 0, [], NOW, 1), kind: "FRACTURE" as const, phase: "ACTIVE" as const, timer: 100 };
    let d = { next: 0, serial: 1, current: fr };
    let won = false;
    for (let t = 0; t < FRACTURE_HOLD + 2 && !won; t++) { const s = stepLivingDirector(d, inp({ px: fr.x, pz: fr.z, city: "neon", tagAlive: 5 })); won = s.resolved?.outcome === "WON"; d = s.director as typeof d; }
    expect(won).toBe(true);
  });
  test("fallen districts are retaken first", () => {
    const ev = pickEvent("nexus", mulberry32(9), ["nexus:shipyard"], NOW, 2);
    expect(ev.kind).toBe("INVASION"); expect(ev.district).toBe("nexus:shipyard");
  });
  test("resolution changes standing, district, contracts and pays exactly once", () => {
    let p = ok(performNpcAction({ ...base(), living: adjustRep(EMPTY_LIVING, "wardens", 25) }, "vos", "accept:hold-the-line", NOW));
    const ev = { id: "e1", kind: "INVASION" as const, city: "nexus" as const, district: "nexus:market" };
    const r = resolveLivingEvent(p, ev, "WON", NOW);
    expect(repOf(r.progression.living, "guild")).toBe(EVENT_RULES.INVASION.win.rep);
    expect(districtStatus(r.progression.living, "nexus:market", NOW)).toBe("SECURED");
    expect(r.progression.living.contracts["hold-the-line"]!.progress).toBe(1);
    expect(resolveLivingEvent(r.progression, ev, "WON", NOW).progression).toBe(r.progression);
    p = resolveLivingEvent(r.progression, { ...ev, id: "e2" }, "FAILED", NOW + 1).progression;
    expect(districtStatus(p.living, "nexus:market", NOW + 2)).toBe("FALLEN");
  });
  test("stopping the Syndicate convoy costs Syndicate standing and earns Aegis standing", () => {
    const r = resolveLivingEvent(base(), { id: "c1", kind: "CONVOY", city: "neon", district: "neon:grid" }, "WON", NOW);
    expect(repOf(r.progression.living, "aegis")).toBe(EVENT_RULES.CONVOY.win.rep);
    expect(repOf(r.progression.living, "syndicate")).toBe(-8);
  });
});

describe("living city reactions", () => {
  test("civilians flee nearby combat, cower, then calm down", () => {
    const c = spawnCivilian({ id: "t", name: "T", role: "VENDOR", title: "", lore: "", homeX: 0, homeZ: 0 }, 0);
    const rnd = mulberry32(1);
    stepCivilian(c, 0.2, 100, 100, rnd, [{ x: 5, z: 0 }]);
    expect(c.state).toBe("FLEE");
    const x0 = c.x;
    for (let i = 0; i < 10; i++) stepCivilian(c, 0.2, 100, 100, rnd, [{ x: 5, z: 0 }]);
    expect(c.x).toBeLessThan(x0);
    for (let i = 0; i < 60; i++) stepCivilian(c, 0.2, 100, 100, rnd, [{ x: c.x + PANIC_RADIUS + 20, z: 0 }]);
    expect(["WANDER", "IDLE"]).toContain(c.state);
  });
  test("guards shoot invaders in their city, never finish a boss, and only fire on a hostile player after a warning", () => {
    const guards = createGuards();
    const g = guards.find((x) => x.id === "warden-north")!;
    const rnd = mulberry32(5);
    const targets = [{ x: g.x + 10, z: g.z, alive: true, boss: false, hp: 5 }, { x: g.x - 25, z: g.z, alive: true, boss: true, hp: 10, maxHp: 40 }];
    let hits = 0;
    for (let i = 0; i < 40; i++) hits += stepGuards(guards, targets, { dt: 0.25, px: 0, pz: 0, playerAlive: true, stance: () => "ally", rand: rnd }).hits.filter((h) => h.index === 0).length;
    expect(hits).toBeGreaterThan(0);
    const bossHits = stepGuards(guards, [targets[1]!], { dt: 1, px: 0, pz: 0, playerAlive: true, stance: () => "ally", rand: () => 0 }).hits;
    expect(bossHits.every((h) => h.damage === 0)).toBe(true);
    const fresh = createGuards();
    const w = fresh.find((x) => x.id === "warden-north")!;
    const first = stepGuards(fresh, [], { dt: 0.1, px: w.x + 4, pz: w.z, playerAlive: true, stance: (f) => (f === "wardens" ? "hostile" : "ally"), rand: () => 0 });
    expect(first.warnings).toContain("wardens"); expect(first.playerDamage).toBe(0);
    let dmg = 0;
    for (let t = 0; t < WARN_SECONDS + 3; t += 0.25) dmg += stepGuards(fresh, [], { dt: 0.25, px: w.x + 4, pz: w.z, playerAlive: true, stance: (f) => (f === "wardens" ? "hostile" : "ally"), rand: () => 0 }).playerDamage;
    expect(dmg).toBeGreaterThan(0);
    const calm = createGuards();
    const c2 = calm.find((x) => x.id === "warden-north")!;
    let none = 0;
    for (let t = 0; t < 6; t += 0.25) none += stepGuards(calm, [], { dt: 0.25, px: c2.x + 4, pz: c2.z, playerAlive: true, stance: () => "ally", rand: () => 0 }).playerDamage;
    expect(none).toBe(0);
  });
});
