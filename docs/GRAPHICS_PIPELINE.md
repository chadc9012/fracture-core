# Graphics pipeline (October 2026)

Every authored 3D asset in the game is generated from scripts in `scripts/` with Blender's Python module (`pip install bpy pillow`), so any of them can be rebuilt, restyled or extended without a modelling package.

| Script | Output | What it makes |
| --- | --- | --- |
| `build-fleet.py` + `fleet_kit.py` | `public/models/fleet/*.glb` | 22 vehicles. Car bodies are lofted from profile curves (`BODIES`), with clear-coat paint, glass, lamps, interiors and real wheels (tyre tread, spoked rims, brake discs, calipers). Specials: buggy, lightcycle, tanks, transport, war rig, helicopter, jet, shuttle, drone, boats. |
| `build-buildings.py` | `public/models/buildings/*.glb` | Nexus civic towers (white stone, blue glass, gold) and the Neon skyline (`neon-v-A..F` on `neon-layout.ts` footprints): tiers with setbacks, curtain walls with mullions and floor slabs, lit-window emissive maps (`WindowsLit`), crowns, holo billboards. |
| `build-palms.py` | `public/models/foliage/palm-*.glb` | City palms with alpha-cut fronds. |
| `build-textures.py` | `public/textures/` | Tileable asphalt, pavers and facade maps (albedo / normal / roughness) and relief normal maps for the six ground surfaces. |
| `build-trees.py`, `build-city.py`, `build-props.py`, `build-weapons.py` | earlier passes | Forest trees, the old Neon towers (fallback), props, weapons. |

Contracts the game relies on (see `src/game/fleet-models.ts`, `src/game/building-models.ts`):

- Metres, ground at y = 0, nose / lobby toward three.js +Z.
- Vehicle nodes: `SteerFL`/`SteerFR` pivots, `Wheel*` spin about X, `Rotor*` about Y, `RotorTail` about X, `Wing`, `Underglow`.
- Materials by name: `Paint` (garage colour, per-instance in traffic), `Taillight` (brake glow), `Headlight`, `WindowsLit` (glows with the night).

Rendering: repeated models go through `InstancedGlb` (one InstancedMesh per material). City streets are one draped mesh shaded in world space by `city-surface.ts`.
