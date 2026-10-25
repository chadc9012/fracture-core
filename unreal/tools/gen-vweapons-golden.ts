/**
 * Records golden vehicle-weapon behaviour from the web build's real vehicle-weapons.ts (armamentFor, vehiclePoint, aimFor,
 * vehicleVelocity), ordnance.ts (fireRound, stepRound, splashDamage), launchers.ts pickLockTarget and sim.ts fireBullet /
 * fireOrdnance, plus Scene.tsx's vehicle fire loop (copied verbatim below, it is not exported), for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/VehicleWeaponsCoreTest.cpp).
 *
 *   npx esbuild unreal/tools/gen-vweapons-golden.ts --bundle --platform=node --format=esm \
 *     --alias:@=./src --outfile=/tmp/wf-vw.mjs && node /tmp/wf-vw.mjs
 *
 * Lines are tab-separated; "~" = absent; numbers are JS shortest round-trip.
 *   ARM id kind build                         an armament, followed by
 *     G slot name rate damage spread speed knock heat mount pitchAssist converge sound shell muzzles   (muzzles r,u,f;...)
 *     O name ordnance rate salvo gap damage mount muzzles
 *   VP x y z yaw pitch roll r u f -> X Y Z
 *   AIM mount x y z yaw pitch roll camYaw camPitch assist mx my mz converge -> yaw pitch
 *   VV yaw speed vy -> vx vy vz
 *   RD id kind speed turn life splash damage prox domain fx fy fz ax ay az     a round, then steps
 *     RS dt tx ty tz|~ -> x y z dx dy dz age alive burst(x y z radius damage reason | ~)
 *   SP radius damage distance -> value
 *   LK fx fz yaw cone range n (x z alive)* -> index
 *   FB x y z yaw pitch speed ivx ivy ivz dmg knock heat preheat -> fired vx vy vz life dmg heat overheated
 *   FO id x y z yaw pitch dmg carry knock preheat n (x z alive)* -> fired speed damage target dx dy dz heat overheated
 *   FL id kind build  then  FS dt trigger secondary rateMod blocked -> shots(slot:r,u,f;...) cool gunCool secCool salvoCool salvoLeft barrel gunBarrel podBarrel
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { aimFor, armamentFor, BY_BUILD, vehiclePoint, vehicleVelocity, type VehicleArmament, type VehicleGun } from "../../src/game/vehicle-weapons";
import { fireRound, ORDNANCE, splashDamage, stepRound, type OrdnanceDef } from "../../src/game/ordnance";
import { pickLockTarget } from "../../src/game/launchers";
import { createSim, fireBullet, fireOrdnance } from "../../src/game/sim";
import { VEHICLES } from "../../src/game/vehicles";
import { handlingFor, type HandlingKind } from "../../src/game/vehicle-handling";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "vehicleweapons_golden.txt");
const NONE = "~";
const n = (v: number) => String(v);
let seed = 0x5eed11;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const range = (a: number, b: number) => a + rand() * (b - a);
Math.random = rand; // createSim draws; nothing recorded depends on these draws
globalThis.performance.now = () => 1_000_000;

const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const mz = (ms: readonly (readonly number[])[]) => ms.map((m) => m.map(n).join(",")).join(";");

const KINDS: HandlingKind[] = ["RACER", "OFFROAD", "TANK", "JET", "HELI", "BOAT", "SUB"];
const IDS = [...VEHICLES.map((v) => v.id as string), "no-such-vehicle"];
const BUILDS = ["", ...Object.keys(BY_BUILD)];
const gunLine = (slot: string, g: VehicleGun) => out("G", slot, g.name, g.rate, g.damage, g.spread, g.speed, g.knock, g.heat, g.mount, g.pitchAssist, g.converge, g.sound, g.shell === undefined ? NONE : g.shell, mz(g.muzzles));

// ---- armaments: every kind x vehicle x build ----
for (const kind of KINDS) for (const id of IDS) for (const build of BUILDS) {
  const a = armamentFor(id, kind, build || null);
  out("ARM", id, kind, build || NONE);
  if (a.primary) gunLine("PRIMARY", a.primary);
  if (a.secondaryGun) gunLine("SECONDARY_GUN", a.secondaryGun);
  if (a.secondary) out("O", a.secondary.name, a.secondary.ordnance, a.secondary.rate, a.secondary.salvo, a.secondary.salvoGap, a.secondary.damage, a.secondary.mount, mz(a.secondary.muzzles));
}
// the 14 vehicles as the game maps them
for (const v of VEHICLES) out("KIND", v.id, handlingFor(v).kind);

// ---- geometry ----
const pose = () => ({ x: range(-500, 500), y: range(-20, 200), z: range(-500, 500), yaw: range(-7, 7), pitch: range(-0.8, 0.8), roll: range(-0.9, 0.9) });
for (let i = 0; i < 1500; i++) {
  const p = pose(), l = [range(-3, 3), range(-1, 5), range(-5, 6)] as const;
  const w = vehiclePoint(p, l);
  out("VP", p.x, p.y, p.z, p.yaw, p.pitch, p.roll, l[0], l[1], l[2], w.x, w.y, w.z);
}
for (let i = 0; i < 1500; i++) {
  const p = pose(), mount = rand() < 0.4 ? "TURRET" : "FIXED", m = vehiclePoint(p, [range(-2.5, 2.5), range(0, 3), range(0, 5)]);
  const conv = pick([0, 0, 30, 60, 220, range(1, 300)]), cy = range(-7, 7), cp = range(-1.2, 1.2), as = pick([0.12, 0.18, 0.25, 0.3]);
  const a = aimFor(mount, p, cy, cp, as, m, conv);
  out("AIM", mount, p.x, p.y, p.z, p.yaw, p.pitch, p.roll, cy, cp, as, m.x, m.y, m.z, conv, a.yaw, a.pitch);
}
for (let i = 0; i < 300; i++) { const y = range(-7, 7), s = range(-20, 120), vy = range(-15, 15), v = vehicleVelocity(y, s, vy); out("VV", y, s, vy, v.vx, v.vy, v.vz); }

// ---- ordnance flights ----
const ground = (x: number, z: number) => 2 * Math.sin(x * 0.05) + Math.cos(z * 0.07) - 1;
const shell = (g: VehicleGun): OrdnanceDef => ({ id: "cannon-shell", kind: "ROCKET", name: g.name, speed: g.speed, turnRate: 0, life: 3, splashRadius: g.shell ?? 0, damage: 1, proximity: 1.6, domain: "ANY", fits: [] });
const defs: OrdnanceDef[] = [...ORDNANCE, shell(armamentFor("goliath-tank", "TANK").primary!)];
for (let i = 0; i < 160; i++) {
  const d = pick(defs), from = { x: range(-50, 50), y: range(0, 60), z: range(-50, 50) };
  const aim: [number, number, number] = [range(-1, 1), range(-0.6, 0.4), range(-1, 1)];
  if (i % 37 === 0) { aim[0] = 0; aim[1] = 0; aim[2] = 0; } // a zero aim (norm falls back to length 1)
  const r = fireRound(d, from, aim);
  out("RD", d.id, d.kind, d.speed, d.turnRate, d.life, d.splashRadius, d.damage, d.proximity, d.domain, from.x, from.y, from.z, aim[0], aim[1], aim[2]);
  const tmode = rand();
  let tx = from.x + range(-120, 120), ty = range(0, 40), tz = from.z + range(-120, 120);
  const tvx = range(-15, 15), tvz = range(-15, 15);
  for (let s = 0; s < 600 && r.alive; s++) {
    const dt = pick([1 / 30, 0.05, 0.1, range(0.001, 0.12)]);
    tx += tvx * dt; tz += tvz * dt;
    const target = tmode < 0.3 ? null : { x: tx, y: ty, z: tz };
    const b = stepRound(r, dt, target, ground);
    out("RS", dt, target ? `${n(target.x)} ${n(target.y)} ${n(target.z)}` : NONE, r.x, r.y, r.z, r.dx, r.dy, r.dz, r.age, r.alive ? 1 : 0, b ? `${n(b.x)} ${n(b.y)} ${n(b.z)} ${n(b.radius)} ${n(b.damage)} ${b.reason}` : NONE);
  }
}
for (let i = 0; i < 400; i++) {
  const radius = pick([4.5, 5, 6, 8, 9, range(1, 10)]), damage = pick([1, 9, 18, 22.5, range(1, 60)]), dist = pick([0, radius, radius * 0.5, range(0, radius * 1.3)]);
  out("SP", radius, damage, dist, splashDamage({ x: 0, y: 0, z: 0, radius, damage, reason: "GROUND" }, dist));
}
const cands = () => Array.from({ length: Math.floor(rand() * 9) }, () => ({ x: range(-300, 300), z: range(-300, 300), alive: rand() < 0.8 }));
for (let i = 0; i < 600; i++) {
  const fx = range(-50, 50), fz = range(-50, 50), yaw = range(-7, 7), cone = pick([0.5, 0.3, 1]), rng = pick([120, 260]), c = cands();
  if (i % 50 === 0) c.push({ x: fx + 3, z: fz, alive: true }); // inside the 4 m dead zone
  out("LK", fx, fz, yaw, cone, rng, c.length, ...c.map((v) => `${n(v.x)} ${n(v.z)} ${v.alive ? 1 : 0}`), pickLockTarget({ x: fx, z: fz }, yaw, c, cone, rng));
}

// ---- sim.ts fireBullet / fireOrdnance ----
for (let i = 0; i < 400; i++) {
  const sim = createSim();
  const pre = pick([0, 30, 95, 99.9, range(0, 100)]); sim.weaponHeat = pre; sim.overheated = i % 23 === 0;
  const x = range(-50, 50), y = range(0, 40), z = range(-50, 50), yaw = range(-7, 7), pitch = range(-0.8, 0.8), speed = pick([110, 160, 220, 320, 130, range(60, 330)]);
  const inh = { vx: range(-60, 60), vy: range(-10, 10), vz: range(-60, 60) }, dmg = range(0.5, 12), knock = range(0.5, 6), heat = pick([0.3, 0.6, 1.4, 3]);
  const fired = fireBullet(sim, x, y, z, yaw, true, pitch, dmg, knock, heat, undefined, "BULLET", { speed, inherit: inh });
  const b = sim.bullets.find((v) => v.alive);
  out("FB", x, y, z, yaw, pitch, speed, inh.vx, inh.vy, inh.vz, dmg, knock, heat, pre, sim.overheated && !fired ? 1 : 0, fired ? 1 : 0, b ? b.vx : 0, b ? b.vy : 0, b ? b.vz : 0, b ? b.life : 0, b ? b.dmg : 0, sim.weaponHeat, sim.overheated ? 1 : 0);
}
for (let i = 0; i < 400; i++) {
  const sim = createSim();
  const pre = pick([0, 30, 95, 99, range(0, 100)]); sim.weaponHeat = pre; sim.overheated = i % 29 === 0;
  const d = pick(defs), x = range(-50, 50), y = range(0, 40), z = range(-50, 50), yaw = range(-7, 7), pitch = range(-0.6, 0.6);
  const dmg = range(1, 30), carry = pick([0, -5, range(0, 90)]), knock = pick([2, 6, range(0.5, 6)]);
  const c = cands();
  sim.machines = c.map((v) => ({ ...sim.machines[0], x: v.x, z: v.z, alive: v.alive })) as typeof sim.machines;
  const wasOver = sim.overheated;
  const fired = fireOrdnance(sim, d, x, y, z, yaw, pitch, dmg, carry, knock);
  const r = sim.rounds.find((v) => v.alive) as (typeof sim.rounds)[number] & { target: number; knock: number } | undefined;
  out("FO", d.id, x, y, z, yaw, pitch, dmg, carry, knock, pre, wasOver ? 1 : 0, sim.mods.bulletDamage * sim.verbDamageMult, c.length, ...c.map((v) => `${n(v.x)} ${n(v.z)} ${v.alive ? 1 : 0}`),
    fired ? 1 : 0, r ? r.def.speed : 0, r ? r.def.damage : 0, r ? r.target : -1, r ? r.dx : 0, r ? r.dy : 0, r ? r.dz : 0, sim.weaponHeat, sim.overheated ? 1 : 0);
}

// ---- Scene.tsx vehicle fire loop (verbatim timers and barrels; firing side effects stripped) ----
function fireLoop(armament: VehicleArmament, vf: { cool: number; gunCool: number; secCool: number; salvoLeft: number; salvoCool: number; barrel: number; gunBarrel: number; podBarrel: number }, trigger: boolean, secondaryTrigger: boolean, dt: number, fireRate: number, blocked: boolean) {
  const shots: string[] = [];
  vf.cool -= dt; vf.gunCool -= dt; vf.secCool -= dt; vf.salvoCool -= dt;
  if (!blocked) {
    const fireGun = (g: VehicleGun, slot: "cool" | "gunCool", barrel: "barrel" | "gunBarrel", name: string) => {
      if (vf[slot] > 0) return;
      vf[slot] = g.rate / fireRate;
      const m = g.muzzles[vf[barrel]++ % g.muzzles.length]!;
      shots.push(`${name}:${m.map(n).join(",")}`);
    };
    if (trigger && armament.primary) fireGun(armament.primary, "cool", "barrel", "PRIMARY");
    if (secondaryTrigger && armament.secondaryGun) fireGun(armament.secondaryGun, "gunCool", "gunBarrel", "SECONDARY_GUN");
    const sec = armament.secondary;
    if (sec) {
      if (secondaryTrigger && vf.secCool <= 0 && vf.salvoLeft <= 0) { vf.secCool = sec.rate; vf.salvoLeft = sec.salvo; vf.salvoCool = 0; }
      if (vf.salvoLeft > 0 && vf.salvoCool <= 0) {
        const m = sec.muzzles[vf.podBarrel++ % sec.muzzles.length]!;
        shots.push(`ORDNANCE:${m.map(n).join(",")}`);
        vf.salvoLeft--; vf.salvoCool = sec.salvoGap;
      }
    }
  }
  return shots;
}
for (let i = 0; i < 90; i++) {
  const kind = pick(KINDS), id = pick(IDS), build = rand() < 0.4 ? pick(Object.keys(BY_BUILD)) : "";
  const a = armamentFor(id, kind, build || null);
  out("FL", id, kind, build || NONE);
  const vf = { cool: 0, gunCool: 0, secCool: 0, salvoLeft: 0, salvoCool: 0, barrel: 0, gunBarrel: 0, podBarrel: 0 };
  let trig = false, sec = false;
  for (let s = 0; s < 160; s++) {
    if (rand() < 0.08) trig = !trig;
    if (rand() < 0.06) sec = !sec;
    const dt = pick([1 / 60, 1 / 30, range(0.001, 0.1)]), rate = pick([1, 1, 1.15, 0.8]), blocked = rand() < 0.05;
    const shots = fireLoop(a, vf, trig, sec, dt, rate, blocked);
    out("FS", dt, trig ? 1 : 0, sec ? 1 : 0, rate, blocked ? 1 : 0, shots.length ? shots.join(";") : NONE, vf.cool, vf.gunCool, vf.secCool, vf.salvoCool, vf.salvoLeft, vf.barrel, vf.gunBarrel, vf.podBarrel);
  }
}

writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`wrote ${lines.length} lines to ${OUT}`);
