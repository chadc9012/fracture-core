import { describe, expect, it } from "bun:test";
import { clearDecks, districtDeckAt, registerDeck } from "./district-decks";
import { clearWalls, collideWalls, setWalls } from "./walls";
import { ARENAS, ROOFTOP_RUN as A, arenaDecks, arenaForMode, arenaSolids, arenaWalls, belowKillPlane, confine, fractureAt, fractureLine, fractureVisibility, spawnPoint, surfaceAt, toWorld } from "./killbox-arenas";
import { PVP_MODES, ZONE_RADIUS } from "./pvp";
import { activityById, currentTarget, startActivity } from "./activities";
import { DEFAULT_PROGRESSION } from "./progression";
import { validSpot } from "./resume-spot";

const deckAtLocal = (dx: number, dz: number) => { const w = toWorld(A, dx, dz); return districtDeckAt(w.x, w.z) - A.base; };

describe("Rooftop Run", () => {
  it("plays every arena mode except the royale", () => {
    for (const m of ["clash", "dominion", "freefall", "lockdown", "ascendancy"] as const) expect(arenaForMode(m)?.id).toBe("rooftop-run");
    expect(arenaForMode("royale")).toBeUndefined();
    for (const a of Object.values(ARENAS)) for (const m of a.modes) expect(PVP_MODES[m]).toBeDefined();
  });

  it("is point-symmetric, so neither side has better ground", () => {
    for (let x = -44; x <= 44; x += 2) for (let z = -33; z <= 33; z += 1.5) expect(surfaceAt(A, x, z)).toBe(surfaceAt(A, -x, -z));
    const props = new Set(A.cover.map((k) => `${k.x},${k.z},${k.w},${k.d},${k.h}`));
    for (const k of A.cover) expect(props.has(`${-k.x},${-k.z},${k.w},${k.d},${k.h}`)).toBe(true);
  });

  it("joins the two blocks only by the three crossings", () => {
    const crossing = (x: number) => Number.isFinite(surfaceAt(A, x, 0));
    expect([-34, 0, 34].every(crossing)).toBe(true);
    for (const x of [-44, -20, -10, 10, 20, 44]) expect(crossing(x)).toBe(false);
  });

  it("every roof, crossing and staircase is walkable as a deck, with no step taller than you can climb", () => {
    clearDecks();
    for (const d of arenaDecks(A)) registerDeck(d);
    // walking any lane from your spawn to theirs never meets a sudden rise of more than a stair (the ledges are walled; see below)
    for (const x of [-34, 0, 34]) {
      let prev = deckAtLocal(x, 30);
      for (let z = 30; z >= -30; z -= 0.25) { const h = deckAtLocal(x, z); expect(Number.isFinite(h)).toBe(true); expect(Math.abs(h - prev)).toBeLessThan(0.5); prev = h; }
    }
    // the stairs climb from the mid roof to the tall one smoothly
    let prev = deckAtLocal(-6, 28.5);
    for (let x = -6; x >= -20; x -= 0.25) { const h = deckAtLocal(x, 28.5); expect(h - prev).toBeLessThan(0.5); prev = h; }
    expect(deckAtLocal(-20, 28.5)).toBe(23);
    // over the street there is nothing to stand on
    expect(deckAtLocal(-20, 0)).toBe(-Infinity);
    clearDecks();
  });

  it("walls keep you on the roof: parapets on the street side, rails on the catwalks, and the ledge up to the tall roof", () => {
    clearWalls(); setWalls("arena", arenaWalls(A));
    const push = (dx: number, dz: number, feet: number) => { const w = toWorld(A, dx, dz), body = { x: w.x, z: w.z }; return collideWalls(body, 0.45, A.base + feet); };
    expect(push(-24, 8.2, 23)).toBe(true); // the street parapet of the Rooftop Bar
    expect(push(0, 8.2, 20)).toBe(false); // the mouth of the billboard bridge is open
    expect(push(-35.4, 0, 22.2)).toBe(true); // the west catwalk's rail
    expect(push(-15.8, 14, 20)).toBe(true); // from the mid roof you cannot walk up the 3 m ledge…
    expect(push(-15.8, 14, 23)).toBe(false); // …but from the top you can drop off it
    expect(push(-15.8, 28.5, 20)).toBe(false); // the stairs are open
    expect(push(-24, 8.2, 23 + 1.5)).toBe(false); // jump clear of the parapet and you go over it
    clearWalls();
  });

  it("every spawn, zone and the objective sit on a surface, clear of props", () => {
    const solid = (x: number, z: number) => A.cover.some((k) => Math.abs(x - k.x) < k.w / 2 + 0.5 && Math.abs(z - k.z) < k.d / 2 + 0.5);
    for (const [x, z] of [...A.spawns.us, ...A.spawns.them]) { expect(Number.isFinite(surfaceAt(A, x, z))).toBe(true); expect(solid(x, z)).toBe(false); }
    for (const z of A.zones) expect(Number.isFinite(surfaceAt(A, z.dx, z.dz))).toBe(true);
    expect(Number.isFinite(surfaceAt(A, A.objective[0], A.objective[1]))).toBe(true);
    // the zones are far enough apart to be separate fights
    expect(Math.hypot(A.zones[0]!.dx - A.zones[1]!.dx, A.zones[0]!.dz - A.zones[1]!.dz)).toBeGreaterThan(ZONE_RADIUS * 3);
    // your spawns are on the north block, theirs on the south
    expect(A.spawns.us.every(([, z]) => z > 8)).toBe(true); expect(A.spawns.them.every(([, z]) => z < -8)).toBe(true);
  });

  it("confine puts a rival who walked off the edge or into a tank back on the roof", () => {
    expect(confine(A, 0, 20)).toEqual({ x: 0, z: 20, moved: false });
    const off = confine(A, -20, 0); // in the street
    expect(off.moved).toBe(true); expect(Number.isFinite(surfaceAt(A, off.x, off.z))).toBe(true); expect(Math.hypot(off.x + 20, off.z)).toBeLessThan(10);
    const out = confine(A, 60, 20); // past the outer edge
    expect(out.x).toBeLessThan(46); expect(out.z).toBeCloseTo(20, 5);
    const tank = A.cover.find((k) => k.id === "nw-tank")!, inTank = confine(A, tank.x, tank.z);
    expect(inTank.moved).toBe(true);
    expect(Math.abs(inTank.x - tank.x) >= tank.w / 2 || Math.abs(inTank.z - tank.z) >= tank.d / 2).toBe(true);
    // a whole sweep of the map: whatever goes in comes out on a walkable point
    for (let x = -60; x <= 60; x += 7) for (let z = -45; z <= 45; z += 5) { const c = confine(A, x, z); expect(Number.isFinite(surfaceAt(A, c.x, c.z))).toBe(true); }
  });

  it("falling into the street is a death; the lowest roof is well clear of it", () => {
    const lowest = Math.min(...A.roofs.map((r) => r.top));
    expect(belowKillPlane(A, A.base + lowest)).toBe(false);
    expect(belowKillPlane(A, A.base + A.killPlane - 0.1)).toBe(true);
    expect(lowest - A.killPlane).toBeGreaterThan(5);
  });

  it("you respawn as far from the rivals as your side allows", () => {
    const threats = [{ x: -30, z: 28 }, { x: 0, z: 25 }];
    const p = spawnPoint(A, "us", threats);
    expect(A.spawns.us.some(([x, z]) => x === p.x && z === p.z)).toBe(true);
    expect(p.x).toBeGreaterThan(20);
    expect(spawnPoint(A, "them", [], 1)).toEqual({ x: 0, z: -31 });
  });

  it("the Billboard Blackout runs on its clock and dims sight ranges", () => {
    const f = A.fracture;
    expect(fractureAt(A, 10).active).toBe(false);
    expect(fractureAt(A, f.first - 5).warning).toBe(true);
    expect(fractureLine(A, f.first - 5)).toBe("Billboard Blackout in 5 s");
    expect(fractureAt(A, f.first + 10).active).toBe(true);
    expect(fractureVisibility(A, f.first + 10)).toBeCloseTo(f.visibility, 5);
    expect(fractureLine(A, f.first + 10)).toBe(`BILLBOARD BLACKOUT · ${f.length - 10} s`);
    expect(fractureVisibility(A, f.first + f.length + 1)).toBe(1);
    expect(fractureAt(A, f.first + f.every + 1)).toMatchObject({ active: true, count: 2 });
    // it fades in rather than snapping
    expect(fractureVisibility(A, f.first + 0.5)).toBeGreaterThan(f.visibility);
  });

  it("props block line of sight at the height they stand", () => {
    const s = arenaSolids(A);
    expect(s).toHaveLength(A.cover.length);
    const tank = s.find((b) => b.id.endsWith("nw-tank"))!.box;
    expect(tank.y - tank.h / 2).toBeCloseTo(A.base + 23, 5);
  });
});

describe("launching a Killbox playlist", () => {
  it("records the arena on the run and points the waypoint at it; the royale and the old duel stay in the open world", () => {
    const go = (id: string) => { const s = startActivity(structuredClone(DEFAULT_PROGRESSION), id, Date.UTC(2026, 10, 2)); if ("error" in s) throw new Error(s.error); return s.run; };
    const clash = go(PVP_MODES.clash.activity);
    expect(clash.arena).toBe("rooftop-run");
    const t = currentTarget(activityById(PVP_MODES.clash.activity)!, clash)!;
    expect(t).toMatchObject({ x: A.site.x + A.objective[0], z: A.site.z + A.objective[1] });
    expect(go(PVP_MODES.royale.activity).arena).toBeUndefined();
    expect(go("crucible-duel").arena).toBeUndefined();
  });
});

describe("leaving the arena", () => {
  it("a save made mid-match never resumes up in the arena's airspace", () => {
    expect(validSpot({ x: A.site.x, z: A.site.z })).toBe(false);
    expect(validSpot({ x: A.site.x + 30, z: A.site.z - 20 })).toBe(false);
    expect(validSpot({ x: 0, z: 0 })).toBe(true);
  });
});
