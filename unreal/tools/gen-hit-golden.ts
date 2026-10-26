/**
 * Records golden hit rules from the web build's real weapon-elements.ts, weapon-meta.ts, weapon-evolution.ts, null-disruption.ts,
 * maw-collapse.ts and enemy-reactions.ts for the C++ port's test (Plugins/WorldFractureCore/Tests/HitCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs hit
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyElementHit, mergeVuln, freshStatuses, statusSpeedMult, burnDamage, type MachineStatuses } from "../../src/game/weapon-elements";
import { rangeFalloff, precisionFor, hitMultiplier, enemyPower, operatorPower, powerScale } from "../../src/game/weapon-meta";
import { ruins, discoverNearby, canEvolve, evolveWeapon, registerEvolutionHit, evolutionDamageMult, burstTargets, ruinElementOf, freshCharge, type EvolutionAbility, type EvolutionCharge } from "../../src/game/weapon-evolution";
import { registerNullHit, INITIAL_NULL_CHARGE, type NullChargeState } from "../../src/game/null-disruption";
import { registerMawHit, mawEffect, resetMaw, INITIAL_MAW, type MawState } from "../../src/game/maw-collapse";
import { reactTo, isStaggeredNow, hitPart, type Reaction } from "../../src/game/enemy-reactions";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";
import type { GearItem } from "../../src/game/inventory";
import type { WeaponId } from "../../src/game/weapons";
import type { ClassId } from "../../src/game/loadout";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "hit_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
const o = (v: string | null | undefined) => (v === undefined || v === null || v === "" ? "~" : v);
let seed = 0x41c3;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const ELEMENTS = ["THERMAL", "CRYO", "BIO", "ARC", "KINETIC"] as const;
const WEAPONS: WeaponId[] = ["AUTO", "PULSE", "SIDEARM", "SHOTGUN", "HEAVY", "SWORD", "ROCKET", "CINDER", "FROSTBITE", "VITRIOL"];
const CLASSES = ["TITAN", "HUNTER", "WARLOCK", null] as const;
const ABILITIES: EvolutionAbility[] = ["EMBER_BRAND", "RIME_SHATTER", "ROT_BLOOM", "STORM_ARC", "SUN_FLARE"];
const st = (s: MachineStatuses) => `${n(s.burnUntil)}|${n(s.chillUntil)}|${n(s.shockReadyAt)}`;

/* element statuses */
for (let t = 0; t < 200; t++) {
  const s = freshStatuses(); let now = 100 + rand() * 50; let vuln = { mult: 1, until: 0 };
  out("SE");
  for (let k = 0; k < 30; k++) {
    now += pick([0, 0.2, 1, 3.4, 3.5, 4]);
    const el = pick(ELEMENTS), boss = rand() < 0.2;
    const fx = applyElementHit(s, el, now, boss);
    if (fx.vuln) vuln = mergeVuln(vuln, fx.vuln, now);
    const dt = pick([0.016, 0.5]);
    out("EH", el, now, b(boss), o(fx.status), n(fx.stun), fx.vuln ? `${n(fx.vuln.mult)}:${n(fx.vuln.until)}` : "~", st(s), `${n(vuln.mult)}:${n(vuln.until)}`, n(statusSpeedMult(s, now + dt)), dt, n(burnDamage(s, now + dt, dt)));
  }
}
/* weapon class, power */
for (let i = 0; i < 4000; i++) {
  const w = pick(WEAPONS), c = pick(CLASSES), d = pick([0, 7.99, 8, 8.01, 20, 26, 28, 38, 48, 55, 70, 100, 130, 160, 170, rand() * 200]), pr = rand() < 0.4;
  out("WM", w, o(c), d, b(pr), n(rangeFalloff(w, d)), n(precisionFor(w, c)), n(hitMultiplier(w, { distance: d, precision: pr, cls: c })));
}
for (let i = 0; i < 2000; i++) {
  const powers = Array.from({ length: Math.floor(rand() * 6) }, () => Math.round(rand() * 400));
  const level = pick([0, 1, 1.5, 7, 49, 50, 51, 80]), diff = pick([-1, 0, 1, 3, 5]), elite = rand() < 0.3, boss = rand() < 0.1;
  const op = operatorPower(powers, level), ep = enemyPower(diff, elite, boss);
  out("PW", powers.join(",") || "~", level, diff, b(elite), b(boss), n(op), n(ep), n(powerScale(op - ep)));
}
for (const dlt of [Infinity, -Infinity, NaN, -1000, -75, -1, 0, 50, 100, 150]) out("PS", dlt, n(powerScale(dlt)));
/* body */
for (let i = 0; i < 2000; i++) { const y = rand() * 4 - 1, f = rand() - 0.5, h = pick([0, 0.05, 1.85, 2.4, rand() * 3]); out("HP", y, f, h, hitPart(y, f, h)); }
for (const y of [0.45, 0.4499, 0.82, 0.8199, 0.82001]) out("HP", y, 0, 1, hitPart(y, 0, 1)); // the band edges exactly
const rs = (r: Reaction | undefined) => (r ? [r.kind, n(r.until), n(r.start), n(r.dx), n(r.dz), n(r.k), r.part].join("|") : "~");
for (let t = 0; t < 200; t++) {
  let r: Reaction | undefined; let now = 10;
  out("RT");
  for (let k = 0; k < 30; k++) {
    now += pick([0.05, 0.2, 0.5, 1.2, 2]);
    const dmg = pick([0, 0.5, 1, 2, 3, -1]), maxHp = pick([0, 3.5, 7, 34]), elite = rand() < 0.3, boss = rand() < 0.15, dx = pick([0, 1, -3]), dz = pick([0, 2, 5]), part = pick(["HEAD", "TORSO", "LEGS", undefined] as const);
    r = reactTo(r, { damage: dmg, maxHp, elite, boss, now, dx, dz, part });
    out("RE", dmg, maxHp, b(elite), b(boss), now, dx, dz, o(part), rs(r), b(isStaggeredNow(r, now + 0.1)));
  }
}
/* evolution */
for (const r of ruins()) out("RU", r.id, r.name, r.regionId, r.element, r.ability, r.material, r.blurb, r.x, r.z);
for (const a of ABILITIES) out("AE", a, ruinElementOf(a), n(evolutionDamageMult(a, true)), n(evolutionDamageMult(a, false)));
for (let t = 0; t < 100; t++) {
  const a = pick(ABILITIES); let c: EvolutionCharge = freshCharge(); const seq: string[] = [];
  for (let k = 0; k < 20; k++) { const h = registerEvolutionHit(c, a); c = h.charge; seq.push(`${b(h.burst)}${n(c.hits)}`); }
  out("EV", a, seq.join(","));
}
for (let t = 0; t < 800; t++) {
  const a = pick(ABILITIES), ox = rand() * 20, oz = rand() * 20;
  const others = Array.from({ length: Math.floor(rand() * 9) }, () => ({ x: ox + pick([0, 0.005, 3, 6, 7, 8, 10, 10.001]) * pick([1, -1]), z: oz + pick([0, 2, 5]) }));
  const hits = burstTargets({ x: ox, z: oz }, others, a);
  out("BT", a, ox, oz, others.map((p) => `${n(p.x)}:${n(p.z)}`).join(";") || "~", hits.map((h) => n(others.indexOf(h))).join(",") || "~");
}
const gi = (g: GearItem) => [g.id, g.slot, n(g.power), n(g.level), g.element, g.evolution ? `${g.evolution.ruinId}+${g.evolution.ability}` : "~"].join("^");
const kv = (m: Record<string, number | undefined>) => Object.keys(m).filter((k) => m[k] !== undefined).sort().map((k) => `${k}=${n(m[k]!)}`).join(",") || "~";
const ps = (p: PlayerProgression) => [p.inventory.map(gi).join(";") || "~", p.earnedRewards.join(",") || "~", kv(p.materials as Record<string, number>)].join("|");
for (let t = 0; t < 300; t++) {
  const inv: GearItem[] = Array.from({ length: 1 + Math.floor(rand() * 4) }, (_, i) => ({ id: `w${i}`, name: `Gun ${i}`, slot: pick(["primary", "secondary", "heavy", "helmet"] as const), power: 200, level: pick([1, 4, 5, 9]), element: "KINETIC", source: "x", ...(rand() < 0.1 ? { evolution: { ruinId: "rimeheart-spire", ability: "RIME_SHATTER" as EvolutionAbility } } : {}) }));
  const mats: Record<string, number> = {};
  for (const k of ["forgeCatalyst", "thermalShards", "cryoCrystal", "bioCatalyst", "microCircuits"]) if (rand() < 0.7) mats[k] = pick([0, 1, 2, 5, 6, 12]);
  let p: PlayerProgression = { ...structuredClone(DEFAULT_PROGRESSION), inventory: inv, materials: mats as PlayerProgression["materials"], earnedRewards: rand() < 0.2 ? ["ruin:cinderglass-vault"] : [] };
  out("P", ps(p));
  for (let k = 0; k < 6; k++) {
    const r = pick(ruins()), w = pick([...inv.map((g) => g.id), "nope"]);
    if (rand() < 0.4) { const x = r.x + pick([0, 39.99, 40, 40.01, 90]), z = r.z; p = discoverNearby(p, x, z); out("DN", x, z, ps(p)); }
    else { const chk = canEvolve(p, r, w); p = evolveWeapon(p, r.id, w); out("CE", r.id, w, `${b(chk.ok)}:${o(chk.reason)}`, ps(p)); }
  }
}
/* perks */
const ns = (s: NullChargeState) => [n(s.charge), n(s.lastTimedAt), n(s.cooldownUntil), n(s.lastEventId)].join("|");
for (let t = 0; t < 150; t++) {
  let s: NullChargeState = { ...INITIAL_NULL_CHARGE }; let now = 0, ev = 0;
  out("NC");
  for (let k = 0; k < 40; k++) { now += pick([0.1, 1, 6.1, 8]); if (rand() < 0.9) ev++; const timed = rand() < 0.6; const r = registerNullHit(s, { now, timed, eventId: ev }); s = r.state; out("NH", now, b(timed), ev, b(r.pulse), ns(s)); }
}
const ms = (s: MawState) => [n(s.hunger), n(s.lastHitAt), n(s.cooldownUntil), n(s.lastEventId)].join("|");
for (let t = 0; t < 150; t++) {
  let s: MawState = { ...INITIAL_MAW }; let now = 0, ev = 0;
  out("MC");
  for (let k = 0; k < 40; k++) {
    now += pick([0.1, 1, 5.1, 7]); if (rand() < 0.9) ev++;
    if (rand() < 0.05) { s = resetMaw(s); out("MR", ms(s)); continue; }
    const r = registerMawHit(s, { now, eventId: ev }); s = r.state; out("MH", now, ev, b(r.collapse), ms(s));
  }
}
for (let i = 0; i < 1000; i++) { const dx = pick([0, 1e-7, 3, -6, 9.99, 10, 10.01]) * pick([1, -1]), dz = pick([0, 4, -7]), dmg = rand() * 20; const e = mawEffect(dx, dz, dmg); out("ME", dx, dz, dmg, e ? `${n(e.pullX)}|${n(e.pullZ)}|${n(e.damage)}` : "~"); }
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`hit golden: ${lines.length} lines -> ${OUT}`);
