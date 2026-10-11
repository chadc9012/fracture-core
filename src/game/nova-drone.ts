/** NOVA's field drone (trailer reference: the small hovering saucer that keeps station at the Operator's shoulder, docs/trailer-references.md).
 * Presentation only: it never targets, scans or blocks anything. Pure follow rules so the motion is testable without rendering.
 * Station is off the LEFT shoulder because the third-person camera sits over the right one. */
export type DronePose = { x: number; y: number; z: number; yaw: number };

export const DRONE_STATION = { side: 1.35, up: 1.55, forward: 0.25 } as const;

/** where the drone wants to be for an operator at (x,y,z) facing `yaw` (forward = (sin yaw, cos yaw)), with an idle bob and drift at time `t` */
export function droneStation(x: number, y: number, z: number, yaw: number, t: number): DronePose {
  const lx = Math.cos(yaw), lz = -Math.sin(yaw);          // operator's left
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const drift = Math.sin(t * 0.7) * 0.25;
  return {
    x: x + lx * (DRONE_STATION.side + drift) + fx * DRONE_STATION.forward,
    y: y + DRONE_STATION.up + Math.sin(t * 1.9) * 0.12,
    z: z + lz * (DRONE_STATION.side + drift) + fz * DRONE_STATION.forward,
    yaw: yaw + Math.sin(t * 0.5) * 0.4,
  };
}

/** critically-damped-ish follow: lags behind quick moves, never overshoots, and snaps after a teleport (> `snap` metres away) */
export function stepDrone(cur: DronePose, target: DronePose, dt: number, snap = 25): DronePose {
  if (Math.hypot(target.x - cur.x, target.y - cur.y, target.z - cur.z) > snap) return { ...target };
  const k = 1 - Math.exp(-dt * 4.5), ky = 1 - Math.exp(-dt * 6);
  const dyaw = Math.atan2(Math.sin(target.yaw - cur.yaw), Math.cos(target.yaw - cur.yaw));
  return { x: cur.x + (target.x - cur.x) * k, y: cur.y + (target.y - cur.y) * ky, z: cur.z + (target.z - cur.z) * k, yaw: cur.yaw + dyaw * k };
}
