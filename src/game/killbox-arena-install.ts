/** Puts a Killbox arena (killbox-arenas.ts) into the shared world registries: its decks (walkHeight), walls (collideWalls) and
 * line-of-sight solids. Idempotent, and arenas stay registered once installed: they hang in their own airspace at ARENA_ALTITUDE,
 * so nothing else ever walks on or sees them. Called before the drop-in transit lands (GameCanvas) and when a match starts (Scene). */
import { registerDeck } from "./district-decks";
import { setModelSolid } from "./environment-collision";
import { arenaDecks, arenaSolids, arenaWalls, type KillboxArena } from "./killbox-arenas";
import { setWalls } from "./walls";

const installed = new Set<string>();
export function installArena(a: KillboxArena): void {
  if (installed.has(a.id)) return;
  installed.add(a.id);
  for (const d of arenaDecks(a)) registerDeck(d);
  setWalls(`arena:${a.id}`, arenaWalls(a));
  for (const s of arenaSolids(a)) setModelSolid(s.id, s.box);
}
