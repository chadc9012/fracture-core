import { walkHeight } from "./terrain";

/**
 * Opening cinematic camera path — a scripted flythrough that plays behind intro.ts's text beats
 * (IntroCinematic.tsx fades its black overlay from opaque to transparent across the sequence, so
 * this is what's actually revealed underneath: a wide aerial pass over the broken world, sweeping
 * down toward the spawn point, landing exactly on the default third-person framing Scene.tsx's own
 * follow-camera uses at rest). That's the "world reveal" — not a separate render, the real running
 * Scene/Terrain/Sky the player is about to drop into, just not yet under player control.
 *
 * Pure data + a sampler (same shape as intro.ts) so Scene.tsx only has to ask "where's the camera
 * at time t" — one scripted waypoint curve normalized to intro.ts's own introTotalSeconds(), so
 * retiming the text beats retimes the flythrough for free.
 */
export type CameraPose = { position: [number, number, number]; lookAt: [number, number, number] };

const SPAWN_X = -58;
const SPAWN_Z = -34 + 12;

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Waypoints as [x, y, z] camera position + [x, y, z] look-at target, spread across the sequence:
 * a high slow orbit over the shattered regions, a lateral pass over faction territory, then a
 * descending push toward the spawn point, ending on the same spot/offset Scene.tsx's resting
 * third-person camera uses — so the handoff to live gameplay control is a cut, not a jump. */
const WAYPOINTS: readonly { at: number; pose: CameraPose }[] = [
  {
    at: 0,
    pose: { position: [SPAWN_X + 260, 230, SPAWN_Z + 180], lookAt: [SPAWN_X, 10, SPAWN_Z] },
  },
  {
    at: 0.3,
    pose: { position: [SPAWN_X - 190, 170, SPAWN_Z + 140], lookAt: [SPAWN_X + 40, 5, SPAWN_Z - 30] },
  },
  {
    at: 0.62,
    pose: { position: [SPAWN_X + 70, 70, SPAWN_Z - 150], lookAt: [SPAWN_X, 8, SPAWN_Z] },
  },
  {
    at: 0.85,
    pose: { position: [SPAWN_X + 16, 24, SPAWN_Z - 34], lookAt: [SPAWN_X, 6, SPAWN_Z] },
  },
  {
    // final pose matches Scene.tsx's resting third-person offset (yaw 0, cameraBlend 1):
    // camTarget = (SPAWN.x + 1.3, SPAWN.y + 3.15, SPAWN.z - 5.8), looking down-range at +Z.
    at: 1,
    pose: { position: [SPAWN_X + 1.3, 0, SPAWN_Z - 5.8], lookAt: [SPAWN_X, 0, SPAWN_Z + 54.2] },
  },
];

/** Camera pose at `elapsed` seconds into a sequence of total length `totalSeconds`; clamps to the
 * first/last waypoint outside that range so callers never have to guard the edges. The final
 * waypoint's y-components are resolved against live terrain height (walkHeight) rather than baked
 * in, since Terrain.tsx's ground isn't flat. */
export function introCameraAt(elapsed: number, totalSeconds: number): CameraPose {
  const t = totalSeconds > 0 ? Math.max(0, Math.min(1, elapsed / totalSeconds)) : 1;
  let lo = WAYPOINTS[0]!;
  let hi = WAYPOINTS[WAYPOINTS.length - 1]!;
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    if (t >= WAYPOINTS[i]!.at && t <= WAYPOINTS[i + 1]!.at) {
      lo = WAYPOINTS[i]!;
      hi = WAYPOINTS[i + 1]!;
      break;
    }
  }
  const span = hi.at - lo.at;
  const local = span > 0 ? ease((t - lo.at) / span) : 1;
  const position: [number, number, number] = [
    lerp(lo.pose.position[0], hi.pose.position[0], local),
    lerp(lo.pose.position[1], hi.pose.position[1], local),
    lerp(lo.pose.position[2], hi.pose.position[2], local),
  ];
  const lookAt: [number, number, number] = [
    lerp(lo.pose.lookAt[0], hi.pose.lookAt[0], local),
    lerp(lo.pose.lookAt[1], hi.pose.lookAt[1], local),
    lerp(lo.pose.lookAt[2], hi.pose.lookAt[2], local),
  ];
  // Final descent only (t > 0.78): the authored y-values above are offsets above ground, not
  // absolute altitudes, so resolve them against the real walk height at spawn rather than a
  // hand-tuned flat number — keeps the landing glued to Terrain.tsx's actual ground mesh.
  if (t > 0.78) {
    const groundAtCam = walkHeight(position[0], position[2]);
    const groundAtLook = walkHeight(lookAt[0], lookAt[2]);
    position[1] = groundAtCam + lerp(16, 3.15, (t - 0.78) / 0.22);
    lookAt[1] = groundAtLook + 1.6;
  }
  return { position, lookAt };
}
