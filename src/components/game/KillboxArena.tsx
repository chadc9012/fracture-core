import type { KillboxArena as Arena } from "@/game/killbox-arenas";
import type { PvpState } from "@/game/pvp";
import { PlazaArenaView } from "./PlazaArena";
import { KaijuComplexView } from "./KaijuComplexArena";
import { NeonYardView } from "./NeonYardArena";
import { GlassSpireView } from "./GlassSpireArena";
import { RiverfrontView } from "./RiverfrontArena";
import { SolaraOutpostView } from "./SolaraOutpostArena";
import { SkydockView } from "./SkydockArena";

/** A built Killbox arena (killbox-arenas.ts), dressed for its look after the owner's PvP maps board: Kaiju Complex
 * (KaijuComplexArena.tsx), the plaza maps Fracture Floor and Killbox Prime (PlazaArena.tsx), Skydock (SkydockArena.tsx), Neon Yard (NeonYardArena.tsx), Glass Spire (GlassSpireArena.tsx), Riverfront (RiverfrontArena.tsx) or Solara Outpost (SolaraOutpostArena.tsx). Each view draws from the same data the arena's decks and walls
 * come from. */
export function KillboxArena({ arena, state }: { arena: Arena; state: PvpState }) {
  if (arena.look === "neon-rooftops") return <KaijuComplexView arena={arena} state={state} />;
  if (arena.look === "skydock") return <SkydockView arena={arena} state={state} />;
  if (arena.look === "neon-yard") return <NeonYardView arena={arena} state={state} />;
  if (arena.look === "glass-spire") return <GlassSpireView arena={arena} state={state} />;
  if (arena.look === "riverfront") return <RiverfrontView arena={arena} state={state} />;
  if (arena.look === "solara-outpost") return <SolaraOutpostView arena={arena} state={state} />;
  return <PlazaArenaView arena={arena} state={state} />;
}
