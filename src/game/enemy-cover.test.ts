import { describe, expect, test } from "bun:test";
import { coverCandidates, coverPhase, findCover, COVER_CHEST, HIDE_SECONDS } from "./enemy-cover";
import { canSee } from "./line-of-sight";
import { addObstacle, queryObstacles, resetObstacles } from "./obstacles";
import { createSim, stepSim, type Machine } from "./sim";
import { walkHeight } from "./terrain";
import { registeredModelSolids, removeModelSolid, setModelSolid } from "./environment-collision";

const flat = { ground: () => 0 };
const player = { x: 0, y: 1.6, z: 0 };

describe("finding cover", () => {
  test("a wall near the trooper: the spot is behind it (hidden) and the lean-out spot sees the player", () => {
    const wall = { x: 4, y: 1.1, z: 20, w: 3, h: 2.2, d: 0.6 };
    const world = { ...flat, solids: [wall] };
    const c = findCover(0, 20, player, coverCandidates([], [wall], () => 0), world);
    expect(c).not.toBeNull();
    expect(Math.hypot(c!.x, c!.z)).toBeGreaterThan(Math.hypot(wall.x, wall.z)); // the far side
    expect(canSee(player, { x: c!.x, y: COVER_CHEST, z: c!.z }, world)).toBe(false);
    expect(canSee(player, { x: c!.peekX, y: 1.35, z: c!.peekZ }, world)).toBe(true);
    expect(c!.run).toBeLessThan(10);
  });
  test("a big rock works; a sapling, a cactus and a kerb do not", () => {
    resetObstacles();
    addObstacle("rock", 3, 18, 1.4, 80, 1);
    addObstacle("tree", -3, 18, 0.3, 20, 1);
    addObstacle("cactus", 0, 14, 0.6, 10, 1);
    const cands = coverCandidates(queryObstacles(0, 18), [{ x: 0, y: 0.15, z: 10, w: 6, h: 0.3, d: 0.4 }], () => 0);
    expect(cands.length).toBe(1);
    const c = findCover(0, 20, player, cands, { ...flat, obstaclesNear: queryObstacles });
    expect(c).not.toBeNull();
    expect(Math.hypot(c!.x - 3, c!.z - 18)).toBeLessThan(3);
    resetObstacles();
  });
  test("open ground: no cover", () => {
    resetObstacles();
    expect(findCover(0, 20, player, coverCandidates([], [], () => 0), flat)).toBeNull();
  });
  test("cover the player is standing at, or too far to run to, is skipped", () => {
    const atPlayer = { x: 1, y: 1.1, z: 1, w: 3, h: 2.2, d: 0.6 };
    const far = { x: 0, y: 1.1, z: 80, w: 3, h: 2.2, d: 0.6 };
    expect(findCover(0, 20, player, coverCandidates([], [atPlayer, far], () => 0), { ...flat, solids: [atPlayer, far] })).toBeNull();
  });
  test("hide, then lean out when the gun is ready, stay out through the wind-up", () => {
    expect(coverPhase(HIDE_SECONDS, false, 0)).toBe("HIDE");
    expect(coverPhase(0, false, 2)).toBe("HIDE");
    expect(coverPhase(0, false, 0.2)).toBe("PEEK");
    expect(coverPhase(1, true, 0)).toBe("PEEK");
  });
});

describe("a wounded trooper fights from real cover", () => {
  const PX = -240, PZ = -230;
  test("it runs behind the wall, spends time hidden, and only fires when leaning out", () => {
    const sim = createSim();
    for (const t of sim.trucks) t.alive = false;
    for (const o of sim.machines) o.alive = false;
    const m = sim.machines[0]!;
    const sx = PX - 2, sz = PZ + 20;
    Object.assign(m, { alive: true, x: sx, z: sz, y: walkHeight(sx, sz) + 2.2 * 0.95, hp: 5, maxHp: 10, rot: Math.PI, scale: 0.95, zone: "wastelands", cool: 0, elite: false, boss: false, profile: "Test Grunt", kind: "RAIDER", drop: "scrapMetal", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, mission: true, react: undefined }) as Machine;
    delete m.ai; delete m.los;
    const wx = PX + 4, wz = PZ + 22;
    setModelSolid("cover-test-wall", { x: wx, y: walkHeight(wx, wz) + 1.2, z: wz, w: 3, h: 2.4, d: 0.6 });
    const world = { ground: walkHeight, obstaclesNear: queryObstacles, solids: registeredModelSolids() };
    const eye = { x: PX, y: walkHeight(PX, PZ) + 1.7, z: PZ };
    let hidden = 0, fired = 0, firedInView = 0;
    try {
      for (let f = 0; f < 60 * 14; f++) {
        if (f === 2) m.hp -= 0.5; // it gets shot: wounded and below half
        sim.hp = 100; sim.weaponHeat = 0;
        stepSim(sim, { px: PX, pz: PZ, dt: 1 / 60, night: 0, inVehicle: false, yaw: 0, py: eye.y, pspeed: 0, stance: "STAND" });
        const chest = { x: m.x, y: walkHeight(m.x, m.z) + COVER_CHEST, z: m.z };
        if (f > 60 * 4 && !canSee(eye, chest, world)) hidden++;
        for (const s of sim.enemyShots.splice(0)) {
          fired++;
          if (!s.blockAt) firedInView++;
        }
      }
    } finally { removeModelSolid("cover-test-wall"); }
    expect((m as Machine).ai?.peekX).toBeDefined(); // it found the wall, not the old blind side-step
    expect(hidden).toBeGreaterThan(60 * 2); // seconds spent out of sight
    expect(fired).toBeGreaterThan(0); // and it still fights
    expect(firedInView).toBe(fired); // every shot from the lean-out, never into its own wall
  });
});
