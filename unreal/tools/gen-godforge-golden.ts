/**
 * Records golden Godforge, secrets, foundries and on-foot weapon heat from the web build's real godforge.ts, secrets.ts,
 * foundries.ts and sim.ts fireBullet / fireLauncher for the C++ port's test (Plugins/WorldFractureCore/Tests/GodforgeCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs godforge
 *
 *   SITE crownX crownZ radius vaelX vaelZ     REG id x z radius      FO name slot -> foundry     FR foundry aiming -> heat|recoil|hip
 *   FB preHeat preOver heat mult pellets -> fired heat overheated     FL preHeat preOver heat mult -> fired heat overheated
 *   P save   then actions, each followed by the save:  FG design now | SO item rune | RR item rune | AS item | RK item kills |
 *            CD | CH | CS id night storm nemesis pledged    -> ok message-or-error save
 *   Q x z night storm nemesis pledged -> stage|marks|guardianDue|vaelNear|unlocked runes|sensed|relic combat;...
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  HOLLOW_CROWN, VAEL, RUNE_ORDER, RELIC_DESIGNS, forgeStage, marksFound, guardianDue, vaelNear, runeUnlocked, forgeRelic, socketRune, removeRune,
  ascendRelic, recordRelicKills, collectRuneDust, claimHeart, runeCombat, relicElement, type RuneId,
} from "../../src/game/godforge";
import { SECRETS, secretPoint, senseSecret, claimSecret } from "../../src/game/secrets";
import { foundryOf } from "../../src/game/foundries";
import { REGIONS } from "../../src/game/world";
import { WEAPON_CATALOG } from "../../src/game/weapon-catalog";
import { createSim, fireBullet, fireLauncher } from "../../src/game/sim";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";
import type { GearItem } from "../../src/game/inventory";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "godforge_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
const o = (v: string | null | undefined) => (v === undefined || v === null || v === "" ? "~" : v);
let seed = 0x60df;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));

const kv = (m: Record<string, number | undefined> | undefined) => Object.keys(m ?? {}).filter((k) => m![k] !== undefined).sort().map((k) => `${k}=${n(m![k]!)}`).join(",") || "~";
const list = (xs: readonly string[]) => (xs.length ? xs.join(",") : "~");
const item = (i: GearItem) => [i.id, i.name, i.slot, n(i.power), n(i.level), i.element, i.source, o(i.rarity), i.godforge ? `${i.godforge.tier}+${i.godforge.runes.join(".") || "~"}+${n(i.godforge.kills)}+${b(i.godforge.awakened)}` : "~"].join("^");
const ps = (p: PlayerProgression) => [list(p.earnedRewards), kv(p.materials as Record<string, number>), n(p.fractureShards), p.inventory.map(item).join(";") || "~",
  p.nemeses.map((x) => `${x.id}:${x.status}`).join(",") || "~", list(p.story.collectibles), kv(p.nexLedger as Record<string, number>)].join("|");

/* ---- places ---- */
out("SITE", HOLLOW_CROWN.x, HOLLOW_CROWN.z, HOLLOW_CROWN.radius, VAEL.x, VAEL.z);
const secretRegions = [...new Set(SECRETS.map((s) => s.regionId))];
for (const id of secretRegions) { const r = REGIONS.find((x) => x.id === id)!; out("REG", id, r.x, r.z, r.radius); }
for (const s of SECRETS) { const p = secretPoint(s); out("SP", s.id, p.x, p.z); }

/* ---- foundries ---- */
const SLOTS = ["primary", "secondary", "heavy", "helmet", "vehicle", "chest"] as const;
const TOKENS = ["Void", "pulse", "ARC", "MG", "mg-7", "smg", "Mag-Cannon", "Heavy", "rifle", "DMR", "Pistol", "crossbow", "Bio-Lum", "Anomaly", "phase", "Maul", "Frontline", "Hourglass", "Slugger", "Ember", "Crown", "Rime", "Häkke", "Ωmega", "🔥", "ſtorm", "Ke", "drMg", "mgx", "x_mg", "mg_", "carbine", "Eternity", "Caster", "Plasma"];
for (const w of WEAPON_CATALOG) for (const slot of ["primary", "heavy"] as const) out("FO", w.name, slot, o(foundryOf({ name: w.name, slot })));
for (let i = 0; i < 1500; i++) {
  const name = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(TOKENS)).join(pick([" ", "-", "", "."]));
  const slot = pick(SLOTS);
  out("FO", name, slot, o(foundryOf({ name, slot })));
}
for (const f of ["OMOLON", "HAKKE", "SUROS", "TEX_MECHANICA", "BLACK_ARMORY", "~"]) for (const aim of [false, true]) {
  const foundry = f === "~" ? null : f;
  // Scene.tsx's fire loop: heatMult, recoilMult, hipMult
  const heatMult = foundry === "OMOLON" ? 0.75 : 1, recoilMult = foundry === "SUROS" ? 0.7 : 1, hipMult = foundry === "TEX_MECHANICA" && !aim ? 1.25 : 1;
  out("FR", f, b(aim), `${n(heatMult)}|${n(recoilMult)}|${n(hipMult)}`);
}

/* ---- on-foot heat through the real fireBullet / fireLauncher ---- */
const sim = createSim();
const HEATS = [0.7, 0.8, 1.2, 2, 2.2, 3];
for (let i = 0; i < 3000; i++) {
  for (const x of sim.bullets) x.alive = false;
  for (const x of sim.rounds) x.alive = false;
  const pre = pick([0, 40, 85, 93, 95.1, 99.9, Math.round(rand() * 1000) / 10]); const over = rand() < 0.08;
  sim.weaponHeat = pre; sim.overheated = over;
  const heat = pick(HEATS), mult = pick([1, 0.75]);
  if (rand() < 0.75) {
    const pellets = pick([1, 1, 8]);
    let fired = 0;
    for (let k = 0; k < pellets; k++) if (fireBullet(sim, 0, 1.5, 0, rand() * 6, false, 0, 1, 1 / pellets, (heat * mult) / pellets)) fired++;
    out("FB", pre, b(over), heat, mult, pellets, fired, sim.weaponHeat, b(sim.overheated));
  } else {
    const fired = fireLauncher(sim, pick(["ROCKET", "CINDER", "FROSTBITE", "VITRIOL"] as const), 0, 1.5, 0, 0, 0, 1, 1, heat * mult);
    out("FL", pre, b(over), heat, mult, b(fired), sim.weaponHeat, b(sim.overheated));
  }
}

/* ---- the Godforge and secrets ---- */
const MARKS = ["secret:forge-mark-1", "secret:forge-mark-2", "secret:forge-mark-3"];
const OTHER_SECRETS = ["secret:moon-shrine", "secret:storm-relay", "secret:trophy-cairn", "secret:drowned-bell", "secret:syndicate-ledger"];
let now = 1_760_000_000_000;
const query = (p: PlayerProgression) => {
  const s = pick(SECRETS), sp = secretPoint(s);
  const spots = [{ x: HOLLOW_CROWN.x, z: HOLLOW_CROWN.z }, { x: VAEL.x, z: VAEL.z }, sp, { x: -300, z: 180 }];
  const at = pick(spots), d = pick([0, 2, 3.59, 3.61, 4, 13.9, 14.1, 25, 59, 61]), a = rand() * 6.28;
  const x = at.x + Math.sin(a) * d, z = at.z + Math.cos(a) * d;
  const ctx = { night: rand() < 0.5, storm: rand() < 0.3, nemesisSlain: rand() < 0.4, pledged: rand() < 0.3, earned: p.earnedRewards };
  const sensed = senseSecret(x, z, ctx);
  const relics = p.inventory.filter((i) => i.godforge).map((i) => { const rc = runeCombat(i.godforge); return `${i.id}:${rc.bursts.join(".") || "~"}:${b(rc.devour)}${b(rc.rift)}${b(rc.ward)}${b(rc.reap)}${b(rc.awakened)}:${relicElement(i.godforge!.runes)}`; }).join(";") || "~";
  out("Q", x, z, b(ctx.night), b(ctx.storm), b(ctx.nemesisSlain), b(ctx.pledged),
    [forgeStage(p), n(marksFound(p)), b(guardianDue(p, x, z)), b(vaelNear(p, x, z)), RUNE_ORDER.filter((r) => runeUnlocked(p, r)).join(".") || "~", sensed ? `${sensed.secret.id}:${n(sensed.dist)}:${b(sensed.open)}` : "~", relics].join("|"));
};
for (let t = 0; t < 600; t++) {
  // the last 200 saves are rich (every secret, the Heart, six slain nemeses, plenty of materials): relics get forged, socketed with
  // conflicting runes, ascended to Sovereign and awakened
  const rich = t >= 400;
  let p: PlayerProgression = structuredClone(DEFAULT_PROGRESSION);
  const earned: string[] = [];
  for (const m of MARKS) if (rich || rand() < 0.6) earned.push(m);
  for (const s of OTHER_SECRETS) if ((rich && rand() < 0.9) || rand() < 0.3) earned.push(s);
  if (rich || rand() < 0.5) earned.push("godforge:heart");
  if (rand() < 0.2) earned.push("godforge:dust:1");
  const mats: Record<string, number> = {};
  for (const k of ["forgeCatalyst", "crownHeart", "runeDust", "aegisCore", "fractureCore", "scrapMetal"]) if (rich || rand() < 0.7) mats[k] = rich ? pick([4, 9, 20, 40]) : pick([0, 1, 2, 3, 4, 8, 14, 30]);
  const nemeses = Array.from({ length: rich ? 5 + Math.floor(rand() * 2) : Math.floor(rand() * 7) }, (_, i) => ({ id: `nem-${i}`, status: rich && i < (t % 2 ? 3 : 5) ? "SLAIN" : pick(["SLAIN", "SLAIN", "ACTIVE", "FLED"]) }));
  const plain: GearItem = { id: "plain-1", name: "Eclipse Devourer", slot: "primary", power: 250, level: 2, element: "ARC", source: "Loot" };
  p = { ...p, earnedRewards: earned, materials: mats as PlayerProgression["materials"], fractureShards: rich ? pick([1500, 4000, 9000]) : pick([0, 150, 200, 450, 900, 2000, 5000]), inventory: rand() < 0.3 ? [plain] : [], nemeses: nemeses as unknown as PlayerProgression["nemeses"], story: { ...p.story, collectibles: rand() < 0.2 ? ["secret:moon-shrine"] : [] }, nexLedger: {} };
  out("P", ps(p));
  for (let k = 0; k < (rich ? 30 : 14); k++) {
    now += 1000 + Math.floor(rand() * 1e6);
    const r = rich && k === 0 ? 0 : rand();
    const relics = p.inventory.filter((i) => i.godforge).map((i) => i.id);
    const itemId = relics.length && rand() < 0.9 ? pick(relics) : pick(["plain-1", "nope"]);
    const rune = pick(RUNE_ORDER) as RuneId;
    let res: { progression: PlayerProgression; message?: string } | { error: string };
    if (r < 0.15) { const d = pick([...RELIC_DESIGNS.map((x) => x.id), "unknown-design"]); res = forgeRelic(p, d, now); out("FG", d, now); }
    else if (r < 0.4) { res = socketRune(p, itemId, rune); out("SO", itemId, rune); }
    else if (rich && r < 0.48) { res = ascendRelic(p, itemId); out("AS", itemId); }
    else if (r < 0.48) { const sock = p.inventory.find((i) => i.id === itemId)?.godforge?.runes ?? []; const rr = sock.length && rand() < 0.8 ? pick(sock) : rune; res = removeRune(p, itemId, rr); out("RR", itemId, rr); }
    else if (r < 0.6) { res = ascendRelic(p, itemId); out("AS", itemId); }
    else if (r < 0.7) { const kills = pick([0, 1, 5, 40, 99, 100, -3]); res = recordRelicKills(p, itemId, kills); out("RK", itemId, kills); }
    else if (r < 0.77) { res = collectRuneDust(p); out("CD"); }
    else if (r < 0.82) { res = claimHeart(p); out("CH"); }
    else if (r < 0.9) {
      const id = pick([...SECRETS.map((s) => s.id), "nothing"]);
      const ctx = { night: rand() < 0.5, storm: rand() < 0.5, nemesisSlain: rand() < 0.5, pledged: rand() < 0.5 };
      res = claimSecret(p, id, ctx); out("CS", id, b(ctx.night), b(ctx.storm), b(ctx.nemesisSlain), b(ctx.pledged));
    } else { query(p); continue; }
    if ("error" in res) out("R", "0", res.error, ps(p));
    else { p = res.progression; out("R", "1", o(res.message), ps(p)); }
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`godforge golden: ${lines.length} lines -> ${OUT}`);
