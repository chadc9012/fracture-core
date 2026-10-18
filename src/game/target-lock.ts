/**
 * Combat target lock-on (pure), ported from the Stage 8/9 camera package. Not yet driven by Scene.tsx: the existing
 * soft aim assist there is untouched. A host feeds candidates (with its own line-of-sight result in `visible`) and
 * gets back which target to lock, whether to keep it, the next target when cycling, and a look point that leads movers.
 */
export type V3 = { x: number; y: number; z: number };
export type LockCandidate = { id: string; position: V3; visible?: boolean; alive?: boolean; /** boss/elite/objective bias */ priority?: number };
export type LockOptions = { maxAcquireDistance?: number; maxRetainDistance?: number; maxAngleRadians?: number; targetHeight?: number; leadSeconds?: number };
export type LockState = { lockedTargetId: string | null; shoulderSide: 1 | -1 };

const fin = (n: number, f = 0) => (Number.isFinite(n) ? n : f);
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, fin(n, a)));
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (v: V3) => Math.hypot(v.x, v.y, v.z);
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const unit = (v: V3): V3 => { const l = len(v) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const usable = (c: LockCandidate) => !!c.id && c.visible !== false && c.alive !== false;

export const newLockState = (): LockState => ({ lockedTargetId: null, shoulderSide: 1 });

/** Best visible, living target inside the forward cone. Score favours alignment, then closeness, then priority. */
export function acquireTarget(origin: V3, forward: V3, candidates: readonly LockCandidate[], o: LockOptions = {}): string | null {
  const maxD = clamp(o.maxAcquireDistance ?? 28, 1, 200), maxA = clamp(o.maxAngleRadians ?? 1.0, 0.05, Math.PI), f = unit(forward);
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    if (!usable(c)) continue;
    const delta = sub(c.position, origin), d = len(delta);
    if (!Number.isFinite(d) || d > maxD || d < 0.001) continue;
    const align = clamp(dot(f, unit(delta)), -1, 1);
    if (Math.acos(align) > maxA) continue;
    const score = align * 3 - d / maxD + clamp(c.priority ?? 0, -5, 5) * 0.12;
    if (!best || score > best.score) best = { id: c.id, score };
  }
  return best?.id ?? null;
}

/** Keeps the lock while the target is still valid, visible and inside the (larger) retain radius. */
export function retainLock(state: LockState, origin: V3, candidates: readonly LockCandidate[], o: LockOptions = {}): LockState {
  if (!state.lockedTargetId) return state;
  const c = candidates.find((x) => x.id === state.lockedTargetId);
  if (!c || !usable(c) || len(sub(c.position, origin)) > clamp(o.maxRetainDistance ?? 36, 1, 250)) return { ...state, lockedTargetId: null };
  return state;
}

/** Next valid target in a stable (id-sorted) order, wrapping; null when none. */
export function cycleTarget(currentId: string | null, candidates: readonly LockCandidate[]): string | null {
  const valid = candidates.filter(usable).slice().sort((a, b) => a.id.localeCompare(b.id));
  if (!valid.length) return null;
  const i = valid.findIndex((c) => c.id === currentId);
  return valid[(i + 1) % valid.length]!.id;
}

export const swapShoulder = (s: LockState): LockState => ({ ...s, shoulderSide: s.shoulderSide === 1 ? -1 : 1 });

/** Where the camera should look: the target plus a height offset, led by its velocity for `leadSeconds`. */
export function lockLookAt(target: V3, velocity: V3 = { x: 0, y: 0, z: 0 }, o: LockOptions = {}): V3 {
  const lead = clamp(o.leadSeconds ?? 0, 0, 0.8), h = Math.max(-2, Math.min(4, fin(o.targetHeight ?? 0.8)));
  return { x: fin(target.x) + fin(velocity.x) * lead, y: fin(target.y) + h + fin(velocity.y) * lead, z: fin(target.z) + fin(velocity.z) * lead };
}
