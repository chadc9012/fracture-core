/**
 * Enemy cover (pure). A wounded trooper used to "take cover" by running to a point off to one side whether or not anything
 * stood there. Now it looks for the real thing: a rock, wreck, building, thick trunk or wall near it that hides it from the
 * player (checked with line-of-sight.ts from the player's eye to the trooper's chest), plus a lean-out spot just beside it
 * with a clear shot. sim.ts then runs the fight from there: hide, lean out and fire, duck back.
 */
import { obstacleHeight, sightLine, type Point3, type SightWorld } from "./line-of-sight";
import type { Obstacle } from "./obstacles";
import type { SolidBox } from "./environment-collision";

export type CoverSpot = { x: number; z: number; peekX: number; peekZ: number; /** metres the trooper must run to get there */ run: number };

/** how far a trooper will run for cover (m) */
export const COVER_SEARCH = 22;
/** a crouched trooper's chest above the ground: the height cover has to hide */
export const COVER_CHEST = 1.05;
/** standing chest height when it leans out to shoot */
export const PEEK_CHEST = 1.35;
/** hide this long, then lean out (s) */
export const HIDE_SECONDS = 1.6;
/** how long a trooper keeps using a cover before re-evaluating (s) */
export const COVER_HOLD = 7;

type Candidate = { x: number; z: number; r: number };

/** where something can hide: obstacles at least chest-high with a body-wide footprint, and solid boxes (walls, crates) */
export function coverCandidates(obstacles: readonly Obstacle[], solids: readonly SolidBox[], ground: (x: number, z: number) => number): Candidate[] {
  const out: Candidate[] = [];
  for (const o of obstacles) {
    if (o.broken) continue;
    if (obstacleHeight(o) < COVER_CHEST + 0.1) continue;
    if (o.kind === "tree" && o.r < 0.55) continue; // a sapling hides nobody
    if (o.kind === "cactus") continue;
    out.push({ x: o.x, z: o.z, r: o.r });
  }
  for (const s of solids) {
    if (s.y + s.h / 2 - ground(s.x, s.z) < COVER_CHEST + 0.1) continue; // a kerb, not cover
    if (Math.max(s.w, s.d) < 1) continue;
    out.push({ x: s.x, z: s.z, r: Math.max(s.w, s.d) / 2 });
  }
  return out;
}

/**
 * The best cover near a trooper at (mx, mz) from a player whose eye is at `player`: the spot directly behind each candidate
 * (away from the player, just clear of it) that the player cannot see, preferring a short run that does not cross the
 * player's front. The lean-out spot is a step to the side from which the player is in view (null cover if none works).
 */
export function findCover(mx: number, mz: number, player: Point3, candidates: readonly Candidate[], world: SightWorld): CoverSpot | null {
  let best: CoverSpot | null = null, bestScore = Infinity;
  const dp = Math.hypot(mx - player.x, mz - player.z);
  for (const c of candidates) {
    const toC = Math.hypot(c.x - mx, c.z - mz);
    if (toC > COVER_SEARCH + c.r) continue;
    const ax = c.x - player.x, az = c.z - player.z, al = Math.hypot(ax, az);
    if (al < 4) continue; // the player is standing on it
    const ux = ax / al, uz = az / al;
    const back = c.r + 0.9;
    const x = c.x + ux * back, z = c.z + uz * back;
    // never run to a spot closer to the player than it is now by much (no charging through the line of fire to hide)
    if (Math.hypot(x - player.x, z - player.z) < Math.min(dp, 8) - 2) continue;
    const g = world.ground(x, z);
    if (!sightLine(player, { x, y: g + COVER_CHEST, z }, world).blocked) continue;
    // lean out: a step to either side, whichever opens a line to the player
    let peek: { x: number; z: number } | null = null;
    for (const side of [1, -1]) {
      const px = x - uz * side * (c.r + 1.1), pz = z + ux * side * (c.r + 1.1);
      if (!sightLine(player, { x: px, y: world.ground(px, pz) + PEEK_CHEST, z: pz }, world).blocked) { peek = { x: px, z: pz }; break; }
    }
    if (!peek) continue;
    const run = Math.hypot(x - mx, z - mz);
    if (run < bestScore) { bestScore = run; best = { x, z, peekX: peek.x, peekZ: peek.z, run }; }
  }
  return best;
}

/** at the cover: lean out while winding up a shot, or once it has hidden HIDE_SECONDS and its gun is nearly ready; else hide */
export const coverPhase = (hideLeft: number, aiming: boolean, cooldown: number): "HIDE" | "PEEK" => (aiming || (hideLeft <= 0 && cooldown <= 0.6) ? "PEEK" : "HIDE");
