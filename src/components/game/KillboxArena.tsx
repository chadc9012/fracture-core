import type { KillboxArena as Arena } from "@/game/killbox-arenas";
import type { PvpState } from "@/game/pvp";
import { PlazaArenaView } from "./PlazaArena";
import { KaijuComplexView } from "./KaijuComplexArena";

/** A built Killbox arena (killbox-arenas.ts), dressed for its look after the owner's PvP maps board: Kaiju Complex
 * (KaijuComplexArena.tsx), or the plaza maps Fracture Floor and Killbox Prime (PlazaArena.tsx). Each view draws from the same data the arena's decks and walls
 * come from. */
export function KillboxArena({ arena, state }: { arena: Arena; state: PvpState }) {
  return arena.look === "neon-rooftops" ? <KaijuComplexView arena={arena} state={state} /> : <PlazaArenaView arena={arena} state={state} />;
}
