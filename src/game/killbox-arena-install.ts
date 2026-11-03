/** Puts a Killbox arena (killbox-arenas.ts) into the shared world registries: its decks (walkHeight), walls (collideWalls) and
 * line-of-sight solids. Idempotent, and arenas stay registered once installed: they hang in their own airspace at ARENA_ALTITUDE,
 * so nothing else ever walks on or sees them. Called before the drop-in transit lands (GameCanvas) and when a match starts (Scene).
 * `syncShifters` swaps the moving cover (Fracture Floor's glass data walls) in and out as it rises and sinks; Scene calls it every frame. */
import { registerDeck } from "./district-decks";
import { removeModelSolid, setModelSolid } from "./environment-collision";
import { arenaDecks, arenaSolids, arenaWalls, shifterBlockers, solidShifters, type KillboxArena } from "./killbox-arenas";
import { clearWalls, setWalls } from "./walls";

const installed = new Set<string>();
export function installArena(a: KillboxArena): void {
  if (installed.has(a.id)) return;
  installed.add(a.id);
  for (const d of arenaDecks(a)) registerDeck(d);
  setWalls(`arena:${a.id}`, arenaWalls(a));
  for (const s of arenaSolids(a)) setModelSolid(s.id, s.box);
}

/** which shifters each arena last registered as standing (a key of their ids), and the solids it set */
const standing = new Map<string, { key: string; solids: string[] }>();
/** brings the arena's moving cover into line with match time `t`; cheap when nothing changed. Returns whether it changed. */
export function syncShifters(a: KillboxArena, t: number): boolean {
  if (!a.shifters.length) return false;
  const key = solidShifters(a, t).map((s) => s.id).join(",");
  const was = standing.get(a.id);
  if (was && was.key === key) return false;
  const owner = `arena:${a.id}:shifters`, { walls, solids } = shifterBlockers(a, t);
  if (walls.length) setWalls(owner, walls); else clearWalls(owner);
  for (const id of was?.solids ?? []) removeModelSolid(id);
  for (const s of solids) setModelSolid(s.id, s.box);
  standing.set(a.id, { key, solids: solids.map((s) => s.id) });
  return true;
}
