# Characters and world map (Oct 10 polish pass)

Status key: **implemented** / **unit-tested** / **browser-verified**. Nothing here is browser-verified in the live game yet; the offline previews below were rendered by a CPU rasteriser from the real shipped files, not by WebGL.

## Operators: why they looked blocky and grey/orange
Measured from the Meshy GLBs (scripts in the PR description): each body has only ~1,400 unique points / ~3,000 triangles (4-8 cm edges), no materials, and was painted by colouring *vertices*, so every colour boundary was a chunky triangle-sized patch and nothing separated armor from cloth or showed a face. Skin data was also truncated (three.js reads 4 of the up-to-24 influences; 2-8 % of vertices lost weight).

What changed (implemented, unit-tested, offline-previewed; not browser-verified):
- `src/game/operator-mesh.ts` (pure): one Loop subdivision step that respects UV seams, a smooth normal field, signed curvature, and "top 4 skin influences".
- `scripts/build-operator-hd.ts`: bakes `public/models/operators/<name>-hd.glb` from the Meshy originals (kept as the source). ~12k triangles each; skeleton, clips and UVs unchanged (verified byte-for-byte for every animation accessor). Re-run with `bun scripts/build-operator-hd.ts`.
- `src/game/operator-texture.ts` (pure): paints a texture through the UVs from interpolated region weights, so plate edges are as sharp as the texture. Adds seams between armor pieces, baked cavity shading and edge wear (from curvature), cloth weave, a value gradient, and a visor with a glowing slit evaluated per texel. `bakeTexels` (model-only, cached per model+size) is separate from `paintBaked` (palette pass, ~140 ms at 1024 on this box), so changing colours or armor never re-bakes.
- `OperatorModel.tsx` + `operator-skin.ts`: uploads `map` + `emissiveMap`; 768 px in the forge, 512 in the world. F3 diagnostics now report `texturePaint`, `textureSize`, `textureCovered`, `visorTexels`.

Honest limits: the body is still a ~12k-triangle mesh, not a hand-authored 40k hero asset; the paint is procedural, so there are no per-piece engraved details or a modelled face (the visor is the face). The face is assumed to look along +z (true for all three). Unverified in the browser: texture orientation (glTF v=0 first row, `flipY=false`), mip bleed at island borders, forge recolour latency, whether the visor reads at world distance.

## World map
- `terrain-map.ts`: a resumable raster job (the old one cost 1.5 s on the main thread at 420 px and froze the map screen). Cartographic style: depth-graded ocean with surf, lifted land colours, smoother hillshade, 10 m contours (index every 50 m), shoreline, soft rivers, lakes. 512 px (3.2 m/pixel, was 3.9).
- `useTerrainMap`: 96 px preview in ~100 ms, then the full image painted 12 ms per frame; shared by StarMap and the in-game atlas, with a "Surveying terrain" status.
- `map-labels.ts` (pure, tested): collision-free region labels (no overlaps, none on a marker, all inside the frame), nice scale-bar length, graticule.
- `MapLayers.tsx`: one shared set of layers for both screens (terrain, grid, cased supply roads, soft zones, markers + labels, compass, scale bar) replacing two near-duplicate SVG blocks; ocean-coloured background so the square no longer floats in dark margins.
Update (same day, from the reference image you sent): the hub **StarMap now shows the illustrated Fractured Earth** (`src/assets/fractured-earth-map-v2.jpg`, cropped from your concept; title, region names, legend and compass are part of the picture) with clickable hotspots from `src/game/map-art.ts` (tested: every region present, north up). The atlas "MAP" tab uses the same art. The painting is not the terrain, so it is only used where position does not matter; the in-game **tactical map stays on the real-terrain raster** (player dot, mission markers, hazards) and now has biome tints, forest canopy mottling, lava veins and snow caps. Discovered-landmark glyphs are no longer drawn on the hub map (they would not line up with a painting). Source art is 1158 px wide, so it looks soft on a large screen; a higher-resolution export would fix that.

Not done: (old) the atlas "MAP" tab is still the illustrated PNG; icons for landmarks are still text glyphs.

## Measured baseline from your F4 screenshots (Intel Metal, dpr 0.75, 900x506, all-on)
FPS 8-17, frame 58-120 ms of which render 9-16 ms and "other" 49-104 ms; gpu busy 26-33 ms, js busy 12-21 ms; 2.0-2.3 M triangles, 350-860 draw calls, 7 lights. Heaviest meshes: fir 276k, log 204k (two ~100k-triangle logs, from the "at least 2 instances" rule), water 180k, shrub 110k. The "other" 50-100 ms is still unexplained (it is not JS or GPU-busy time). Follow-ups: decimate the log/rock/shrub GLBs, find the "other" time with a Performance trace.

## Hub map: landmarks, high-res art and photo strips

- **Terrain view** (StarMap "Painted | Terrain" toggle): the real terrain raster through the shared `MapLayers` viewBox (the same world coordinates as the in-game atlas). Discovered landmarks (`isLandmarkKnown`) are drawn from `LANDMARKS` at their world x/z through that one transform; undiscovered ones are not rendered. No landmark data is duplicated. The tactical map in the atlas was not changed and stays on world coordinates; the painted art is never a coordinate source.
- **High-res art hook** (`useMapArt`, `hiresArtUsable` in `src/game/map-art.ts`): if `public/maps/fractured-earth-map-4096.jpg` exists, is an image, at least 2048 px wide and within 1% of the bundled aspect, it replaces the 1158 px art; otherwise the bundled image stays. **No such file exists yet: a higher-resolution export of the painting is still needed from the artist.** Nothing is upscaled.
- **Photo strips** (`MapStrips.tsx`, `src/assets/map-strips/*.jpg`, `MAP_STRIPS`): 14 tiles (4 top, 6 left, 4 bottom) cropped from the concept picture you supplied (1312 px wide, so tiles are only 141-339 px: they read as thumbnails, not originals). Decorative, aria-hidden, hidden below `lg`. Cleaner originals would replace these files 1:1.
- **Status**: unit-tested = aspect/usable rules and strip counts; module graph builds; **not browser-verified** (layout, hotspot alignment, strip sizing, terrain-view labels, HEAD probe behaviour all unseen).
