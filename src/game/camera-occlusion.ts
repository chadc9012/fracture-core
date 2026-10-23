/** Third-person camera occlusion: how far along the boom (player's head → desired camera spot) the camera can sit before a tree
 * trunk, rock, tower or building wall gets between it and the operator. Scene pulls the camera in to that point, so standing
 * behind a swamp cypress or against a wall shows the operator instead of a screen full of bark. Pure (reads the obstacle and
 * wall grids the collision code already keeps). */
import { queryObstacles } from "./obstacles";
import { wallsNear } from "./walls";

/** how close the camera may come to a surface (m) */
export const CAMERA_PAD = 0.45;
/** never closer to the head than this fraction of the boom, so the camera does not end up inside the operator */
export const CAMERA_MIN_T = 0.18;

function blocked(x: number, z: number, y: number): boolean {
  for (const o of queryObstacles(x, z)) if (Math.hypot(x - o.x, z - o.z) < o.r + CAMERA_PAD) return true;
  for (const w of wallsNear(x, z)) {
    if (y > w.top || y < w.base) continue;
    const ex = w.bx - w.ax, ez = w.bz - w.az, l2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - w.ax) * ex + (z - w.az) * ez) / l2));
    if (Math.hypot(x - (w.ax + ex * t), z - (w.az + ez * t)) < w.half + CAMERA_PAD) return true;
  }
  return false;
}

/** fraction 0..1 of the boom from `head` to `cam` that is clear (1 = nothing in the way) */
export function boomClearance(head: { x: number; y: number; z: number }, cam: { x: number; y: number; z: number }): number {
  const len = Math.hypot(cam.x - head.x, cam.z - head.z);
  if (len < 0.01) return 1;
  const steps = Math.max(4, Math.ceil(len / 0.3));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (blocked(head.x + (cam.x - head.x) * t, head.z + (cam.z - head.z) * t, head.y + (cam.y - head.y) * t)) return Math.max(CAMERA_MIN_T, (i - 1) / steps);
  }
  return 1;
}
