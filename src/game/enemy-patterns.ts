/** ENEMY ATTACK & MOVEMENT PATTERNS - readable, learnable behaviours in the spirit of Destiny's combat roles (swarming Dregs,
 *  strafing Vandals, shielded Captains, blinking Knights, ogre charges) and Helldivers 2's threats (telegraphed Charger runs you
 *  sidestep and punish, leaping Hunters, Stalkers that strike when your back is turned, artillery shells that mark the ground).
 *
 *  Every pattern is a small state machine - MOVE (positioning), TELL (a visible wind-up that locks its target), ACT (the strike)
 *  and RECOVER (a punish window) - so a player can always read what is coming, dodge it, and answer it. This module is pure: it
 *  returns velocity, facing and requests (a strike, a blink, a stun, a guard); sim.ts applies them through the normal damage and
 *  vulnerability paths.
 *
 *  Coordinates: every x/z in the output (blink, tell, strike) is an OFFSET from the enemy's own position, because the enemy does not
 *  move while a tell is showing; the caller adds the enemy's position. */
export type PatternId = "SWARMER" | "STRAFER" | "ADVANCER" | "CHARGER" | "CAPTAIN" | "STALKER" | "BLINKER" | "ARTILLERY";
export type Phase = "MOVE" | "TELL" | "ACT" | "RECOVER";

export type PatternState = {
  id: PatternId; phase: Phase; t: number; total: number; cd: number;
  /** strafe direction and time until it flips */ dir: 1 | -1; flip: number;
  /** where the attack was aimed when the tell began, and where the enemy stood */ tx: number; tz: number; ax: number; az: number;
  /** unit direction of a charge/leap */ ux: number; uz: number; spent: boolean; seed: number; key: string;
};
export type PatternInput = {
  d: number; dx: number; dz: number; dt: number; time: number; speed: number;
  /** player facing (yaw 0 = +z), when known */ playerYaw?: number | undefined; playerHp: number;
};
export type Strike = { damage: number; radius: number; x: number; z: number; label: string; kind: "CIRCLE" | "LANE" };
export type PatternTell = { kind: "RING" | "LANE"; x: number; z: number; tx: number; tz: number; radius: number; width: number; progress: number };
export type PatternOut = {
  vx: number; vz: number; rot: number;
  /** the generic ranged/melee behaviour may run this frame */ fire: boolean;
  strike?: Strike; tell?: PatternTell;
  /** teleport the enemy here (Blinker) */ blink?: { x: number; z: number };
  /** the enemy is open to punishment for this many seconds, with this damage multiplier (Charger after a miss, Captain after a bash) */ exposed?: { seconds: number; mult: number };
  /** a raised shield: incoming damage multiplier while it is up */ guard?: number;
};

type Spec = { speed: number; band: readonly [number, number]; strafe: number; cd: number; trigger: readonly [number, number] };
export const SPECS: Record<PatternId, Spec> = {
  SWARMER:   { speed: 1.2,  band: [0, 0],   strafe: 0.55, cd: 3,   trigger: [0, 8] },
  STRAFER:   { speed: 0.9,  band: [14, 24], strafe: 0.9,  cd: 0,   trigger: [0, 0] },
  ADVANCER:  { speed: 0.75, band: [12, 18], strafe: 0.25, cd: 0,   trigger: [0, 0] },
  CHARGER:   { speed: 0.8,  band: [0, 0],   strafe: 0,    cd: 5,   trigger: [4, 28] },
  CAPTAIN:   { speed: 0.7,  band: [0, 0],   strafe: 0.15, cd: 4,   trigger: [0, 5] },
  STALKER:   { speed: 1.1,  band: [13, 18], strafe: 1,    cd: 4,   trigger: [6, 22] },
  BLINKER:   { speed: 0.9,  band: [12, 22], strafe: 0.7,  cd: 6,   trigger: [0, 60] },
  ARTILLERY: { speed: 0.6,  band: [28, 40], strafe: 0,    cd: 5.5, trigger: [14, 55] },
};
/** tuning of the committed attacks, exported so tests and tooling can read the numbers the player has to learn */
export const MOVES = {
  leap:   { tell: 0.35, act: 0.3, recover: 1.0, radius: 2.2, damage: 6 },
  charge: { tell: 1.2, act: 1.4, recover: 2.0, speedMult: 3.4, width: 3.2, damage: 16, exposeMult: 1.6, maxLength: 40 },
  bash:   { tell: 0.6, act: 0.15, recover: 1.1, radius: 3, damage: 10, exposeMult: 1.3, guardMult: 0.6 },
  strike: { tell: 0.4, act: 0.35, recover: 0.8, radius: 2.2, damage: 8 },
  blink:  { tell: 0.5, distance: 12 },
  shell:  { tell: 1.6, act: 0.2, recover: 0.6, radius: 6, damage: 14 },
} as const;

/** which pattern an enemy gets, from what it is: the faction kind, whether it is elite, and its place in the pool (so a group
 *  always mixes roles instead of every enemy of one kind doing the same thing at the same time) */
export function patternFor(kind: string | undefined, elite: boolean, index: number): PatternId | null {
  switch (kind) {
    case "OVERCLOCKED": return index % 4 === 3 ? "STALKER" : "SWARMER";
    case "ABERRATION": return "CHARGER";
    case "VANGUARD": return elite ? "CAPTAIN" : "ADVANCER";
    case "RAIDER": return elite ? (index % 2 ? "ARTILLERY" : "BLINKER") : index % 5 === 4 ? "BLINKER" : "STRAFER";
    default: return null;
  }
}

/** the first attack comes quickly, staggered across a group by the seed */
export function newPattern(id: PatternId, key: string, seed: number): PatternState {
  return { id, phase: "MOVE", t: 0, total: 0, cd: 0.6 + ((seed % 7) / 7) * 0.8, dir: seed % 2 ? 1 : -1, flip: 1.2 + (seed % 5) * 0.4, tx: 0, tz: 0, ax: 0, az: 0, ux: 0, uz: 1, spent: false, seed, key };
}

const toward = (dx: number, dz: number) => { const d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d }; };
/** unit vector turned 90 degrees (the strafe direction) */
const side = (u: { x: number; z: number }, dir: number) => ({ x: -u.z * dir, z: u.x * dir });
const enter = (s: PatternState, phase: Phase, secs: number) => { s.phase = phase; s.t = secs; s.total = secs; };

/** Advance one enemy's pattern by dt. Pure apart from mutating `s`. */
export function stepPattern(s: PatternState, inp: PatternInput): PatternOut {
  const { d, dt } = inp;
  const spec = SPECS[s.id], u = toward(inp.dx, inp.dz), rot = Math.atan2(inp.dx, inp.dz);
  const sp = inp.speed * spec.speed;
  const out: PatternOut = { vx: 0, vz: 0, rot, fire: false };
  s.cd -= dt;

  const move = (forward: number, strafe: number, mult = 1) => {
    const sd = side(u, s.dir);
    out.vx = (u.x * forward + sd.x * strafe) * sp * mult; out.vz = (u.z * forward + sd.z * strafe) * sp * mult;
  };
  /** step toward holding a distance band: forward when too far, back when too close, strafing all the while */
  const hold = (strafeScale = 1) => {
    s.flip -= dt;
    if (s.flip <= 0) { s.dir = s.dir === 1 ? -1 : 1; s.flip = 1.4 + ((s.seed + Math.floor(inp.time)) % 5) * 0.45; }
    const [lo, hi] = spec.band;
    const forward = d > hi ? 1 : d < lo ? -1 : 0;
    move(forward, spec.strafe * strafeScale);
  };

  switch (s.id) {
    case "STRAFER": case "ADVANCER": {
      hold(inp.playerHp < 0.35 ? 0.3 : 1);
      out.fire = true;
      return out;
    }

    case "SWARMER": {
      if (s.phase === "MOVE") {
        const weave = Math.sin(inp.time * 3 + s.seed) * spec.strafe;
        s.dir = weave >= 0 ? 1 : -1;
        move(1, Math.abs(weave));
        out.fire = true;
        if (s.cd <= 0 && d >= spec.trigger[0] && d <= spec.trigger[1]) {
          Object.assign(s, { ax: 0, az: 0, ux: u.x, uz: u.z, spent: false });
          s.tx = Math.max(2.5, Math.min(d, spec.trigger[1])); // leap distance, relative to the enemy
          enter(s, "TELL", MOVES.leap.tell);
        }
        return out;
      }
      if (s.phase === "TELL") { // crouch, facing the target
        s.t -= dt;
        out.tell = { kind: "RING", x: 0, z: 0, tx: s.ux * s.tx, tz: s.uz * s.tx, radius: MOVES.leap.radius, width: 0, progress: 1 - s.t / s.total };
        if (s.t <= 0) enter(s, "ACT", MOVES.leap.act);
        return out;
      }
      if (s.phase === "ACT") {
        s.t -= dt;
        const v = s.tx / MOVES.leap.act;
        out.vx = s.ux * v; out.vz = s.uz * v; out.rot = Math.atan2(s.ux, s.uz);
        if (s.t <= 0) { out.strike = { damage: MOVES.leap.damage, radius: MOVES.leap.radius, x: 0, z: 0, label: "Leap", kind: "CIRCLE" }; enter(s, "RECOVER", MOVES.leap.recover); }
        return out;
      }
      s.t -= dt; if (s.t <= 0) { s.phase = "MOVE"; s.cd = spec.cd; }
      return out;
    }

    case "CHARGER": {
      if (s.phase === "MOVE") {
        move(1, 0);
        out.fire = d < 6; // only its melee up close; the charge is its attack
        if (s.cd <= 0 && d >= spec.trigger[0] && d <= spec.trigger[1]) {
          s.ux = u.x; s.uz = u.z; s.spent = false; s.tx = Math.min(d + 8, MOVES.charge.maxLength);
          enter(s, "TELL", MOVES.charge.tell);
        }
        return out;
      }
      if (s.phase === "TELL") { // paws the ground; the lane is fixed the moment the tell starts
        s.t -= dt;
        out.rot = Math.atan2(s.ux, s.uz);
        out.tell = { kind: "LANE", x: 0, z: 0, tx: s.ux * s.tx, tz: s.uz * s.tx, radius: 0, width: MOVES.charge.width, progress: 1 - s.t / s.total };
        if (s.t <= 0) { enter(s, "ACT", MOVES.charge.act); s.ax = 0; }
        return out;
      }
      if (s.phase === "ACT") {
        s.t -= dt;
        const v = inp.speed * MOVES.charge.speedMult;
        out.vx = s.ux * v; out.vz = s.uz * v; out.rot = Math.atan2(s.ux, s.uz);
        s.ax += v * dt; // distance run
        // the lane hit is resolved by the caller against the player's position along the run; `strike` fires once, on contact
        if (!s.spent && d < MOVES.charge.width / 2 + 1 && inp.dx * s.ux + inp.dz * s.uz > -1) {
          s.spent = true;
          out.strike = { damage: MOVES.charge.damage, radius: MOVES.charge.width / 2 + 1, x: 0, z: 0, label: "Charge", kind: "LANE" };
        }
        if (s.t <= 0 || s.ax >= s.tx) { enter(s, "RECOVER", MOVES.charge.recover); out.exposed = { seconds: MOVES.charge.recover, mult: MOVES.charge.exposeMult }; }
        return out;
      }
      s.t -= dt; if (s.t <= 0) { s.phase = "MOVE"; s.cd = spec.cd; }
      return out;
    }

    case "CAPTAIN": {
      if (s.phase === "MOVE") {
        move(d > 3.5 ? 1 : 0, d > 3.5 ? spec.strafe : 0);
        out.fire = true;
        out.guard = MOVES.bash.guardMult;
        if (s.cd <= 0 && d >= spec.trigger[0] && d <= spec.trigger[1]) enter(s, "TELL", MOVES.bash.tell);
        return out;
      }
      if (s.phase === "TELL") { // shield drawn back
        s.t -= dt;
        out.tell = { kind: "RING", x: 0, z: 0, tx: 0, tz: 0, radius: MOVES.bash.radius, width: 0, progress: 1 - s.t / s.total };
        if (s.t <= 0) { out.strike = { damage: MOVES.bash.damage, radius: MOVES.bash.radius, x: 0, z: 0, label: "Shield bash", kind: "CIRCLE" }; enter(s, "RECOVER", MOVES.bash.recover); out.exposed = { seconds: MOVES.bash.recover, mult: MOVES.bash.exposeMult }; }
        return out;
      }
      s.t -= dt; if (s.t <= 0) { s.phase = "MOVE"; s.cd = spec.cd; }
      return out;
    }

    case "STALKER": {
      if (s.phase === "MOVE") {
        hold();
        // it waits for you to turn your back - or, when facing is unknown, simply for its timer
        const behind = inp.playerYaw === undefined ? true : (Math.sin(inp.playerYaw) * -u.x + Math.cos(inp.playerYaw) * -u.z) < 0.15; // player faces away from the enemy
        if (s.cd <= 0 && behind && d >= spec.trigger[0] && d <= spec.trigger[1]) { s.ux = u.x; s.uz = u.z; s.tx = d; s.spent = false; enter(s, "TELL", MOVES.strike.tell); }
        return out;
      }
      if (s.phase === "TELL") {
        s.t -= dt;
        out.tell = { kind: "RING", x: 0, z: 0, tx: s.ux * s.tx, tz: s.uz * s.tx, radius: MOVES.strike.radius, width: 0, progress: 1 - s.t / s.total };
        if (s.t <= 0) enter(s, "ACT", MOVES.strike.act);
        return out;
      }
      if (s.phase === "ACT") {
        s.t -= dt;
        const v = s.tx / MOVES.strike.act;
        out.vx = s.ux * v; out.vz = s.uz * v; out.rot = Math.atan2(s.ux, s.uz);
        if (s.t <= 0) { out.strike = { damage: MOVES.strike.damage, radius: MOVES.strike.radius, x: 0, z: 0, label: "Ambush", kind: "CIRCLE" }; enter(s, "RECOVER", MOVES.strike.recover); }
        return out;
      }
      s.t -= dt; move(-1, 0.6); if (s.t <= 0) { s.phase = "MOVE"; s.cd = spec.cd; }
      return out;
    }

    case "BLINKER": {
      if (s.phase === "MOVE") {
        hold();
        out.fire = true;
        if (s.cd <= 0 && d < spec.trigger[1]) enter(s, "TELL", MOVES.blink.tell);
        return out;
      }
      if (s.phase === "TELL") { // shimmer in place, then reappear on a flank
        s.t -= dt;
        out.tell = { kind: "RING", x: 0, z: 0, tx: 0, tz: 0, radius: 1.6, width: 0, progress: 1 - s.t / s.total };
        if (s.t <= 0) {
          const ang = rot + (s.dir * (1.6 + ((s.seed + Math.floor(inp.time)) % 3) * 0.3));
          // lands 12 m from the player on the side it was strafing toward (relative to the player: the caller converts)
          out.blink = { x: inp.dx - Math.sin(ang) * MOVES.blink.distance, z: inp.dz - Math.cos(ang) * MOVES.blink.distance };
          s.phase = "MOVE"; s.cd = spec.cd;
        }
        return out;
      }
      return out;
    }

    case "ARTILLERY": {
      if (s.phase === "MOVE") {
        const forward = d > spec.band[1] ? 1 : d < spec.band[0] ? -1 : 0;
        move(forward, 0);
        if (s.cd <= 0 && d >= spec.trigger[0] && d <= spec.trigger[1]) { s.tx = inp.dx; s.tz = inp.dz; enter(s, "TELL", MOVES.shell.tell); }
        return out;
      }
      if (s.phase === "TELL") { // the shell's landing point is fixed when the tell starts: leave the ring and it misses
        s.t -= dt;
        out.tell = { kind: "RING", x: 0, z: 0, tx: s.tx, tz: s.tz, radius: MOVES.shell.radius, width: 0, progress: 1 - s.t / s.total };
        if (s.t <= 0) { out.strike = { damage: MOVES.shell.damage, radius: MOVES.shell.radius, x: s.tx, z: s.tz, label: "Artillery shell", kind: "CIRCLE" }; enter(s, "RECOVER", MOVES.shell.recover); }
        return out;
      }
      s.t -= dt; if (s.t <= 0) { s.phase = "MOVE"; s.cd = spec.cd; }
      return out;
    }
  }
}
