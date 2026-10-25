/** Fracture Gate descent runtime: per-frame glue between descent-run.ts and the live sim (like wasteland-runtime.ts).
 * Walking into a gate starts a run and asks Scene to teleport you onto the threshold floor; each tier sends its waves
 * (tagged `rift:<tier>` so they are never leashed or retired), opens its drop when the last wave is down, and the boss
 * room ends the run. Scene owns the player's position: it applies `teleport`, slows the fall when `shaft` is set, and
 * calls `descentDeath` from its death flow. GameCanvas applies `emits` to the save. */
import { alert, freeSlots, spawnEventSquad, type Machine, type WorldSim } from "./sim";
import { INITIAL_POISE } from "./boss-poise";
import {
  DESCENT_TOP, RANKS, dayOf, depthBelow, dungeonById, gateAt, gateRadius, inDescentSpace, inShaft, setActiveDescent, tierAt,
  type FractureGate,
} from "./fracture-gates";
import {
  CHAMPION_NAME, arrive, bossDefeated, bossEngaged, checkEnrage, clearTier, currentTier, died, enrageLeft, gateBreaking, openWays,
  startDescent, takeExit, tierPlan, waveSent, type DescentRun,
} from "./descent-run";

export type DescentEmit =
  | { type: "TIER_LOOT"; run: DescentRun; tier: number }
  | { type: "END"; run: DescentRun };

export type DescentHud = null | {
  dungeon: string;
  place: string;
  rank: string;
  rankLied: boolean;
  depth: number;
  tierLabel: string;
  objective: string;
  lives: number;
  enrage: number | null;
  /** a gate within 60 m in the open world, before you go in */
  gateNear?: { name: string; rank: string; sealed: boolean; dist: number; breaking: boolean } | null;
};

export type DescentRuntime = {
  run: DescentRun | null;
  returnPos: { x: number; y: number; z: number } | null;
  /** must walk away from a gate (or the threshold exit) before it can take you again */
  rearm: boolean;
  /** gate-days whose break squad has already spilled out */
  breaks: Set<string>;
  bossTag: string | null;
  gatesDay: string;
  gates: FractureGate[];
};

export const createDescentRuntime = (): DescentRuntime => ({ run: null, returnPos: null, rearm: true, breaks: new Set(), bossTag: null, gatesDay: "", gates: [] });

const tagOf = (tier: number) => `rift:${tier}`;
const aliveTagged = (sim: WorldSim, tag: string) => sim.machines.reduce((n, m) => n + (m.alive && m.living === tag ? 1 : 0), 0);
const despawnRift = (sim: WorldSim) => { for (const m of sim.machines) if (m.alive && m.living?.startsWith("rift:")) { m.alive = false; delete m.living; } };
const tagged = (sim: WorldSim, tag: string) => sim.machines.filter((m) => m.alive && m.living === tag);
const stand = (m: Machine, floorY: number) => { m.y = floorY + 2.2 * m.scale; };

/** where the threshold's way back out stands (non-sealed gates only): behind your landing, against the wall */
export const thresholdExit = (run: DescentRun) => { const t = run.layout.tiers[0]!; return { x: t.landing.x, z: t.landing.z + Math.sign(t.landing.z - run.layout.origin.z) * 8 }; };
/** the boss room's way out once the boss is down: the far end from where you landed */
export const bossExit = (run: DescentRun) => { const t = run.layout.tiers[run.layout.tiers.length - 1]!; return { x: t.landing.x, z: run.layout.origin.z - (t.landing.z - run.layout.origin.z) }; };
export const EXIT_RADIUS = 3;

function spawnWave(sim: WorldSim, run: DescentRun, px: number, pz: number) {
  const tier = currentTier(run);
  const plan = tierPlan(tier, run.rank, run.squad);
  const wave = plan.waves[run.wave];
  if (!wave) return 0;
  const d = dungeonById(run.dungeonId);
  const region = d?.regionId ?? "nexus";
  const tag = tagOf(tier.index);
  // spawn around the middle of the room, well clear of the drop shaft (26 m out) and of where you landed
  const cx = run.layout.origin.x, cz = run.layout.origin.z;
  freeSlots(sim, wave.count + (wave.gatekeeper ? 1 : 0), px, pz);
  const n = spawnEventSquad(sim, tag, cx, cz, wave.count, wave.elites, region, Math.min(14, Math.min(tier.w, tier.d) / 4));
  const troops = tagged(sim, tag);
  for (const m of troops) stand(m, tier.floorY);
  // champions: named, much tougher elites (their round-type counters are not wired into combat yet)
  const plain = troops.filter((m) => !m.elite);
  wave.champions.forEach((type, i) => {
    const m = plain[i];
    if (!m) return;
    Object.assign(m, { elite: true, hp: m.hp * 4, maxHp: (m.maxHp ?? m.hp) * 4, scale: 1.6, profile: CHAMPION_NAME[type] });
    stand(m, tier.floorY);
  });
  if (wave.gatekeeper) {
    const m = troops.find((t) => t.elite) ?? troops[0];
    if (m) { Object.assign(m, { elite: true, hp: m.hp * 10, maxHp: (m.maxHp ?? m.hp) * 10, scale: 2.4, profile: d?.gatekeeper ?? "Gatekeeper" }); stand(m, tier.floorY); }
  }
  return n;
}

function spawnBoss(sim: WorldSim, run: DescentRun, px: number, pz: number): string | null {
  const tier = currentTier(run);
  const d = dungeonById(run.dungeonId);
  const tag = `rift:boss:${tier.index}`;
  freeSlots(sim, 1, px, pz);
  const cx = run.layout.origin.x, cz = run.layout.origin.z + (run.layout.origin.z - tier.landing.z) * 0.5;
  if (!spawnEventSquad(sim, tag, cx, cz, 1, 1, d?.regionId ?? "nexus", 1)) return null;
  const m = tagged(sim, tag)[0]!;
  const hp = 28 * (sim.challenge?.enemyHp ?? 1) * (1 + 0.35 * RANKS[run.rank].tiers / 3) * (tier.kind === "NESTED" ? 1.6 : 1);
  Object.assign(m, { boss: true, elite: true, hp, maxHp: hp, scale: tier.kind === "NESTED" ? 2.8 : 2.4, phase: 0, poiseState: INITIAL_POISE, cool: 2,
    profile: tier.kind === "NESTED" ? `${d?.boss ?? "Boss"}, Unbound` : d?.boss ?? "Boss" });
  stand(m, tier.floorY);
  alert(sim, tier.kind === "NESTED" ? "Something older waits under the boss room" : `${m.profile} · ${d?.bossMechanic ?? ""}`);
  return tag;
}

export type DescentStep = {
  emits: DescentEmit[];
  hud: DescentHud;
  /** put the player here this frame (entering, leaving) */
  teleport: { x: number; y: number; z: number; yaw?: number } | null;
  /** falling through an open drop: Scene slows the fall */
  shaft: boolean;
  /** inside the descent column: skip world bounds, use the descent's air */
  inside: boolean;
};

export function stepDescentRuntime(rt: DescentRuntime, sim: WorldSim, inp: { now: number; px: number; py: number; pz: number; inVehicle: boolean; blocked: boolean; earnedRewards: readonly string[]; gates: () => FractureGate[] }): DescentStep {
  const emits: DescentEmit[] = [];
  const day = dayOf(inp.now);
  if (rt.gatesDay !== day) { rt.gatesDay = day; rt.gates = inp.gates(); }
  const feet = inp.py - 1.6;

  /* ---------- in the open world: gates, breaks ---------- */
  if (!rt.run) {
    let gateNear: NonNullable<DescentHud>["gateNear"] = null;
    let nearest = Infinity;
    for (const g of rt.gates) {
      const dist = Math.hypot(inp.px - g.x, inp.pz - g.z);
      const breaking = gateBreaking(g, inp.now, inp.earnedRewards);
      // a broken gate spills a squad around itself once per gate-day, when someone comes close enough to see it
      if (breaking && dist < 140 && !rt.breaks.has(g.id)) {
        rt.breaks.add(g.id);
        const d = dungeonById(g.dungeonId);
        freeSlots(sim, 6, inp.px, inp.pz);
        spawnEventSquad(sim, `rift-break:${g.id}`, g.x, g.z, 6, 2, d?.regionId ?? "nexus", 14);
        alert(sim, `Dungeon break · ${d?.name ?? "A Fracture Gate"} is spilling its monsters`);
      }
      if (dist < 60 && dist < nearest) { nearest = dist; const d = dungeonById(g.dungeonId); gateNear = { name: d?.name ?? "Fracture Gate", rank: g.shownRank, sealed: g.sealed, dist: Math.round(dist), breaking }; }
    }
    const g = gateAt(rt.gates, inp.px, inp.pz);
    if (!g || Math.abs(feet - g.y) > 6) rt.rearm = true;
    if (g && rt.rearm && !inp.inVehicle && !inp.blocked && sim.hp > 0 && Math.abs(feet - g.y) <= 6) {
      const run = startDescent(g, inp.now, 1);
      rt.run = run;
      rt.rearm = false;
      rt.bossTag = null;
      // you come back out just in front of the gate, not inside its trigger
      const dx = inp.px - g.x, dz = inp.pz - g.z, away = Math.hypot(dx, dz), r = gateRadius(g.shownRank) + 3;
      const ux = away > 0.5 ? dx / away : 1, uz = away > 0.5 ? dz / away : 0;
      rt.returnPos = { x: g.x + ux * r, y: inp.py, z: g.z + uz * r };
      setActiveDescent({ layout: run.layout, open: openWays(run) });
      const d = dungeonById(g.dungeonId)!;
      alert(sim, `${d.name} · ${g.shownRank}-rank${g.sealed ? " · SEALED: the only way out is the bottom" : ""}`);
      const t0 = run.layout.tiers[0]!;
      return { emits, hud: null, teleport: { x: t0.landing.x, y: t0.floorY + 1.6, z: t0.landing.z, yaw: t0.landing.z < run.layout.origin.z ? 0 : Math.PI }, shaft: false, inside: true };
    }
    return { emits, hud: gateNear ? { dungeon: gateNear.name, place: "", rank: gateNear.rank, rankLied: false, depth: 0, tierLabel: "", objective: "", lives: 0, enrage: null, gateNear } : null, teleport: null, shaft: false, inside: false };
  }

  /* ---------- in the descent ---------- */
  let run = rt.run;
  const open = openWays(run);
  setActiveDescent({ layout: run.layout, open });
  const here = tierAt(run.layout, feet, open.nested);
  const landed = Math.abs(feet - here.floorY) < 0.6;
  if (landed && here.index > run.tier) {
    const before = run.rankRevealed;
    run = arrive(run, here.index);
    if (run.rankRevealed && !before) alert(sim, "The air turns wrong · this gate was not what it read");
  }
  const tier = currentTier(run);
  const plan = tierPlan(tier, run.rank, run.squad);
  const tag = tagOf(tier.index);
  const onFloor = landed && here.index === run.tier;

  // waves: the next goes out when the last is down and you are standing on the tier
  if (run.status === "ACTIVE" && onFloor && !run.cleared.includes(tier.index) && aliveTagged(sim, tag) === 0) {
    if (plan.boss && run.wave === 0 && !rt.bossTag) {
      rt.bossTag = spawnBoss(sim, run, inp.px, inp.pz);
      if (rt.bossTag) { spawnWave(sim, run, inp.px, inp.pz); run = waveSent(bossEngaged(run, inp.now)); }
    } else if (!plan.boss && run.wave < plan.waves.length) {
      if (spawnWave(sim, run, inp.px, inp.pz) > 0) run = waveSent(run);
    } else if (!plan.boss && run.wave >= plan.waves.length) {
      run = clearTier(run);
      if (tier.gated) alert(sim, tier.kind === "THRESHOLD" ? "The way down opens" : "Tier cleared · the drop is open");
      if (tier.kind === "ENCOUNTER" || tier.kind === "GATEKEEPER") emits.push({ type: "TIER_LOOT", run, tier: tier.index });
    }
  }
  // the boss
  if (rt.bossTag && plan.boss && aliveTagged(sim, rt.bossTag) === 0 && run.status === "ACTIVE" && !(tier.kind === "BOSS" && run.bossDown)) {
    rt.bossTag = null;
    run = bossDefeated(run, inp.now);
    if (run.status === "ACTIVE" && run.nested) alert(sim, "The floor of the boss room cracks open");
  }
  run = checkEnrage(run, inp.now);

  // ways out: the threshold exit (not sealed, before the drop), and the boss room's exit once the boss is down
  let leave = false;
  if (run.status === "ACTIVE") {
    const d = dungeonById(run.dungeonId);
    const t0 = run.layout.tiers[0]!;
    const atThreshold = Math.abs(feet - t0.floorY) < 1 && run.tier === 0;
    const te = thresholdExit(run);
    const onTe = atThreshold && !d?.sealed && Math.hypot(inp.px - te.x, inp.pz - te.z) < EXIT_RADIUS;
    if (!onTe) rt.rearm = true;
    if (onTe && rt.rearm) { run = takeExit(run); leave = true; }
    const boss = run.layout.tiers[run.layout.tiers.length - 1]!;
    const be = bossExit(run);
    if (run.bossDown && Math.abs(feet - boss.floorY) < 1 && Math.hypot(inp.px - be.x, inp.pz - be.z) < EXIT_RADIUS) { run = takeExit(run); leave = true; }
  }
  if (run.status !== "ACTIVE") leave = true;

  if (leave) {
    despawnRift(sim);
    setActiveDescent(null);
    emits.push({ type: "END", run });
    const back = rt.returnPos;
    rt.run = null; rt.returnPos = null; rt.bossTag = null; rt.rearm = false;
    alert(sim, run.status === "CLEARED" ? `${dungeonById(run.dungeonId)?.name ?? "Descent"} cleared` : run.reason ?? "Descent ended");
    return { emits, hud: null, teleport: back, shaft: false, inside: false };
  }
  rt.run = run;
  setActiveDescent({ layout: run.layout, open: openWays(run) });

  const d = dungeonById(run.dungeonId)!;
  const left = aliveTagged(sim, tag) + (rt.bossTag ? aliveTagged(sim, rt.bossTag) : 0);
  const objective = run.bossDown
    ? run.nested ? "Drop into the crack, or take the exit" : "Take the exit"
    : plan.boss ? (rt.bossTag ? `Defeat ${tier.kind === "NESTED" ? `${d.boss}, Unbound` : d.boss}` : "Reach the bottom")
    : run.cleared.includes(tier.index) || !tier.gated && run.wave >= plan.waves.length ? "Find the drop · go down"
    : `${tier.kind === "ENCOUNTER" ? `Encounter · wave ${Math.max(1, run.wave)}/${plan.waves.length}` : tier.kind === "GATEKEEPER" ? `Defeat ${d.gatekeeper}` : "Clear the tier"} · ${left} hostile${left === 1 ? "" : "s"}`;
  const label = tier.kind === "THRESHOLD" ? "Threshold" : tier.kind === "BOSS" ? "Boss room" : tier.kind === "NESTED" ? "Nested depths" : tier.kind === "ENCOUNTER" ? `Tier ${tier.index + 1} · Encounter` : tier.kind === "GATEKEEPER" ? `Tier ${tier.index + 1} · Gatekeeper` : `Tier ${tier.index + 1}`;
  return {
    emits,
    hud: { dungeon: d.name, place: d.place, rank: run.rankRevealed ? `${run.shownRank} → ${run.rank}` : run.shownRank, rankLied: run.rankRevealed, depth: depthBelow(feet), tierLabel: label, objective, lives: run.lives, enrage: enrageLeft(run, inp.now) },
    teleport: null,
    shaft: inShaft(run.layout, openWays(run), inp.px, inp.pz, feet),
    inside: inDescentSpace(run.layout, inp.px, inp.pz, inp.py),
  };
}

/** Scene's death flow: spend a life and put you back on the tier you are on, or end the run and send you back out */
export function descentDeath(rt: DescentRuntime, sim: WorldSim): { respawn: { x: number; y: number; z: number } } | null {
  if (!rt.run) return null;
  const run = died(rt.run);
  if (run.status === "ACTIVE") {
    rt.run = run;
    const t = currentTier(run);
    alert(sim, `Recovered · ${run.lives} shared ${run.lives === 1 ? "life" : "lives"} left`);
    return { respawn: { x: t.landing.x, y: t.floorY + 1.6, z: t.landing.z } };
  }
  despawnRift(sim);
  setActiveDescent(null);
  const back = rt.returnPos ?? { x: 0, y: DESCENT_TOP, z: 0 };
  pendingEnd.push(run);
  rt.run = null; rt.returnPos = null; rt.bossTag = null; rt.rearm = false;
  alert(sim, run.reason ?? "Descent failed");
  return { respawn: back };
}
/** runs that ended in the death flow; stepDescentRuntime's caller drains them into END emits */
const pendingEnd: DescentRun[] = [];
export const drainEndedRuns = (): DescentRun[] => pendingEnd.splice(0);
