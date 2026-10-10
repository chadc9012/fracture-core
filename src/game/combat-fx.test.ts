import { describe, expect, test } from "bun:test";
import { BOSS_ELEMENT, ELEMENT_STYLE, attackFx, createFlights, flightAt, launch, stepFlights, volleyTargets, zoneElement } from "./combat-fx";
import { CASING_OF, casingFor, createCasings, ejectCasing, stepCasings } from "./casings";
import { ORDNANCE, fireRound, ordnanceById, splashDamage, stepRound } from "./ordnance";
import { ENCOUNTERS } from "./scenario-encounters";
import { VEHICLES } from "./vehicles";

const seq = (seed: number) => { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

describe("elements", () => {
  test("regional troops use their region's element; unmapped regions keep plain tracers", () => {
    expect(zoneElement("ember", "RAIDER")).toBe("FIRE");
    expect(zoneElement("frostspire", "VANGUARD")).toBe("ICE");
    expect(zoneElement("swamps", "ABERRATION")).toBe("ACID");
    expect(zoneElement("wastelands", "RAIDER")).toBe("BALLISTIC");
    expect(zoneElement(undefined)).toBe("BALLISTIC");
  });
  test("every element has a style", () => { for (const e of ["FIRE", "ICE", "ACID", "VOID", "ARC", "HOLY", "BALLISTIC"] as const) expect(ELEMENT_STYLE[e].speed).toBeGreaterThan(0); });
});

describe("boss attacks (against the real encounter data)", () => {
  test("every scenario boss has an element and at least one visual attack", () => {
    for (const id of Object.keys(ENCOUNTERS).filter((k) => !ENCOUNTERS[k]!.truce)) { // Vaelith is a non-lethal trial: no new combat visuals
      expect(BOSS_ELEMENT[id]).toBeDefined();
      const fx = Object.values(ENCOUNTERS[id]!.attacks).map((a) => attackFx(id, a.id, a.kind));
      expect(fx.some((f) => f.mode !== "none")).toBe(true);
    }
  });
  test("ranged FAN attacks fire volleys: Dark Knight void bolts, Rime Alpha frost breath", () => {
    expect(attackFx("dark-knight", "bolt", "FAN")).toMatchObject({ mode: "volley", element: "VOID", count: 5 });
    expect(attackFx("rime-alpha", "breath", "FAN")).toMatchObject({ mode: "volley", element: "ICE", count: 9 });
  });
  test("the Dark Knight casts staff spells for sweeps and fields; other bosses do not fake spells", () => {
    expect(attackFx("dark-knight", "sweep", "SLAM").mode).toBe("spell");
    expect(attackFx("dark-knight", "fracture", "FIELD").mode).toBe("spell");
    expect(attackFx("dark-knight", "lunge", "LUNGE").mode).toBe("none");
    expect(attackFx("rime-alpha", "pounce", "POUNCE").mode).toBe("none");
  });
  test("acid and fire exist as visible elements for bosses (Drowned Monarch acid)", () => {
    expect(BOSS_ELEMENT["drowned-monarch"]).toBe("ACID");
    expect(ELEMENT_STYLE.FIRE.lob).toBeGreaterThan(0);
  });
  test("the Drowned Monarch's field attacks lob acid (it has no ranged attack of its own)", () => {
    expect(attackFx("drowned-monarch", "pressure", "FIELD")).toMatchObject({ mode: "volley", element: "ACID" });
    expect(attackFx("drowned-monarch", "trident", "SLAM").mode).toBe("none");
  });
  test("unknown scenarios draw nothing", () => expect(attackFx("nope", "x", "FAN").mode).toBe("none"));
});

describe("flights", () => {
  test("launch, travel, arrive; pool full returns null instead of stalling", () => {
    const pool = createFlights(2);
    const f = launch(pool, "ACID", [0, 2, 0], [20, 1, 0])!;
    expect(f).not.toBeNull();
    expect(flightAt(f)[0]).toBeCloseTo(0);
    f.age = f.life / 2;
    expect(flightAt(f)[0]).toBeCloseTo(10);
    expect(flightAt(f)[1]).toBeGreaterThan(1.5); // acid lobs
    launch(pool, "ICE", [0, 0, 0], [5, 0, 0]);
    expect(launch(pool, "ICE", [0, 0, 0], [5, 0, 0])).toBeNull();
    expect(stepFlights(pool, 5)).toBe(2);
    expect(pool.some((p) => p.alive)).toBe(false);
  });
  test("volley targets fan evenly and stay within reach", () => {
    const t = volleyTargets({ x: 0, z: 0 }, { x: 0, z: 30 }, 5, 0.3, 40);
    expect(t).toHaveLength(5);
    expect(t[2]!.x).toBeCloseTo(0);
    expect(t[0]!.x).toBeLessThan(0); expect(t[4]!.x).toBeGreaterThan(0);
    for (const p of t) expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(40.01);
  });
});

describe("casings", () => {
  test("ballistic weapons eject; energy and melee do not", () => {
    expect(casingFor("AUTO")).toBe("small");
    expect(casingFor("HEAVY")).toBe("large");
    expect(casingFor("PULSE")).toBeNull();
    expect(casingFor("SWORD")).toBeNull();
    expect(casingFor("unknown")).toBeNull();
    expect(Object.keys(CASING_OF).sort()).toEqual(["AUTO", "HEAVY", "PULSE", "SWORD"]);
    const pool = createCasings(4);
    expect(ejectCasing(pool, "PULSE", 0, 1, 0, 0)).toBeNull();
    expect(pool.some((c) => c.alive)).toBe(false);
  });
  test("a casing falls, bounces at most twice, settles on the ground and expires", () => {
    const pool = createCasings(2);
    const c = ejectCasing(pool, "AUTO", 0, 1.5, 0, 0, seq(4))!;
    let maxBounce = 0;
    for (let i = 0; i < 100; i++) { stepCasings(pool, 0.02, () => 0); maxBounce = Math.max(maxBounce, c.bounces); if (!c.alive) break; }
    expect(maxBounce).toBeLessThanOrEqual(2);
    if (c.alive) expect(c.y).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 200; i++) stepCasings(pool, 0.02, () => 0);
    expect(c.alive).toBe(false);
  });
  test("a full pool recycles the oldest casing instead of growing", () => {
    const pool = createCasings(2);
    ejectCasing(pool, "AUTO", 0, 1, 0, 0); pool[0]!.age = 2;
    ejectCasing(pool, "AUTO", 1, 1, 0, 0);
    ejectCasing(pool, "AUTO", 2, 1, 0, 0);
    expect(pool).toHaveLength(2);
    expect(pool.every((c) => c.alive)).toBe(true);
  });
});

describe("rockets and missiles (rules only)", () => {
  test("unguided rocket flies straight and bursts on the ground", () => {
    const def = ordnanceById("rocket-pod")!;
    const r = fireRound(def, { x: 0, y: 10, z: 0 }, [1, -0.5, 0]);
    let burst = null as ReturnType<typeof stepRound>;
    for (let i = 0; i < 400 && !burst; i++) burst = stepRound(r, 0.02, null, () => 0);
    expect(burst?.reason).toBe("GROUND");
    expect(r.alive).toBe(false);
    expect(r.dz).toBe(0);
  });
  test("a guided missile turns toward a target within its turn rate and detonates by proximity", () => {
    const def = ordnanceById("air-missile")!;
    const target = { x: 0, y: 100, z: 200 };
    const r = fireRound(def, { x: 0, y: 100, z: 0 }, [1, 0, 0]);
    stepRound(r, 0.1, target, () => -1000);
    expect(r.dz).toBeGreaterThan(0);
    expect(Math.hypot(r.dx, r.dy, r.dz)).toBeCloseTo(1, 5);
    let burst = null as ReturnType<typeof stepRound>;
    for (let i = 0; i < 600 && !burst; i++) burst = stepRound(r, 0.02, target, () => -1000);
    expect(burst).not.toBeNull();
    expect(["PROXIMITY", "TIMEOUT"]).toContain(burst!.reason);
  });
  test("a missile with a turn limit cannot reverse instantly", () => {
    const r = fireRound(ordnanceById("guided-missile")!, { x: 0, y: 50, z: 0 }, [0, 0, 1]);
    stepRound(r, 0.1, { x: 0, y: 50, z: -100 }, () => -1000);
    expect(r.dz).toBeGreaterThan(0.9);
  });
  test("splash falls off with distance and is zero past the radius", () => {
    const b = { x: 0, y: 0, z: 0, radius: 6, damage: 40, reason: "GROUND" as const };
    expect(splashDamage(b, 0)).toBe(40);
    expect(splashDamage(b, 3)).toBe(20);
    expect(splashDamage(b, 6)).toBe(0);
  });
  test("every ordnance entry fits only vehicles that exist (or the on-foot launcher)", () => {
    const ids = new Set(VEHICLES.map((v) => v.id));
    for (const o of ORDNANCE) for (const f of o.fits) expect(ids.has(f as never) || f === "foot-heavy").toBe(true);
  });
});
