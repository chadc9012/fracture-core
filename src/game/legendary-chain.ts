/** Pure deterministic legendary combo resolution. Damage is returned as a proposal;
 * callers must apply it through the existing sim.ts damage/reward pipeline. */
export type ChainElement = "THERMAL" | "CRYO" | "ARC" | "BIO" | "KINETIC";
export type ChainMark = Readonly<{ targetId: string; element: ChainElement; appliedAt: number; sourceId: string }>;
export type ChainState = Readonly<{ marks: readonly ChainMark[]; consumed: readonly string[] }>;
export type ChainReaction = Readonly<{ targetId: string; kind: "THERMAL_SHOCK" | "SHATTER" | "OVERGROWTH"; damageMultiplier: number; triggerId: string }>;
export const emptyChainState = (): ChainState => ({ marks: [], consumed: [] });
const WINDOW_MS = 3500;
const MAX_ACTIVE_MARKS = 256;
const MAX_TRACKED_HITS = 4096;
const validToken = (value: string) => typeof value === "string" && /^[a-zA-Z0-9_:-]{1,128}$/.test(value);
const PAIRS: Record<string, ChainReaction["kind"]> = {
  "ARC+THERMAL": "THERMAL_SHOCK", "CRYO+KINETIC": "SHATTER", "BIO+THERMAL": "OVERGROWTH",
};
/** A unique server-authoritative hit ID prevents retries and duplicate packets from
 * producing additional damage. Only distinct elements from distinct hits can react. */
export function registerChainHit(state: ChainState, hit: Readonly<{
  id: string; targetId: string; sourceId: string; element: ChainElement; at: number;
}>): { state: ChainState; reaction: ChainReaction | null } {
  if (!validToken(hit.id) || !validToken(hit.targetId) || !validToken(hit.sourceId) || !Number.isFinite(hit.at) || hit.at < 0 ||
      !["THERMAL", "CRYO", "ARC", "BIO", "KINETIC"].includes(hit.element)) return { state, reaction: null };
  if (state.consumed.includes(hit.id)) return { state, reaction: null };
  // Ignore stale out-of-order packets instead of rolling back the active combo clock.
  const latest = state.marks.reduce((max, mark) => mark.targetId === hit.targetId ? Math.max(max, mark.appliedAt) : max, 0);
  if (hit.at < latest) return { state, reaction: null };
  // Expire only the hit target; independent enemies can receive hits with
  // different network timestamps without losing each other's combo state.
  const marks = state.marks.filter(m => m.targetId !== hit.targetId || (hit.at >= m.appliedAt && hit.at - m.appliedAt <= WINDOW_MS));
  const previous = marks.find(m => m.targetId === hit.targetId && m.element !== hit.element && m.sourceId !== hit.sourceId);
  const key = previous ? [previous.element, hit.element].sort().join("+") : "";
  const kind = PAIRS[key];
  const consumed = [...state.consumed.slice(-(MAX_TRACKED_HITS - 1)), hit.id];
  if (kind && previous) return {
    state: { marks: marks.filter(m => m.targetId !== hit.targetId), consumed },
    reaction: { targetId: hit.targetId, kind, damageMultiplier: kind === "SHATTER" ? 1.35 : 1.2, triggerId: hit.id },
  };
  return { state: { marks: [...marks.filter(m => m.targetId !== hit.targetId || m.sourceId !== hit.sourceId),
    { targetId: hit.targetId, element: hit.element, appliedAt: hit.at, sourceId: hit.sourceId }].slice(-MAX_ACTIVE_MARKS), consumed }, reaction: null };
}

/** Apply a validated chain proposal to an existing damage amount. This function
 * never mutates HP, grants loot, or bypasses sim.ts defeat/reward handling.
 * The caller must apply the returned amount through its normal damage path. */
export function resolveChainDamage(baseDamage: number, reaction: ChainReaction | null): number {
  if (!Number.isFinite(baseDamage) || baseDamage <= 0) return 0;
  if (!reaction) return baseDamage;
  const multiplier = reaction.damageMultiplier;
  if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 2) return baseDamage;
  const adjusted = baseDamage * multiplier;
  return Number.isFinite(adjusted) ? adjusted : baseDamage;
}
