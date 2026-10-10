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
