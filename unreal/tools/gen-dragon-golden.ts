/**
 * Records golden Dragonite / Vyrak trust / riding states from the web build's real dragonite.ts, dragonite-cast.ts
 * (statsFor) and vyrak-trust.ts for the C++ port's test (Plugins/WorldFractureCore/Tests/DragonCoreTest.cpp).
 *
 *   npx esbuild unreal/tools/gen-dragon-golden.ts --bundle --platform=node --format=esm \
 *     --alias:@=./src --outfile=/tmp/wf-dragon-golden.mjs && node /tmp/wf-dragon-golden.mjs
 *
 * Lines (tab-separated, "~" = absent). Items are "id|name|slot|power|level|element|source|setId|rarity|perk".
 *   C name class                    a case: fresh progression for that class ("~" = no class)
 *   PI item / PE slot id / PM material amount / K key      inventory, equipped, materials, an earnedRewards key
 *   U ability -> RU error|~         upgradeDragonite
 *   T kind id                       recordTrust
 *   AB / EC -> RC ok reason|~       claimAncientBond / claimEternalCovenant
 *   S state                         full derived state after the step (see describe)
 *   DS ability level wornSlots enhance -> stats       dragoniteStats over armorBonus (direct)
 *   W level wornSlots               a Wyrmcall run: stats from that wyrmcall level + armor; then
 *     WS ok state / WT dt targets -> WA action|~ state                summon / step
 *   F x y z yaw pitch bank speed    a flight; then FT pitch turn throttle dt ground -> FS flight   (ground = the value
 *                                   groundAt returned, or "~" when it was not called)
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PROGRESSION, type ClassId, type PlayerProgression } from "../../src/game/progression";
import { DRAGONITE_IDS, upgradeDragonite, upgradeLevel, wornCovenant, armorBonus, dragoniteStats, appearanceStage, clearCount, cappedResist, createWyrm, summonWyrm, stepWyrm, type DragoniteId, type Wyrm, type WyrmTarget, type CovenantPiece } from "../../src/game/dragonite";
import { statsFor } from "../../src/game/dragonite-cast";
import { dragoniteGear } from "../../src/game/dragon-covenant";
import { trustOf, trustStage, recordTrust, claimAncientBond, claimEternalCovenant, canRide, createFlight, stepFlight, type Flight } from "../../src/game/vyrak-trust";
import type { GearItem } from "../../src/game/inventory";
import { UNIQUE_SCENARIOS } from "../../src/game/unique-scenarios";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "dragon_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
let seed = 0xd2a90;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
Math.random = () => { throw new Error("the dragon rules must not draw random numbers"); };

const gear = (g: GearItem) => `${g.id}|${g.name}|${g.slot}|${n(g.power)}|${n(g.level)}|${g.element}|${g.source}|${g.setId ?? ""}|${g.rarity ?? ""}|${g.perk ?? ""}`;
const stats = (s: Record<string, number>) => Object.keys(s).sort().map((k) => `${k}:${n(s[k]!)}`).join(",");
const CONTEXTS = [
  { regionId: null, inDungeon: false, inStoryMission: false, indoors: false },
  { regionId: "solara", inDungeon: false, inStoryMission: false, indoors: false },
  { regionId: "nexus", inDungeon: false, inStoryMission: false, indoors: false },
  { regionId: "neon", inDungeon: false, inStoryMission: false, indoors: false },
  { regionId: "solara", inDungeon: true, inStoryMission: false, indoors: false },
  { regionId: "solara", inDungeon: false, inStoryMission: true, indoors: false },
  { regionId: "solara", inDungeon: false, inStoryMission: false, indoors: true },
];
const describe = (p: PlayerProgression, c: ClassId | null) => {
  const t = trustOf(p, c);
  const ride = CONTEXTS.map((ctx) => { const r = canRide(p, c, ctx); return r.ok ? "ok" : r.reason!; }).join("|");
  const levels = c ? DRAGONITE_IDS.map((a) => `${a}=${upgradeLevel(p, c, a)}`).join(",") : NONE;
  const st = DRAGONITE_IDS.map((a) => `${a}{${stats(statsFor({ earnedRewards: p.earnedRewards, inventory: p.inventory, equippedGear: p.equippedGear, cls: c }, a))}}`).join(";");
  return `earned=[${p.earnedRewards.join(",")}];dragonite=${n(p.materials.dragonite ?? 0)};inventory=[${p.inventory.map(gear).join(";")}]`
    + `;trust=${n(t.challenge)}/${n(t.encounter)}/${n(t.ruin)}/${n(t.puzzle)}/${n(t.protect)}/${n(t.total)};stage=${trustStage(p, c)};ride=${ride};levels=${levels}`
    + `;appearance=${c ? appearanceStage(clearCount(p, c)) : NONE};stats=${st}`;
};

const lines: string[] = [];
const CLASSES: (ClassId | null)[] = ["TITAN", "HUNTER", "WARLOCK", null];
const encounterIds = [...UNIQUE_SCENARIOS.map((s) => s.id), "vyrak", "regional-boss-1", "regional-boss-2"];
const CHALLENGE_IDS = ["unbroken-covenant", "wings-of-the-ancient", "dragons-patience"];
const SLOTS: CovenantPiece[] = ["helmet", "chest", "gauntlets", "legs", "classItem"];
let steps = 0;

for (let c = 0; c < 180; c++) {
  const cls = pick(CLASSES);
  const other = pick(["TITAN", "HUNTER", "WARLOCK"] as ClassId[]);
  let p: PlayerProgression = { ...DEFAULT_PROGRESSION, earnedRewards: [], inventory: [], equippedGear: {}, materials: {} };
  lines.push(["C", `case-${c}`, cls ?? NONE].join("\t"));
  const key = (k: string) => { if (!p.earnedRewards.includes(k)) { p = { ...p, earnedRewards: [...p.earnedRewards, k] }; lines.push(["K", k].join("\t")); } };
  if (rand() < 0.8 && cls) key(`covenant:vyrak:${cls}`);
  if (rand() < 0.4) key(`covenant:vyrak:${other}`);
  // a devoted Operator: most of the way to full trust already (challenges cap at 75, encounters at 32)
  if (cls && rand() < 0.45) {
    for (const ch of CHALLENGE_IDS) if (rand() < 0.85) key(`covenant-challenge:${cls}:${ch}`);
    for (let e = Math.floor(rand() * 6); e > 0; e--) key(`enc-done:${cls}:${pick(encounterIds)}`);
  }
  const dragonite = pick([0, 2, 3, 9, 19, 34, 80, 200]);
  p = { ...p, materials: { dragonite } };
  lines.push(["PM", "dragonite", n(dragonite)].join("\t"));
  // covenant armor owned and maybe worn (other classes' too: wornness is by item id)
  if (cls && rand() < 0.7) {
    const pieces = [...dragoniteGear(cls), ...(rand() < 0.3 ? dragoniteGear(other) : [])];
    const equipped: Record<string, string> = {};
    for (const g of pieces) if (rand() < 0.75) { p = { ...p, inventory: [...p.inventory, g] }; lines.push(["PI", gear(g)].join("\t")); if (rand() < 0.6) { equipped[g.slot] = g.id; } }
    if (rand() < 0.3) { const plain: GearItem = { id: "plain-helm", name: "Plain Helm", slot: "helmet", power: 100, level: 1, element: "KINETIC", source: "Shop" }; p = { ...p, inventory: [...p.inventory, plain] }; lines.push(["PI", gear(plain)].join("\t")); if (rand() < 0.5) equipped.helmet = plain.id; }
    p = { ...p, equippedGear: equipped };
    for (const [slot, id] of Object.entries(equipped)) lines.push(["PE", slot, id].join("\t"));
  }
  lines.push(`S\t${describe(p, cls)}`);

  for (let k = 4 + Math.floor(rand() * 14); k > 0; k--) {
    const r = rand();
    const c2 = cls ?? "TITAN";
    if (r < 0.25) {
      const a = pick(DRAGONITE_IDS);
      lines.push(["U", a].join("\t"));
      const res = upgradeDragonite(p, cls, a);
      if ("error" in res) lines.push(["RU", res.error].join("\t"));
      else { p = res.progression; lines.push(["RU", NONE].join("\t")); }
    } else if (r < 0.45) {
      const kind = pick(["ruin", "puzzle", "protect"] as const);
      const id = pick(["", "r1", "r2", "r3", "r4", "p1", "p2", "x"]);
      lines.push(["T", kind, id].join("\t"));
      p = recordTrust(p, cls, kind, id);
    } else if (r < 0.55) {
      lines.push("AB");
      const res = claimAncientBond(p, cls);
      p = res.progression;
      lines.push(["RC", res.ok ? "1" : "0", res.reason ?? NONE].join("\t"));
    } else if (r < 0.62) {
      lines.push("EC");
      const res = claimEternalCovenant(p, cls);
      p = res.progression;
      lines.push(["RC", res.ok ? "1" : "0", NONE].join("\t"));
    } else if (r < 0.75) {
      key(`covenant-challenge:${pick([c2, other])}:${pick([...CHALLENGE_IDS, "made-up"])}`);
    } else if (r < 0.9) {
      key(`enc-done:${pick([c2, c2, other])}:${pick(encounterIds)}`);
    } else {
      key(`covenant-clear:${c2}:${1 + Math.floor(rand() * 8)}`);
    }
    lines.push(`S\t${describe(p, cls)}`);
    steps++;
  }
}

// dragoniteStats directly, including out-of-range levels and the 3-piece enhance
for (let i = 0; i < 400; i++) {
  const a = pick(DRAGONITE_IDS);
  const level = pick([-1, 0, 1, 2, 2.5, 3, 4, 5, 9]);
  const worn = SLOTS.filter(() => rand() < 0.45);
  if (rand() < 0.15) worn.push(worn[0] ?? "helmet");
  const enhance = rand() < 0.5 ? pick(DRAGONITE_IDS) : null;
  const s = dragoniteStats(a, level, armorBonus(worn, enhance));
  lines.push(["DS", a, n(level), worn.join(",") || NONE, enhance ?? NONE, stats(s)].join("\t"));
}
for (let i = 0; i < 60; i++) {
  const ar = pick([-0.2, 0, 0.1, 0.3, 0.45, 0.6]), dh = pick([-0.1, 0, 0.2, 0.35]);
  lines.push(["CR", n(ar), n(dh), n(cappedResist(ar, dh))].join("\t"));
}

// Wyrmcall runs
const wyrmText = (w: Wyrm) => `${w.state}/${n(w.t)}/${n(w.left)}/${n(w.strafesLeft)}/${w.target === null ? NONE : n(w.target)}/${n(w.cooldown)}/${w.finished ? 1 : 0}`;
for (let i = 0; i < 120; i++) {
  const level = pick([0, 1, 2, 3, 4]);
  const worn = SLOTS.filter(() => rand() < 0.4);
  const st = dragoniteStats("wyrmcall", level, armorBonus(worn));
  lines.push(["W", n(level), worn.join(",") || NONE].join("\t"));
  const w = createWyrm();
  const newTargets = (): WyrmTarget[] => Array.from({ length: Math.floor(rand() * 4) }, (_, j) => ({ id: j + Math.floor(rand() * 3), dist: pick([3, 8, 8, 15, 30]), boss: rand() < 0.35, windingUp: rand() < 0.15 }));
  let targets = newTargets();
  for (let s = 0; s < 90; s++) {
    if (s === 0 || rand() < 0.03) { const ok = summonWyrm(w, st); lines.push(["WS", ok ? "1" : "0", wyrmText(w)].join("\t")); continue; }
    const dt = pick([0.1, 0.25, 0.25, 0.5, 0.5, 1, 1, 3, 20]);
    if (rand() < 0.12) targets = newTargets();
    const action = stepWyrm(w, dt, targets, st);
    lines.push(["WT", n(dt), targets.map((t) => `${n(t.id)}:${n(t.dist)}:${t.boss ? 1 : 0}:${t.windingUp ? 1 : 0}`).join(",") || NONE, action ? `${action.kind}:${n(action.target)}` : NONE, wyrmText(w)].join("\t"));
  }
}

// riding flight
const flightText = (f: Flight) => [f.x, f.y, f.z, f.yaw, f.pitch, f.bank, f.speed].map(n).join(",");
for (let i = 0; i < 80; i++) {
  let f = createFlight(rand() * 400 - 200, 20 + rand() * 100, rand() * 400 - 200, rand() * 6);
  lines.push(["F", ...flightText(f).split(",")].join("\t"));
  for (let s = 0; s < 60; s++) {
    const bad = rand() < 0.04;
    const input = { pitch: pick([-1.5, -1, -0.4, 0, 0.3, 1, 2]), turn: pick([-1, -0.5, 0, 0.5, 1, 1.4]), throttle: bad ? NaN : pick([-1, -0.3, 0, 0.5, 1, 1.3]) };
    const dt = rand() < 0.03 ? pick([0, -0.1, Infinity]) : pick([1 / 60, 1 / 30, 0.05, 0.2, 1]);
    let groundSeen: number | null = null;
    const groundValue = rand() < 0.05 ? NaN : pick([0, 10, 30, 60, 90, 130]);
    f = stepFlight(f, input, dt, () => { groundSeen = groundValue; return groundValue; });
    lines.push(["FT", n(input.pitch), n(input.turn), n(input.throttle), n(dt), groundSeen === null ? NONE : n(groundSeen), flightText(f)].join("\t"));
  }
}

writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`180 cases, ${steps} progression steps, 400 stat rows, 120 wyrm runs, 80 flights -> ${OUT}`);
