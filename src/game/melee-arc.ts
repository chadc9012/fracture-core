/** Who a sword swing reaches (pure; Scene's sword block and the melee tests share it). A swing cuts a 150-degree arc in front
 * of the Operator (±75° off the facing) out to `reach` × the target's size, and only targets roughly at the same height: the
 * old test was a full 180-degree half-plane with no height check, so a slash cut troopers standing beside you or on a ledge
 * 6 m above. */
export const MELEE_HALF_ARC = (75 * Math.PI) / 180;
export const MELEE_HEIGHT = 2.5;

export function inSwordArc(p: { x: number; z: number; feet: number; yaw: number }, e: { x: number; z: number; feet: number; scale: number }, reach: number): boolean {
  const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
  if (d > reach * e.scale + 1) return false;
  if (Math.abs(e.feet - p.feet) > MELEE_HEIGHT * Math.max(1, e.scale)) return false;
  if (d < 0.6) return true; // standing inside you: always caught
  return (dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)) / d >= Math.cos(MELEE_HALF_ARC);
}
