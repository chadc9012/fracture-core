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
