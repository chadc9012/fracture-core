import type { KillboxArena as Arena } from "@/game/killbox-arenas";
import type { PvpState } from "@/game/pvp";
import { FractureFloorView } from "./FractureFloorArena";
import { KaijuComplexView } from "./KaijuComplexArena";

/** A built Killbox arena (killbox-arenas.ts), dressed for its look after the owner's PvP maps board: Kaiju Complex
 * (KaijuComplexArena.tsx) or Fracture Floor (FractureFloorArena.tsx). Each view draws from the same data the arena's decks and walls
 * come from. */
export function KillboxArena({ arena, state }: { arena: Arena; state: PvpState }) {
  return arena.look === "nexus-grid" ? <FractureFloorView arena={arena} state={state} /> : <KaijuComplexView arena={arena} state={state} />;
}
