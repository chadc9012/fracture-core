/**
 * Exports the Killbox arenas and modes for the Godot project (godot-world-fracture/scripts/killbox/): every arena's roofs,
 * walkways, cover, ledges, shifters, spawns, zones, fracture event and kill plane (src/game/killbox-arenas.ts, the owner's
 * PvP maps board) and the modes (src/game/pvp.ts). The web game stays the source of truth; the JSON is small, so it is
 * committed (godot-world-fracture/data/killbox.json) and re-run whenever an arena changes.
 *
 *   bun scripts/export-godot-killbox.ts
 */
import { writeFileSync } from "node:fs";
import { ARENAS } from "../src/game/killbox-arenas";
import { PVP_MODES } from "../src/game/pvp";

const out = {
  arenas: Object.values(ARENAS).map((a) => ({
    id: a.id, name: a.name, region: a.region, size: a.size, blurb: a.blurb, look: a.look, base: a.base, killPlane: a.killPlane,
    roofs: a.roofs, walks: a.walks, cover: a.cover, ledges: a.ledges, shifters: a.shifters, spawns: a.spawns, zones: a.zones, objective: a.objective, fracture: a.fracture, modes: a.modes,
  })),
  modes: Object.values(PVP_MODES),
};
writeFileSync("godot-world-fracture/data/killbox.json", JSON.stringify(out));
console.log(`killbox.json: ${out.arenas.length} arenas, ${out.modes.length} modes`);
