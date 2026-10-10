# World scale (4x map)

The world used to be ~380 m across with a 30 u/s walk, so crossing a region took seconds. `WORLD_SCALE` (src/game/world.ts, default 4) stretches the whole map; `?worldScale=1` (or `WORLD_SCALE=1` for tests/tools) restores the original layout for A/B checks. It is read once at module load.

## What scales, and how

| Thing | Rule |
| --- | --- |
| Regions | `REGIONS` = base table x scale for centres and wild radii. **Nexus keeps its authored radius** (a bigger plateau around the city, not bigger buildings). `BASE_WORLD_REGIONS` keeps the original table. |
| Landform | `terrain.ts` evaluates the original noise/biome shaping in base space (`x / WORLD_SCALE`), heights stretched by `HEIGHT_K` (1 + 0.35 (S-1) = 2.05 at 4x) about the waterline. A world-space roll layer (`detailHeight`, ~25 m, faded on the city plateau and authored forest ground, and over river channels / lake basins) puts walkable-scale undulation back. |
| Water | Rivers and lakes are traced on the *smooth* landform (`smoothHeightAt`) with step/reach/width multiplied by `RIVER_SCALE` (= max(1, S/2)); fall thresholds use `HEIGHT_K / S`. rivers.test.ts still guards the named features. |
| Authored sites | Positions go through `scaleSite(x, z)`: offset from the nearest base region x scale (Nexus 1:1), ocean sites from the origin. Used by verdant.ts (trail control points), interiors.ts, regional-shops.ts, thalassia-site.ts. Anything human-sized (clearing radii, cover/spawn offsets, crash debris, trail width) keeps its authored metres: the ambush clearing and crash site are anchored to the trail's own control points. |
| Neon City | `NEON_OFFSET` = Nexus + (82, -38) x max(1, S/2). |
| Movement | `foot-speed.ts`: 14 walk / ~30 sprint at S > 1 (30 / 63 at 1). movement-feel stride thresholds follow `FOOT_SCALE`. |
| Hazard zones, landmark discovery, minimap/compass reach | Radii/ranges x max(1, S/2). Atlas and destination maps keep marker sizes in original-world units (positions are world units). |
| Fog / camera | `FOG_REACH` = 1 + 0.2 (S-1) (1.6 at 4x); camera far 1800. |

## Rendering

* **Chunked ground** (`terrain-chunks.ts`, `Terrain.tsx Ground`): 96 m chunks, four LODs (1.5 / 3 / 6 / 12 m grid) chosen by distance with hysteresis, built nearest-first in resumable row slices under a per-frame budget (14 ms for the first 120 frames, then 4 ms). Edge skirts hide LOD seams; normals come from a one-cell border so same-LOD neighbours match. The old single plane and `terrain-refine.ts` are no longer used by the game (the refine module and its tests remain).
* **Water** is a 2400 m patch (300 x 300) that follows the camera, snapped to its vertex spacing, with the waves keyed to world position (`uOrigin`). The baked depth texture covers only the land.
* **Roads**: `distanceToRoad` is bucketed; `ROAD_SAMPLES` keeps ~2.5 m spacing.
* **Forest**: base tree count x S^2/2 (distance-culled, tri-budgeted PolyFoliage); GLB firs 20 m / broadleaf 14 m at S > 1; groves x1.5; understory parents are weighted toward the trail corridor (`forestScatter`, `UNDERSTORY_K`). Non-culled layers are capped (`UNDERSTORY_PARENT_CAP`, `PROC_TREE_CAP`, `ROOT_TREE_CAP`). Other regions' plain instanced props grow with sqrt(S) only.

## Status

Unit-tested (bun, at WORLD_SCALE 1, 2 and 4): scale maths, site relocation, trail/crash/clearing layout, chunk grid/LOD/seams/skirts/resumable builds, river features, road lookup, stride thresholds. **Not browser-verified**: chunk streaming, water patch shader change, frame cost, how the 4x forest looks, whether the 14 u/s walk feels right. `window.__terrainChunks()` in the console reports chunk counts per LOD, triangles and queue depth; F3 shows the frame numbers.

Known follow-ups: Ember/Swamps supply roads (lanes derive from REGIONS, so they will follow the scale), wildlife/civilian counts per region are unchanged (sparser), swamps are drier than at 1x, `terrain-map.ts` samples the same number of pixels over a 4x area, atlas art ("MAP" tab) is the original picture.

## Forest mood pass (same change set)

* `LightShafts.tsx` + `light-shafts.ts`: crossed additive sunbeam cards (14 pooled, grid-keyed so they stay put), slanted along the live sun direction, strength from sun elevation, `skyEnv.cloud` and how deep the camera is inside Veridan; not mounted on LOW. Tested: placement, stability, strength rules. **Not seen in a browser.**
* `atmosphere.ts` Veridan: cooler, thicker green-blue air (fogScale 0.78, haze 1.3) with a warmer key light, for layered mist and visible beams.
* Not done yet: autumn-tinted broadleaf variation, valley mist cards, mossy-boulder and fern density review, stream bank props. Those need a look at real screenshots first.
