# Forest performance protocol (repeatable F3/F4 baseline)

Why: reported readings varied 6-23 FPS and 36-152 ms "other" between screenshots taken at different spots, tiers and moments. Changes below are **implemented and unit-tested, not yet measured**. Only measurements taken the same way before and after count.

## How to measure (same spot, same tier, same time of day)
1. Hard-refresh (Cmd+Shift+R) so the build includes commit after `06eb3fb`; confirm F3 shows `goliath-hd.glb paint:texture ...`.
2. Load the same save, stand at the same place (suggest: Veridan trail start, facing the ambush clearing). Set quality (MEDIUM, then LOW), do not move.
3. F3 on. Wait 10 s so the averages settle. Screenshot "all on".
4. F4 once per step, wait 10 s, screenshot each: UI hidden -> sky off -> **water off** -> weather+wildlife off -> **forest+ground cover off** -> cities off -> shadows off.
5. Record: frame ms, render ms, other ms, js busy, gpu busy, FPS, worst, calls, tris, heaviest meshes.
6. Take three runs (all on) to see the spread; a change is real only if it is outside that spread.

## What changed that this protocol should confirm
- Water patch: 180k triangles at every tier -> 22k LOW / 38k MEDIUM / 51k HIGH / 66k ULTRA (`src/game/water-grid.ts`). Same 8 m spacing near the camera (250/400/500/600 m by tier), coarser out to 64 m at the fogged edge. Shoreline and foam are fragment-shader (baked depth texture), unchanged. Expected: `iso:water` falls from 180k to the numbers above in "heaviest meshes"; the GPU-busy gain should show in "water off" vs "all on" deltas shrinking.
- Not changed: vegetation budgets (fir 276k, log 204k, shrub 110k, broadleaf 172k are the per-tier caps in `perf-budget.ts`). They are not reduced blind; the "forest+ground cover off" step shows what they cost.

## Known limits
- "other" time (36-174 ms) is not explained by triangles: render CPU is 7-22 ms and GPU busy 6-34 ms in the same frames. The water change cannot be expected to remove it. Candidates (unverified): compositor/present stalls on this Intel Mac, texture uploads, GC. A Chrome DevTools Performance recording of ~5 s would show it.
- Far swells now sample at up to 64 m spacing; if far water shimmers or looks flat in the browser, raise `WATER_INNER_HALF` or lower `WATER_MAX_SPACING`.
