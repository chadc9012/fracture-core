/**
 * Records golden Dragonite casts from the web build's real dragonite-cast.ts (castDragonite / stepDragonite) and
 * live-build.ts energy regeneration for the C++ port's test (Plugins/WorldFractureCore/Tests/DragoniteCastCoreTest.cpp).
 *
 *   node unreal/tools/build-golden.mjs unreal/tools/gen-dragoncast-golden.ts
 *
 * build-golden routes dragonite-cast.ts's applyMachineDamageMods / defeatMachine / alert to a recorder (damage x0.9).
 *
 * Lines (tab-separated, "~" = absent). Items are "id|name|slot|power|level|element|source|setId|rarity|perk".
 *   C name class fury energy      a case; then PI item / PE slot id / K earnedRewards key
 *   M alive x z hp boss aim cool vulnUntil vulnMult      one machine slot, in order
 *   CAST id x z yaw grounded now  -> RC ok|text|launchVy|glide|airDashes|energy
 *   STEP dt x z now               -> RS resist|stagger|gliding
 *   L log                         the world calls of the operation
 *   X state                       runtime and machines after it (numbers compared to 1e-9 relative)
 *   EN energy dt rate -> value
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSim } from "../../src/game/sim";
import { createDragoniteRuntime, castDragonite, stepDragonite, type DragoniteRuntime } from "../../src/game/dragonite-cast";
import { DRAGONITE_IDS } from "../../src/game/dragonite";
import { dragoniteGear } from "../../src/game/dragon-covenant";
import type { ClassId } from "../../src/game/progression";
import type { GearItem } from "../../src/game/inventory";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "dragonitecast_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
const o = (v: number | undefined) => (v === undefined ? NONE : String(v));
let seed = 0xca57;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
let nowSec = 500;
globalThis.performance.now = () => nowSec * 1000;
let rulesRunning = false;
Math.random = () => { if (rulesRunning) throw new Error("casts must not draw random numbers"); return rand(); };
const log = (): string[] => ((globalThis as unknown as { __wfCastLog: string[] }).__wfCastLog ??= []);
const gear = (g: GearItem) => `${g.id}|${g.name}|${g.slot}|${n(g.power)}|${n(g.level)}|${g.element}|${g.source}|${g.setId ?? ""}|${g.rarity ?? ""}|${g.perk ?? ""}`;
const stats = (s: Record<string, number> | null | undefined) => (s ? Object.keys(s).sort().map((k) => `${k}:${n(s[k]!)}`).join(",") : NONE);

type Sim = ReturnType<typeof createSim>;
const MACHINES = 8;
const state = (rt: DragoniteRuntime, sim: Sim) => {
  const cd = DRAGONITE_IDS.map((id) => `${id}=${n(rt.cd[id])}`).join(",");
  const p = rt.pending ? `${n(rt.pending.x)}|${n(rt.pending.z)}|${n(rt.pending.left)}|${n(rt.pending.fury)}|${stats(rt.pending.st)}` : NONE;
  const w = rt.wyrm;
  const wyrm = `${w.state}/${n(w.t)}/${n(w.left)}/${n(w.strafesLeft)}/${w.target === null ? NONE : n(w.target)}/${n(w.cooldown)}/${w.finished ? 1 : 0}`;
  const ms = sim.machines.slice(0, MACHINES).map((m) => [m.alive ? 1 : 0, n(m.x), n(m.z), n(m.hp), m.boss ? 1 : 0, n(m.aim ?? 0), n(m.cool), n(m.vulnUntil), n(m.vulnMult)].join("|")).join(";");
  return `cd={${cd}};pending=${p};hide=${n(rt.hide)};hideStats=${stats(rt.hideStats)};glide=${n(rt.glide)};air=${n(rt.airDashes)};landing=${n(rt.landingStrike)};wyrm=${wyrm};machines=[${ms}]`;
};

const lines: string[] = [];
const CLASSES: (ClassId | null)[] = ["TITAN", "HUNTER", "WARLOCK", "TITAN", null];
let ops = 0;
for (let c = 0; c < 160; c++) {
  const cls = pick(CLASSES);
  const fury = pick([0, 0, 0.05, 0.15, 0.3]);
  let energy = pick([0, 15, 40, 100]);
  const earned: string[] = [];
  const inventory: GearItem[] = [];
  const equipped: Record<string, string> = {};
  if (cls && rand() < 0.9) earned.push(`covenant:vyrak:${cls}`);
  if (cls && rand() < 0.5) earned.push(`vyrak-riding:${cls}`);
  if (cls) for (const id of DRAGONITE_IDS) for (let lv = 1, top = Math.floor(rand() * 5); lv <= top; lv++) earned.push(`dragonite-up:${cls}:${id}:${lv}`);
  if (cls && rand() < 0.5) for (const g of dragoniteGear(cls)) if (rand() < 0.7) { inventory.push(g); equipped[g.slot] = g.id; }
  lines.push(["C", `case-${c}`, cls ?? NONE, n(fury), n(energy)].join("\t"));
  for (const g of inventory) lines.push(["PI", gear(g)].join("\t"));
  for (const [s, id] of Object.entries(equipped)) lines.push(["PE", s, id].join("\t"));
  for (const k of earned) lines.push(["K", k].join("\t"));

  const sim = createSim();
  for (const m of sim.machines) m.alive = false;
  for (let i = 0; i < MACHINES; i++) {
    const m = sim.machines[i]!;
    Object.assign(m, { alive: rand() < 0.85, x: Math.round((rand() * 28 - 14) * 10) / 10, z: Math.round((rand() * 28 - 14) * 10) / 10, hp: pick([1, 3, 7, 20, 34]), boss: rand() < 0.15, aim: rand() < 0.25 ? 0.4 : 0, cool: 0, vulnUntil: 0, vulnMult: 1 });
    lines.push(["M", m.alive ? "1" : "0", n(m.x), n(m.z), n(m.hp), m.boss ? "1" : "0", n(m.aim ?? 0), n(m.cool), n(m.vulnUntil), n(m.vulnMult)].join("\t"));
  }
  const rt = createDragoniteRuntime();
  const ctx = { earnedRewards: earned, inventory, equippedGear: equipped, cls, fury };
  let x = 0, z = 0, yaw = rand() * 6;
  nowSec = 500 + c;
  for (let k = 0; k < 60; k++) {
    log().length = 0;
    if (rand() < 0.35) {
      const id = pick(DRAGONITE_IDS), grounded = rand() < 0.7;
      lines.push(["CAST", id, n(x), n(z), n(yaw), grounded ? "1" : "0", n(nowSec)].join("\t"));
      const e = { value: energy };
      rulesRunning = true;
      const r = castDragonite(rt, sim, e, id, { x, z, yaw }, grounded, ctx);
      rulesRunning = false;
      energy = e.value;
      lines.push(["RC", [r.ok ? "1" : "0", r.text, o(r.launchVy), o(r.glideSeconds), o(r.airDashes), n(energy)].join("|")].join("\t"));
    } else {
      const dt = pick([0.1, 0.25, 0.5, 1, 2, 6]);
      lines.push(["STEP", n(dt), n(x), n(z), n(nowSec)].join("\t"));
      rulesRunning = true;
      const r = stepDragonite(rt, sim, dt, { x, z }, ctx);
      rulesRunning = false;
      lines.push(["RS", [n(r.resist), n(r.stagger), r.gliding ? "1" : "0"].join("|")].join("\t"));
      nowSec += dt;
      energy = Math.min(100, energy + dt * 9);
      lines.push(["EN", n(energy)].join("\t"));
      for (const m of sim.machines.slice(0, MACHINES)) m.cool = Math.max(0, m.cool - dt);
      if (rand() < 0.2) { x += rand() * 6 - 3; z += rand() * 6 - 3; yaw += rand() - 0.5; }
      if (rand() < 0.1) { const m = sim.machines[Math.floor(rand() * MACHINES)]!; m.aim = m.aim ? 0 : 0.5; lines.push(["AIM", n(sim.machines.indexOf(m)), n(m.aim)].join("\t")); }
    }
    lines.push(["L", log().join(";") || NONE].join("\t"));
    lines.push(`X\t${state(rt, sim)}`);
    ops++;
  }
}
for (let i = 0; i < 40; i++) {
  const e = pick([0, 30, 95, 100]), dt = pick([0.016, 0.5, 2]), rate = pick([1, 1.25, 2]);
  lines.push(["ENR", n(e), n(dt), n(rate), n(Math.min(100, e + dt * 9 * rate))].join("\t"));
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`160 cases, ${ops} operations -> ${OUT}`);
