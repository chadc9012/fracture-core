import { REGIONS, regionAt, type Region } from "./world";

/** Death & checkpoint rules: never respawn inside an active war zone or next to hostiles.
 * Checkpoints are only recorded on calm ground; on death you return to the last checkpoint,
 * else the nearest safe/starter area, nudged away from any crossfire. */
export type Point = { x: number; z: number };
export const SAFE_KINDS: Region["kind"][] = ["safe", "starter"];
export const HOSTILE_CLEARANCE = 40;
export const CHECKPOINT_INTERVAL_S = 8;

const hostileKind = (p: Point) => { const r = regionAt(p.x, p.z); return !!r && !SAFE_KINDS.includes(r.kind); };
const nearestHostile = (p: Point, hostiles: Point[]) => hostiles.reduce((m, h) => Math.min(m, Math.hypot(h.x - p.x, h.z - p.z)), Infinity);

/** May this position become the player's checkpoint? */
export function isCheckpointSafe(p: Point, hostiles: Point[], inCombat: boolean): boolean {
  if (inCombat || hostileKind(p)) return false;
  return nearestHostile(p, hostiles) >= HOSTILE_CLEARANCE;
}

/** Where to respawn after death. */
export function chooseRespawn(deathAt: Point, checkpoint: Point | null, hostiles: Point[]): Point & { label: string } {
  if (checkpoint && !hostileKind(checkpoint) && nearestHostile(checkpoint, hostiles) >= HOSTILE_CLEARANCE) return { ...checkpoint, label: "last checkpoint" };
  const safe = REGIONS.filter((r) => SAFE_KINDS.includes(r.kind))
    .sort((a, b) => Math.hypot(a.x - deathAt.x, a.z - deathAt.z) - Math.hypot(b.x - deathAt.x, b.z - deathAt.z));
  for (const r of safe) {
    // try a ring of spots inside the safe area, keep the one furthest from hostiles
    let best: Point | null = null, bestD = -1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const p = { x: r.x + Math.cos(a) * r.radius * 0.35, z: r.z + Math.sin(a) * r.radius * 0.35 };
      const d = nearestHostile(p, hostiles);
      if (d > bestD) { bestD = d; best = p; }
    }
    if (best && bestD >= HOSTILE_CLEARANCE) return { ...best, label: r.name };
  }
  const fallback = safe[0]!;
  return { x: fallback.x, z: fallback.z + 10, label: fallback.name };
}
