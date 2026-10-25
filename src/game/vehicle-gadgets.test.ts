import { describe, expect, test } from "bun:test";
import { FLEET } from "./fleet";
import { armamentFor } from "./vehicle-weapons";
import { vehicleById } from "./vehicles";
import { handlingFor } from "./vehicle-handling";
import {
  dropMine, droneTarget, freshGadgets, GADGET, GADGET_BY_BUILD, gadgetFor, inCaltrops, inFlames, launchCaltrops, launchDrone,
  mineTriggered, popFlares, ramFor, spoofed, stepDrone, stepFlares,
} from "./vehicle-gadgets";
import { collidePlayer, createSim, stepSim, type Machine, type WorldSim } from "./sim";
import { walkHeight } from "./terrain";

describe("every listed gadget hardpoint works", () => {
  test("each build's non-gun hardpoint maps to a gadget, named as the garage lists it", () => {
    for (const [id, gd] of Object.entries(GADGET_BY_BUILD)) {
      const b = FLEET.find((f) => f.id === id);
      expect(b, id).toBeDefined();
      expect(b!.hardpoints).toContain(gd.name);
      // the gadget takes the secondary trigger: the build has no second gun or ordnance in the way
      const arm = armamentFor(b!.base, handlingFor(vehicleById(b!.base as never)).kind, id);
      if (gd.use !== "PASSIVE") { expect(arm.secondary, id).toBeNull(); expect(arm.secondaryGun ?? null, id).toBeNull(); }
    }
    expect(gadgetFor("civic-rover")).toBeNull();
    expect(gadgetFor(null)).toBeNull();
  });
});

describe("gadget rules", () => {
  test("a mine arms after a moment, then goes off when something is on it; oldest mine goes past the cap", () => {
    const st = freshGadgets();
    dropMine(st, "MINE", 0, 0, 0, 10);
    const m = st.mines[0]!;
    expect(mineTriggered(m, 10.2, [{ x: 1, z: 0 }])).toBe(false);
    expect(mineTriggered(m, 11, [{ x: 1, z: 0 }])).toBe(true);
    expect(mineTriggered(m, 11, [{ x: 9, z: 0 }])).toBe(false);
    for (let i = 0; i < 10; i++) dropMine(st, "MINE", i, 0, 0, 10);
    expect(st.mines.length).toBe(GADGET.MINE.max);
  });
  test("caltrops cover a field behind and expire", () => {
    const st = freshGadgets();
    launchCaltrops(st, 0, 0, 0);
    expect(inCaltrops(st, 3, 2, 1)).toBe(true);
    expect(inCaltrops(st, 9, 0, 1)).toBe(false);
    expect(inCaltrops(st, 1, 0, GADGET.CALTROPS.life + 1)).toBe(false);
  });
  test("flames wrap the hull and reach a little further ahead", () => {
    const src = { x: 0, z: 0, yaw: 0 };
    expect(inFlames(src, { x: 4, z: 0 })).toBe(true);
    expect(inFlames(src, { x: 0, z: 8 })).toBe(true); // ahead: capsule
    expect(inFlames(src, { x: 0, z: -8 })).toBe(false);
    expect(inFlames(src, { x: 9, z: 0 })).toBe(false);
  });
  test("flares spoof enemy fire for a moment and the decoys fall", () => {
    const st = freshGadgets();
    popFlares(st, 0, 50, 0, 0, 0);
    expect(spoofed(st, 1)).toBe(true);
    expect(spoofed(st, GADGET.FLARES.spoof + 0.1)).toBe(false);
    const y0 = st.flares[0]!.y;
    for (let i = 0; i < 150; i++) stepFlares(st, i / 60, 1 / 60);
    expect(st.flares[0]!.y).toBeLessThan(y0);
  });
  test("the drone climbs to its orbit over the player and picks the nearest visible target", () => {
    const st = freshGadgets();
    launchDrone(st, 0, 2, 0, 0);
    const d = st.drones[0]!;
    for (let i = 0; i < 120; i++) stepDrone(d, { x: 0, y: 2, z: 0 }, 1 / 60);
    expect(d.y).toBeGreaterThan(8);
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(GADGET.DRONE.orbit, 0);
    const ts = [{ x: 40, z: 0, alive: true }, { x: 15, z: 0, alive: true }, { x: 5, z: 0, alive: false }];
    expect(droneTarget(d, ts)).toBe(1);
    expect(droneTarget(d, ts, (i) => i !== 1)).toBe(0);
    launchDrone(st, 0, 2, 0, 1);
    expect(st.drones.length).toBe(1); // one per dock
  });
  test("the grill always rams harder; the breach thruster only during its window", () => {
    expect(ramFor(GADGET_BY_BUILD["goliath-4x4"]!, 0, 5).damageMult).toBeGreaterThan(2);
    const breach = GADGET_BY_BUILD["void-skimmer-prototype"]!;
    expect(ramFor(breach, 6, 5).damageMult).toBeGreaterThan(2);
    expect(ramFor(breach, 4, 5).damageMult).toBe(1);
    expect(ramFor(null, 0, 0)).toEqual({ damageMult: 1, selfMult: 1 });
  });
});

describe("gadgets in the sim", () => {
  const PX = -240, PZ = -230;
  function world(hp = 30) {
    const sim = createSim();
    for (const t of sim.trucks) t.alive = false;
    for (const o of sim.machines) o.alive = false;
    const m = sim.machines[0]!;
    const x = PX, z = PZ + 30;
    Object.assign(m, { alive: true, x, z, y: walkHeight(x, z) + 2.2 * 0.95, hp, maxHp: hp, rot: Math.PI, scale: 0.95, zone: "wastelands", cool: 0, elite: false, boss: false, profile: "Test Grunt", kind: "RAIDER", drop: "scrapMetal", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, mission: true, react: undefined }) as Machine;
    delete m.ai; delete m.los;
    return { sim, m };
  }
  const step = (sim: WorldSim, frames: number, before?: () => void) => {
    for (let f = 0; f < frames; f++) { before?.(); sim.hp = 100; stepSim(sim, { px: PX, pz: PZ, dt: 1 / 60, night: 0, inVehicle: true, yaw: 0, py: walkHeight(PX, PZ) + 1.7, pspeed: 0, stance: "STAND" }); }
  };
  const now = () => performance.now() / 1000;

  test("a trooper on an armed mine is blown up", () => {
    const { sim, m } = world(12);
    dropMine(sim.gadgets, "MINE", m.x, walkHeight(m.x, m.z), m.z - 2, now() - 2);
    const bursts = sim.burstEvents.length;
    step(sim, 60 * 3);
    expect(m.alive).toBe(false);
    expect(sim.burstEvents.length).toBeGreaterThan(bursts);
    expect(sim.gadgets.mines.length).toBe(0);
  });
  test("an EMP mine stuns and slows instead of killing", () => {
    const { sim, m } = world(1e6);
    dropMine(sim.gadgets, "EMP_MINE", m.x, walkHeight(m.x, m.z), m.z, now() - 2);
    step(sim, 2);
    expect(m.alive).toBe(true);
    expect(m.cool).toBeGreaterThan(GADGET.EMP_MINE.stun - 0.2);
    expect(m.snareMult).toBe(GADGET.EMP_MINE.slow);
    expect(sim.burstEvents.at(-1)?.fx).toBe("ARC");
  });
  test("caltrops slow a trooper crossing them", () => {
    const run = (spikes: boolean) => {
      const { sim, m } = world(1e6);
      if (spikes) launchCaltrops(sim.gadgets, m.x, m.z - 3, now());
      const z0 = m.z;
      step(sim, 60);
      return z0 - m.z;
    };
    expect(run(true)).toBeLessThan(run(false) * 0.7);
  });
  test("flame jets burn what is next to the hull and nothing far off", () => {
    const { sim, m } = world(1e6);
    const far = sim.machines[1]!;
    Object.assign(far, { ...m, x: PX + 30, z: PZ, hp: 1e6, maxHp: 1e6 });
    m.x = PX + 3; m.z = PZ;
    step(sim, 60, () => { m.x = PX + 3; m.z = PZ; sim.gadgets.flame = { x: PX, z: PZ, yaw: 0 }; });
    expect(1e6 - m.hp).toBeGreaterThan(GADGET.FLAME.dps * 0.8);
    expect(far.hp).toBe(1e6);
    expect(sim.weaponHeat).toBeGreaterThan(10);
  });
  test("the Remora drone shoots a trooper down", () => {
    const { sim, m } = world(8);
    launchDrone(sim.gadgets, PX, walkHeight(PX, PZ) + 3, PZ, now());
    step(sim, 60 * 12, () => { m.x = PX; m.z = PZ + 30; });
    expect(m.alive).toBe(false);
  });
  test("flares: enemy rounds miss while they burn", () => {
    const count = (flares: boolean) => {
      const { sim, m } = world(1e6);
      m.z = PZ + 12;
      let hits = 0;
      step(sim, 60 * 25, () => {
        m.x = PX; m.z = PZ + 12;
        if (flares && !spoofed(sim.gadgets, now())) popFlares(sim.gadgets, PX, 40, PZ, 0, now());
        for (const s of sim.enemyShots.splice(0)) if (s.hit) hits++;
      });
      return hits;
    };
    expect(count(false)).toBeGreaterThan(0);
    expect(count(true)).toBe(0);
  });
  test("the ramming grill hits harder and hurts the hull less", () => {
    const ram = (grill: boolean) => {
      const { sim, m } = world(1e6);
      m.x = PX; m.z = PZ + 4;
      sim.gadgets.ram = grill ? ramFor(GADGET_BY_BUILD["goliath-4x4"]!, 0, 0) : { damageMult: 1, selfMult: 1 };
      sim.impactCool = 0; sim.hp = 100;
      collidePlayer(sim, { x: PX, z: PZ, yaw: 0, vSpeed: 30, inVehicle: true });
      return { dealt: 1e6 - m.hp, taken: 100 - sim.hp };
    };
    const plain = ram(false), grill = ram(true);
    expect(grill.dealt).toBeGreaterThan(plain.dealt * 2);
    expect(grill.taken).toBeLessThan(plain.taken * 0.5);
  });
});
