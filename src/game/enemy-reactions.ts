/** Enemy hit reactions (ported idea: flinch / stagger from confirmed hits). Pure: sim.ts feeds every bullet that
 * lands; a hit that takes a big enough share of the enemy's health staggers it, which knocks a ranged wind-up back to its start and
 * holds its next attack for a moment; small hits only flinch. Bosses never stagger here (they have poise windows,
 * boss-poise.ts) and Crucible rivals neither (they're players' stand-ins). Actors.tsx reads the live reaction to lean
 * the body away from the hit and to stop the wind-up pulse. */
export type ReactionKind = "flinch" | "stagger";
/** where the hit landed on the body (from the hit height between the feet and the top of the head) */
export type HitPart = "HEAD" | "TORSO" | "LEGS";
export type Reaction = { kind: ReactionKind; until: number; start: number; dx: number; dz: number; k: number; part: HitPart };

/** share of max health one hit must take to stagger: elites shrug off more */
export const STAGGER_SHARE = { regular: 0.22, elite: 0.34 } as const;
export const DURATION: Record<ReactionKind, number> = { flinch: 0.16, stagger: 0.45 };
/** after a stagger the enemy can't be staggered again for this long (no stun-lock) */
export const STAGGER_IMMUNITY = 1.2;

export function reactTo(prev: Reaction | undefined, opts: { damage: number; maxHp: number; elite: boolean; boss: boolean; now: number; dx: number; dz: number; part?: HitPart }): Reaction | undefined {
  const { damage, maxHp, elite, boss, now } = opts;
  if (!(damage > 0) || !(maxHp > 0) || !Number.isFinite(now)) return prev;
  const share = Math.min(1, damage / maxHp);
  const recentStagger = prev?.kind === "stagger" && now < prev.until + STAGGER_IMMUNITY;
  const kind: ReactionKind = !boss && !recentStagger && share >= STAGGER_SHARE[elite ? "elite" : "regular"] ? "stagger" : "flinch";
  // a flinch never cuts a stagger short
  if (kind === "flinch" && prev?.kind === "stagger" && now < prev.until) return prev;
  const l = Math.hypot(opts.dx, opts.dz) || 1;
  return { kind, start: now, until: now + DURATION[kind] * (boss ? 0.6 : 1), dx: opts.dx / l, dz: opts.dz / l, k: share, part: opts.part ?? "TORSO" };
}
export const isStaggeredNow = (r: Reaction | undefined, now: number) => !!r && r.kind === "stagger" && now < r.until;
/** 0..1 how hard the body is thrown back right now (eases out over the reaction) */
export function recoilAt(r: Reaction | undefined, now: number): number {
  if (!r || now >= r.until || now < r.start) return 0;
  const t = (now - r.start) / (r.until - r.start);
  return (1 - t) * (1 - t) * (r.kind === "stagger" ? 1 : 0.25 + r.k * 0.75);
}

/** which part a hit at `hitY` struck, on a body standing at `feetY` that is `height` tall */
export function hitPart(hitY: number, feetY: number, height: number): HitPart {
  const f = (hitY - feetY) / Math.max(0.1, height);
  return f >= 0.82 ? "HEAD" : f < 0.45 ? "LEGS" : "TORSO";
}

/**
 * The limbs' part of a reaction: additive bone rotations (radians, bone-local Euler, Mixamo names without the prefix; same
 * axes as death-animations.ts: +X on Spine curls forward, on Leg bends the knee) laid over whatever clip is playing, so the
 * enemy keeps walking or aiming while it is struck. Where it was hit decides what moves:
 *  - HEAD: the head snaps away from the shot,
 *  - TORSO: the chest jerks away from the shot and the shoulders twist with a side hit; after a stagger's jolt it folds over a little,
 *  - LEGS: the knee on the struck side buckles and the body dips toward it.
 * `rot` is the body's facing (yaw, 0 = +z); the push (dx, dz) is the direction the hit travelled.
 */
export function reactionBones(r: Reaction | undefined, now: number, rot: number): Record<string, [number, number, number]> | null {
  const a = recoilAt(r, now);
  if (!r || a <= 0) return null;
  const s = r.kind === "stagger" ? 1 : 0.55;
  // the push in the body's own frame: forward (shot in the back) +1, toward its left +1
  const fwd = r.dx * Math.sin(rot) + r.dz * Math.cos(rot), left = r.dx * Math.cos(rot) - r.dz * Math.sin(rot);
  const k = a * s;
  if (r.part === "HEAD") return {
    Neck: [fwd * 0.45 * k, left * 0.25 * k, -left * 0.3 * k], Head: [fwd * 0.55 * k, left * 0.3 * k, -left * 0.35 * k],
    Spine2: [fwd * 0.12 * k, 0, 0],
  };
  if (r.part === "LEGS") {
    const leg = left >= 0 ? "Left" : "Right"; // the leg on the side the hit pushes toward gives way
    return {
      [`${leg}UpLeg`]: [-0.25 * k, 0, 0], [`${leg}Leg`]: [0.9 * k, 0, 0],
      Spine: [0.18 * k, 0, -left * 0.15 * k], Spine1: [0.1 * k, 0, 0],
    };
  }
  // a stagger jerks the chest away from the shot, then (once the jolt has passed) folds the body over a little
  const u = (now - r.start) / Math.max(1e-6, r.until - r.start);
  const fold = r.kind === "stagger" && u > 0.4 ? 0.22 * Math.sin(((u - 0.4) / 0.6) * Math.PI) : 0;
  return {
    Spine: [fwd * 0.45 * k + fold, left * 0.35 * k, -left * 0.15 * k], Spine1: [fwd * 0.3 * k + fold * 0.8, left * 0.25 * k, 0],
    Spine2: [fwd * 0.15 * k, left * 0.15 * k, 0], Head: [fwd * 0.2 * k, 0, 0],
    LeftArm: [-0.15 * k, 0, -0.25 * k], RightArm: [-0.15 * k, 0, 0.25 * k],
  };
}
