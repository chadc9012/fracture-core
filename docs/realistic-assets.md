# Realistic world props: status

Rule: no model is claimed to work in-game until it was seen in a browser. Nothing below has been browser-verified yet.

## Now using real (already hosted, CC0 Poly Haven) models
| Prop | Where | Model | Fallback |
|---|---|---|---|
| Frostspire boulders | Terrain.tsx `PolyFoliage kind="rock"` (variants, 3.4 m) | rock_moss_set_01 | procedural `organicRock` until the GLB is on screen; on LOW |
| Swamp dead trees | `kind="log"` stood upright (8 m, small lean) | dead_tree_trunk | procedural cylinders |
| Forest saplings / brush | `kind="shrub"` / `kind="fern"` (variants) | shrub_02 / fern_02 | procedural canopy blobs |

All go through PolyFoliage: HEAD-verified, error-isolated, distance-culled, triangle-budgeted per tier. Rocks and trunks past the detailed budget draw as cheap silhouettes (`PROXY_RADIUS` rock 300 m, log 260 m) so they do not vanish. Unmeasured: real triangle counts (read `__forestAssets()` in the console) and whether the mossy rock suits snow.

## Still procedural (no suitable hosted model exists)
Wasteland/Solara rocks and Ember rocks (`namaqualand_boulder_02` is hosted but ~100k tris each, too heavy to instance), vehicle wrecks (boxes), cacti (capsules), swamp reeds, procedural tree stand-ins (LOW tier).

## How to add the rest
Models must be hosted in the project's asset store (the sandbox cannot reach Meshy or Poly Haven). Upload GLBs through Lovable, then: decimate to <=3k tris (rocks/cacti), <=6k (wrecks), embed textures <=1K, Y-up, origin at the base, 1 unit = 1 m, CC0/own licence noted in the `.asset.json`. Add a `FoliageKind` in PolyFoliage.tsx + a budget in perf-budget.ts + a hide-when-ready switch in Terrain.tsx.

## Characters
Operators use the upgraded `*-hd.glb` meshes with texture paint; see docs/characters-and-map.md.

## Wildlife (Oct 2026)
- Fixed: animal legs, wings and tails never moved (the animation phase was captured once at mount), fish were placed on land in the swamp, birds walked on the ground, and only 38 animals existed in a world 16x larger than they were placed for.
- Now: 135 animals across the forest, Frostspire, swamp, deserts, Wastelands and Nexus, plus fish schools in every lake large enough. Herds share alarms, animals notice moving (and louder sprinting) players, look at them, then bolt; birds feed, take off and land elsewhere; vultures circle high over the deserts.
- Real model: the fox is the Khronos sample Fox GLB (CC0 model, CC BY 4.0 rig/animation, credited in Credits), with Survey/Walk/Run clips matched to ground speed. Every other species is a jointed procedural rig; a rigged GLB per species can replace it.
- Rime Alpha (frost wolf boss): the GLB has a skeleton but no clips; legs are now found from the skeleton and walk/gallop procedurally.
- NOT browser-verified: proportions, gait timing and the fox's facing were checked from the model data and unit tests only.
