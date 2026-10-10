# Verdant Forest — environment tracker

Status legend: **VERIFIED** = observed in a running build or by a numeric check that is part of the test suite; **UNVERIFIED** = written but never seen running.

## Environment limits of the last pass
The authoring sandbox could not install dependencies (the npm registry is unreachable: `bun install` fails with ConnectionRefused), so
there is no `node_modules`, no Vite build and no browser run. Nothing below marked UNVERIFIED has been looked at. Hosted asset URLs
(`/__l5e/assets-v1/...`) are served by the Lovable host and cannot be fetched from the sandbox either.

## Terrain, crater, mesh
| Item | Status | Evidence |
|---|---|---|
| Shared ground height (`forestRelief` inside `heightAt`) | VERIFIED (numeric) | `forest-relief.test.ts`: zero hills outside the region, authored ground level, ground continuous |
| Trail, spawn, ambush clearing walkable and dry | VERIFIED (numeric) | slope and height tests over every trail point |
| Impact pit continuity | VERIFIED (numeric) | **Bug found and fixed:** the pit was cut off by the forest-region radius, leaving a ~1.5 m cliff at the rim. Now covered by a 0.25 m-step continuity test |
| Mesh vs walked ground at the pit | VERIFIED (numeric) | The 2.5 m mesh misses the pit by 0.56 m; a local 4× patch (`terrain-refine.ts`) brings it under 0.25 m. Border lies on the coarse edges (no cracks), tested |
| Patch seam lighting (normals not welded at the seam) | UNVERIFIED | possible faint seam |
| Crater rim looks natural, no flat cut line at the buried nose | UNVERIFIED | needs eyes |
| Forest-edge transition does not change neighbours | VERIFIED (numeric) for hills (exactly 0 beyond the rim); the pit alone reaches past the rim by design |

## Crash site and dressing
| Item | Status |
|---|---|
| Hull layout, collision circles, route clearance | VERIFIED (numeric): circles never cover the trail centre-line, no trail point within 1.5 m of the hull |
| Hull geometry (procedural lathe), tear, ribs, nacelles, wings, cables | UNVERIFIED — never rendered |
| Hull floating/intersecting the ground | UNVERIFIED |
| Scan ring placement (mean ground at the scan radius) | UNVERIFIED |
| Scout wreck, crates: placement off the route | VERIFIED (numeric); ground contact and collision feel UNVERIFIED |
| Ruts and puddles follow terrain, no z-fighting | UNVERIFIED |
| Shadows and frame rate | UNVERIFIED (use the F3 readout) |
| Scorched/damaged vegetation, snapped trees, road shoulders, signs, guardrails, extra wreckage | NOT BUILT — deliberately not stacked on unverified visuals |
| Real spacecraft / utility vehicle models | NOT SOURCED — no verified licensed asset reachable from the sandbox; nothing imported |

## Asset manifest audit (`src/assets/polyhaven/*.asset.json`)
Thirteen entries, all hosted relative URLs under `/__l5e/assets-v1/`. Manifest metadata (size, content type) is consistent; **whether each URL
actually serves was NOT checked** — run `__forestAssets()` in the browser console for the live load report.

| Asset | Size | Type |
|---|---|---|
| `aerial_rocks_02.jpg` | 768 KB | image/jpeg |
| `brown_mud_02.jpg` | 515 KB | image/jpeg |
| `burned_ground_01.jpg` | 1009 KB | image/jpeg |
| `coast_sand_01.jpg` | 938 KB | image/jpeg |
| `dead_tree_trunk.glb` | 4674 KB | model/gltf-binary |
| `fern_02.glb` | 186 KB | model/gltf-binary |
| `fir_sapling.glb` | 1431 KB | model/gltf-binary |
| `forest_ground_04.jpg` | 1088 KB | image/jpeg |
| `island_tree_02.glb` | 2825 KB | model/gltf-binary |
| `namaqualand_boulder_02.glb` | 5018 KB | model/gltf-binary |
| `rock_moss_set_01.glb` | 1887 KB | model/gltf-binary |
| `shrub_02.glb` | 536 KB | model/gltf-binary |
| `snow_02.jpg` | 318 KB | image/jpeg |

## Browser checklist (to do in the Lovable preview or locally)
1. Open the console, run `__forestAssets()`; record loaded vs failed models and any console errors.
2. Walk the trail from the spawn to the scan ring; confirm the ring sits on the ground and the scan completes.
3. Look at the pit rim, the buried nose, the berm; check the patch seam and the hull against the ground.
4. Check ruts/puddles for flicker, the scout wreck and crates for ground contact; try to walk through them.
5. Press F3: frame rate, draw calls, triangles near the crash site.
6. Walk to the forest edge and confirm neighbouring regions look unchanged.
