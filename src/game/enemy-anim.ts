/** Clip weights for rigged enemy models (Meshy rigs with idle / walk / run / shoot clips). Pure, so the blend is
 * testable; EnemyModel.tsx applies it to a per-instance AnimationMixer. Presentation only: AI and hits never read it. */
export type EnemyDrive = { /** ground speed, m/s (world units) */ speed: number; /** winding up or firing a ranged shot */ aiming: boolean };
export type ClipWeights = { idle: number; walk: number; run: number; shoot: number };

export const WALK_SPEED = 1.2;
export const RUN_SPEED = 6;
const CLIP_FALLBACK: (keyof ClipWeights)[] = ["idle", "walk", "run", "shoot"];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const safeSpeed = (speed: number) => Number.isFinite(speed) ? Math.max(0, speed) : 0;

/** Which clips play, and how much. Missing clips are handled by the caller (weight folds into what exists). */
export function enemyClipWeights(d: EnemyDrive, has: Partial<Record<keyof ClipWeights, boolean>>): ClipWeights {
  const speed = safeSpeed(d.speed);
  const moving = clamp01(speed / WALK_SPEED);
  const run = has.run ? clamp01((speed - WALK_SPEED * 2) / (RUN_SPEED - WALK_SPEED * 2)) : 0;
  let w: ClipWeights = { idle: 1 - moving, walk: moving * (1 - run), run: moving * run, shoot: 0 };
  // firing on the move: the walk-and-shoot clip replaces the plain walk (the rifle comes up); standing, the combat idle already aims
  if (d.aiming && has.shoot) w = { ...w, shoot: w.walk + w.run, walk: 0, run: 0 };
  if (!has.idle) { w.walk += w.idle; w.idle = 0; }
  if (!has.walk) { w.run += w.walk; w.walk = 0; }
  if (!has.run) { w.walk += w.run; w.run = 0; }
  // Some imported rigs contain only a shoot clip. Never leave a valid rig frozen
  // because its locomotion clips are absent; normalize onto an available action.
  for (const name of CLIP_FALLBACK) if (!has[name]) w[name] = 0;
  const total = w.idle + w.walk + w.run + w.shoot;
  if (total === 0) {
    const fallback = CLIP_FALLBACK.find((name) => has[name]);
    if (fallback) w[fallback] = 1;
  } else if (Math.abs(total - 1) > 1e-8) {
    for (const name of CLIP_FALLBACK) w[name] /= total;
  }
  return w;
}

/** Walk/run cycle playback rate: matches the clip's stride to the actual ground speed (clamped so it never moonwalks). */
export function strideRate(speed: number, clip: "walk" | "run"): number {
  const native = clip === "run" ? RUN_SPEED : WALK_SPEED * 1.6;
  return Math.min(1.8, Math.max(0.6, safeSpeed(speed) / native));
}
