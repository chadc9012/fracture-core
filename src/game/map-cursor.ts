/** Gamepad map cursor (Destiny-style): the right stick moves a free cursor over the Director's maps; near a selectable marker
 * the cursor slows down ("friction") and, once the stick is released inside the snap radius, settles onto the marker.
 * Pure: distances are in world metres, the speed scales with how much of the world is on screen (`span`). */
export type CursorTarget = { id: string; x: number; z: number };
export type MapCursor = { x: number; z: number; /** the marker the cursor rests on, if any */ hover: string | null };

export const CURSOR = {
  deadzone: 0.18,
  /** screens per second at full deflection */
  speed: 0.55,
  /** near a marker the cursor moves this much slower */
  friction: 0.35,
  /** snap/friction radius, as a fraction of the visible span */
  snap: 0.035,
  /** how quickly a released cursor settles onto the marker (per second) */
  settle: 14,
} as const;

const shape = (v: number) => { const a = Math.abs(v); if (a < CURSOR.deadzone) return 0; const k = (a - CURSOR.deadzone) / (1 - CURSOR.deadzone); return Math.sign(v) * k * k; };

/** nearest marker within the snap radius of (x, z) */
export function nearestTarget(x: number, z: number, targets: readonly CursorTarget[], radius: number): CursorTarget | null {
  let best: CursorTarget | null = null, bd = radius;
  for (const t of targets) { const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = t; } }
  return best;
}

export function stepCursor(c: MapCursor, stick: { x: number; y: number }, dt: number, span: number, targets: readonly CursorTarget[]): MapCursor {
  const sx = shape(stick.x), sy = shape(stick.y), r = span * CURSOR.snap;
  const near = nearestTarget(c.x, c.z, targets, r);
  if (sx !== 0 || sy !== 0) {
    const v = span * CURSOR.speed * dt * (near ? CURSOR.friction : 1);
    const x = c.x + sx * v, z = c.z + sy * v;
    return { x, z, hover: nearestTarget(x, z, targets, r)?.id ?? null };
  }
  if (!near) return { ...c, hover: null };
  // released inside the snap radius: settle onto the marker
  const k = Math.min(1, CURSOR.settle * dt);
  return { x: c.x + (near.x - c.x) * k, z: c.z + (near.z - c.z) * k, hover: near.id };
}

/** keep the cursor on screen: returns how far the view must pan to follow it (0,0 while it is inside the inner 80%) */
export function edgePan(c: { x: number; z: number }, view: { cx: number; cz: number }, span: number): { dx: number; dz: number } {
  const half = span * 0.4;
  const ex = c.x - view.cx, ez = c.z - view.cz;
  return { dx: Math.abs(ex) > half ? ex - Math.sign(ex) * half : 0, dz: Math.abs(ez) > half ? ez - Math.sign(ez) * half : 0 };
}
