import { describe, expect, it } from "bun:test";
import { ARENAS, FRACTURE_FLOOR, KAIJU_COMPLEX, KILLBOX_PRIME, extractionSites, spawnPoint, surfaceAt, type KillboxArena } from "./killbox-arenas";
import { ALLY_NAMES, BOT, allyCount, clearShot, fieldUnits, newBots, roundPresence, resetAllies, rivalCount, routeVia, stairsFrom, stepBots, walkable, zonePresence, type BotsState, type RivalView } from "./killbox-bots";
import { PVP_MODES, ZONE_RADIUS, newPvp, stepPvp, type PvpModeId } from "./pvp";
import type { RivalClass } from "./crucible";

/** A whole match with no Scene: the rivals are a little stand-in for the sim machines (spawn, take hits, die, come back), the player
 * stands still at a spawn and is never shot dead (so the bots decide it). Returns the final state and what happened. */
function playOut(arena: KillboxArena, mode: PvpModeId, seconds = 900, opts: { dieAt?: number } = {}) {
  const st = newPvp(mode, 3, arena.zones, { allies: allyCount(mode), rivals: rivalCount(mode) }, extractionSites(arena));
  const bots = newBots(arena, mode, "TITAN", 11);
  const n = rivalCount(mode), cls: RivalClass[] = ["TITAN", "HUNTER", "WARLOCK"];
  const rivals: (RivalView & { hp: number; down: number })[] = Array.from({ length: n }, (_, i) => { const p = spawnPoint(arena, PVP_MODES[mode].kind === "ffa" ? "any" : "them", [], i); return { tag: `crucible:${i}`, cls: cls[i % 3]!, x: p.x, z: p.z, alive: true, hp: 9, down: 0 }; });
  const player = { ...spawnPoint(arena, "us", [], 0), alive: true };
  let allyDeaths = 0, rivalDeaths = 0, playerHurt = 0, round = st.round, hurtWhileOut = 0, roundsSatOut = 0;
  const ffa = PVP_MODES[mode].kind === "ffa", credited = new Map<string, number>();
  const dt = 0.1;
  for (let k = 0; k < seconds / dt && !st.result; k++) {
    // the player goes down once at `dieAt` and sits the round out (Scene does this: alive false while pvp.ts says `out`)
    const dies = opts.dieAt !== undefined && !st.out && st.clock < opts.dieAt && st.clock + dt >= opts.dieAt;
    player.alive = !st.out && !dies;
    const o = stepBots(bots, { arena, st, dt, player, rivals });
    if (st.out) hurtWhileOut += o.playerDamage;
    let fell = 0;
    const ffaKills = new Map<string, number>();
    for (const r of rivals) {
      const mv = o.rivalMoves.get(r.tag); if (mv) { r.x = mv.x; r.z = mv.z; }
      const hit = o.rivalHits.get(r.tag); if (hit && r.alive) { r.hp -= hit; if (r.hp <= 0) { r.alive = false; r.down = 3.5; rivalDeaths++; fell++; const by = o.hitBy.get(r.tag); if (ffa && by) { ffaKills.set(by, (ffaKills.get(by) ?? 0) + 1); credited.set(by, (credited.get(by) ?? 0) + 1); } } }
      if (!r.alive && PVP_MODES[mode].kind !== "rounds") { r.down -= dt; if (r.down <= 0) { const p = spawnPoint(arena, "them", [], rivalDeaths); Object.assign(r, { x: p.x, z: p.z, alive: true, hp: 9 }); } }
    }
    playerHurt += o.playerDamage; allyDeaths += o.allyDeaths;
    const killsNow = rivals.filter((r) => !r.alive).length;
    stepPvp(st, { dt, kills: ffa ? 0 : fell, died: dies, ...(ffa ? { ffaKills, killedBy: null } : {}), px: player.x, pz: player.z, rivalsAlive: n - killsNow, allyDeaths: o.allyDeaths, ...(PVP_MODES[mode].kind === "zones" ? { presence: zonePresence(bots, st, player, ZONE_RADIUS) } : {}), ...(PVP_MODES[mode].kind === "extract" ? { units: fieldUnits(bots, player) } : {}), ...(PVP_MODES[mode].kind === "rounds" ? roundPresence(bots, arena, ZONE_RADIUS) : {}) });
    if (st.out && dies) roundsSatOut++;
    if (st.round !== round) { round = st.round; resetAllies(bots, arena); for (const [i, r] of rivals.entries()) { const p = spawnPoint(arena, "them", [], i); Object.assign(r, { x: p.x, z: p.z, alive: true, hp: 9 }); } }
  }
  return { st, bots, allyDeaths, rivalDeaths, playerHurt, hurtWhileOut, roundsSatOut, credited };
}

describe("Killbox bots", () => {
  it("field the whole of both teams on a built arena", () => {
    expect([allyCount("clash"), rivalCount("clash")]).toEqual([5, 6]);
    expect([allyCount("lockdown"), rivalCount("lockdown")]).toEqual([3, 4]);
    expect([allyCount("ascendancy"), rivalCount("ascendancy")]).toEqual([2, 3]);
    expect([allyCount("freefall"), rivalCount("freefall")]).toEqual([0, 6]);
    const b = newBots(KILLBOX_PRIME, "clash", "HUNTER");
    expect(b.allies.map((a) => a.name)).toEqual([...ALLY_NAMES]);
    expect(b.allies.every((a) => KILLBOX_PRIME.spawns.us.some(([x, z]) => x === a.x && z === a.z))).toBe(true);
    // nobody is left to fight off-field, so the score only moves with real eliminations
    const st = newPvp("clash", 1, KILLBOX_PRIME.zones, { allies: 5, rivals: 6 });
    for (let i = 0; i < 2000; i++) stepPvp(st, { dt: 0.1, kills: 0, died: false, px: 0, pz: 30, rivalsAlive: 6 });
    expect([st.us, st.them]).toEqual([0, 0]);
  });

  it("sight is blocked by tall cover and standing shifters, not by low barriers", () => {
    const c = KILLBOX_PRIME.cover.find((k) => k.id === "container-a")!;
    expect(clearShot(KILLBOX_PRIME, c.x, c.z - 5, c.x, c.z + 5, 0)).toBe(false);
    const low = KILLBOX_PRIME.cover.find((k) => k.id === "barrier-a")!;
    expect(clearShot(KILLBOX_PRIME, low.x, low.z - 4, low.x, low.z + 4, 0)).toBe(true);
    const ring = KILLBOX_PRIME.shifters.find((k) => k.id === "ring-n")!;
    expect(clearShot(KILLBOX_PRIME, 0, 3, 0, 14, 10)).toBe(true); // the ring is down
    expect(clearShot(KILLBOX_PRIME, 0, 3, 0, 14, KILLBOX_PRIME.fracture.first + 8)).toBe(false); // …and up during the lock
    expect(ring.phase).toBe("down");
  });

  it("a bot routes over a bridge when the street is in the way, and stays put when the way is straight", () => {
    const v = routeVia(KAIJU_COMPLEX, 35, 17, 0, -20)!;
    expect(v).toBeDefined();
    expect(KAIJU_COMPLEX.walks.some((w) => Math.abs(w.x - v.x) < 0.01 || Math.abs(w.x - v.then.x) < 0.01)).toBe(true);
    expect(routeVia(KAIJU_COMPLEX, -20, 20, 20, 20)).toBeUndefined();
    expect(walkable(KILLBOX_PRIME, -38, -10, 0, 0)).toBe(false); // from the balcony a 4 m wall stands in the way
    expect(routeVia(KILLBOX_PRIME, -38, -10, 0, 0)).toBeDefined();
  });

  it("a bot below a climb finds the stairs", () => {
    const s = stairsFrom(KILLBOX_PRIME, -40, -10, 16)!; // on the west balcony
    expect(surfaceAt(KILLBOX_PRIME, s.x, s.z)).toBeCloseTo(16, 5);
    expect(surfaceAt(KILLBOX_PRIME, s.then.x, s.then.z)).toBeCloseTo(20, 5);
  });

  for (const arena of Object.values(ARENAS)) for (const mode of ["clash", "dominion", "lockdown", "ascendancy", "extraction", "ranked"] as const) {
    it(`${arena.name} · ${PVP_MODES[mode].name}: the bots play the match to a result, both teams score, and everyone stays on the map`, () => {
      const r = playOut(arena, mode);
      expect(r.st.result).not.toBeNull();
      // the fight happens: rivals and allies go down (a round can be won on the objective, so either side may be the one that falls)
      expect(r.rivalDeaths + r.allyDeaths).toBeGreaterThan(PVP_MODES[mode].kind === "rounds" ? 0 : 4);
      if (PVP_MODES[mode].kind !== "rounds") { expect(r.rivalDeaths).toBeGreaterThan(0); expect(r.allyDeaths + r.playerHurt).toBeGreaterThan(0); }
      for (const b of [...r.bots.allies, ...r.bots.rivals.values()]) expect(Number.isFinite(surfaceAt(arena, b.x, b.z))).toBe(true);
    });
  }

  it("in Extraction the bots pick the core up, run it home and score with it", () => {
    let extracted = 0;
    for (const arena of Object.values(ARENAS)) { const r = playOut(arena, "extraction", 480); extracted += r.st.us + r.st.them; }
    expect(extracted).toBeGreaterThan(0);
  });

  it("in a round mode your going down sits you out while your allies play the round on, and nobody shoots at you", () => {
    for (const mode of ["lockdown", "ascendancy"] as const) for (const arena of [KAIJU_COMPLEX, KILLBOX_PRIME, ARENAS["void-rift"]]) {
      const r = playOut(arena, mode, 400, { dieAt: 3 });
      expect(r.roundsSatOut).toBe(1);
      expect(r.hurtWhileOut).toBe(0);
      expect(r.st.round).toBeGreaterThan(1);
      // the first round was not handed to them the moment you fell: the allies played it on
      expect(r.st.reason === "You went down").toBe(false);
    }
  });

  it("in Freefall on a built arena the board moves only with real eliminations, each to the bot that scored it", () => {
    for (const arena of Object.values(ARENAS)) {
      const r = playOut(arena, "freefall", 240);
      expect(r.st.board).toHaveLength(1 + rivalCount("freefall"));
      const total = r.st.board.reduce((n, k) => n + k, 0), credited = [...r.credited.values()].reduce((n, k) => n + k, 0);
      expect(total).toBe(credited);
      expect(total).toBeGreaterThan(0);
    }
  });

  it("in Dominion the bots take zones by standing in them", () => {
    const r = playOut(FRACTURE_FLOOR, "dominion", 120);
    expect(r.st.zones.some((z) => z.owner !== null)).toBe(true);
  });

  it("free-for-all rivals fight each other as well as you", () => {
    const st = newPvp("freefall", 1, KILLBOX_PRIME.zones, { allies: 0, rivals: 6 });
    const bots: BotsState = newBots(KILLBOX_PRIME, "freefall", "TITAN");
    // two rivals face to face in the open, the player far away behind cover
    const rivals: RivalView[] = [{ tag: "crucible:0", cls: "TITAN", x: -10, z: 22, alive: true }, { tag: "crucible:1", cls: "HUNTER", x: 10, z: 22, alive: true }];
    let hits = 0;
    for (let k = 0; k < 60; k++) { const o = stepBots(bots, { arena: KILLBOX_PRIME, st, dt: 0.1, player: { x: 0, z: -30, alive: true }, rivals }); hits += o.rivalHits.size; }
    expect(hits).toBeGreaterThan(0);
  });

  it("ally bots that go down come back at your spawns, but not inside a round", () => {
    const b = newBots(KILLBOX_PRIME, "clash", "TITAN"), st = newPvp("clash", 1, KILLBOX_PRIME.zones, { allies: 5, rivals: 6 });
    b.allies[0]!.alive = false; b.allies[0]!.respawnIn = BOT.respawn;
    for (let k = 0; k < (BOT.respawn + 0.5) / 0.1; k++) stepBots(b, { arena: KILLBOX_PRIME, st, dt: 0.1, player: { x: 0, z: 30, alive: true }, rivals: [] });
    expect(b.allies[0]!.alive).toBe(true);
    const r = newBots(KILLBOX_PRIME, "ascendancy", "TITAN"), rs = newPvp("ascendancy", 1, KILLBOX_PRIME.zones, { allies: 2, rivals: 3 });
    r.allies[0]!.alive = false;
    for (let k = 0; k < 100; k++) stepBots(r, { arena: KILLBOX_PRIME, st: rs, dt: 0.1, player: { x: 0, z: 30, alive: true }, rivals: [] });
    expect(r.allies[0]!.alive).toBe(false);
  });
});
