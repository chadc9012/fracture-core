# Verdant Forest completion audit (Rule 1: audit before editing)

Status vocabulary: **EXISTS** (code present), **TESTED** (unit tests), **BROWSER** (seen running in a browser). Nothing below is BROWSER-verified by this audit: the sandbox has no installed dependencies (`node_modules` is empty) and cannot reach the hosted GLB/HDRI assets, so the game cannot run here. Browser items are marked NOT VERIFIED until the owner (or a session with a running preview) checks them.

## Baseline (taken 2026-10-10, HEAD 55cf7aa)
- Typecheck (`tsc --noEmit -p .`): 0 type errors; the only message is the sandbox's missing `vite/client` types.
- Tests (`bun test`): 853 pass, 2 fail, 2 errors. The errors are `Cannot find package 'react'` from `src/game/useKeyboard.ts` (reached via `regional-shops.test.ts`) and a second unhandled error in `loot-caches.test.ts`; both come from the sandbox lacking installed packages, not from the code. The 2 "fails" are the same two files. To be re-run in an environment with `bun install` before any claim of a green suite.
- FPS / frame time / draw calls / triangles: no new numbers. Latest owner readings (earlier in this project): Safari Apple GPU 8-13 FPS, frame 49-131 ms, tris 0.7-2.1 M, calls 139-765; Chrome Intel ANGLE: GPU busy 20-37 ms, JS busy 10-17 ms. `iso:forest` and `iso:sky` readings are still missing. See docs/forest-perf-protocol.md.

## Phase A - terrain
| Item | State |
|---|---|
| Heightfield, slope mask (dirt/bare rock), road grading, forest relief hills + crash pit | EXISTS, TESTED (terrain, forest-relief, verdant) |
| Region ground textures (forest_ground_04, brown_mud_02, burned_ground_01, aerial_rocks_02, coast_sand_01) | EXISTS (hosted JPEG assets), NOT VERIFIED |
| Trail, clearings, crash site, landmarks | EXISTS as pure data (verdant.ts, crash-layout.ts), TESTED |
| Cliffs / ravines / ridgelines beyond noise + relief | GAP: no authored cliff or ravine pass |
| Mud / moss / riverbank / shoreline material transitions | PARTIAL: slope + elevation mask only; no riverbank or wet-edge blend |
| Faceted distant terrain (owner report) | OPEN, cause not isolated |

## Phase B - vegetation
| Item | State |
|---|---|
| Real GLBs (Poly Haven CC0): fir_sapling, island_tree_02, shrub_02, fern_02, dead_tree_trunk, rock_moss_set_01 | EXISTS, HEAD-verified at runtime, culled and budgeted; NOT VERIFIED visually |
| Hero trees with detailed trunks/roots | GAP: only `island_tree_02` and `fir_sapling`; no hero-tree asset hosted |
| Moss rocks, fallen logs | EXISTS (rock_moss_set_01, dead_tree_trunk) |
| Flowers, branches, roots, boulders other than the moss set | GAP: procedural or absent (`namaqualand_boulder_02` ~100k tris, too heavy) |
| Wind sway, instancing, distance culling, tier budgets | EXISTS, TESTED (foliage-cull, wind-sway) |
| Cost of vegetation | UNMEASURED: per-mesh budgets up to 276k tris; the `iso:forest` reading is still owed. Per owner rule, no vegetation is added until costs are known |
| LOW tier | procedural stand-ins by design |

## Phase C - water
| Item | State |
|---|---|
| Ocean/lake patch: depth colour from baked terrain texture, fresnel sky blend, sun specular, shoreline foam band, whitecaps, tiered mesh density | EXISTS (Water.tsx, water-grid.ts), TESTED grid/style; NOT VERIFIED visually |
| Traced rivers, lakes, waterfalls from rivers.ts, flow shader, bank foam, rapids, plunge-pool foam, mist puffs | EXISTS (Rivers.tsx), TESTED (rivers.test.ts) |
| Normal-mapped ripples, planar/env reflections | GAP: no normal map or reflection probe; sky blend only |
| Wet rock / damp surfaces beside water | GAP |
| Shoaling, narrow channels drawn as sand (owner report) | OPEN |
| Underwater: murk, HUD overlay, buoyancy rules | EXISTS (underwater.ts, atmosphere.ts), TESTED rules |
| Shallow vs deep distinction for the player, no invisible walls, bridge collision | NOT VERIFIED (rules exist; no in-game test) |
| Waterfall audio | GAP: audio.ts has `playSplash` and footsteps incl. WATER but no stream/waterfall loop or distance emitters |

## Phase D - lighting / atmosphere
EXISTS: regional atmosphere, weather cycle, HDRI region lighting with Lightformer fallback, sky dome (far-plane pin fix `260df12`, user-confirmed gone), CSS grade, localized mist at waterfalls. GAP/OPEN: blocky sky patches (source not isolated; `iso:sky` screenshot owed), light shafts, canopy-shade transition. Rule from the command: do not change the sky fix.

## Phase E - interaction
EXISTS: landmarks and ruins with ledger-only discovery, checkpoints, respawn rules, quest bridge, caches (Y), shops, weapon-evolution ruins (U). Not verified in the running forest: enemy navigation versus dense vegetation/new terrain, collision on trees/rocks (obstacles.ts registers solids).

## Phase F - starter armor and weapons
| Item | State |
|---|---|
| Armor slots | 4 (helmet, chest, gauntlets, legs). The command also lists boots and shoulders: not slots today; would be a new-slot/save decision |
| Armor visuals | **PLACEHOLDER**: `armor-pieces.ts` is explicitly procedural primitive geometry parented to Mixamo bones, "not final art". Mix-and-match, stats (Defense/Mobility/Intellect), inventory display EXISTS and is TESTED |
| Authored armor GLBs | **MISSING**: none in repo. Integration path exists (one shape id per piece is replaceable) but no assets to plug in |
| Operators | Cipher has an authored textured GLB (`tint:false`); Goliath and Nyx use painted `*-hd.glb` bodies. Armor therefore cannot be shown on Cipher as separate pieces (its own material, no plates) |
| Weapons | Third-person held props are **PLACEHOLDER** primitives (weapon-props.ts, "NOT final art"). No weapon GLB exists anywhere in the repo. The first-person viewmodel group is in Scene.tsx; its geometry and presentation are NOT VERIFIED |
| Firing, recoil, reload, HUD, controller | EXISTS (weapons.ts, bindings, HUD); NOT VERIFIED on a pad |

## Phase G - audio
EXISTS: procedural biome/weather ambience, footsteps incl. water, splash, positional `where()`. GAP: dedicated stream/waterfall emitters, wind-in-leaves layer per forest density.

## Phase H - performance
Open from earlier work: React Scene/GameCanvas re-render about 10/s (HUD gate did not move it; true driver not found), Safari Apple GPU 8-13 FPS, "other" 42-98 ms unexplained. No vegetation or water additions should land before the `iso:forest` / `iso:water` / idle-F3 readings exist.

## Phase I - map
Done this session (55cf7aa, unit-tested, NOT VERIFIED visually): shared glyph table, legend matches pins, in-game map button/key. Still to check: forest region name/boundary on the painted map versus rivers/lakes/falls actually generated.

## What cannot be completed without something from the owner
1. **Authored 3D armor pieces** per class (helmet, chest, arms, legs, boots) and **starter weapon GLBs** (rifle, sidearm, heavy). Not in repo and cannot be invented; Meshy exports would work through the existing integration path.
2. **A running browser** (owner's preview) for every verification step in Phase J, including the missing F3/F4 isolation readings.
3. **Sign-off** on: adding boots/shoulder armor slots (save-shape change), and Cipher armor treatment (his authored mesh has no separable plates).

## Proposed milestone order (one controlled step at a time)
1. **Measure** (owner, ~10 min): idle F3 on MEDIUM, then `iso:forest`, `iso:water`, `iso:sky` screenshots at the Veridan trail start. Nothing else moves until these exist.
2. **Water (code, small, testable)**: wet-edge/riverbank colour blend in terrain colour, narrow-channel shoreline fix, waterfall/stream audio emitters (extending audio.ts), shallow-vs-deep rule check as unit tests.
3. **Terrain**: authored cliff/ravine pass in `forest-relief.ts` (wavelengths >= 8 m), faceted-distance fix once located.
4. **Vegetation**: only what the step-1 numbers allow.
5. **Equipment**: wire real GLBs when delivered; until then label the current gear as placeholder everywhere (inventory/forge), never "complete".
6. **Browser verification pass** against the Phase J checklist, reported item by item.

Current verdict: **PARTIALLY COMPLETE** on the existing code, **BLOCKED** for armor/weapons (assets missing) and for every browser-verification item (no live preview here).


## Water pass (approved follow-up) - status
| Item | State |
|---|---|
| Dry gaps in the carved river channel | FIXED in code, TESTED: measured 229 uncovered submerged samples before (4-5% per river, mostly river ends and bends), 0 after round caps (rivers.test.ts). NOT VERIFIED visually |
| Protected dry places never wet (spawn, trail, crash site, cover, land landmarks) | TESTED |
| Wet-edge / mud blend near channels, lake rims, waterfall spray; wet rock only darkens | IMPLEMENTED, TESTED (wetness.ts); baked into terrain colour once, no per-frame cost. NOT VERIFIED visually |
| Stream and waterfall audio | IMPLEMENTED (water-audio.ts + audio.ts), TESTED mix/lifecycle logic. **Synthesized filtered noise, not recorded samples; nothing has been heard.** Recorded loops would need hosted audio files (none exist). NOT VERIFIED by ear |
| Ripple normals, reflections | NOT DONE by instruction; follow-up items |
| Shoaling, narrow ocean inlets drawn as sand on the painted map | NOT DONE: the ocean/lake painter was not changed; needs a map screenshot to target |
| Test suite | `rng.ts` extracted so pure rule modules no longer import React (this was why `loot-caches` and `regional-shops` tests could not load). Result: 878 pass, 1 fail |
| Remaining failure | `loot-caches.test.ts` "drop rate tracks rarity": the generated world contains **zero LEGENDARY caches** (5 common / 14 rare / 23 epic), so `find(LEGENDARY)` is undefined. Reproduced on the pre-water-pass commit, so it is older and was masked by the missing-React load error. Fix needs a reward-economy decision (let a cache roll legendary, or change the test); not changed here |
