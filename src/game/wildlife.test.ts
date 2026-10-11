// @ts-ignore bun:test types
import { describe, expect, test } from "bun:test";
import { spawnCritter, stepCritter, SPECIES_PROFILE, seededRnd, type Alarms, type Critter, type Habitat, type Threat } from "./wildlife";
import { buildPopulation, isWet, lakeSurfaceAt, HABITAT } from "./wildlife-habitat";
import { isReserved } from "./verdant";
import { REGIONS, regionAt } from "./world";
import { waterNetwork } from "./terrain";

const far: Threat = { x: 9999, z: 9999, speed: 0, sprinting: false };
const run = (c: Critter, seconds: number, threat: Threat, habitat?: Habitat, alarms?: Alarms) => {
  const rnd = seededRnd(5);
  for (let t = 0; t < seconds; t += 0.05) stepCritter(c, 0.05, threat, rnd, habitat, alarms, t);
  return c;
};

describe("wildlife behaviour", () => {
  test("left alone, a deer grazes and wanders but stays near home", () => {
    const d = spawnCritter("d", "DEER", 0, 0, 1);
    const seen = new Set<string>();
    const rnd = seededRnd(2);
    for (let t = 0; t < 120; t += 0.05) { stepCritter(d, 0.05, far, rnd); seen.add(d.state); expect(Math.hypot(d.x, d.z)).toBeLessThan(SPECIES_PROFILE.DEER.homeRadius * 1.9); }
    expect(seen.has("WANDER")).toBe(true);
    expect(seen.has("GRAZE")).toBe(true);
  });
  test("its legs move only when it moves (phase follows distance, so feet don't skate)", () => {
    const d = spawnCritter("d", "DEER", 0, 0, 1);
    d.state = "IDLE"; d.timer = 99; const p0 = d.phase;
    run(d, 2, far);
    expect(d.phase - p0).toBeLessThan(2); // only slow idle breathing
  });
  test("a standing player never spooks it; a moving one makes it look, then bolt", () => {
    const d = spawnCritter("d", "DEER", 0, 0, 1); d.timer = 99;
    run(d, 1, { x: 10, z: 0, speed: 0, sprinting: false });
    expect(d.state === "FLEE" || d.state === "ALERT").toBe(false);
    stepCritter(d, 0.05, { x: 25, z: 0, speed: 1.5, sprinting: false }, seededRnd(1));
    expect(d.state).toBe("ALERT");
    stepCritter(d, 0.05, { x: 10, z: 0, speed: 1.5, sprinting: false }, seededRnd(1));
    expect(d.state).toBe("FLEE");
    const x0 = d.x;
    run(d, 1.5, { x: 10, z: 0, speed: 1.5, sprinting: false });
    expect(d.x).toBeLessThan(x0); // ran away from the player (who is at +x)
  });
  test("sprinting is heard from further away", () => {
    const a = spawnCritter("a", "DEER", 0, 0, 1), b = spawnCritter("b", "DEER", 0, 0, 1);
    stepCritter(a, 0.05, { x: 25, z: 0, speed: 6, sprinting: false }, seededRnd(1));
    stepCritter(b, 0.05, { x: 25, z: 0, speed: 6, sprinting: true }, seededRnd(1));
    expect(a.state).toBe("ALERT");
    expect(b.state).toBe("FLEE");
  });
  test("the herd bolts together", () => {
    const alarms: Alarms = new Map();
    const lead = spawnCritter("a", "DEER", 0, 0, 1, "herd"), calm = spawnCritter("b", "DEER", 30, 0, 2, "herd");
    stepCritter(lead, 0.05, { x: 5, z: 0, speed: 2, sprinting: false }, seededRnd(1), undefined, alarms, 0);
    stepCritter(calm, 0.05, { x: 5, z: 0, speed: 2, sprinting: false }, seededRnd(1), undefined, alarms, 0.05);
    expect(lead.state).toBe("FLEE");
    expect(calm.state).toBe("FLEE");
  });
  test("ground animals never walk into water", () => {
    const wet: Habitat = { isWet: (x) => x > 5 };
    const d = spawnCritter("d", "DEER", 0, 0, 3);
    const rnd = seededRnd(9);
    for (let t = 0; t < 200; t += 0.05) { stepCritter(d, 0.05, { x: -10, z: 0, speed: 3, sprinting: true }, rnd, wet); expect(d.x).toBeLessThanOrEqual(5.01); }
  });
  test("birds take off when disturbed, fly, then land again", () => {
    const b = spawnCritter("b", "SONGBIRD", 0, 0, 4);
    expect(b.state).toBe("GROUND");
    stepCritter(b, 0.05, { x: 3, z: 0, speed: 2, sprinting: false }, seededRnd(1));
    expect(b.state).toBe("FLY");
    run(b, 3, far);
    expect(b.alt).toBeGreaterThan(2);
    run(b, 40, far);
    expect(b.state).toBe("GROUND");
    expect(b.alt).toBe(0);
  });
  test("vultures circle high over their range", () => {
    const v = spawnCritter("v", "VULTURE", 0, 0, 5);
    v.homeRadius = 50; v.x = 50; v.z = 0;
    run(v, 60, far);
    expect(v.alt).toBeGreaterThan(20);
    expect(Math.hypot(v.x, v.z)).toBeGreaterThan(20);
    expect(Math.hypot(v.x, v.z)).toBeLessThan(90);
  });
  test("fish stay inside their lake and scatter from a swimmer", () => {
    const f = spawnCritter("f", "FISH", 0, 0, 6);
    f.homeRadius = 8;
    run(f, 30, far);
    expect(Math.hypot(f.x, f.z)).toBeLessThan(8.6);
    f.x = 1; f.z = 0;
    stepCritter(f, 0.05, { x: 0, z: 0, speed: 1, sprinting: false }, seededRnd(1));
    run(f, 0.6, { x: 0, z: 0, speed: 1, sprinting: false });
    expect(f.x).toBeGreaterThan(1);
  });
});

describe("wildlife placement in the real world", () => {
  const pop = buildPopulation();
  test("there is real wildlife in the forest, mountains, swamp, deserts and city", () => {
    const by = (s: string) => pop.filter((c) => c.species === s).length;
    expect(by("DEER")).toBeGreaterThanOrEqual(8);
    expect(by("FOX")).toBeGreaterThanOrEqual(2);
    expect(by("RABBIT")).toBeGreaterThanOrEqual(6);
    expect(by("SONGBIRD")).toBeGreaterThanOrEqual(10);
    expect(by("VULTURE")).toBeGreaterThanOrEqual(4);
    expect(new Set(pop.map((c) => c.id)).size).toBe(pop.length);
  });
  test("no land animal starts in water or on the mission trail", () => {
    for (const c of pop) {
      const loc = SPECIES_PROFILE[c.species].locomotion;
      if (loc === "fish" || loc === "soar") continue;
      expect(isWet(c.x, c.z)).toBe(false);
      expect(isReserved(c.homeX, c.homeZ, 6)).toBe(false);
    }
  });
  test("each herd lives in its own region", () => {
    for (const c of pop) {
      if (SPECIES_PROFILE[c.species].locomotion !== "ground") continue;
      const want = c.group.split("-")[1]!;
      expect(regionAt(c.homeX, c.homeZ)?.id ?? want).toBe(want);
    }
  });
  test("fish only spawn inside lakes", () => {
    const fish = pop.filter((c) => c.species === "FISH");
    if (waterNetwork().lakes.some((l) => l.r >= 6)) expect(fish.length).toBeGreaterThan(0);
    for (const f of fish) expect(lakeSurfaceAt(f.x, f.z)).not.toBeNull();
  });
  test("a minute of simulation keeps every land animal dry", () => {
    const rnd = seededRnd(11);
    const sample = pop.filter((c) => SPECIES_PROFILE[c.species].locomotion === "ground").slice(0, 25).map((c) => ({ ...c }));
    for (let t = 0; t < 60; t += 0.1) for (const c of sample) stepCritter(c, 0.1, { x: c.x + 8, z: c.z, speed: 2, sprinting: t > 30 }, rnd, HABITAT, undefined, t);
    for (const c of sample) expect(isWet(c.x, c.z)).toBe(false);
  });
  test("regions exist for every plan", () => { for (const id of ["veridan", "frostspire", "swamps", "solara", "wastelands", "nexus"]) expect(REGIONS.some((r) => r.id === id)).toBe(true); });
});
