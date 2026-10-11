/**
 * Pure wildlife simulation: no React or three.js, so every rule is unit-testable. Wildlife.tsx draws the
 * animals and only reads what this module decides: where each animal is, what it is doing, and the
 * animation drivers (gait phase, head pose, wing beat) its body should show.
 *
 * Behaviour (modelled on how real prey animals react):
 *  - Ground animals cycle IDLE → GRAZE → WANDER. They notice a *moving* player at `alertRadius`
 *    (ALERT: freeze, head up, look at the threat) and bolt at `fleeRadius`, or sooner if the player
 *    sprints. A herd shares one alarm: when one deer bolts, the herd bolts with it.
 *  - Birds feed on the ground (GROUND), take off when disturbed (FLY), circle at altitude and land
 *    somewhere else in their range. Raptors/vultures (SOAR) circle high over their range all day.
 *  - Fish swim in schools inside a lake and dart away from a player in the water.
 *  - Nothing walks into deep water: wander targets are checked against `isWet`, and a step that would
 *    enter water stops the animal at the bank instead.
 */

export type Species = "DEER" | "FOX" | "RABBIT" | "SONGBIRD" | "VULTURE" | "FISH" | "DOG" | "CAT" | "SNAKE";
export type CritterState = "IDLE" | "GRAZE" | "WANDER" | "ALERT" | "FLEE" | "GROUND" | "FLY" | "SOAR" | "SWIM";
export type Locomotion = "ground" | "bird" | "soar" | "fish";

export type Critter = {
  id: string;
  species: Species;
  /** animals that share one alarm (a deer herd, a bird flock, a fish school) */
  group: string;
  /** antlered buck, used by the renderer only */
  variant: number;
  homeX: number;
  homeZ: number;
  homeRadius: number;
  x: number;
  z: number;
  /** height above the ground (birds) or below the surface (fish, negative) */
  alt: number;
  /** facing angle, radians (0 = +z) */
  heading: number;
  /** current ground speed, m/s (eased, so gaits blend) */
  speed: number;
  state: CritterState;
  targetX: number;
  targetZ: number;
  targetAlt: number;
  /** seconds until the next idle/graze/wander decision */
  timer: number;
  /** gait / wing / tail phase, advanced by distance travelled (so feet don't skate) */
  phase: number;
  /** 0 = head up, 1 = head down to graze */
  headDown: number;
  /** head yaw relative to the body (looking at a threat) */
  look: number;
  /** body scale variation, 0.85..1.15 */
  size: number;
};

export type SpeciesProfile = {
  locomotion: Locomotion;
  walk: number;
  run: number;
  alertRadius: number;
  fleeRadius: number;
  homeRadius: number;
  /** metres travelled per full gait cycle at walk (stride length); run uses `strideRun` */
  stride: number;
  strideRun: number;
  pause: [number, number];
  grazes: boolean;
};

export const SPECIES_PROFILE: Record<Species, SpeciesProfile> = {
  DEER: { locomotion: "ground", walk: 1.3, run: 9, alertRadius: 34, fleeRadius: 18, homeRadius: 26, stride: 1.4, strideRun: 4.2, pause: [2, 6], grazes: true },
  FOX: { locomotion: "ground", walk: 1.1, run: 7, alertRadius: 24, fleeRadius: 12, homeRadius: 30, stride: 0.9, strideRun: 2.4, pause: [2, 5], grazes: false },
  RABBIT: { locomotion: "ground", walk: 0.8, run: 6.5, alertRadius: 14, fleeRadius: 7, homeRadius: 10, stride: 0.5, strideRun: 1.6, pause: [1.5, 5], grazes: true },
  SONGBIRD: { locomotion: "bird", walk: 0.5, run: 8, alertRadius: 10, fleeRadius: 7, homeRadius: 34, stride: 0.12, strideRun: 1, pause: [0.6, 2.4], grazes: true },
  VULTURE: { locomotion: "soar", walk: 0, run: 9, alertRadius: 0, fleeRadius: 0, homeRadius: 55, stride: 1, strideRun: 1, pause: [4, 9], grazes: false },
  FISH: { locomotion: "fish", walk: 0.7, run: 3.6, alertRadius: 10, fleeRadius: 6, homeRadius: 10, stride: 0.5, strideRun: 0.9, pause: [1, 3], grazes: false },
  DOG: { locomotion: "ground", walk: 1.1, run: 5, alertRadius: 0, fleeRadius: 6, homeRadius: 14, stride: 0.8, strideRun: 1.8, pause: [2, 6], grazes: false },
  CAT: { locomotion: "ground", walk: 0.8, run: 5.5, alertRadius: 9, fleeRadius: 5, homeRadius: 12, stride: 0.5, strideRun: 1.5, pause: [3, 8], grazes: false },
  SNAKE: { locomotion: "ground", walk: 0.4, run: 1.8, alertRadius: 8, fleeRadius: 4, homeRadius: 8, stride: 0.35, strideRun: 0.5, pause: [3, 8], grazes: false },
};

/** Where water is, injected so the rules stay pure and testable (Wildlife.tsx passes the real terrain). */
export type Habitat = {
  /** true where a ground animal must not walk (lake, river channel, sea) */
  isWet: (x: number, z: number) => boolean;
};
export const DRY_LAND: Habitat = { isWet: () => false };

/** Player input to the step: position, speed (m/s) and whether they are on foot and sprinting. */
export type Threat = { x: number; z: number; speed: number; sprinting: boolean };

/** deterministic per-critter RNG so a spawn list is stable across reloads */
export function seededRnd(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function spawnCritter(id: string, species: Species, homeX: number, homeZ: number, index: number, group = id): Critter {
  const rnd = seededRnd(index * 7919 + species.length * 104729 + 17);
  const p = SPECIES_PROFILE[species];
  const flying = p.locomotion === "soar";
  return {
    id, species, group,
    variant: Math.floor(rnd() * 3),
    homeX, homeZ, homeRadius: p.homeRadius,
    x: homeX + (rnd() - 0.5) * 4,
    z: homeZ + (rnd() - 0.5) * 4,
    alt: flying ? 30 + rnd() * 15 : p.locomotion === "fish" ? -0.9 : 0,
    heading: rnd() * Math.PI * 2,
    speed: flying ? p.run : 0,
    state: flying ? "SOAR" : p.locomotion === "fish" ? "SWIM" : p.locomotion === "bird" ? "GROUND" : "IDLE",
    targetX: homeX, targetZ: homeZ, targetAlt: 0,
    timer: rnd() * 3,
    phase: rnd() * Math.PI * 2,
    headDown: 0,
    look: 0,
    size: 0.85 + rnd() * 0.3,
  };
}

const ease = (v: number, to: number, rate: number, dt: number) => v + (to - v) * Math.min(1, rate * dt);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function pickTarget(c: Critter, rnd: () => number, habitat: Habitat, radius = c.homeRadius) {
  for (let tries = 0; tries < 8; tries++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * radius;
    const x = c.homeX + Math.cos(a) * d, z = c.homeZ + Math.sin(a) * d;
    if (SPECIES_PROFILE[c.species].locomotion !== "fish" && habitat.isWet(x, z)) continue;
    c.targetX = x; c.targetZ = z;
    return;
  }
  c.targetX = c.x; c.targetZ = c.z;
}

/** Alarm shared by a herd/flock/school: set by any member that bolts, read by the rest this frame. */
export type Alarms = Map<string, { x: number; z: number; until: number }>;

/**
 * Advance one animal by dt seconds. `now` is a monotonic clock in seconds (for shared alarms).
 * Mutates and returns the same object; the caller owns the array.
 */
export function stepCritter(c: Critter, dt: number, threat: Threat, rnd: () => number, habitat: Habitat = DRY_LAND, alarms?: Alarms, now = 0): Critter {
  const p = SPECIES_PROFILE[c.species];
  const dist = Math.hypot(threat.x - c.x, threat.z - c.z);
  const moving = threat.speed > 0.3;
  // sprinting doubles how far away an animal hears you; standing still never spooks anything
  const reach = threat.sprinting ? 1.8 : 1;
  const alarm = alarms?.get(c.group);
  const groupAlarm = alarm && alarm.until > now ? alarm : null;

  if (p.locomotion === "soar") return soar(c, dt, rnd);
  if (p.locomotion === "fish") return swim(c, dt, threat, dist, moving, reach, rnd, alarms, now, groupAlarm);
  if (p.locomotion === "bird") return bird(c, dt, threat, dist, moving, reach, rnd, habitat, alarms, now, groupAlarm);

  // ---------- ground animals ----------
  const spooked = (moving && dist < p.fleeRadius * reach) || Boolean(groupAlarm);
  if (spooked && p.fleeRadius > 0) {
    if (c.state !== "FLEE") alarms?.set(c.group, { x: groupAlarm?.x ?? threat.x, z: groupAlarm?.z ?? threat.z, until: now + 4 });
    c.state = "FLEE";
    const fromX = groupAlarm?.x ?? threat.x, fromZ = groupAlarm?.z ?? threat.z;
    const ax = c.x - fromX, az = c.z - fromZ, len = Math.hypot(ax, az) || 1;
    c.targetX = c.x + (ax / len) * 14; c.targetZ = c.z + (az / len) * 14;
    // stay loosely tied to home so animals don't stream off the map
    const hd = Math.hypot(c.targetX - c.homeX, c.targetZ - c.homeZ), lim = c.homeRadius * 1.8;
    if (hd > lim) { c.targetX = c.homeX + (c.targetX - c.homeX) * (lim / hd); c.targetZ = c.homeZ + (c.targetZ - c.homeZ) * (lim / hd); }
    c.timer = 2.5 + rnd() * 2;
  } else if (moving && dist < p.alertRadius * reach && c.state !== "FLEE") {
    // freeze and watch: head up, turn the head toward the threat
    c.state = "ALERT";
    c.timer = 1.5 + rnd() * 2;
  } else if (c.state === "FLEE") {
    c.timer -= dt;
    if (c.timer <= 0 || Math.hypot(c.targetX - c.x, c.targetZ - c.z) < 0.5) { c.state = "ALERT"; c.timer = 1 + rnd() * 2; }
  } else {
    c.timer -= dt;
    if (c.timer <= 0) {
      if (c.state === "WANDER" || c.state === "ALERT") {
        c.state = p.grazes && rnd() < 0.6 ? "GRAZE" : "IDLE";
        c.timer = p.pause[0] + rnd() * (p.pause[1] - p.pause[0]);
      } else {
        c.state = "WANDER";
        pickTarget(c, rnd, habitat);
        c.timer = 6 + rnd() * 6;
      }
    }
  }

  const goal = c.state === "FLEE" ? p.run : c.state === "WANDER" ? p.walk : 0;
  c.speed = ease(c.speed, goal, c.state === "FLEE" ? 4 : 2.5, dt);
  if (c.speed > 0.02) {
    const dx = c.targetX - c.x, dz = c.targetZ - c.z, d = Math.hypot(dx, dz);
    if (d > 0.2) {
      // turn toward the target at a natural rate instead of snapping
      const want = Math.atan2(dx, dz);
      c.heading += wrapAngle(want - c.heading) * Math.min(1, (c.state === "FLEE" ? 6 : 2.5) * dt);
      const step = Math.min(d, c.speed * dt);
      const nx = c.x + Math.sin(c.heading) * step, nz = c.z + Math.cos(c.heading) * step;
      if (habitat.isWet(nx, nz)) { c.speed = 0; c.targetX = c.x; c.targetZ = c.z; }
      else { c.x = nx; c.z = nz; c.phase += (step / (c.state === "FLEE" ? p.strideRun : p.stride)) * Math.PI * 2; }
    } else if (c.state === "WANDER") { c.state = "IDLE"; c.timer = p.pause[0] + rnd() * (p.pause[1] - p.pause[0]); }
  } else c.phase += dt * 0.6; // idle breathing / tail
  c.headDown = ease(c.headDown, c.state === "GRAZE" ? 1 : 0, 2, dt);
  const lookWant = c.state === "ALERT" ? Math.max(-1.2, Math.min(1.2, wrapAngle(Math.atan2(threat.x - c.x, threat.z - c.z) - c.heading))) : 0;
  c.look = ease(c.look, lookWant, 4, dt);
  return c;
}

/* ---------- songbirds: feed on the ground, take off, circle, land elsewhere ---------- */
function bird(c: Critter, dt: number, threat: Threat, dist: number, moving: boolean, reach: number, rnd: () => number, habitat: Habitat, alarms: Alarms | undefined, now: number, groupAlarm: { x: number; z: number } | null): Critter {
  const p = SPECIES_PROFILE[c.species];
  if (c.state === "GROUND") {
    if ((moving && dist < p.fleeRadius * reach) || groupAlarm) {
      alarms?.set(c.group, { x: threat.x, z: threat.z, until: now + 2 });
      c.state = "FLY"; c.targetAlt = 8 + rnd() * 10; c.timer = 5 + rnd() * 6;
      pickTarget(c, rnd, habitat);
    } else {
      // hop and peck around the feeding spot
      c.timer -= dt;
      if (c.timer <= 0) {
        c.heading += (rnd() - 0.5) * 2;
        const hop = 0.25 + rnd() * 0.3;
        c.x += Math.sin(c.heading) * hop; c.z += Math.cos(c.heading) * hop;
        c.timer = p.pause[0] + rnd() * (p.pause[1] - p.pause[0]);
      }
      c.headDown = ease(c.headDown, Math.sin(now * 3 + c.phase) > 0.3 ? 1 : 0, 10, dt);
      c.alt = ease(c.alt, 0, 6, dt);
      c.speed = 0;
    }
    c.phase += dt * 2;
    return c;
  }
  // FLY: steer toward the target at altitude, then descend and land
  c.timer -= dt;
  const dx = c.targetX - c.x, dz = c.targetZ - c.z, d = Math.hypot(dx, dz);
  if (d < 3) pickTarget(c, rnd, habitat);
  c.heading += wrapAngle(Math.atan2(dx, dz) - c.heading) * Math.min(1, 2 * dt);
  c.speed = ease(c.speed, p.run, 2, dt);
  c.x += Math.sin(c.heading) * c.speed * dt; c.z += Math.cos(c.heading) * c.speed * dt;
  const landing = c.timer <= 0 && !(moving && dist < p.alertRadius * 2);
  c.alt = ease(c.alt, landing ? 0 : c.targetAlt, landing ? 0.9 : 1.5, dt);
  c.phase += dt * 16; // wing beats
  c.headDown = 0;
  // never touch down on water: keep flying until over land
  if (landing && c.alt < 0.15 && habitat.isWet(c.x, c.z)) { c.timer = 2; pickTarget(c, rnd, habitat); }
  else if (landing && c.alt < 0.15) { c.state = "GROUND"; c.alt = 0; c.speed = 0; c.timer = 1 + rnd() * 2; }
  return c;
}

/* ---------- vultures / raptors: wide circles high over their range ---------- */
function soar(c: Critter, dt: number, rnd: () => number): Critter {
  const p = SPECIES_PROFILE[c.species];
  c.timer -= dt;
  if (c.timer <= 0) { c.targetAlt = 26 + rnd() * 22; c.timer = p.pause[0] + rnd() * (p.pause[1] - p.pause[0]); }
  // bank around home: turn rate keeps the bird on a circle of ~homeRadius
  const ox = c.x - c.homeX, oz = c.z - c.homeZ, r = Math.hypot(ox, oz) || 1;
  const tangent = Math.atan2(oz, -ox); // counter-clockwise tangent
  const pull = (r - c.homeRadius) / c.homeRadius;
  const want = tangent + Math.max(-0.8, Math.min(0.8, pull)) * (Math.PI / 2);
  c.heading += wrapAngle(want - c.heading) * Math.min(1, 0.9 * dt);
  c.speed = p.run;
  c.x += Math.sin(c.heading) * c.speed * dt; c.z += Math.cos(c.heading) * c.speed * dt;
  c.alt = ease(c.alt, c.targetAlt || c.alt, 0.3, dt);
  c.phase += dt * 1.2; // occasional slow wing beats
  return c;
}

/* ---------- fish: a loose school inside its lake, darting from a swimmer ---------- */
function swim(c: Critter, dt: number, threat: Threat, dist: number, moving: boolean, reach: number, rnd: () => number, alarms: Alarms | undefined, now: number, groupAlarm: { x: number; z: number } | null): Critter {
  const p = SPECIES_PROFILE[c.species];
  const scared = (moving && dist < p.fleeRadius * reach) || Boolean(groupAlarm);
  if (scared) {
    if (!groupAlarm) alarms?.set(c.group, { x: threat.x, z: threat.z, until: now + 1.5 });
    const fx = groupAlarm?.x ?? threat.x, fz = groupAlarm?.z ?? threat.z;
    const ax = c.x - fx, az = c.z - fz, len = Math.hypot(ax, az) || 1;
    c.targetX = c.x + (ax / len) * 6; c.targetZ = c.z + (az / len) * 6;
  } else {
    c.timer -= dt;
    if (c.timer <= 0 || Math.hypot(c.targetX - c.x, c.targetZ - c.z) < 0.4) { pickTarget(c, rnd, DRY_LAND); c.timer = p.pause[0] + rnd() * (p.pause[1] - p.pause[0]); c.targetAlt = -0.5 - rnd() * 1.2; }
  }
  // never leave the lake: clamp the target into the home circle
  const hd = Math.hypot(c.targetX - c.homeX, c.targetZ - c.homeZ);
  if (hd > c.homeRadius) { c.targetX = c.homeX + (c.targetX - c.homeX) * (c.homeRadius / hd); c.targetZ = c.homeZ + (c.targetZ - c.homeZ) * (c.homeRadius / hd); }
  const dx = c.targetX - c.x, dz = c.targetZ - c.z, d = Math.hypot(dx, dz);
  c.speed = ease(c.speed, scared ? p.run : d > 0.4 ? p.walk : 0.1, scared ? 6 : 1.5, dt);
  if (d > 0.05) c.heading += wrapAngle(Math.atan2(dx, dz) - c.heading) * Math.min(1, (scared ? 8 : 2) * dt);
  c.x += Math.sin(c.heading) * c.speed * dt; c.z += Math.cos(c.heading) * c.speed * dt;
  c.alt = ease(c.alt, c.targetAlt || -0.9, 0.8, dt);
  c.phase += dt * (3 + c.speed * 5);
  return c;
}

/* ---------- placement ---------- */

export type HerdSpec = { species: Species; count: number; members: [number, number]; spread: number };

/** Herd/flock home points spread over a region, avoiding water and reserved ground (the mission trail). */
export function placeHomes(region: { x: number; z: number; radius: number }, count: number, seed: number, ok: (x: number, z: number) => boolean, fill = 0.75): { x: number; z: number }[] {
  const rnd = seededRnd(seed);
  const out: { x: number; z: number }[] = [];
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * region.radius * fill;
    const x = region.x + Math.cos(a) * d, z = region.z + Math.sin(a) * d;
    if (!ok(x, z)) continue;
    // keep herds apart so the region feels populated, not clumped
    if (out.some((h) => Math.hypot(h.x - x, h.z - z) < region.radius * 0.18)) continue;
    out.push({ x, z });
  }
  return out;
}
