import type { KillboxArena as Arena } from "@/game/killbox-arenas";
import type { PvpState } from "@/game/pvp";
import { PlazaArenaView } from "./PlazaArena";
import { KaijuComplexView } from "./KaijuComplexArena";
import { NeonYardView } from "./NeonYardArena";
import { SkydockView } from "./SkydockArena";

/** A built Killbox arena (killbox-arenas.ts), dressed for its look after the owner's PvP maps board: Kaiju Complex
 * (KaijuComplexArena.tsx), the plaza maps Fracture Floor and Killbox Prime (PlazaArena.tsx), Skydock (SkydockArena.tsx) or Neon Yard (NeonYardArena.tsx). Each view draws from the same data the arena's decks and walls
 * come from. */
export function KillboxArena({ arena, state }: { arena: Arena; state: PvpState }) {
  if (arena.look === "neon-rooftops") return <KaijuComplexView arena={arena} state={state} />;
  if (arena.look === "skydock") return <SkydockView arena={arena} state={state} />;
  if (arena.look === "neon-yard") return <NeonYardView arena={arena} state={state} />;
  return <PlazaArenaView arena={arena} state={state} />;
}
