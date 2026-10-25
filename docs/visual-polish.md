# Visual polish pass: forest density, operator colour, projectiles, cinematic grade

Status: **implemented**, **unit-tested** where the rule is pure (`src/game/visual-polish.test.ts`), **not browser-verified** (no browser or WebGL here, and the `.tsx` files could not be type-checked because `react`/`three` are not installed in this sandbox). Please check each item in the running game and report back.

Context from your screenshots: Intel Iris GPU, 10–24 FPS, 3.5–4.6M triangles, 830–950 draw calls, dpr 0.75. The game puts that GPU on the LOW tier (no post-processing, no shadows, no HDRI), which is why it reads flat and grey.

| Change | Where | Expected effect | Cost note |
|---|---|---|---|
| Clustered tree groves on top of the uniform scatter (14 grove centres, ~9 trees each, min spacing 2.6 m, trail/clearings/roads/rivers kept clear) | `forest-density.ts`, `Terrain.tsx` | thick stands with gaps instead of an evenly spread park; about +125 trees at full density (half at LOW) | tree draw radius cut 170 → 130 m to offset |
| More ferns, shrubs and saplings | `VerdantForest.tsx` | denser understory | already distance-culled (55–70 m) |
| Two-tone operator paint: operator trim colour on helmet, shoulders, gauntlets and shins; brighter armor floor; lighter emissive floor | `operator-paint.ts`, `OperatorModel.tsx`, `Scene.tsx` | no longer one flat grey plate; worn set pieces still take their set colour | none |
| Operator model starts downloading at once | `Scene.tsx` (`useGLTF.preload`) | shorter time on the plain procedural stand-in | none |
| Bullets: soft halo plus a long faint trail behind each shot | `Actors.tsx` | shots read as energy streaks | +2 pooled meshes per bullet slot (48 slots) |
| Ability casts (spells/magic/strikes): ring, dome, light pillar and burst tinted by effect, sized to the real radius | `spell-fx.ts`, `AbilityFx.tsx` | casts are visible; reads CAST events only, applies nothing | 6 pooled slots |
| Thrown stratagem beacons: glowing halo while in flight | `Actors.tsx` | the throw can be followed | 1 mesh per beacon |
| CSS cinematic grade (vignette + teal shadow / warm highlight) when post-processing is off | `cinematic-look.ts`, `CinematicGrade.tsx`, `GameCanvas.tsx` | cinematic look on LOW/MEDIUM/Safari at almost no GPU cost | one DOM overlay, `pointer-events: none` |

## Not changed / honest gaps
- There are no missile or projectile entities in the sim other than bullets and stratagem beacons, so there is nothing else to restyle. Enemy shots are audio-only events.
- Real shadows, HDRI lighting and SSAO remain tier-gated; this pass does not turn them on for weak GPUs.
- Performance claims need numbers from your browser (F3 / `?perf=1`): compare triangles and draw calls in Veridan before and after.
- If the extra trees cost too much, lower `GROVE.centres` / `GROVE.perGrove` in `forest-density.ts`.

## Grey operators and the white bullet dot (follow-up)

- **Cause of the grey operator:** `operator-paint.ts` raised dark armour colours with `lift`, which blends toward light grey, so the dark brown (Goliath), violet (Nyx) and indigo (Cipher) appearance colours all became grey. It now uses `vivid` (HSL: keeps the hue, raises lightness/saturation); neutral colours still fall back to `lift`. The operator's visor colour (orange / magenta / amber) is now the trim accent for helmet, shoulders, gauntlets and shins (Scene and the forge pass `trim={appearance.visor}`). Tests pin that the three default operators keep saturation and three distinct hues.
- **Starter armour in the forge:** the forge never received the worn gear, so its operators showed no plates. `StartMenu` now passes `worn` to `IdentityForge`, which passes it to `OperatorModel` (the same attachment the world uses).
- **Weapons in hand:** `weapon-props.ts` is a procedural starter prop per weapon (rifle, pulse, heavy, blade, four launchers) attached to `mixamorig:RightHand`; `OperatorModel` toggles the held one each frame from `held.current.weapon` (Scene passes its state; the forge shows each class's first loadout weapon). It is a carried pose, not an aimed one, and the hand-bone axes are assumed (barrel along +Z), so orientation needs a browser check.
- **White dot:** player bullets spawn at the player while the camera sits just behind, so the halo/core filled the screen. Bullet parts now fade in between 3 and 8 m from the camera, the flat muzzle-flash disc is gone, and the core/halo/tracer are about half the size.
- **Not browser-verified.** The `.tsx` changes are syntax-checked only.

## Sky dome, ground cover, terrain detail and painted map (autonomy batch 1)

All of this is **implemented and covered by automated tests where it is pure logic; none of it has been seen in a browser** (the shader and `.tsx` files are syntax-checked only).

- **Sky** (`sky-dome.ts` pure parameters + `SkyDome.tsx`): one analytic dome drawn over the atmospheric Sky: a sun disc with glow and silver-lined cloud edges, lit cumulus (a clear day keeps scattered cloud, overcast raises cover) plus thin cirrus, stars and a Milky Way band at night. Cloud octaves 3/4/5 for LOW/MEDIUM+/HIGH+. The moon, halo and extra starfield stay in `SkyBodies`. Colours warm toward orange at golden hour (tested). A GLSL compile error would only hide the dome, but it has not been compiled in a browser.
- **Ground cover** (`ground-cover.ts` + `GroundCover.tsx`): per-region flowers, bushes, small rocks and reeds with their own palettes (Veridan meadows, Wasteland scrub, Solara dry brush and orange rock, Frostspire pale shrubs and grey rock, Ember charred shrubs and basalt, Swamp reed beds and pale lilies), plus reeds and wildflowers along every wet river bank. Patchy meadows/thickets rather than a carpet; nothing on roads, the mission trail/spawn/crash/ambush pads, in river channels or in deep water (tested). One draw call per kind, wind sway in the vertex shader, mounted 4.5 s after the terrain; density 0.35/0.7/1/1.3 by render tier.
- **Terrain** (`terrain.ts`, `Terrain.tsx`): mesh grid 160 -> 210 segments (about 1.9 m); ground colour now has large-scale lush/dry patches and fine speckle, supply roads read as packed earth and river banks as wet mud.
- **Map** (`terrain-map.ts`, `WorldAtlas.tsx`): the tactical map paints the real continent (hill-shaded from the game's own heightAt/colorAt, ocean depth, lakes, rivers), draws supply roads and outlined labelled regions.
- Not done yet: a large sky body (Destiny-style sphere) is a style call waiting on the owner; no new tree species or new GLB assets; the main-menu/forge backdrop does not use the dome; performance must be measured with F3 (the earlier probe showed 10-15 FPS with ~4.5 M triangles on an integrated GPU, so the tree load is the real bottleneck, not these additions).

## Fracture Moon and authored sky wash

- `sky-dome.ts` adds `SKY_BODY` (fixed direction, angular radius 0.17 rad, i.e. a giant body filling the sky) and an authored zenith → horizon colour `wash` in `skyParams`, both pure and tested.
- `SkyDome.tsx` draws the body as a lit, cracked sphere (fbm surface, glowing fracture network, sun-side lighting, atmosphere rim, halo) before stars/clouds/sun, so clouds pass in front of it.
- Status: implemented and unit-tested for the parameters only. The GLSL has NOT been compiled or viewed in a browser; expect tuning once screenshots exist.

## Performance pass (from your F3 screenshots)

Measured by you on Intel / ANGLE Metal: 8-11 FPS, 5.6-6.5M triangles, GPU busy ~120 ms at 900x464 (dpr already at its 0.75 floor). That is triangle/light bound, not resolution bound.

What changed (all presentation; nothing touches gameplay):
- `src/game/perf-budget.ts` (+ tests): per-species triangle allowance per tier (MEDIUM: fir/broadleaf 280k each, shrub/fern 110k, rock 100k, log 50k; LOW x0.35, HIGH x1.9, ULTRA x3). `PolyFoliage` now draws the nearest instances until the allowance is spent, using each model's measured triangles per instance, so cost no longer depends on how heavy a downloaded model is. Rocks and logs always keep at least the 2 nearest.
- `RegionModels` (the ~100k-triangle rocks/trunks): shown nearest-first within a shared allowance (MEDIUM 220k) and only cast shadows on HIGH/ULTRA.
- Rocks and logs in the forest cast shadows only on HIGH/ULTRA (the shadow pass redraws every caster).
- `DistrictLight`: all district point lights share one evaluation and compete nearest-first for a tier cap (LOW 2, MEDIUM 4, HIGH 6, ULTRA 8). You had 8 point lights on.
- City mount radius (Nexus/Neon/Thalassia) is scaled by tier (MEDIUM x0.7).
- `src/game/quality-governor.ts`: if frames stay low once resolution is at its floor, the effective tier drops one level (never faster than every 8 s, never up, never saved) with an on-screen notice.
- F3 readout now names the heaviest meshes (terrain+trees, ground-cover, city:neon, foliage:fir, region-models:...) and prints an `operator paint:` section (paint path, material count, bones per region, chest/suit colours) to trace a grey operator.
- NOT done in this pass: forest density changes, lighting/exposure changes, projectile effect upgrades, a dev showcase scene. Not browser-verified; no production build or full type-check could be run (dependencies cannot be installed here).

## Map, compass, landmarks and hazard zones

- `compass.ts` is the one heading convention (north = world −z, east = +x). The HUD compass used `heading = −yaw`, which put N/E/S/W on the wrong sides relative to the map and minimap; it now uses `headingFromYaw`, shows 8 cardinals and a degree readout. The minimap arrow already matched the map.
- `landmarks.ts`: 25 regional landmarks + Neon City + Thalassia, positioned from region centres, each with a one-line history. Landmark-to-landmark trails (`LANDMARK_ROUTES`) are map data only; they do not alter terrain, convoy lanes or collision. Ember and the Swamps still have no graded supply road — adding lanes changes `sim.ts` convoys and terrain grading and is left as a decision.
- Discovery is `landmark-seen:<id>` in `progression.earnedRewards` (union-merged). Safe-zone hubs are known from the start. Discovery grants no rewards.
- `hazard-zones.ts`: six localized zones (drifting quicksand, telegraphed avalanche, spatial sink pull, trench heat, crevasse chill, fracture-tear gravity) stacked on the regional hazard via `combineHazard`; Scene applies speed/gravity/damage/pull. Damage goes through the existing hazard path (hurtPlayer floors hp).
- `world-story.ts`: eras, region history, per-region landmark story that reveals on discovery.
- Atlas: compass rose, zone/symbol/cycle legend (`MapLegend.tsx`), landmark pins, trails between known landmarks, hazard overlay toggle. Minimap: cardinals and hazard circles.
- Status: unit-tested (landmarks/hazards/compass/story), UI checked for syntax only — not browser-verified.

## Performance follow-up (from the user's F3 run, Oct 10)

Measured by the user (Intel / ANGLE Metal, 900x464, dpr 0.75): triangles fell from 5.6-6.5M to 0.3-1.9M, GPU busy 16-35 ms, but FPS only rose to 10-18 and 48-81 ms of each frame was "other" (neither JS nor GPU busy). Hypothesis, not yet confirmed: browser compositing, chiefly the full-screen `mix-blend-mode: soft-light` grade overlay, and a fixed GPU cost near 20 ms that does not scale with triangles.
- CinematicGrade is now one plain-alpha layer (no blend mode).
- F3 panel: press F4 to cycle isolation modes (UI hidden, sky, water, weather+wildlife, forest+ground cover, cities, shadows). One screenshot per mode shows what each layer costs.
- The automatic quality cap no longer goes below MEDIUM (LOW had cut foliage to 35% and swapped to procedural blobs: the "lost trees"). LOW's foliage scale is 0.6 when a player picks it.
- Far-forest proxies: fir/broadleaf instances beyond the detailed budget draw as ~20-triangle silhouettes (<=1800 on MEDIUM), so depth stays without real models.
- Title menu operator now receives the saved appearance/body type (it was painted with the class UI colour, hence pale blue).
- Destination map uses the painted terrain with compass rose, legend and known landmarks.
Status: unit-tested pure parts only; none of this has been seen in a browser.

## Oct 24 vision-gap pass (checked in the owner's browser on the live preview, Intel / ANGLE Metal)

Found by looking at the game on the owner's laptop, fixed, and (where the preview had rebuilt) re-checked there:

| Gap seen | Cause | Fix | Verified |
|---|---|---|---|
| Idle audio "a plane taking off, with static" | full-level held sine pad + flat-noise ambience WAVs with clicking loop seams | `ambient-mix.ts` levels, breathing pad, designed beds from `scripts/build-ambience.py` | live: −15.9 → −35.7 dBFS idle, no drone/hiss band; then ambience +3 dB |
| Nights went flat mauve-pink (Frostspire, Ember) | instability cue lerped fog 35% toward #ff2d55 | `INSTABILITY_FOG`: Fracture violet, max 24% | live: fog #a05374 → #6e6cac |
| Flat cyan ocean band at the horizon | Water.tsx ShaderMaterial had no fog chunks | fog uniforms + fog_vertex/fog_fragment | live |
| Half the grass near-black (Solara noon) | up-normals on a DoubleSide material get flipped per face | `ground-lit.ts` drops the flip for GrassField and the Verdant grass cards | live |
| Palm trunk filling the third-person view | palms never in the obstacle grid | `palmSolids` registered while the city is mounted | unit test |
| Ground cover ~1M tris every frame | whole-world instancing, no distance limit | `COVER_CULL_RADIUS` reselect like the trees | live: Verdant MEDIUM 3.8M → 2.7M tris |
| Ruin sites ~230 meshes (draw calls) | one mesh per stone | six instanced batches | headless: 50 → 8 draws for a ruin view |
| Homes as flat boxes | vertex colour only, bare panes | plaster triplanar, framed windows, shutters, chimney, gutters, railings | headless renders |
| Swamp moss as flat rectangles, black crowns | untextured planes; crowns #2f4a2a under the gritty grade | strand cut-out texture; murky olive crowns | headless renders |

Trailer shots built: shard-gain burst (`ShardGainFx`), skyline lookout above Nexus (`SkylineLookout`).

Owner decisions (Oct 24-25): the jungle-reclaimed city is built (`reclaimed-city.ts`); the 52 m region labels stay; the billboard cloud puffs (`CloudLayer`) are retired.

## Sky rebuild: the gritty war sky (Oct 25)

The owner disliked the sky and clouds. Three looks were rendered (`SKY_LOOKS` in `sky-dome.ts`: clear / gritty / fracture) and the owner picked **gritty**, now `DEFAULT_SKY_LOOK`.

- Clouds (`SkyDome.tsx`): cumulus on a curved plane with a coverage field (cloud fields with clear gaps), domain-warped billows and edge erosion, lit by two samples toward the sun (dark bases, bright sunlit tops, silver lining), aerial perspective into the horizon. Noise uses an arithmetic hash and rotated octaves: the old grid-aligned value noise drew square blocks.
- Noon horizon is pale blue-white (the cream noon horizon read as smog); the gritty look desaturates the sky and cloud colours.
- The Fracture Moon is a faint ghost by day (`moonDay`) and solid at night; the Sky Rift is dimmed by `riftK`.
- Fracture Storm: from underneath, the lens read as a tiled ceiling over Nexus (sin hash precision + aligned octaves). Fixed hash and rotated octaves, and the lens fades to a faint tint while the camera is under it.

Owner answers (Oct 24, asked directly): keep the floating region-name labels as they are; no jungle-reclaimed city ruins site for now.

## The sky board (Oct 25, supersedes the gritty pick)

The owner sent a sky board (`docs/reference/sky-cycle.png`: morning, noon, sunset, night and a 9-step strip dawn → late night) and said
"the sky transitions should look like this". It is now the `vivid` look and `DEFAULT_SKY_LOOK`:

- `SKY_KEYS` / `skyKeyAt(hour)` in `sky-dome.ts`: zenith, horizon, sun, cloud lit/shade, moon tint, crack colour and glow, nebula for each of the
  nine phases, eased continuously through midnight. `SkyDome` reads the game hour from `timeRef`. Weather greys the board colours.
- The Fracture Moon is solid all day and drawn in front of all but the lowest cloud banks; plate fractures (3D cell borders) are dark chasms
  by day, burn orange at sunset, pink at dusk, violet at night and blue-violet late at night. Rock shards break off its lower-right limb.
  SkyBodies' ordinary moon is hidden under this look (the board has one moon).
- Night: a violet/electric-blue nebula along the galactic band with denser stars.
- Clouds: separate heaped cumulus with cauliflower billows that catch the sun, bright white at noon, fiery at sunset; banks toward the horizon.
- The Sky Rift is nearly off (`riftK` 0.12): the board has no white tear.

## Target frames pass (Oct 25): "make everything look like these"

Reference: `docs/reference/target-nexus-night.png`, `target-neon-night.png`, `target-wilds-day.png` (in-game frames with the real HUD).
Supersedes the Oct 24 "gritty, held-back colour" grade direction.

- Grade (`color-grade.ts`): rich cinematic colour everywhere, blue-teal shadows and golden highlights by day; at night shadows sink to
  deep blue and highlights take the sodium warmth of the street lamps. Neon City keeps the richest grade.
- Post (`GameCanvas.tsx`): MEDIUM now runs the grade + bloom pass too (SMAA in place of the MSAA the composer loses); bloom is stronger.
  The adaptive governor still drops the stack when frames suffer.
- Wet streets (`wet-reflections.ts`, `WetReflections.tsx`, `city-surface.ts` `STREET_WET`): asphalt goes glossy and darker at night and
  in rain; every street lamp in Nexus and Neon gets a light streak down the road toward the camera (one additive instanced batch).
- Sky traffic (`sky-traffic.ts`, `SkyTraffic.tsx`): hover cars loop over Nexus, Neon and a corridor between them, above the skyline,
  with headlights, tail lights and engine glows that bloom.
- Floating islands (`broken-horizon.ts`): 24 more, smaller islands across the sky at 620–1340 m.
- Nexus signage (`nexus-signs.ts`, `NexusSigns.tsx`): tall banners and holographic figure screens on the street faces of the hub's towers,
  cyan light strips up the tall towers' corners; dim by day, overdriven at night so the bloom catches them.
- Atmosphere (`atmosphere.ts`): city nights are deep blue air instead of violet; the Wastelands by day are clear and warm.
- Fracture Storm debris: lit rock slabs instead of flat navy blobs.

## Target frames, pass 2 (Oct 25 afternoon)

Checked against the three target frames using headless captures of the real game (`window.__warp` + `__dev` at the same spots and times):

- Tower facades (`facade-windows.ts`, swapped in by `InstancedGlb.tsx` for every "WindowsLit" material): one room per bay per floor,
  floors banded dark / part lit / busy, mostly cool office white with warm rooms and rare cyan/magenta, ceiling falloff, blinds, pane
  mullions, faint blue unlit glass. Night glow raised so the bloom catches it.
- Nexus district blocks (`NexusDistricts.tsx`): narrower bays, taller glazing, about half the rooms lit, the same colour mix, a
  shared glow that brightens at night. Taller downtown (`nexus-districts.ts` FLOORS).
- Nexus sky-rail (`nexus-skyrail.ts`, `NexusSkyRail.tsx`): two elevated guideways over street lines with kerb-side portal legs, LED
  underside strips and a shuttling train, as in both city frames.
- Wilds verge scatter (`road-dressing.ts` `vergeScatter`, drawn in `RoadDressing.tsx`): rocks and dry scrub line every open-country road,
  distance-culled to 190 m.
- Floating islands: lighter sky-haze tint by day (they had washed out to pale ghosts) and a larger near set.
- Capture note: the headless captures lack the Lovable-hosted assets (`/__l5e/...`: ground textures, the sky HDR, NPCs), so the real
  game looks better than they do. The Neon "cyan beams" were the glowing edges of a street shelter above the spawn point, not a bug.
- Unreal art plan: `docs/unreal-art-target.md`.
