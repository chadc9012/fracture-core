import { describe, expect, it } from "bun:test";
import { clearDecks, districtDeckAt, registerDeck } from "./district-decks";
import { clearWalls, collideWalls, setWalls } from "./walls";
import { ARENAS, FRACTURE_FLOOR as D, KAIJU_COMPLEX as A, KILLBOX_PRIME as P, SKYDOCK as S, overArena, SHIFT_SECONDS, arenaForRun, arenaParapets, arenasForMode, shifterBlockers, shifterLift, solidShifters, arenaDecks, arenaForMode, arenaSolids, arenaWalls, belowKillPlane, confine, fractureAt, fractureLine, fractureVisibility, spawnPoint, surfaceAt, toWorld } from "./killbox-arenas";
import { PVP_MODES, ZONE_RADIUS } from "./pvp";
import { activityById, currentTarget, startActivity } from "./activities";
import { DEFAULT_PROGRESSION } from "./progression";
import { validSpot } from "./resume-spot";

const deckAtLocal = (dx: number, dz: number) => { const w = toWorld(A, dx, dz); return districtDeckAt(w.x, w.z) - A.base; };

describe("Kaiju Complex", () => {
  it("plays every arena mode except the royale", () => {
    for (const m of ["clash", "dominion", "freefall", "lockdown", "ascendancy"] as const) expect(arenaForMode(m)?.id).toBe("kaiju-complex");
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
    expect(clash.arena).toBe("kaiju-complex");
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

describe("Fracture Floor", () => {
  const solidAt = (x: number, z: number, t: number, pad = 0.5) => [...D.cover, ...solidShifters(D, t)].some((k) => Math.abs(x - k.x) < k.w / 2 + pad && Math.abs(z - k.z) < k.d / 2 + pad);

  it("is point-symmetric: surfaces, cover and every data pillar", () => {
    for (let x = -30; x <= 30; x += 1.5) for (let z = -34; z <= 34; z += 1.5) expect(surfaceAt(D, x, z)).toBe(surfaceAt(D, -x, -z));
    for (const list of [D.cover, D.shifters] as const) {
      const keys = new Set(list.map((k) => `${k.x},${k.z},${k.w},${k.d},${k.h},${"phase" in k ? k.phase : ""}`));
      for (const k of list) expect(keys.has(`${-k.x},${-k.z},${k.w},${k.d},${k.h},${"phase" in k ? k.phase : ""}`)).toBe(true);
    }
  });

  it("the ramps climb smoothly onto the uplinks; elsewhere the 2.5 m terrace face is a wall from below", () => {
    clearDecks(); for (const d of arenaDecks(D)) registerDeck(d);
    const at = (dx: number, dz: number) => { const w = toWorld(D, dx, dz); return districtDeckAt(w.x, w.z) - D.base; };
    for (const x of [-20, 20]) { let prev = at(x, 10); for (let z = 10; z <= 32; z += 0.25) { const h = at(x, z); expect(h - prev).toBeLessThan(0.5); prev = h; } expect(at(x, 30)).toBeCloseTo(22.5, 5); }
    clearDecks();
    clearWalls(); setWalls("df", arenaWalls(D));
    const hit = (dx: number, dz: number, feet: number) => { const w = toWorld(D, dx, dz); return collideWalls({ x: w.x, z: w.z }, 0.45, D.base + feet); };
    expect(hit(0, 23.8, 20)).toBe(true); // the face of the north uplink, from the floor
    expect(hit(0, 23.8, 22.5)).toBe(false); // you can drop off it
    expect(hit(-20, 23.8, 21.5)).toBe(false); // the ramp mouth is open
    expect(hit(29.8, 0, 20)).toBe(true); // the barrier round the outside
    expect(hit(0, 33.8, 22.5)).toBe(true); // and behind the spawns
    clearWalls();
  });

  it("parapets run only round the outside: none between the floor and the uplinks", () => {
    const ps = arenaParapets(D).map((w) => ({ ax: w.ax - D.site.x, az: w.az - D.site.z, bx: w.bx - D.site.x, bz: w.bz - D.site.z }));
    expect(ps.some((w) => Math.abs(w.az - 24) < 0.01 && Math.abs(w.bz - 24) < 0.01)).toBe(false);
    const total = ps.reduce((n, w) => n + Math.hypot(w.bx - w.ax, w.bz - w.az), 0);
    expect(total).toBeCloseTo(2 * 60 + 2 * 68, 3); // the whole outline, once
  });

  it("the Grid Rewrite sinks the standing pillars and raises the sunken ones, easing over SHIFT_SECONDS", () => {
    const f = D.fracture, up = D.shifters.find((s) => s.phase === "up")!, down = D.shifters.find((s) => s.phase === "down")!;
    expect(shifterLift(D, up, 10)).toBe(1); expect(shifterLift(D, down, 10)).toBe(0);
    expect(shifterLift(D, up, f.first + SHIFT_SECONDS / 2)).toBeCloseTo(0.5, 5);
    expect(shifterLift(D, up, f.first + 5)).toBe(0); expect(shifterLift(D, down, f.first + 5)).toBe(1);
    expect(shifterLift(D, down, f.first + f.length + SHIFT_SECONDS + 0.1)).toBe(0);
    expect(shifterLift(D, up, f.first + f.every + 3)).toBe(0); // the next rewrite too
    // blockers follow: walls and sight solids only for what stands
    const calm = shifterBlockers(D, 10), rewrite = shifterBlockers(D, f.first + 5);
    expect(calm.solids.map((s) => s.id).every((id) => !id.includes("slot"))).toBe(true);
    expect(rewrite.solids.map((s) => s.id).every((id) => id.includes("slot"))).toBe(true);
    expect(calm.walls).toHaveLength(4 * D.shifters.filter((s) => s.phase === "up").length);
  });

  it("spawns, zones and the objective stay clear of cover and pillars in both states, on the floor or a terrace", () => {
    for (const t of [10, D.fracture.first + 5]) {
      for (const [x, z] of [...D.spawns.us, ...D.spawns.them]) { expect(Number.isFinite(surfaceAt(D, x, z))).toBe(true); expect(solidAt(x, z, t)).toBe(false); }
      for (const z of D.zones) { expect(surfaceAt(D, z.dx, z.dz)).toBe(20); expect(solidAt(z.dx, z.dz, t)).toBe(false); }
      expect(solidAt(D.objective[0], D.objective[1], t)).toBe(false);
    }
    expect(D.spawns.us.every(([, z]) => z > 24)).toBe(true); expect(D.spawns.them.every(([, z]) => z < -24)).toBe(true);
    // nothing sits on a ramp, and nothing overlaps anything else
    const all = [...D.cover, ...D.shifters];
    for (const k of all) for (const w of D.walks) expect(Math.abs(k.x - w.x) < k.w / 2 + w.width / 2 && Math.abs(k.z - w.z) < k.d / 2 + w.length / 2).toBe(false);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const p = all[i]!, q = all[j]!; expect(Math.abs(p.x - q.x) < (p.w + q.w) / 2 && Math.abs(p.z - q.z) < (p.d + q.d) / 2).toBe(false); }
  });

  it("confine pushes a rival out of a pillar only while it stands", () => {
    const up = D.shifters.find((s) => s.id === "pillar-n")!;
    expect(confine(D, up.x, up.z, 0.8, 10).moved).toBe(true);
    expect(confine(D, up.x, up.z, 0.8, D.fracture.first + 5).moved).toBe(false);
  });

  it("its airspace never overlaps Kaiju Complex's", () => {
    expect(Math.abs(D.site.z - A.site.z) > 180 || Math.abs(D.site.x - A.site.x) > 180).toBe(true);
  });
});

describe("map rotation", () => {
  it("each arena playlist rotates Kaiju Complex → Fracture Floor → Killbox Prime → Skydock match to match", () => {
    for (const m of ["clash", "dominion", "freefall", "lockdown", "ascendancy"] as const) {
      expect(arenasForMode(m).map((a) => a.id)).toEqual(["kaiju-complex", "fracture-floor", "killbox-prime", "skydock"]);
      expect([0, 1, 2, 3, 4].map((n) => arenaForRun(m, n)?.id)).toEqual(["kaiju-complex", "fracture-floor", "killbox-prime", "skydock", "kaiju-complex"]);
    }
    expect(arenaForRun("royale", 0)).toBeUndefined();
  });

  it("the second launch of the day lands on Fracture Floor", () => {
    let p = structuredClone(DEFAULT_PROGRESSION);
    const ids: (string | undefined)[] = [];
    for (let i = 0; i < 3; i++) { const s = startActivity(p, PVP_MODES.lockdown.activity, Date.UTC(2026, 10, 2, 12, i)); if ("error" in s) throw new Error(s.error); p = s.progression; ids.push(s.run.arena); }
    expect(ids).toEqual(["kaiju-complex", "fracture-floor", "killbox-prime"]);
  });
});

/** rules every arena must keep, whatever its layout */
for (const X of Object.values(ARENAS)) describe(`every arena: ${X.name}`, () => {
  const blockers = (t: number) => [...X.cover, ...solidShifters(X, t)];
  const blocked = (x: number, z: number, t: number, pad = 0.5) => blockers(t).some((k) => Math.abs(x - k.x) < k.w / 2 + pad && Math.abs(z - k.z) < k.d / 2 + pad);
  const times = [10, X.fracture.first + 8];

  it("is point-symmetric (surfaces, cover, shifters)", () => {
    for (let x = -50; x <= 50; x += 1.5) for (let z = -40; z <= 40; z += 1.5) expect(surfaceAt(X, x, z)).toBe(surfaceAt(X, -x, -z));
    for (const list of [X.cover, X.shifters] as const) {
      const keys = new Set(list.map((k) => `${k.x},${k.z},${k.w},${k.d},${k.h},${"phase" in k ? k.phase : ""}`));
      for (const k of list) expect(keys.has(`${-k.x},${-k.z},${k.w},${k.d},${k.h},${"phase" in k ? k.phase : ""}`)).toBe(true);
    }
  });
  it("spawns, zones and the objective stand on a surface and clear of cover in both event states; spawns split by side", () => {
    for (const t of times) {
      for (const [x, z] of [...X.spawns.us, ...X.spawns.them]) { expect(Number.isFinite(surfaceAt(X, x, z))).toBe(true); expect(blocked(x, z, t)).toBe(false); }
      for (const z of X.zones) { expect(Number.isFinite(surfaceAt(X, z.dx, z.dz))).toBe(true); expect(blocked(z.dx, z.dz, t, 1)).toBe(false); }
      expect(blocked(X.objective[0], X.objective[1], t, 1)).toBe(false);
    }
    expect(X.spawns.us.every(([, z]) => z > 8)).toBe(true); expect(X.spawns.them.every(([, z]) => z < -8)).toBe(true);
  });
  it("no prop overlaps another, sits on a stair or ramp (flat bridges may carry cover), or hangs off a surface", () => {
    const all = [...X.cover, ...X.shifters];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const p = all[i]!, q = all[j]!; expect(Math.abs(p.x - q.x) < (p.w + q.w) / 2 && Math.abs(p.z - q.z) < (p.d + q.d) / 2).toBe(false); }
    for (const k of all) {
      for (const w of X.walks.filter((q) => q.top !== q.topB)) { const hx = w.along === "x" ? w.length / 2 : w.width / 2, hz = w.along === "z" ? w.length / 2 : w.width / 2; expect(Math.abs(k.x - w.x) < k.w / 2 + hx && Math.abs(k.z - w.z) < k.d / 2 + hz).toBe(false); }
      for (const [cx, cz] of [[k.x - k.w / 2, k.z - k.d / 2], [k.x + k.w / 2, k.z + k.d / 2], [k.x - k.w / 2, k.z + k.d / 2], [k.x + k.w / 2, k.z - k.d / 2]] as const) expect(Number.isFinite(surfaceAt(X, cx, cz))).toBe(true);
    }
  });
  it("every walkway climbs smoothly (no step over 0.5 m along it), and its ends meet the surfaces it joins", () => {
    clearDecks(); for (const d of arenaDecks(X)) registerDeck(d);
    const at = (dx: number, dz: number) => { const w = toWorld(X, dx, dz); return districtDeckAt(w.x, w.z) - X.base; };
    for (const w of X.walks) {
      const ax = w.along === "x" ? w.x - w.length / 2 - 1.5 : w.x, az = w.along === "z" ? w.z - w.length / 2 - 1.5 : w.z, n = (w.length + 3) / 0.25;
      let prev = at(ax, az);
      for (let i = 1; i <= n; i++) { const x = w.along === "x" ? ax + i * 0.25 : ax, z = w.along === "z" ? az + i * 0.25 : az, h = at(x, z); expect(Number.isFinite(h)).toBe(true); expect(Math.abs(h - prev)).toBeLessThan(0.55); prev = h; }
    }
    clearDecks();
  });
  it("its airspace overlaps no other arena's, and the kill plane sits below every surface", () => {
    for (const o of Object.values(ARENAS)) if (o !== X) expect(Math.abs(o.site.x - X.site.x) > 180 || Math.abs(o.site.z - X.site.z) > 180).toBe(true);
    expect(Math.min(...X.roofs.map((r) => r.top)) - X.killPlane).toBeGreaterThan(4);
    expect(overArena(X.site.x, X.site.z)).toBe(true);
  });
});

describe("Killbox Prime", () => {
  it("the balconies are walled from below except at the stairs, and open to drop onto from the deck", () => {
    clearWalls(); setWalls("kp", arenaWalls(P));
    const hit = (dx: number, dz: number, feet: number) => { const w = toWorld(P, dx, dz); return collideWalls({ x: w.x, z: w.z }, 0.45, P.base + feet); };
    expect(hit(-32.2, -10, 16)).toBe(true); // the deck face, from the west balcony
    expect(hit(-32.2, -26, 17)).toBe(false); // the stair mouth
    expect(hit(-31.8, -10, 20)).toBe(false); // from the deck you can drop down
    expect(hit(-31.8, 20, 20)).toBe(true); // no balcony here: the deck's parapet
    expect(hit(-43.8, -10, 16)).toBe(true); // the balcony's own parapet
    clearWalls();
  });
  it("the Containment Lock raises the ring round the capture zone and sinks the deck walls", () => {
    const ring = P.shifters.filter((s) => s.id.startsWith("ring")), deck = P.shifters.filter((s) => s.id.startsWith("glass"));
    expect(ring).toHaveLength(4); expect(deck).toHaveLength(4);
    const t = P.fracture.first + 8;
    expect(ring.every((s) => shifterLift(P, s, 10) === 0 && shifterLift(P, s, t) === 1)).toBe(true);
    expect(deck.every((s) => shifterLift(P, s, 10) === 1 && shifterLift(P, s, t) === 0)).toBe(true);
    // the ring stands outside the capture zone and leaves its four corners open
    for (const s of ring) expect(Math.hypot(s.x, s.z) - Math.min(s.w, s.d) / 2).toBeGreaterThan(ZONE_RADIUS);
    for (const [x, z] of [[7, 7], [-7, 7], [7, -7], [-7, -7]] as const) expect(ring.some((s) => Math.abs(x - s.x) < s.w / 2 && Math.abs(z - s.z) < s.d / 2)).toBe(false);
  });
});

describe("Skydock", () => {
  it("the ramps and gantry walkways are railed over the drop, and open at their ends", () => {
    clearWalls(); setWalls("sd", arenaWalls(S));
    const hit = (dx: number, dz: number, feet: number) => { const w = toWorld(S, dx, dz); return collideWalls({ x: w.x, z: w.z }, 0.45, S.base + feet); };
    expect(hit(14.1, 18, 21)).toBe(true); // the east rail of the north-east ramp
    expect(hit(12, 14.2, 20)).toBe(false); // stepping onto it from the deck
    expect(hit(25.5, 31.6, 23)).toBe(true); // the gantry walkway's outer rail
    expect(hit(33.6, 0, 24)).toBe(true); // the gantry's outer parapet
    expect(hit(30.6, 0, 24)).toBe(false); // the stair from the deck arrives here
    clearWalls();
  });
  it("the gantries sit above the deck and both docks, and every team spawn is on its dock", () => {
    expect(surfaceAt(S, 32, 0)).toBe(24); expect(surfaceAt(S, 0, 0)).toBe(20); expect(surfaceAt(S, 0, 28)).toBe(22);
    for (const [x, z] of S.spawns.us) expect(surfaceAt(S, x, z)).toBe(22);
    // the docks and the deck are joined only over the ramps: the middle of the drop is open
    expect(surfaceAt(S, 0, 18)).toBe(-Infinity);
  });
});
