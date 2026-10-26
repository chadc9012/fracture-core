/**
 * Records golden boss fights from the web build's real encounter-sim.ts (with its scenario-encounters.ts data),
 * boss-poise.ts, boss-phases.ts, scenario-gimmicks.ts and sim.ts applyMachineDamageMods for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/EncounterCoreTest.cpp).
 *
 *   node unreal/tools/build-golden.mjs unreal/tools/gen-encounter-golden.ts
 *
 * (build-golden routes encounter-sim.ts's hurtPlayer to a recorder: player hits are reported, not applied.)
 * performance.now is driven by the recorder, so every "now" is in the file.
 *
 * Lines (tab-separated, "~" = absent):
 *   ENC id victory truce            truce = below|floorFrac|nova
 *   ATK enc id kind label tell tellTime damage minRange maxRange radius width arc reach decoys recovery window zone summon
 *                                                          summon = profile:kind:count:hp:scale:elite,...
 *   PH enc id name below nova attacks gap arena finale     zone = kind|radius|dps|slow|count|arm|life|place|ringRadius|orbitSpeed|name
 *                                                          finale = attack|window|floorHp|nova
 *   SCR id outsideWindowMult gimmick
 *   RUN scenarioId profile bossX bossZ        a fight; then per step any of
 *     D amount now     damage the boss (hp floor / death as defeatMachine)      ST until   stagger until
 *     CO cool          set the boss's stun cooldown                             SH decoyId now  shatter a decoy
 *     SU profile kind x z hp scale elite   a called-in troop placed in the first free slot     KS slot  it dies
 *     R now            the player died                                          S dt px pz now   step
 *     X state          state after the step (fuzzy compare: numbers to 1e-9 relative)
 *   DB scenarioId x z  a boss for the damage rules; then  H dmg element px pz now -> HR out|poise|history|hits
 *   PP fraction -> phase      DP poise staggerUntil weakUntil dt now -> poise
 *   HP poise staggerUntil weakUntil poiseDamage now -> poise|damageMult
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSim, applyMachineDamageMods, type Machine } from "../../src/game/sim";
import { resetSkill } from "../../src/game/summon-skills";
import { stepEncounters, resetEncounters, encounterHpFloor, endEncounter, onDecoyShattered, isSummoned, pinSummons } from "../../src/game/encounter-sim";
import { ENCOUNTERS, type ZoneSpec } from "../../src/game/scenario-encounters";
import { UNIQUE_SCENARIOS } from "../../src/game/unique-scenarios";
import { INITIAL_POISE, decayPoise, hitPoise, type PoiseState } from "../../src/game/boss-poise";
import { phaseForHpFraction } from "../../src/game/boss-phases";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "encounter_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
const o = (v: number | undefined | null) => (v === undefined || v === null ? NONE : String(v));
let seed = 0xe7c0;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
let nowSec = 1000;
globalThis.performance.now = () => nowSec * 1000;
let rulesRunning = false; // createSim may roll; the encounter and damage rules must not
Math.random = () => { if (rulesRunning) throw new Error("encounters must not draw random numbers"); return rand(); };
const hurts = (): [number, string][] => ((globalThis as unknown as { __wfHurts: [number, string][] }).__wfHurts ??= []);

const lines: string[] = [];
const zoneText = (z: ZoneSpec | undefined) => (z ? [z.kind, n(z.radius), n(z.dps), o(z.slow), n(z.count), n(z.arm), n(z.life), z.place, o(z.ringRadius), o(z.orbitSpeed), z.name].join("|") : NONE);
for (const def of Object.values(ENCOUNTERS)) {
  lines.push(["ENC", def.scenarioId, def.victory, def.truce ? [n(def.truce.below), n(def.truce.floorFrac), def.truce.nova].join("|") : NONE].join("\t"));
  for (const a of Object.values(def.attacks))
    lines.push(["ATK", def.scenarioId, a.id, a.kind, a.label, a.tell, n(a.tellTime), n(a.damage), n(a.minRange), n(a.maxRange), o(a.radius), o(a.width), o(a.arc), o(a.reach), o(a.decoys), n(a.recovery), n(a.window), zoneText(a.zones), a.summon ? a.summon.map((g) => [g.profile, g.kind, n(g.count), n(g.hp), n(g.scale), g.elite ? "1" : "0"].join(":")).join(",") : NONE].join("\t"));
  for (const p of def.phases)
    lines.push(["PH", def.scenarioId, p.id, p.name, n(p.below), p.nova, p.attacks.join(","), n(p.gap), zoneText(p.arena), p.finale ? [p.finale.attack, n(p.finale.window), n(p.finale.floorHp), p.finale.nova].join("|") : NONE].join("\t"));
}
for (const s of UNIQUE_SCENARIOS) lines.push(["SCR", s.id, n(s.outsideWindowMult), s.gimmick ?? NONE].join("\t"));

type Sim = ReturnType<typeof createSim>;
const poiseText = (p: PoiseState | undefined) => { const q = p ?? INITIAL_POISE; return `${n(q.poise)}|${n(q.staggerUntil)}|${n(q.weakPointUntil)}`; };
function stateText(sim: Sim, m: Machine, decoys: Map<Machine, number>, seenEvent: { id: number }) {
  const e = m.encounter;
  const enc = e ? [n(e.phase), e.state, n(e.timer), o(e.atk as string | undefined), n(e.cursor), n(e.tx), n(e.tz), n(e.cx), n(e.cz), n(e.sinceFinale), n(e.finaleUntil), n(e.tellTotal), e.truce ? "1" : "0", o(e.truceAt)].join("|") : NONE;
  const boss = [m.alive ? 1 : 0, n(m.x), n(m.z), n(m.hp), n(m.cool), poiseText(m.poiseState), m.scenarioId ?? NONE].join("|");
  const zones = sim.encounterZones.map((z) => [n(z.id), z.name, z.kind, n(z.x), n(z.z), n(z.radius), n(z.dps), n(z.slow), n(z.armAt), n(z.until), z.scope, z.orbit ? n(z.orbit.ang) : NONE].join("|")).join(";");
  const events = sim.encounterEvents.filter((ev) => ev.id > seenEvent.id).map((ev) => [n(ev.id), ev.kind, ev.scenarioId, n(ev.phase), ev.phaseName, ev.attack ?? NONE, ev.text, n(ev.x), n(ev.z), n(ev.radius), n(ev.duration), ev.hit === undefined ? NONE : ev.hit ? "1" : "0", n(ev.at)].join("|")).join(";");
  for (const ev of sim.encounterEvents) seenEvent.id = Math.max(seenEvent.id, ev.id);
  const hurt = hurts().map(([d, l]) => `${n(d)}|${l}`).join(";");
  hurts().length = 0;
  const dec = [...decoys.entries()].sort((a, b) => a[1] - b[1]).map(([mm, id]) => `${n(id)}|${n(mm.x)}|${n(mm.z)}`).join(";");
  const sum = sim.machines.filter(isSummoned).map((x) => [n(x.x), n(x.z), x.profile, x.kind, n(x.hp), n(x.scale), x.elite ? "1" : "0"].join("|")).sort().join(";");
  return `boss=${boss};enc=${enc};zones=[${zones}];events=[${events}];hurts=[${hurt}];hazard=${n(sim.hazardSpeedMult)};decoys=[${dec}];summons=[${sum}]`;
}

/** decoy machines get ids in spawn order, matched to their DECOY events by position */
function trackDecoys(sim: Sim, decoys: Map<Machine, number>, next: { id: number }, fromEvent: number) {
  for (const [mm] of decoys) if (!mm.alive || !mm.decoy) decoys.delete(mm);
  for (const ev of sim.encounterEvents) {
    if (ev.kind !== "DECOY" || ev.id <= fromEvent) continue;
    const mm = sim.machines.find((x) => x.alive && x.decoy && x.x === ev.x && x.z === ev.z && !decoys.has(x));
    if (mm) decoys.set(mm, next.id++);
  }
}

const SCENARIOS = Object.keys(ENCOUNTERS);
let steps = 0;
const DRILL_TROOPS = [["Void Reaver", "OVERCLOCKED", 3, 0.9, false], ["Void Arcanist", "RAIDER", 4, 1.1, false], ["Void Sentinel", "VANGUARD", 22, 2.6, true], ["Void Vanguard", "VANGUARD", 12, 1.7, true]] as const;
for (let run = 0; run < 152; run++) {
  // the last 16 fights start the Hollow Saint in its False Saints phase, so decoys spawn, cap at 4 and shatter
  const decoyDrill = run >= 96 && run < 112;
  // the last 40 are Astravore with troops placed and killed at random, so every summon skill (Reaver strikes, Arcanist pools,
  // Sentinel turrets up to three) and slot reuse is exercised
  const summonDrill = run >= 112;
  const scenarioId = decoyDrill ? "hollow-saint" : summonDrill ? "astravore" : SCENARIOS[run % SCENARIOS.length]!;
  nowSec = 1000 + run * 3;
  const sim = createSim();
  for (const mm of sim.machines) mm.alive = false;
  sim.encounterZones = []; sim.encounterEvents = []; sim.hazardSpeedMult = 1;
  hurts().length = 0;
  const m = sim.machines[0]!;
  const bx = Math.round(rand() * 200 - 100), bz = Math.round(rand() * 200 - 100);
  Object.assign(m, { alive: true, boss: true, elite: true, scenarioId, x: bx, z: bz, hp: 34, maxHp: 34, cool: 0, poiseState: INITIAL_POISE, profile: `Boss ${scenarioId}`, encounter: undefined, decoy: undefined });
  lines.push(["RUN", scenarioId, m.profile, n(bx), n(bz)].join("\t"));
  let px = bx + 20, pz = bz;
  const decoys = new Map<Machine, number>();
  const nextDecoy = { id: 1 };
  const seen = { id: 0 };
  const style = decoyDrill ? "patient" : pick(["aggressive", "patient", "kiting"] as const);
  if (decoyDrill) { lines.push(["D", "10", n(nowSec)].join("\t")); m.hp -= 10; }
  const maxSteps = decoyDrill ? 500 : summonDrill ? 400 : scenarioId === "hollow-saint" ? 400 : 220;
  const addTroop = () => {
    const [profile, kind, hp, scale, elite] = pick(DRILL_TROOPS);
    const slot = sim.machines.find((x) => !x.alive);
    if (!slot) return;
    const x = m.x + Math.round(rand() * 60 - 30), z = m.z + Math.round(rand() * 60 - 30);
    Object.assign(slot, { alive: true, react: undefined, x, z, hp, maxHp: hp, rot: 0, scale, zone: m.zone, cool: 1.2, elite, boss: false, mission: false, profile, kind, drop: "dataShards", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, aim: 0, summoned: true });
    delete slot.encounter; delete slot.decoy; delete slot.living; delete slot.nemesis; delete slot.scenarioId; delete slot.lastPlayerDamage; resetSkill(slot);
    lines.push(["SU", profile, kind, n(x), n(z), n(hp), n(scale), elite ? "1" : "0"].join("\t"));
  };
  if (summonDrill) for (let k = 2 + Math.floor(rand() * 4); k > 0; k--) addTroop();
  for (let s = 0; s < maxSteps && m.alive; s++) {
    const before = seen.id;
    if (summonDrill) {
      const q = rand();
      if (q < 0.03) addTroop();
      else if (q < 0.05) { const i = sim.machines.findIndex((x) => isSummoned(x)); const live = sim.machines.map((x, k) => (isSummoned(x) ? k : -1)).filter((k) => k >= 0); if (i >= 0) { const k = pick(live); sim.machines[k]!.alive = false; delete sim.machines[k]!.summoned; lines.push(["KS", n(k)].join("\t")); } }
    }
    const r = rand();
    if (r < (style === "aggressive" ? 0.18 : decoyDrill ? 0.01 : 0.08)) {
      const amount = pick([0.5, 1, 2, 3, 5, 8]);
      lines.push(["D", n(amount), n(nowSec)].join("\t"));
      m.hp -= amount;
      if (m.hp <= 0) {
        const floor = encounterHpFloor(m, nowSec);
        if (floor > 0) m.hp = floor;
        else { m.alive = false; endEncounter(sim, m); }
      }
    } else if (r < 0.2) {
      const until = nowSec + pick([0.5, 1, 3]);
      lines.push(["ST", n(until)].join("\t"));
      m.poiseState = { ...(m.poiseState ?? INITIAL_POISE), staggerUntil: until };
    } else if (r < 0.25) {
      const cool = pick([0, 0.4, 1.5]);
      lines.push(["CO", n(cool)].join("\t"));
      m.cool = cool;
    } else if (r < 0.31) {
      if (decoys.size && (!decoyDrill || rand() < 0.15)) {
        const [mm, id] = pick([...decoys.entries()]);
        lines.push(["SH", n(id), n(nowSec)].join("\t"));
        mm.alive = false; onDecoyShattered(sim, mm); delete mm.decoy;
      }
    } else if (r < 0.313) {
      lines.push(["R", n(nowSec)].join("\t"));
      resetEncounters(sim);
    }
    trackDecoys(sim, decoys, nextDecoy, before);
    if (!m.alive) { lines.push(`X\t${stateText(sim, m, decoys, seen)}`); break; }
    // the player moves: dodging, closing in, kiting, sometimes far away
    const step = style === "kiting" ? 4 : 2;
    px += (rand() * 2 - 1) * step; pz += (rand() * 2 - 1) * step;
    if (rand() < 0.03) { px = m.x + pick([0, 3, 12, 40, 89.5, 92, 120]); pz = m.z + pick([0, -5, 9]); }
    const dt = pick([1 / 30, 0.1, 0.25, 0.5]);
    lines.push(["S", n(dt), n(px), n(pz), n(nowSec)].join("\t"));
    const evBefore = seen.id;
    rulesRunning = true; stepEncounters(sim, dt, px, pz); pinSummons(sim, dt, px, pz); rulesRunning = false; // the squad AI (between the two in sim.ts) is not replayed
    trackDecoys(sim, decoys, nextDecoy, evBefore);
    m.cool = Math.max(0, m.cool - dt);
    nowSec += dt;
    lines.push(`X\t${stateText(sim, m, decoys, seen)}`);
    steps++;
  }
}

// damage rules: applyMachineDamageMods for scenario bosses (gimmicks, outside-window immunity) and plain bosses
const ELEMENTS = ["KINETIC", "THERMAL", "CRYO", "ARC", "BIO"] as const;
let hits = 0;
for (let b = 0; b < 120; b++) {
  const sim = createSim();
  sim.consumableDamageMult = 1;
  const m = sim.machines[0]!;
  const scenarioId = rand() < 0.85 ? pick([...UNIQUE_SCENARIOS.map((s) => s.id), "vyrak"]) : undefined;
  Object.assign(m, { alive: true, boss: true, x: 0, z: 0, scenarioId, poiseState: INITIAL_POISE, vulnUntil: 0, vulnMult: 1, nemesisWeak: undefined, gimmickHistory: undefined, playerHits: undefined });
  lines.push(["DB", scenarioId ?? NONE, "0", "0"].join("\t"));
  nowSec = 2000 + b * 50;
  for (let h = 0; h < 40; h++) {
    const dmg = pick([0.2, 0.5, 1, 1.2, 3]), el = rand() < 0.6 ? pick(ELEMENTS) : "KINETIC";
    const ppx = pick([2, 10, 14, 20, 30, 34, 50]), ppz = pick([0, 3]);
    nowSec += pick([0.1, 0.5, 2, 9]);
    rulesRunning = true; const out = applyMachineDamageMods(sim, m, dmg, el, ppx, ppz); rulesRunning = false;
    lines.push(["H", n(dmg), el, n(ppx), n(ppz), n(nowSec), `${n(out)}|${poiseText(m.poiseState)}|${(m.gimmickHistory ?? []).join(",") || NONE}|${n(m.playerHits ?? 0)}`].join("\t"));
    hits++;
  }
}
for (const f of [-0.1, 0, 0.1, 0.3, 0.30000001, 0.5, 0.66, 0.661, 0.9, 1, 1.2]) lines.push(["PP", n(f), n(phaseForHpFraction(f))].join("\t"));
for (let i = 0; i < 60; i++) {
  const p: PoiseState = { poise: pick([0, 3, 50, 99]), staggerUntil: pick([0, 10, 100]), weakPointUntil: pick([0, 20]) };
  const dt = pick([0.1, 1, 30]), now = pick([5, 50, 150]);
  const q = decayPoise(p, dt, now);
  lines.push(["DP", n(p.poise), n(p.staggerUntil), n(p.weakPointUntil), n(dt), n(now), poiseText(q)].join("\t"));
}
// hitPoise around a stagger: staggered, the refractory gap after it, and building again
for (let i = 0; i < 80; i++) {
  const until = pick([10, 50]);
  const p: PoiseState = { poise: pick([0, 40, 95]), staggerUntil: until, weakPointUntil: pick([0, until, until + 3]) };
  const dmg = pick([1, 6, 70]), now = until + pick([-1, 0, 3.9, 5.5, 5.99, 6, 6.01, 9, -until]);
  const r = hitPoise(p, dmg, now);
  lines.push(["HP", n(p.poise), n(p.staggerUntil), n(p.weakPointUntil), n(dmg), n(now), `${poiseText(r.state)}|${n(r.damageMult)}`].join("\t"));
}

writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`${SCENARIOS.length} encounters, 112 fights, ${steps} steps, ${hits} damage hits -> ${OUT}`);
