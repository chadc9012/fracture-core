/** Enemy hit reactions (ported idea: flinch / stagger from confirmed hits). Pure: sim.ts feeds every bullet that
 * lands; a hit that takes a big enough share of the enemy's health staggers it, which knocks a ranged wind-up back to its start and
 * holds its next attack for a moment; small hits only flinch. Bosses never stagger here (they have poise windows,
 * boss-poise.ts) and Crucible rivals neither (they're players' stand-ins). Actors.tsx reads the live reaction to lean
 * the body away from the hit and to stop the wind-up pulse. */
export type ReactionKind = "flinch" | "stagger";
export type Reaction = { kind: ReactionKind; until: number; start: number; dx: number; dz: number; k: number };

/** share of max health one hit must take to stagger: elites shrug off more */
export const STAGGER_SHARE = { regular: 0.22, elite: 0.34 } as const;
export const DURATION: Record<ReactionKind, number> = { flinch: 0.16, stagger: 0.45 };
/** after a stagger the enemy can't be staggered again for this long (no stun-lock) */
export const STAGGER_IMMUNITY = 1.2;

export function reactTo(prev: Reaction | undefined, opts: { damage: number; maxHp: number; elite: boolean; boss: boolean; now: number; dx: number; dz: number }): Reaction | undefined {
  const { damage, maxHp, elite, boss, now } = opts;
  if (!(damage > 0) || !(maxHp > 0) || !Number.isFinite(now)) return prev;
  const share = Math.min(1, damage / maxHp);
  const recentStagger = prev?.kind === "stagger" && now < prev.until + STAGGER_IMMUNITY;
  const kind: ReactionKind = !boss && !recentStagger && share >= STAGGER_SHARE[elite ? "elite" : "regular"] ? "stagger" : "flinch";
  // a flinch never cuts a stagger short
  if (kind === "flinch" && prev?.kind === "stagger" && now < prev.until) return prev;
  const l = Math.hypot(opts.dx, opts.dz) || 1;
  return { kind, start: now, until: now + DURATION[kind] * (boss ? 0.6 : 1), dx: opts.dx / l, dz: opts.dz / l, k: share };
}
export const isStaggeredNow = (r: Reaction | undefined, now: number) => !!r && r.kind === "stagger" && now < r.until;
/** 0..1 how hard the body is thrown back right now (eases out over the reaction) */
export function recoilAt(r: Reaction | undefined, now: number): number {
  if (!r || now >= r.until || now < r.start) return 0;
  const t = (now - r.start) / (r.until - r.start);
  return (1 - t) * (1 - t) * (r.kind === "stagger" ? 1 : 0.25 + r.k * 0.75);
}
