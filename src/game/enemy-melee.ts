/**
 * Enemy melee as a readable swing (pure; sim.ts runs it, Actors/EnemyModel draw it). Melee used to land the instant a trooper
 * came within 6 m: no wind-up, nothing to see, nothing to answer. Now:
 *  - a trooper in range (`MELEE.start`) with its cooldown up starts a swing: a wind-up (`windupFor`: `MELEE.windup`,
 *    bosses `MELEE.bossWindup`) with the arm drawn back, then the strike;
 *  - the strike hurts only if the player is still within `MELEE.reach` when it lands; back off during the wind-up and it whiffs;
 *  - a stagger (enemy-reactions.ts) cancels a swing that has not landed;
 *  - while swinging it does nothing else (no shots), and it faces the player through the wind-up.
 * The damage, cooldown and boss tuning are unchanged (sim.ts engage()).
 */
export const MELEE = { start: 6, reach: 6.5, windup: 0.35, bossWindup: 0.5, recover: 0.3, lunge: 0.45 } as const;

export type Swing = { start: number; hitAt: number; landed: boolean };
export const windupFor = (boss: boolean) => (boss ? MELEE.bossWindup : MELEE.windup);
export const startSwing = (now: number, boss: boolean): Swing => ({ start: now, hitAt: now + windupFor(boss), landed: false });
/** the swing is over once it has landed and recovered */
export const swingDone = (s: Swing, now: number) => now >= s.hitAt + MELEE.recover;

/** 0..1 through the wind-up, then 0..1 through the strike-and-recover */
export function swingPhase(s: Swing, now: number): { phase: "WINDUP" | "STRIKE" | "DONE"; u: number } {
  if (now < s.hitAt) return { phase: "WINDUP", u: Math.max(0, (now - s.start) / Math.max(1e-6, s.hitAt - s.start)) };
  if (now < s.hitAt + MELEE.recover) return { phase: "STRIKE", u: (now - s.hitAt) / MELEE.recover };
  return { phase: "DONE", u: 1 };
}

/** the swing's pose (additive bones, same axes as death-animations.ts / enemy-reactions.ts) and how far the body lunges (m) */
export function swingBones(s: Swing, now: number): { bones: Record<string, [number, number, number]>; lunge: number } | null {
  const { phase, u } = swingPhase(s, now);
  if (phase === "DONE") return null;
  // wind-up: twist away, the striking (right) arm drawn up and back, weight on the back foot
  const w = phase === "WINDUP" ? Math.sin(Math.min(1, u) * Math.PI * 0.5) : 1 - Math.min(1, u * 3);
  // strike: snap round and down, the arm sweeping across, a step in; recover eases back to the clip
  const k = phase === "STRIKE" ? Math.sin(Math.min(1, u) * Math.PI) : 0;
  return {
    lunge: MELEE.lunge * k,
    bones: {
      Spine: [-0.1 * w + 0.3 * k, -0.45 * w + 0.55 * k, 0], Spine1: [-0.05 * w + 0.15 * k, -0.25 * w + 0.3 * k, 0],
      RightArm: [-1.1 * w + 0.6 * k, 0, 0.5 * w - 0.4 * k], RightForeArm: [0, 0, 0.9 * w - 0.2 * k],
      LeftArm: [0.25 * w, 0, -0.2 * w], RightUpLeg: [0.2 * w - 0.3 * k, 0, 0], LeftUpLeg: [-0.1 * w + 0.45 * k, 0, 0], LeftLeg: [0.35 * k, 0, 0],
    },
  };
}
