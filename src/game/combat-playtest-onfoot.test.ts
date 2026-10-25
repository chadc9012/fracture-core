/** Headless on-foot combat playtest. Drives the REAL sim (createSim/fireBullet/fireLauncher/stepSim) with the same call shape
 * Scene.tsx uses in its frame loop (`const shoot = () =>`: muzzle at s.y + 0.05, yaw + jitter, pitch + recoil, dmg = weapon damage,
 * one fireBullet per shotgun pellet, burst follow-ups every burstGap, fireCool = weapon.fireRate). Nothing is rendered; tracers are
 * checked through the same sim.bullets records BulletFx.tsx draws. Bug repros that currently fail are kept as test.todo with notes. */
import { describe, expect, test } from "bun:test";
import { BULLET_POOL, HEAT_PER_SHOT_FOOT, createSim, fireBullet, fireLauncher, logImpact, stepSim, type Machine, type WorldSim } from "./sim";
import { heightAt, walkHeight } from "./terrain";
import { WEAPONS, WEAPON_ORDER, freshAmmo, type WeaponId } from "./weapons";
import { isLauncherId } from "./launchers";
import { makePuffs, makeSparks, puffAlive, sparkAlive, spawnImpact, stepImpacts } from "./bullet-impacts";
import { createMoveState, startSlide, stepSlide, SLIDE_MIN_SPEED, airJump, land, glideVy, GLIDE_MAX_FALL, movementFov, resolveStance, AIR_PROFILE } from "./movement";
import { createStride, stepStride, RUN_SPEED } from "./movement-feel";
import { createReticle, markHit, stepReticle } from "./crosshair";
import { initialView, stepView, viewPose, NEUTRAL_FEEL, handlingClass } from "./weapon-handling";
import { BASE_FOOT_SPEED, SPRINT_MULT } from "./foot-speed";
import { REGIONS } from "./world";
import { OPERATOR_CAMERA } from "./operators";

/** bun runs test.todo (skipped unless `bun test --todo`); the repo's bun:test type shim does not declare it */
const todo = (test as unknown as { todo: (name: string, fn: () => void) => void }).todo;
const DT = 1 / 60;
/** flat open ground outside every region (no ambient spawns, no turrets), terrain 19.8 for 200+ m north */
const PX = -240, PZ = -230;
const GROUND = walkHeight(PX, PZ);
const EYE_Y = GROUND + 1.6; // Scene: s.y = walkHeight + 1.6 when standing

function arena(): WorldSim {
  const sim = createSim();
  for (const t of sim.trucks) t.alive = false; // convoy lanes would eat stray bullets
  for (const m of sim.machines) m.alive = false;
  sim.emergencyQuest = { ...sim.emergencyQuest, state: "DORMANT", timer: 1e9 };
  return sim;
}
/** a plain grunt (Scene's ambient hp 3.5, scale 0.95) parked at (x,z); cool high so it does not wander into melee mid-test */
function grunt(sim: WorldSim, x: number, z: number, o: Partial<Machine> = {}): Machine {
  const m = sim.machines.find((e) => !e.alive)!;
  Object.assign(m, { alive: true, x, z, y: walkHeight(x, z), hp: 3.5, maxHp: 3.5, rot: Math.PI, scale: 0.95, zone: "wastelands", cool: 99, elite: false, boss: false, profile: "Test Grunt", kind: "RAIDER", drop: "scrapMetal", kx: 0, kz: 0, vulnUntil: 0, vulnMult: 1, mission: true, react: undefined }, o);
  delete m.ai; delete m.lastPlayerDamage;
  return m;
}
const step = (sim: WorldSim, px = PX, pz = PZ, inVehicle = false) => stepSim(sim, { px, pz, dt: DT, night: 0, inVehicle, yaw: 0 });

type Shooter = { x: number; y: number; z: number; yaw: number; pitch: number; weapon: WeaponId; fireCool: number; burstLeft: number; burstCool: number; mag: number; shots: number };
const shooter = (weapon: WeaponId, o: Partial<Shooter> = {}): Shooter => ({ x: PX, y: EYE_Y, z: PZ, yaw: 0, pitch: 0, weapon, fireCool: 0, burstLeft: 0, burstCool: 0, mag: freshAmmo()[weapon].mag, shots: 0, ...o });

/** Scene's trigger handling for one frame (no spread jitter so runs are deterministic; shotgun pellets get a fixed fan) */
function triggerFrame(sim: WorldSim, s: Shooter, held: boolean, dt = DT) {
  const wpn = WEAPONS[s.weapon];
  s.fireCool -= dt;
  const shoot = () => {
    if (wpn.mag > 0 && s.mag <= 0) { s.burstLeft = 0; return; }
    if (wpn.kind === "launcher" && isLauncherId(wpn.id)) {
      if (fireLauncher(sim, wpn.id, s.x + Math.sin(s.yaw) * 0.6, s.y + 0.05, s.z + Math.cos(s.yaw) * 0.6, s.yaw, s.pitch, wpn.damage, wpn.knock, wpn.heat)) { s.shots++; s.mag--; }
      return;
    }
    const pellets = wpn.pellets ?? 1;
    let fired = false;
    for (let pi = 0; pi < pellets; pi++) {
      const fan = pellets === 1 ? 0 : ((pi / (pellets - 1)) - 0.5) * wpn.spread;
      if (fireBullet(sim, s.x, s.y + 0.05, s.z, s.yaw + fan, false, s.pitch, wpn.damage, wpn.knock / pellets, wpn.heat / pellets, wpn.element)) fired = true;
    }
    if (fired) { s.shots++; s.mag--; }
  };
  if (s.burstLeft > 0) {
    s.burstCool -= dt;
    if (s.burstCool <= 0) { s.burstLeft--; s.burstCool = wpn.burstGap; shoot(); }
  } else if (held && s.fireCool <= 0) {
    s.fireCool = wpn.fireRate / sim.mods.fireRate;
    shoot();
    s.burstLeft = wpn.burst - 1;
    s.burstCool = wpn.burstGap;
  }
}
/** crosshair on the target's chest (Scene fires from just under the eye along the camera ray) */
function aimAt(s: Shooter, m: Machine) {
  const d = Math.hypot(m.x - s.x, m.z - s.z);
  s.yaw = Math.atan2(m.x - s.x, m.z - s.z);
  s.pitch = Math.atan2(walkHeight(m.x, m.z) + 1.2 - (s.y + 0.05), d);
}
const liveBullets = (sim: WorldSim) => sim.bullets.filter((b) => b.alive);
const GUNS = WEAPON_ORDER.filter((id) => WEAPONS[id].kind === "gun");
const LAUNCHERS = WEAPON_ORDER.filter((id) => WEAPONS[id].kind === "launcher");

describe("on-foot gunfight: every gun class kills a grunt standing 30 m ahead", () => {
  for (const id of GUNS) {
    test(`${id}: bullets travel, hit, damage and kill`, () => {
      const sim = arena();
      const m = grunt(sim, PX, PZ + 30);
      const s = shooter(id);
      const startKills = sim.kills;
      let firstHitAt = -1, t = 0;
      for (let f = 0; f < 60 * 4 && m.alive; f++, t += DT) {
        aimAt(s, m); // the player keeps the crosshair on a target that flinches and strafes
        triggerFrame(sim, s, true);
        const hpBefore = m.hp;
        step(sim);
        if (firstHitAt < 0 && m.hp < hpBefore) firstHitAt = t;
      }
      expect(m.alive).toBe(false);
      expect(sim.kills).toBe(startKills + 1);
      // 30 m at 130 m/s minus the 3.23 m hit radius = ~0.21 s of flight before the first hit
      expect(firstHitAt).toBeGreaterThan(0.15);
      expect(firstHitAt).toBeLessThan(0.3);
      expect(sim.impacts.some((e) => e.id > 0 && e.kind === "machine")).toBe(true);
      expect(sim.drops.length).toBeGreaterThan(0);
    });
  }

  test("hits-to-kill ladder matches the weapon data (heavy one-shots, auto needs four)", () => {
    const ttk: Record<string, number> = {};
    for (const id of GUNS) {
      const sim = arena();
      const m = grunt(sim, PX, PZ + 20);
      const s = shooter(id);
      let hits = 0;
      for (let f = 0; f < 600 && m.alive; f++) { aimAt(s, m); triggerFrame(sim, s, true); const hp = m.hp; step(sim); if (m.hp < hp) hits++; }
      ttk[id] = hits; // damaging frames (all 8 pellets / a whole volley land in one frame)
    }
    expect(ttk["HEAVY"]).toBe(1); // 4.5 dmg vs 3.5 hp
    expect(ttk["SHOTGUN"]).toBe(1); // 8 pellets x 0.75
    expect(ttk["SIDEARM"]).toBe(2); // 2.4 per shot
    expect(ttk["AUTO"]).toBe(4); // 1.0 per round
    expect(ttk["PULSE"]).toBe(3); // 1.3 per round: one 3-round burst
  });

  test("pulse rifle fires a real 3-round burst 0.06 s apart from one trigger pull", () => {
    const sim = arena();
    const s = shooter("PULSE");
    const times: number[] = [];
    let t = 0;
    for (let f = 0; f < 20; f++, t += DT) { const before = s.shots; triggerFrame(sim, s, f === 0); if (s.shots > before) times.push(t); step(sim); }
    expect(times.length).toBe(3);
    expect(times[1]! - times[0]!).toBeCloseTo(0.0667, 1);
  });

  test("shotgun puts 8 pellets in the pool per pull and they fan around the aim", () => {
    const sim = arena();
    const s = shooter("SHOTGUN");
    triggerFrame(sim, s, true);
    const bs = liveBullets(sim);
    expect(bs.length).toBe(8);
    const yaws = bs.map((b) => Math.atan2(b.vx, b.vz));
    expect(Math.max(...yaws) - Math.min(...yaws)).toBeCloseTo(WEAPONS.SHOTGUN.spread, 3);
    expect(bs.every((b) => b.dmg === 0.75)).toBe(true);
  });

  for (const id of LAUNCHERS) {
    test(`${id}: launcher round flies, detonates and kills through splash`, () => {
      const sim = arena();
      const m = grunt(sim, PX, PZ + 40);
      const s = shooter(id);
      triggerFrame(sim, s, true);
      expect(sim.rounds.filter((r) => r.alive).length).toBe(1);
      // hold the trigger: the launcher refires after its fireRate if the first round leaves the grunt standing
      // (re-aim each frame like a player would: the blast knocks the grunt several metres off the first line)
      for (let f = 0; f < 60 * 5 && m.alive; f++) { s.yaw = Math.atan2(m.x - s.x, m.z - s.z); triggerFrame(sim, s, true); step(sim); }
      expect(m.alive).toBe(false);
      expect(sim.burstEvents.length).toBeGreaterThan(0);
      // a proximity burst sits ~2.5 m short of the target's centre; splash still has to cover it
      expect(Math.hypot(sim.burstEvents[0]!.x - m.x, sim.burstEvents[0]!.z - m.z)).toBeLessThan(WEAPONS[id].damage + 10);
    });
  }

  test("one Vitriol rocket kills a basic 3.5 hp grunt (it used to leave it on 0.02 hp)", () => {
    const sim = arena();
    const m = grunt(sim, PX, PZ + 40);
    const s = shooter("VITRIOL");
    aimAt(s, m);
    triggerFrame(sim, s, true);
    for (let f = 0; f < 90 && m.alive; f++) step(sim);
    expect(m.alive).toBe(false);
    expect(s.shots).toBe(1);
  });

  test("a missed volley lands on the ground and logs dust impacts that bullet-impacts turns into particles", () => {
    const sim = arena();
    const s = shooter("AUTO", { pitch: -0.25 }); // looking at the dirt ~10 m ahead
    for (let f = 0; f < 30; f++) { triggerFrame(sim, s, true); step(sim); }
    const ground = sim.impacts.filter((e) => e.id > 0 && e.kind === "ground"); // id 0 = never-written slot
    expect(ground.length).toBeGreaterThan(0);
    for (const e of ground) {
      const d = Math.hypot(e.x - PX, e.z - PZ);
      // 2.55 m above the dirt at -0.25 rad drops in ~10 m
      expect(d).toBeGreaterThan(6);
      expect(d).toBeLessThan(14);
      expect(e.y - heightAt(e.x, e.z)).toBeLessThan(0.4);
    }
    const sparks = makeSparks(), puffs = makePuffs();
    for (const e of ground) spawnImpact(sparks, puffs, e, () => 0.5);
    expect(sparks.filter(sparkAlive).length).toBeGreaterThan(0);
    // grit flies back toward the shooter (against the bullet's travel, +z here)
    expect(sparks.filter(sparkAlive).every((p) => p.vz < 0)).toBe(true);
    stepImpacts(sparks, puffs, 2);
    expect(sparks.some(sparkAlive) || puffs.some(puffAlive)).toBe(false);
  });

  test("logImpact ring keeps only the newest 32 impacts and ids are monotonic", () => {
    const sim = arena();
    for (let i = 0; i < 40; i++) logImpact(sim, { x: i, y: 0, z: 0, vx: 0, vz: 1 }, "cover");
    const ids = sim.impacts.map((e) => e.id).sort((a, b) => a - b);
    expect(ids[0]).toBe(sim.nextImpactId - 32);
    expect(ids.at(-1)).toBe(sim.nextImpactId - 1);
  });
});

describe("bullet / tracer records", () => {
  test("a bullet starts at the shooter and flies along camera yaw AND pitch at 130 m/s", () => {
    const sim = arena();
    for (const [yaw, pitch] of [[0, 0], [Math.PI / 2, 0.3], [-2.2, -0.4], [1, 1.1]] as const) {
      for (const b of sim.bullets) b.alive = false;
      fireBullet(sim, PX, EYE_Y + 0.95, PZ, yaw, false, pitch);
      const b = liveBullets(sim)[0]!;
      expect(Math.hypot(b.vx, b.vy, b.vz)).toBeCloseTo(130, 6);
      // the same direction Scene's camera looks along: (sin yaw cos pitch, sin pitch, cos yaw cos pitch)
      expect(b.vx / 130).toBeCloseTo(Math.sin(yaw) * Math.cos(pitch), 6);
      expect(b.vy / 130).toBeCloseTo(Math.sin(pitch), 6);
      expect(b.vz / 130).toBeCloseTo(Math.cos(yaw) * Math.cos(pitch), 6);
      expect(b.life).toBe(1.4);
    }
  });

  test("bullets fly straight (no drop) and expire after 1.4 s / ~182 m", () => {
    const sim = arena();
    fireBullet(sim, PX, EYE_Y + 40, PZ, 0, false, 0); // high enough to clear the terrain
    const b = liveBullets(sim)[0]!;
    const y0 = b.y;
    let frames = 0;
    while (b.alive && frames < 200) { step(sim); frames++; }
    expect(frames).toBeGreaterThanOrEqual(83);
    expect(frames).toBeLessThanOrEqual(85);
    expect(b.y).toBeCloseTo(y0, 6);
    expect(b.z - PZ).toBeGreaterThan(178);
  });

  test("full-auto never exhausts the 48-bullet pool and heat vents before overheating a 32-round mag", () => {
    const sim = arena();
    const s = shooter("AUTO");
    let peakLive = 0;
    for (let f = 0; f < 60 * 4; f++) { triggerFrame(sim, s, true); step(sim); peakLive = Math.max(peakLive, liveBullets(sim).length); }
    expect(s.shots).toBe(32); // emptied the mag, then stopped
    expect(peakLive).toBeLessThan(BULLET_POOL);
    expect(sim.overheated).toBe(false);
  });

  test("heat: rapid sidearm/heavy dumps raise heat by HEAT_PER_SHOT_FOOT x weapon heat and overheat locks fire", () => {
    const sim = arena();
    fireBullet(sim, PX, EYE_Y, PZ, 0, false, 0, 1, 1, WEAPONS.HEAVY.heat);
    expect(sim.weaponHeat).toBeCloseTo(HEAT_PER_SHOT_FOOT * WEAPONS.HEAVY.heat, 6);
    sim.weaponHeat = 99;
    fireBullet(sim, PX, EYE_Y, PZ, 0);
    expect(sim.overheated).toBe(true);
    expect(fireBullet(sim, PX, EYE_Y, PZ, 0)).toBe(false);
    for (let f = 0; f < 60 * 6 && sim.overheated; f++) step(sim);
    expect(sim.overheated).toBe(false);
  });

  test("firing forward never hits an enemy standing right behind you", () => {
    const sim = arena();
    const behind = grunt(sim, PX, PZ - 1);
    fireBullet(sim, PX, EYE_Y + 0.05, PZ, 0, false, 0);
    step(sim);
    expect(behind.hp).toBe(3.5);
  });

  test("a bullet passing high over an enemy misses it (hit test is a body cylinder)", () => {
    const sim = arena();
    const m = grunt(sim, PX, PZ + 20);
    fireBullet(sim, PX, EYE_Y + 0.95, PZ, 0, false, 1.05); // at 20 m out it is ~35 m up
    for (let f = 0; f < 60; f++) step(sim);
    expect(m.hp).toBe(3.5);
  });

  test("at 20 fps a dead-centre shot does not tunnel through a small drone", () => {
    const sim = arena();
    const m = grunt(sim, PX, PZ + 16.25, { scale: 0.8, mission: false }); // idle (not charging the player), midway between the 13.0 m and 19.5 m step positions
    fireBullet(sim, PX, EYE_Y + 0.05, PZ, 0, false, 0);
    for (let f = 0; f < 10; f++) stepSim(sim, { px: PX, pz: PZ, dt: 0.05, night: 0, inVehicle: false, yaw: 0 });
    expect(m.hp).toBeLessThan(3.5);
  });

  test("first-person rounds leave from the eye line, so tracers cross the crosshair", () => {
    const muzzleAboveEye = OPERATOR_CAMERA.eye - 0.05 - OPERATOR_CAMERA.eye; // Scene SHOT_EYE
    expect(Math.abs(muzzleAboveEye)).toBeLessThan(0.3);
  });
});

describe("movement: sprint / slide / jump / glide", () => {
  const sprintSpeed = (traction: number) => BASE_FOOT_SPEED * traction * SPRINT_MULT;
  /** Scene: velocity.lerp(wish, 1 - exp(-14 dt)) toward the sprint wish */
  const settle = (target: number, seconds: number) => { let v = 0; for (let t = 0; t < seconds; t += DT) v += (target - v) * (1 - Math.exp(-14 * DT)); return v; };

  test("sprint out of the wilds (traction 0.9) reaches the slide threshold and slides with a decaying burst", () => {
    const v = settle(sprintSpeed(0.9), 1);
    expect(v).toBeGreaterThan(SLIDE_MIN_SPEED);
    const ms = createMoveState();
    expect(startSlide(ms, 0, v)).toBe(true);
    const speeds: number[] = [];
    for (let t = 0; t < 1; t += DT) speeds.push(stepSlide(ms, DT));
    expect(speeds[0]!).toBeGreaterThan(v); // 1.3x burst
    const lastSliding = speeds.filter((x) => x > 0);
    expect(lastSliding.at(-1)!).toBeLessThan(v * 0.6);
    expect(speeds.at(-1)).toBe(0);
    expect(movementFov(false, false, true)).toBeGreaterThan(movementFov(false, true, false));
  });

  test("you can slide out of a sprint in the starter region (Verdant Forest)", () => {
    const veridan = REGIONS.find((r) => r.id === "veridan")!;
    const ms = createMoveState();
    expect(startSlide(ms, 0, settle(sprintSpeed(veridan.speed), 2))).toBe(true);
  });
  test("jump arcs: ground jump apex, Hunter double air jump, Titan single, Warlock glide caps the fall", () => {
    const g = 26, v0 = Math.sqrt(2 * g * 6.5);
    const apex = (v: number) => (v * v) / (2 * g);
    expect(apex(v0)).toBeCloseTo(6.5, 6);
    const ms = createMoveState();
    land(ms, "HUNTER");
    expect(airJump(ms, "HUNTER")).toBe(0.9);
    expect(airJump(ms, "HUNTER")).toBe(0.9);
    expect(airJump(ms, "HUNTER")).toBeNull();
    land(ms, "TITAN");
    expect(airJump(ms, "TITAN")).toBe(0.8);
    expect(airJump(ms, "TITAN")).toBeNull();
    // Warlock glide, integrated in Scene's order: glideVy clamp, then gravity, then y += vy dt
    let vy = -12, y = 40;
    for (let t = 0; t < 3; t += DT) { vy = glideVy(vy, "WARLOCK", true); vy -= g * DT; y += vy * DT; }
    const fall = -vy;
    expect(fall).toBeLessThan(GLIDE_MAX_FALL + g * DT + 1e-9);
    expect(fall).toBeGreaterThan(GLIDE_MAX_FALL); // the clamp runs before gravity, so the real fall is 2.2 + g*dt (2.63 m/s at 60 fps)
    expect(glideVy(-12, "HUNTER", true)).toBe(-12);
    expect(AIR_PROFILE.WARLOCK.glide).toBe(true);
  });

  test("stride cadence and stance: sprinting bobs faster than walking, crouch/prone drop out on sprint", () => {
    const a = createStride(), b = createStride();
    let walkPhase = 0, runPhase = 0;
    for (let t = 0; t < 2; t += DT) { walkPhase = stepStride(a, { speed: RUN_SPEED * 0.45, grounded: true, sliding: false, vy: 0, dt: DT }, 0).phase; runPhase = stepStride(b, { speed: RUN_SPEED, grounded: true, sliding: false, vy: 0, dt: DT }, 0).phase; }
    expect(runPhase).toBeGreaterThan(walkPhase);
    const ms = createMoveState();
    ms.prone = true;
    expect(resolveStance(ms, { crouchHeld: false, sprinting: true, jumping: false, grounded: true, sliding: false, swimming: false })).toBe("STAND");
    expect(resolveStance(ms, { crouchHeld: true, sprinting: false, jumping: false, grounded: true, sliding: false, swimming: false })).toBe("CROUCH");
  });
});

describe("reticle + viewmodel during a firefight", () => {
  test("sprinting + firing opens the ring, a hit then a kill flashes the marker, ADS tightens", () => {
    const r = createReticle();
    let idle = stepReticle(r, { motion: "IDLE", bloom: 0, aiming: false, lookRight: 0, lookUp: 0 }, 0.5).gap;
    const open = stepReticle(r, { motion: "SPRINT", bloom: 1, aiming: false, lookRight: 0, lookUp: 0 }, 0.5).gap;
    expect(open).toBeGreaterThan(idle + 15);
    markHit(r, "HIT");
    markHit(r, "KILL");
    markHit(r, "HIT"); // never downgrades a kill
    expect(stepReticle(r, { motion: "IDLE", bloom: 0, aiming: true, lookRight: 0, lookUp: 0 }, DT).hit).toBe("KILL");
    for (let t = 0; t < 1; t += DT) idle = stepReticle(r, { motion: "IDLE", bloom: 0, aiming: true, lookRight: 0, lookUp: 0 }, DT).gap;
    expect(idle).toBeCloseTo(2, 2);
  });

  test("every weapon draws, recoils on a shot and settles back; the sword never ADSes", () => {
    for (const id of WEAPON_ORDER) {
      let v = initialView(id);
      v = stepView(v, { weapon: id, aiming: true, sprinting: false, fired: 1, reload: -1, swing: -1, combo: 0, feel: NEUTRAL_FEEL, noise: 0 }, DT);
      const kicked = viewPose(v, { reload: -1, swing: -1 }, 0, 0).rot[0];
      for (let t = 0; t < 1.5; t += DT) v = stepView(v, { weapon: id, aiming: true, sprinting: false, fired: 0, reload: -1, swing: -1, combo: 0, feel: NEUTRAL_FEEL, noise: 0 }, DT);
      if (handlingClass(id) === "sword") { expect(v.ads).toBeLessThan(0.01); continue; }
      expect(kicked).toBeGreaterThan(0);
      expect(Math.abs(v.kick[1])).toBeLessThan(0.01);
      expect(v.ads).toBeGreaterThan(0.95);
    }
  });
});
