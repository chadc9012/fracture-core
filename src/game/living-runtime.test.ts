// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { createSim, defeatMachine, stepSim } from "./sim";
import { createLivingRuntime, stepLivingRuntime, type LivingEmit } from "./living-runtime";
import { CITIES, EMPTY_LIVING, adjustRep } from "./living-world";
import { EVENT_RULES } from "./living-events";
import { mulberry32 } from "./rng";

const NOW = 1_800_000_000_000;
const quiet = () => { const sim = createSim(); for (const m of sim.machines) m.alive = false; return sim; };
const C = CITIES.nexus;

describe("living runtime against the real sim", () => {
  it("runs an invasion: warns, spawns tagged hostiles, and is won by the player's kills", () => {
    const sim = quiet();
    const rt = createLivingRuntime(sim);
    rt.director.next = 0.1;
    const rnd = mulberry32(2);
    const emits: LivingEmit[] = [];
    const step = (dt: number, px = C.x, pz = C.z) => { const r = stepLivingRuntime(rt, sim, { dt, now: NOW, px, pz, blocked: false, living: EMPTY_LIVING, fallen: [], markers: [], rnd }); emits.push(...r.emits); return r.hud; };
    step(0.2);
    const ev = rt.director.current!;
    expect(ev.phase).toBe("WARNING");
    expect(sim.alerts.some((a) => a.text.includes(EVENT_RULES[ev.kind].title))).toBe(true);
    for (let t = 0; t < EVENT_RULES[ev.kind].warn + 1; t += 0.5) step(0.5);
    expect(rt.director.current!.phase).toBe("ACTIVE");
    const tagged = sim.machines.filter((m) => m.alive && m.living === ev.id);
    if (ev.kind !== "FRACTURE") {
      expect(tagged.length).toBeGreaterThan(0);
      for (const m of tagged) { m.hp = 0; defeatMachine(sim, m, "player"); }
      expect(tagged.every((m) => m.living === undefined)).toBe(true);
      step(0.1);
      const res = emits.find((e) => e.type === "EVENT");
      expect(res && res.type === "EVENT" && res.outcome).toBe("WON");
    }
  });

  it("kills inside a city are reported for contracts; kills outside are not", () => {
    const sim = quiet();
    const rt = createLivingRuntime(sim);
    rt.director.next = 1e9;
    const run = (px: number, pz: number) => { sim.kills += 2; const out: LivingEmit[] = []; for (let i = 0; i < 4; i++) out.push(...stepLivingRuntime(rt, sim, { dt: 0.5, now: NOW, px, pz, blocked: false, living: EMPTY_LIVING, fallen: [], markers: [], rnd: Math.random }).emits); return out; };
    expect(run(C.x + 10, C.z)).toEqual([{ type: "KILLS", city: "nexus", count: 2 }, { type: "REGION_KILLS", region: "nexus", count: 2 }]);
    expect(run(C.x + 900, C.z).filter((e) => e.type === "KILLS")).toEqual([]);
  });

  it("event machines are not scripted-mission machines and are never leashed away", () => {
    const sim = quiet();
    const rt = createLivingRuntime(sim);
    rt.director.next = 0.1;
    stepLivingRuntime(rt, sim, { dt: 0.2, now: NOW, px: C.x, pz: C.z, blocked: false, living: EMPTY_LIVING, fallen: [], markers: [], rnd: () => 0 });
    stepLivingRuntime(rt, sim, { dt: 30, now: NOW, px: C.x, pz: C.z, blocked: false, living: EMPTY_LIVING, fallen: [], markers: [], rnd: () => 0 });
    const tagged = sim.machines.filter((m) => m.alive && m.living);
    expect(tagged.length).toBeGreaterThan(0);
    expect(tagged.some((m) => m.mission)).toBe(false);
    for (let i = 0; i < 90; i++) stepSim(sim, { dt: 0.05, px: C.x + 600, pz: C.z, night: 0, inVehicle: false, yaw: 0 });
    expect(sim.machines.filter((m) => m.alive && m.living).length).toBe(tagged.length);
  });

  it("a hostile faction's patrol fires on the player after its warning; allies never do", () => {
    const sim = quiet();
    const rt = createLivingRuntime(sim);
    rt.director.next = 1e9;
    const g = rt.guards.find((x) => x.faction === "wardens")!;
    const hp0 = sim.hp;
    for (let i = 0; i < 40; i++) stepLivingRuntime(rt, sim, { dt: 0.25, now: NOW, px: g.x + 3, pz: g.z, blocked: false, living: EMPTY_LIVING, fallen: [], markers: [], rnd: () => 0 });
    expect(sim.hp).toBe(hp0);
    for (let i = 0; i < 40; i++) stepLivingRuntime(rt, sim, { dt: 0.25, now: NOW, px: g.x + 3, pz: g.z, blocked: false, living: adjustRep(EMPTY_LIVING, "wardens", -60), fallen: [], markers: [], rnd: () => 0 });
    expect(sim.hp).toBeLessThan(hp0);
    expect(sim.alerts.some((a) => a.text.includes("Nexus Wardens patrol"))).toBe(true);
  });

  it("patrol kills never pay the player or mark player damage", () => {
    const sim = quiet();
    const rt = createLivingRuntime(sim);
    rt.director.next = 1e9;
    const g = rt.guards.find((x) => x.id === "warden-north")!;
    const m = sim.machines[0]!;
    Object.assign(m, { alive: true, x: g.x + 8, z: g.z, hp: 2, boss: false, elite: false, scale: 1, cool: 5, profile: "Test", living: "ev-x" });
    for (let i = 0; i < 60 && m.alive; i++) stepLivingRuntime(rt, sim, { dt: 0.25, now: NOW, px: C.x + 130, pz: C.z, blocked: false, living: EMPTY_LIVING, fallen: [], markers: [], rnd: () => 0 });
    expect(m.alive).toBe(false);
    expect(sim.kills).toBe(0);
    expect(sim.livingKills["ev-x"] ?? 0).toBe(0);
  });

  it("a Living World boss killed by the world (walls, patrols) pays nothing; a catalog boss still does", () => {
    const sim = quiet();
    const m = sim.machines[0]!;
    Object.assign(m, { alive: true, x: C.x, z: C.z, hp: 0, boss: true, elite: true, scale: 2, profile: "Aegis-Prime", living: "ev-b" });
    defeatMachine(sim, m, "world");
    expect(m.alive).toBe(false); expect(sim.kills).toBe(0); expect(sim.credits).toBe(createSim().credits);
    const n = sim.machines[1]!;
    Object.assign(n, { alive: true, x: C.x, z: C.z, hp: 0, boss: true, elite: true, scale: 2, profile: "Catalog", drop: "aegisCore", zone: "nexus" });
    defeatMachine(sim, n, "world");
    expect(sim.kills).toBe(1);
  });
});
