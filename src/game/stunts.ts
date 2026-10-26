/** Off-road air and stunts (owner's off-road brief, Oct 25: jumps off crests, air control, flips, rolls, spins, big air,
 * powerslides, combos and a credit payout; a botched landing is a wipeout). Pure: Scene feeds it the ground under the
 * vehicle each frame and draws the pose; this owns the ballistic hop, the air control and the scoring.
 *
 * Ground vehicles used to be glued to the terrain. Now a vehicle follows the ground while the ground can hold it: its vertical
 * speed is the ground's (climbing a slope at speed builds upward speed), and when the ground falls away faster than gravity can
 * pull the vehicle down (a crest, a ramp lip, a ledge) it leaves the ground and flies until it meets the ground again. */

export const AIR = {
  /** m/s² (a touch heavier than real: arcade hang time without floaty jumps) */
  gravity: 21,
  /** the gap under the wheels before the vehicle counts as airborne (small rolls never launch it) */
  launchGap: 0.35,
  /** air control rates, rad/s: pitch (flip), roll (barrel roll), yaw (spin) */
  pitchRate: 4.6, rollRate: 5.2, yawRate: 3.6,
  /** how far from upright (rad) a landing still counts as clean */
  cleanTilt: 0.85,
  /** landing harder than this (m/s down, relative to the ground) is a hard landing */
  hardImpact: 13,
} as const;

export type AirState = {
  y: number; vy: number; airborne: boolean;
  /** the stand height last frame, to read the ground's own vertical speed */
  lastStand: number;
  /** stunt pose while airborne (rad, unbounded: two backflips is -4π) */
  pitch: number; roll: number; spinYaw: number;
  airTime: number;
};
export const freshAir = (y: number): AirState => ({ y, vy: 0, airborne: false, lastStand: y, pitch: 0, roll: 0, spinYaw: 0, airTime: 0 });

export type AirInput = { throttle: number; brake: number; steer: number; handbrake: boolean };
export type Landing = { airTime: number; pitch: number; roll: number; spinYaw: number; impact: number; clean: boolean };

/** wrap an angle to (-π, π] */
export const wrap = (a: number) => { const t = ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); return t - Math.PI; };

/** One frame of ground following / flight. `stand` is the height the vehicle rests at here (ground + ride height). Returns the
 * landing when it touched down this frame. Air control: brake pitches the nose up (backflip), throttle down (frontflip); steer
 * spins it flat, or rolls it with the handbrake held (barrel roll). */
export function stepAir(st: AirState, stand: number, input: AirInput, dt: number): Landing | null {
  if (dt <= 0) return null;
  const groundVy = (stand - st.lastStand) / dt;
  st.lastStand = stand;
  if (!st.airborne) {
    // follow the ground; leave it when it drops away faster than gravity could pull the vehicle after it
    const nextY = st.y + st.vy * dt - 0.5 * AIR.gravity * dt * dt;
    if (nextY > stand + AIR.launchGap) {
      st.airborne = true; st.y = nextY; st.vy -= AIR.gravity * dt; st.airTime = dt; st.pitch = 0; st.roll = 0; st.spinYaw = 0;
      return null;
    }
    st.y = stand;
    // the ground's vertical speed, eased so one bumpy sample doesn't fling the car
    st.vy += (Math.max(-30, Math.min(30, groundVy)) - st.vy) * (1 - Math.exp(-14 * dt));
    return null;
  }
  // flight
  st.vy -= AIR.gravity * dt;
  st.y += st.vy * dt;
  st.airTime += dt;
  st.pitch += (input.brake - input.throttle) * AIR.pitchRate * dt;
  if (input.handbrake) st.roll += -input.steer * AIR.rollRate * dt;
  else st.spinYaw += input.steer * AIR.yawRate * dt;
  if (st.y > stand) return null;
  const impact = Math.max(0, groundVy - st.vy);
  const clean = Math.abs(wrap(st.pitch)) < AIR.cleanTilt && Math.abs(wrap(st.roll)) < AIR.cleanTilt;
  const landing: Landing = { airTime: st.airTime, pitch: st.pitch, roll: st.roll, spinYaw: st.spinYaw, impact, clean };
  st.airborne = false; st.y = stand; st.vy = groundVy * 0.3; st.pitch = 0; st.roll = 0; st.spinYaw = 0; st.airTime = 0;
  return landing;
}

/* ---------------- scoring ---------------- */

export type Trick = { name: string; points: number };
export const TRICK_POINTS = { flip: 600, roll: 500, spin360: 300, bigAir: 250, hugeAir: 600, powerslide: 150, perSecondAir: 80 } as const;
/** big air thresholds, seconds airborne */
export const BIG_AIR = 1.4, HUGE_AIR = 2.4;
const times = (n: number, base: string) => (n === 1 ? base : n === 2 ? `Double ${base}` : n === 3 ? `Triple ${base}` : `${n}x ${base}`);

/** the tricks a clean landing scored (none for a wipeout or a plain hop) */
export function landingTricks(l: Landing): Trick[] {
  if (!l.clean) return [];
  const out: Trick[] = [];
  // a rotation counts once it is nearly complete (the clean-landing window lets you touch down a little short)
  const full = (a: number) => Math.floor((Math.abs(a) + AIR.cleanTilt) / (Math.PI * 2));
  const flips = full(l.pitch), rolls = full(l.roll), spins = Math.floor((Math.abs(l.spinYaw) + 0.5) / (Math.PI * 2));
  if (flips) out.push({ name: times(flips, l.pitch > 0 ? "Backflip" : "Frontflip"), points: TRICK_POINTS.flip * flips * (flips > 1 ? 1.25 : 1) });
  if (rolls) out.push({ name: times(rolls, "Barrel Roll"), points: TRICK_POINTS.roll * rolls * (rolls > 1 ? 1.25 : 1) });
  if (spins) out.push({ name: spins === 1 ? "360 Spin" : `${spins * 360} Spin`, points: TRICK_POINTS.spin360 * spins });
  if (l.airTime >= HUGE_AIR) out.push({ name: "Huge Air", points: TRICK_POINTS.hugeAir });
  else if (l.airTime >= BIG_AIR) out.push({ name: "Big Air", points: TRICK_POINTS.bigAir });
  if (out.length) out.push({ name: "Air time", points: Math.round(l.airTime * TRICK_POINTS.perSecondAir) });
  return out.map((t) => ({ ...t, points: Math.round(t.points) }));
}

export const POWERSLIDE = { slip: 0.3, minSpeed: 15, minTime: 1.2 } as const;
export const COMBO = { window: 4, step: 0.5, max: 4 } as const;

export type StuntRun = {
  combo: number; comboUntil: number; total: number; best: number;
  slideTime: number;
  /** the latest scored event, for the HUD toast */
  last: { label: string; points: number; at: number; wipeout: boolean } | null;
};
export const freshRun = (): StuntRun => ({ combo: 0, comboUntil: 0, total: 0, best: 0, slideTime: 0, last: null });

/** combo multiplier for the n-th stunt in a chain (1, 1.5, 2 ... capped) */
export const comboMult = (n: number) => Math.min(COMBO.max, 1 + Math.max(0, n - 1) * COMBO.step);

function score(run: StuntRun, tricks: Trick[], now: number): number {
  const base = tricks.reduce((s, t) => s + t.points, 0);
  if (!base) return 0;
  run.combo = now <= run.comboUntil ? run.combo + 1 : 1;
  run.comboUntil = now + COMBO.window;
  const mult = comboMult(run.combo), pts = Math.round(base * mult);
  run.total += pts; run.best = Math.max(run.best, pts);
  const label = tricks.filter((t) => t.name !== "Air time").map((t) => t.name).join(" + ") || "Air";
  run.last = { label: run.combo > 1 ? `${label}  x${mult}` : label, points: pts, at: now, wipeout: false };
  return pts;
}

/** score a landing; a wipeout breaks the combo. Returns the points earned. */
export function scoreLanding(run: StuntRun, l: Landing, now: number): number {
  if (!l.clean) { run.combo = 0; run.comboUntil = 0; run.last = { label: "Wipeout", points: 0, at: now, wipeout: true }; return 0; }
  return score(run, landingTricks(l), now);
}

/** feed the drift state every grounded frame; scores a powerslide when a long enough slide ends */
export function stepPowerslide(run: StuntRun, slip: number, speed: number, dt: number, now: number): number {
  if (slip > POWERSLIDE.slip && Math.abs(speed) > POWERSLIDE.minSpeed) { run.slideTime += dt; return 0; }
  const t = run.slideTime; run.slideTime = 0;
  if (t < POWERSLIDE.minTime) return 0;
  return score(run, [{ name: "Powerslide", points: Math.round(TRICK_POINTS.powerslide * t) }], now);
}

/** Nex paid for stunt points: 1 per 50 points, capped per real day (the ledger key keeps it once-per-day across cloud merges) */
export const STUNT_PAY = { pointsPerNex: 50, dailyCap: 600 } as const;
export function stuntNex(points: number, paidToday: number): number {
  return Math.max(0, Math.min(STUNT_PAY.dailyCap - paidToday, Math.floor(points / STUNT_PAY.pointsPerNex)));
}

/** credit stunt Nex to today's ledger line (`stunts:<YYYY-MM-DD>`, running total for the day, capped): cloud merge keeps the
 * larger total for a key, so the same day's stunts never pay twice */
export function payStunts<P extends { nexLedger?: Record<string, number> }>(p: P, day: string, points: number): P {
  const key = `stunts:${day}`, ledger = p.nexLedger ?? {}, paid = ledger[key] ?? 0, nex = stuntNex(points, paid);
  return nex > 0 ? { ...p, nexLedger: { ...ledger, [key]: paid + nex } } : p;
}
