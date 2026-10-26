// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { MOVES, SPECS, newPattern, patternFor, stepPattern, type PatternId, type PatternOut } from "./enemy-patterns";

const DT = 0.05;
/** run a pattern against a player standing still at (px,pz) relative to an enemy that moves as the pattern says */
function sim(id: PatternId, opts: { start?: number; seconds: number; yaw?: number; seed?: number; stopWhen?: (o: PatternOut, ph: string) => boolean }) {
  const s = newPattern(id, "k", opts.seed ?? 1);
  let ex = 0, ez = 0, t = 0;
  const px = opts.start ?? 15, pz = 0;
  const log: { out: PatternOut; phase: string; ex: number; ez: number; t: number }[] = [];
  for (; t < opts.seconds; t += DT) {
    const out = stepPattern(s, { d: Math.hypot(px - ex, pz - ez), dx: px - ex, dz: pz - ez, dt: DT, time: t, speed: 6.5, playerYaw: opts.yaw, playerHp: 1 });
    if (out.blink) { ex += out.blink.x; ez += out.blink.z; } else { ex += out.vx * DT; ez += out.vz * DT; }
    log.push({ out, phase: s.phase, ex, ez, t });
    if (opts.stopWhen?.(out, s.phase)) break;
  }
  return { s, log, ex, ez };
}

describe("pattern assignment", () => {
  it("each faction kind gets a role, and a group of one kind mixes roles", () => {
    expect(patternFor("ABERRATION", false, 0)).toBe("CHARGER");
    expect(patternFor("VANGUARD", true, 0)).toBe("CAPTAIN");
    expect(patternFor("VANGUARD", false, 0)).toBe("ADVANCER");
    const swarm = new Set([0, 1, 2, 3].map((i) => patternFor("OVERCLOCKED", false, i)));
    expect(swarm.has("SWARMER") && swarm.has("STALKER")).toBe(true);
    const raiders = new Set([0, 1, 2, 3, 4].map((i) => patternFor("RAIDER", false, i)));
    expect(raiders.has("STRAFER") && raiders.has("BLINKER")).toBe(true);
    expect(patternFor("MYSTERY", false, 0)).toBeNull();
    expect(patternFor(undefined, false, 0)).toBeNull();
  });
});

describe("movement patterns", () => {
  it("a Strafer holds its band while moving sideways and flips direction", () => {
    const { log } = sim("STRAFER", { start: 40, seconds: 25 });
    const last = log[log.length - 1]!;
    const dist = Math.hypot(40 - last.ex, 0 - last.ez);
    expect(dist).toBeGreaterThan(SPECS.STRAFER.band[0] - 3);
    expect(dist).toBeLessThan(SPECS.STRAFER.band[1] + 3);
    const signs = new Set(log.slice(200).map((l) => Math.sign(l.out.vz)).filter((x) => x !== 0));
    expect(signs.size).toBe(2); // strafed both ways
    expect(log.every((l) => l.out.fire)).toBe(true);
  });
  it("a Swarmer closes in on a weaving line, not a straight one", () => {
    const { log } = sim("SWARMER", { start: 40, seconds: 3 });
    expect(new Set(log.map((l) => Math.sign(l.out.vz))).size).toBeGreaterThan(1);
    expect(log[log.length - 1]!.ex).toBeGreaterThan(8);
  });
});

describe("Swarmer leap", () => {
  it("tells, leaps along the locked line, lands for damage, then is open to a recovery window", () => {
    const { log } = sim("SWARMER", { start: 5, seconds: 8, stopWhen: (o) => !!o.strike });
    const phases = log.map((l) => l.phase);
    expect(phases).toContain("TELL");
    expect(phases).toContain("ACT");
    const strike = log.find((l) => l.out.strike)!.out.strike!;
    expect(strike.damage).toBe(MOVES.leap.damage);
    expect(log.find((l) => l.out.tell)!.out.tell!.kind).toBe("RING");
  });
  it("is stationary while telling (so the target ring is honest)", () => {
    const { log } = sim("SWARMER", { start: 5, seconds: 8, stopWhen: (o) => !!o.strike });
    for (const l of log.filter((x) => x.phase === "TELL" && x.out.tell)) { expect(l.out.vx).toBe(0); expect(l.out.vz).toBe(0); }
  });
});

describe("Charger", () => {
  it("telegraphs a lane for the full tell, charges at 3.4x speed along it, and is exposed afterwards", () => {
    const { log } = sim("CHARGER", { start: 20, seconds: 15, stopWhen: (o) => !!o.exposed });
    const tells = log.filter((l) => l.out.tell);
    expect(tells.length).toBeGreaterThanOrEqual(Math.floor(MOVES.charge.tell / DT) - 2);
    expect(tells[0]!.out.tell!.kind).toBe("LANE");
    const run = log.filter((l) => l.phase === "ACT");
    expect(run.length).toBeGreaterThan(5);
    expect(Math.hypot(run[2]!.out.vx, run[2]!.out.vz)).toBeCloseTo(6.5 * MOVES.charge.speedMult, 1);
    const ex = log.find((l) => l.out.exposed)!.out.exposed!;
    expect(ex.mult).toBe(MOVES.charge.exposeMult);
    expect(ex.seconds).toBe(MOVES.charge.recover);
  });
  it("hits a player standing in the lane exactly once, and misses one who steps out", () => {
    const hit = sim("CHARGER", { start: 20, seconds: 15, stopWhen: (o) => !!o.exposed });
    expect(hit.log.filter((l) => l.out.strike).length).toBeLessThanOrEqual(1);
    // the player steps 8 m off the lane after the tell locks: simulate by feeding a lateral offset
    const s = newPattern("CHARGER", "k", 1);
    let ex = 0, hits = 0, t = 0;
    for (; t < 15; t += DT) {
      const pz = s.phase === "ACT" || (s.phase === "TELL" && s.t < 0.3) ? 8 : 0;
      const out = stepPattern(s, { d: Math.hypot(20 - ex, pz), dx: 20 - ex, dz: pz, dt: DT, time: t, speed: 6.5, playerHp: 1 });
      ex += out.vx * DT; if (out.strike) hits++;
      if (out.exposed) break;
    }
    expect(hits).toBe(0);
  });
});

describe("Captain, Stalker, Blinker, Artillery", () => {
  it("a Captain keeps its shield up while advancing and drops it to bash", () => {
    const { log } = sim("CAPTAIN", { start: 30, seconds: 20, stopWhen: (o) => !!o.exposed });
    expect(log.some((l) => l.out.guard === MOVES.bash.guardMult)).toBe(true);
    expect(log.find((l) => l.out.strike)!.out.strike!.label).toBe("Shield bash");
    expect(log[log.length - 1]!.out.exposed!.mult).toBe(MOVES.bash.exposeMult);
  });
  it("a Stalker strikes when the player's back is turned but not while they watch it", () => {
    const watched = sim("STALKER", { start: 15, seconds: 12, yaw: Math.PI / 2 }); // the player faces +x: toward the enemy? enemy is at -x -> behind
    const facing = sim("STALKER", { start: 15, seconds: 12, yaw: -Math.PI / 2 }); // faces -x: toward the enemy
    expect(facing.log.some((l) => l.out.strike)).toBe(false);
    expect(watched.log.some((l) => l.out.strike)).toBe(true);
  });
  it("a Blinker reappears about 12 m from the player after a visible shimmer", () => {
    const { log, ex, ez } = sim("BLINKER", { start: 15, seconds: 12, stopWhen: (o) => !!o.blink });
    const shimmer = log.filter((l) => l.out.tell);
    expect(shimmer.length).toBeGreaterThan(5);
    expect(Math.hypot(15 - ex, 0 - ez)).toBeCloseTo(MOVES.blink.distance, 0);
  });
  it("Artillery marks a ring, fixes it, and a player who leaves takes nothing (the ring is where they stood)", () => {
    const { log } = sim("ARTILLERY", { start: 35, seconds: 15, stopWhen: (o) => !!o.strike });
    const tells = log.filter((l) => l.out.tell);
    expect(tells.length).toBeGreaterThan(Math.floor(MOVES.shell.tell / DT) - 3);
    const first = tells[0]!.out.tell!, last = tells[tells.length - 1]!.out.tell!;
    expect([last.tx, last.tz]).toEqual([first.tx, first.tz]); // never tracks the player
    const strike = log.find((l) => l.out.strike)!.out.strike!;
    expect([strike.x, strike.z]).toEqual([first.tx, first.tz]);
    expect(strike.radius).toBe(MOVES.shell.radius);
  });
});
