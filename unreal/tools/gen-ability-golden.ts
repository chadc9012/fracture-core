/**
 * Records golden class-ability behaviour from the web build's real ability-effects.ts (castAbility, holdDisabledField,
 * cancelAbilities, syncSimFromLive), live-build.ts, ability-hud.ts, branch-effects.ts, subclass-verbs.ts,
 * operator-abilities.ts and operators.ts for the C++ port's test (Plugins/WorldFractureCore/Tests/AbilityCoreTest.cpp).
 *
 *   node unreal/tools/build-golden.mjs unreal/tools/gen-ability-golden.ts
 *
 * build-golden routes ability-effects.ts's damage pricing / deaths / alerts / turret and zone spawns, hitPoise and the
 * obstacle query to recorders (damage x0.9; obstacles = the case's list).
 *
 * Lines (tab-separated, "~" = absent):
 *   C name subclass environment energy nextEventId   a case, then
 *     S iframes barrier dome noise combatHeat lastHit           the sim fields the casts touch
 *     B mode PRIMARY TACTICAL ULTIMATE / BR ability branch      its build and branch picks (createLiveBuild)
 *     OB x z r                                                 an obstacle
 *     M alive x z hp boss aim cool vulnUntil vulnMult          a machine slot, in order
 *   CAST slot x z yaw inVehicle now  -> RC ok reason text x z yaw config event
 *   TICK dt recharge / REBIND (then B / BR lines) / HOLD x z / CANCEL x z now / AIM i v
 *   L log      X live|machines|sim      HUD rows      SY verbDamage stealth incoming
 *   SEL tokens ability branch -> tokens picked   (selectAbilityBranch)
 *   TU ... rift turret deploy / step lines
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSim } from "../../src/game/sim";
import { castAbility, holdDisabledField, cancelAbilities, syncSimFromLive, abilityHud } from "../../src/game/ability-effects";
import { createLiveBuild, rebindLiveBuild, tickLiveBuild, type LiveBuild } from "../../src/game/live-build";
import { ABILITY_CONFIGS } from "../../src/game/combat-engine";
import { ABILITY_NODES, type ActiveBuild } from "../../src/game/ability-network";
import { LEGACY_ABILITY_IDS } from "../../src/game/operators";
import { deployRiftTurret, stepRiftTurret, type RiftTurret } from "../../src/game/operator-abilities";
import { DEFAULT_PROGRESSION, selectAbilityBranch } from "../../src/game/progression";
import type { AbilitySlot, SubclassId } from "../../src/game/loadout";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "ability_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
let seed = 0xab1e;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
let nowSec = 800;
globalThis.performance.now = () => nowSec * 1000;
let rulesRunning = false;
Math.random = () => { if (rulesRunning) throw new Error("abilities must not draw random numbers"); return rand(); };
const log = (): string[] => ((globalThis as unknown as { __wfAbilityLog: string[] }).__wfAbilityLog ??= []);
const obstacles = (): { x: number; z: number; r: number }[] => ((globalThis as unknown as { __wfObstacles: { x: number; z: number; r: number }[] }).__wfObstacles ??= []);

const SLOTS: AbilitySlot[] = ["PRIMARY", "TACTICAL", "ULTIMATE"];
const SUBS: (SubclassId | "")[] = ["", "SHIELD_TITAN", "BERSERKER_TITAN", "BULWARK_TITAN", "SHADOW_HUNTER", "TRACKER_HUNTER", "FRACTURE_RUNNER", "CODE_WARLOCK", "VOID_WARLOCK", "ORACLE_WARLOCK"];
const MACHINES = 8;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));

const randomBuild = (): ActiveBuild => {
  const slots = {} as Record<AbilitySlot, string>;
  for (const s of SLOTS) {
    const r = rand();
    const own = ABILITY_CONFIGS.filter((c) => c.slot === s).map((c) => c.id);
    slots[s] = r < 0.75 ? pick(own) : r < 0.85 ? pick(Object.keys(LEGACY_ABILITY_IDS)) : r < 0.95 ? pick(ABILITY_CONFIGS.map((c) => c.id)) : "no-such-ability";
  }
  return { mode: pick(["SOLO", "HYBRID", "SQUAD"]) as ActiveBuild["mode"], slots };
};
const randomBranches = (b: ActiveBuild): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const id of Object.values(b.slots)) {
    if (rand() < 0.4) continue;
    const node = ABILITY_NODES.find((x) => x.id === id);
    out[id] = rand() < 0.85 && node ? pick(node.branches).id : pick(["mirror-plate", "junk-branch", "hold-fast"]);
  }
  if (rand() < 0.2) out[pick(Object.keys(LEGACY_ABILITY_IDS))] = "hold-fast";
  return out;
};
const writeBuild = (b: ActiveBuild, br: Record<string, string>) => {
  out("B", b.mode, b.slots.PRIMARY, b.slots.TACTICAL, b.slots.ULTIMATE);
  for (const [k, v] of Object.entries(br).sort(([a], [c]) => (a < c ? -1 : a > c ? 1 : 0))) out("BR", k, v);
};
const liveText = (l: LiveBuild) => [
  SLOTS.map((s) => l.equipped.slots[s]).join(","), l.equipped.mode,
  Object.keys(l.branches).sort().map((k) => `${k}=${l.branches[k]}`).join(","),
  SLOTS.map((s) => `${l.runtime[s].state}/${n(l.runtime[s].cooldown)}/${n(l.runtime[s].activeFor)}`).join(","),
  n(l.energy), l.effect, n(l.effectTime), l.threat, n(l.damageMultiplier), n(l.shieldReflect), n(l.dashTime), n(l.hackTime), n(l.fieldTime), n(l.momentum),
  n(l.siegeTime), n(l.veilTime), l.verbKind || NONE, n(l.verbTime), n(l.verbMagnitude),
  l.pendingVerb ? `${l.pendingVerb.verb}/${n(l.pendingVerb.magnitude)}/${n(l.pendingVerb.duration)}/${n(l.pendingVerb.radius)}` : NONE, n(l.strikeBoost), n(l.siegeBoost),
].join("|");
type Sim = ReturnType<typeof createSim>;
const simText = (sim: Sim) => {
  const ms = sim.machines.slice(0, MACHINES).map((m) => [m.alive ? 1 : 0, n(m.x), n(m.z), n(m.hp), m.boss ? 1 : 0, n(m.aim ?? 0), n(m.cool), n(m.vulnUntil), n(m.vulnMult)].join("/")).join(";");
  return `${ms}|${n(sim.iframes)}|${n(sim.barrierTime)}|${n(sim.titan.domeTime)}|${n(sim.playerNoise ?? 0)}|${n(sim.combatHeat)}|${n(sim.lastHit)}`;
};
const eventText = (e: { id: number; kind: string; abilityId: string; slot: string; effect: string; x: number; z: number; radius: number; duration: number; fromX?: number; fromZ?: number; hits: number; bossHits: number; kills: number; reason?: string; at: number }) =>
  [n(e.id), e.kind, e.abilityId, e.slot, e.effect, n(e.x), n(e.z), n(e.radius), n(e.duration), e.fromX === undefined ? NONE : n(e.fromX), e.fromZ === undefined ? NONE : n(e.fromZ), n(e.hits), n(e.bossHits), n(e.kills), e.reason ?? NONE, n(e.at)].join("/");
const hudText = (l: LiveBuild) => abilityHud(l).map((h) => [h.slot, h.key, h.id, h.name, h.state, h.ready ? 1 : 0, n(h.cooldown), n(h.cooldownMax), n(h.cost)].join("/")).join(";");

let ops = 0;
for (let c = 0; c < 200; c++) {
  const sub = pick(SUBS), env = pick(["war", "war", "fracture", "safe"]);
  const build = randomBuild(), branches = randomBranches(build);
  const sim = createSim();
  const energy = pick([100, 100, 60, 30, 12, 0]);
  out("C", `case-${c}`, sub || NONE, env, energy, sim.nextAbilityEventId);
  out("S", sim.iframes, sim.barrierTime, sim.titan.domeTime, sim.playerNoise ?? 0, sim.combatHeat, sim.lastHit);
  writeBuild(build, branches);
  let live = createLiveBuild(build, branches);
  live.energy = energy;
  obstacles().length = 0;
  for (let i = 0, k = Math.floor(rand() * 4); i < k; i++) { const o = { x: Math.round((rand() * 24 - 12) * 10) / 10, z: Math.round((rand() * 24 - 12) * 10) / 10, r: pick([0.5, 1, 2]) }; obstacles().push(o); out("OB", o.x, o.z, o.r); }
  for (const m of sim.machines) m.alive = false;
  for (let i = 0; i < MACHINES; i++) {
    const m = sim.machines[i]!;
    Object.assign(m, { alive: rand() < 0.8, x: Math.round((rand() * 36 - 18) * 10) / 10, z: Math.round((rand() * 36 - 18) * 10) / 10, hp: pick([0.5, 1, 3, 7, 20, 34]), boss: rand() < 0.15, aim: rand() < 0.25 ? 0.4 : 0, cool: 0, vulnUntil: 0, vulnMult: 1 });
    out("M", m.alive ? 1 : 0, m.x, m.z, m.hp, m.boss ? 1 : 0, m.aim ?? 0, m.cool, m.vulnUntil, m.vulnMult);
  }
  let x = 0, z = 0, yaw = rand() * 6;
  nowSec = 800 + c * 3;
  for (let k = 0; k < 40; k++) {
    log().length = 0;
    const r = rand();
    if (r < 0.42) {
      const slot = pick(SLOTS), inVehicle = rand() < 0.05;
      out("CAST", slot, x, z, yaw, inVehicle ? 1 : 0, nowSec);
      rulesRunning = true;
      const res = castAbility(sim, live, slot, { x, z, yaw }, { environment: env, subclassId: sub || undefined, inVehicle });
      rulesRunning = false;
      if (res.ok) { x = res.pose.x; z = res.pose.z; yaw = res.pose.yaw; }
      out("RC", res.ok ? 1 : 0, res.ok ? NONE : res.reason, res.ok ? NONE : res.text, x, z, yaw, res.ok ? res.config.id : NONE, eventText(res.event));
    } else if (r < 0.8) {
      const dt = pick([0.05, 0.25, 0.5, 1, 3, 8]), recharge = pick([0, 0, 0.15, -0.2]);
      out("TICK", dt, recharge);
      tickLiveBuild(live, dt, recharge);
      nowSec += dt;
      for (const m of sim.machines.slice(0, MACHINES)) m.cool = Math.max(0, m.cool - dt);
      sim.iframes = Math.max(0, sim.iframes - dt); sim.barrierTime = Math.max(0, sim.barrierTime - dt); sim.titan.domeTime = Math.max(0, sim.titan.domeTime - dt);
      if (rand() < 0.2) { x += rand() * 8 - 4; z += rand() * 8 - 4; yaw += rand() - 0.5; out("MOVE", x, z, yaw); }
      if (rand() < 0.1) { const i = Math.floor(rand() * MACHINES), m = sim.machines[i]!; m.aim = m.aim ? 0 : 0.5; out("AIM", i, m.aim); }
    } else if (r < 0.87) {
      const nb = rand() < 0.3 ? build : randomBuild(), nbr = rand() < 0.3 ? branches : randomBranches(nb);
      out("REBIND"); writeBuild(nb, nbr);
      live = rebindLiveBuild(live, nb, nbr);
    } else if (r < 0.95) {
      out("HOLD", x, z);
      holdDisabledField(sim, live, { x, z, yaw });
    } else {
      out("CANCEL", x, z, nowSec);
      live = cancelAbilities(sim, live, { x, z, yaw });
      for (const e of sim.abilityEvents.slice(-3)) out("EV", eventText(e));
    }
    out("L", log().join(";") || NONE);
    out("X", liveText(live), simText(sim));
    out("HUD", hudText(live));
    const before = { d: sim.verbDamageMult, s: sim.stealthMult, i: sim.verbIncomingMult };
    syncSimFromLive(sim, live);
    out("SY", sim.verbDamageMult, sim.stealthMult, sim.verbIncomingMult);
    Object.assign(sim, { verbDamageMult: before.d, stealthMult: before.s, verbIncomingMult: before.i });
    ops++;
  }
}
// selectAbilityBranch
for (let i = 0; i < 60; i++) {
  const tokens = pick([0, 0.5, 1, 3]), id = pick(ABILITY_CONFIGS).id, br = pick(ABILITY_NODES.find((x) => x.id === id)!.branches).id;
  const p = selectAbilityBranch({ ...DEFAULT_PROGRESSION, calibrationTokens: tokens, abilityBranches: {} }, id, br);
  out("SEL", tokens, id, br, p.calibrationTokens, p.abilityBranches[id] ?? NONE);
}
// rift turrets
for (let c = 0; c < 80; c++) {
  let list: RiftTurret[] = [];
  let now = 100;
  out("TC", c);
  const targets = Array.from({ length: Math.floor(rand() * 6) }, () => ({ x: rand() * 80 - 40, z: rand() * 80 - 40, alive: rand() < 0.8 }));
  for (const t of targets) out("TT", t.x, t.z, t.alive ? 1 : 0);
  for (let k = 0; k < 30; k++) {
    if (rand() < 0.15) { const x = rand() * 10 - 5, z = rand() * 10 - 5, dur = pick([5, 20, 25]); list = deployRiftTurret(list, x, z, now, dur); out("TD", x, z, now, dur, list.map((t) => `${n(t.x)}/${n(t.z)}/${n(t.until)}`).join(";")); }
    const dt = pick([0.1, 0.3, 0.5, 1]);
    const hits = list.map((t) => stepRiftTurret(t, targets, dt));
    now += dt;
    out("TS", dt, hits.join(","), list.map((t) => `${n(t.cool)}/${n(t.rot)}/${n(t.flash)}`).join(";"));
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`200 cases, ${ops} operations, ${lines.length} lines -> ${OUT}`);
