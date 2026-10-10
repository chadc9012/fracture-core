# Reference photo brief: shaping the world from the map photographs

The 14 photographs that used to frame the star map are kept as **reference material only**: `docs/reference/world-photos/*.jpg` (cropped from a 1312 px concept picture, so 141-339 px wide: good for palette and composition, not for texture extraction). They are not bundled into the game and no longer appear on the map.

## What is wired into the game now (sky)

`src/game/sky-dome.ts` `REGION_SKY_MOOD` grades the sky per region from colours sampled out of the photos (mean of the top and upper sky bands). It blends in by time of day (golden hour / night / day), at most `SKY_MOOD_STRENGTH` (0.55) of the way, so the clock-driven gradient stays underneath; Scene passes the player's region through `SkyEnv.region` and SkyDome eases the result over ~2 s at region borders.

| Photo | Region | Phase | Zenith | Horizon/upper |
|---|---|---|---|---|
| Sunrise - Veridan Forest | veridan | golden hour | #8995cf | #c3b4bd |
| Sunset - Nexus City | nexus | golden hour | #97647c | #e67c48 |
| Sunset - The Wastelands | wastelands | golden hour | #a57886 | #c08574 |
| Night - Frostspire Mountains | frostspire | night | #0c3475 | #134897 |
| Storm - Ember Peaks | ember | night | #1d3a66 | #324f83 |
| Day - Solara Desert | solara | day | #abcbf6 | #7c97be |

Not used yet: Moon - Frostspire (similar blue to the night tile), Moonlight - Fracture Zone (#011c48 zenith; the Fracture Zone is not a single region, so no mapping), and the six close-ups below. Sampled colours are single averages of photographic sky, so treat them as a starting palette to tune by eye in the browser, not as final values.

## 3D features the photos show (what exists, what is missing)

I cannot generate or download 3D models in this environment (no access to Meshy / Poly Haven here), so nothing below was invented. "Missing" means a user-supplied GLB or a decision is needed (limits: rocks/cacti <= 3k tris, wrecks <= 6k, textures <= 1K, Y-up, 1 unit = 1 m, origin at base, licence in `.asset.json`).

| Photo | Feature | In the repo today | Gap |
|---|---|---|---|
| Trees, Sunrise - Veridan | tall firs, broadleaf canopy, mist shafts | PolyFoliage fir/broadleaf (real GLBs), regional haze | none for the look; perf budgets are the limit |
| Flowers | wildflower meadow, pink blooms | GroundCover flowers (procedural), forest grass cards | no authored flower GLB; could add a flower-cluster model |
| Lake / Ocean | clear teal water, shoreline | water mesh (`iso:water`, 180k tris) | water is heavy; shoreline foam/colour not tuned to the photos |
| Rocks, Sunset - Wastelands | red sandstone mesas and spires, jeep on dirt tracks | Wastelands terrain colour, supply roads | **missing**: sandstone mesa/spire GLBs, a jeep/vehicle model |
| Volcano, Storm - Ember Peaks | lava-veined cone, lightning, bridge over dark water | Ember terrain + lightning telegraph rules, lava-vein map tint | **missing**: a volcano cone and bridge model |
| Night / Moon - Frostspire | snow peaks, glowing spire tower | snow terrain colour, summit array landmark | **missing**: a lit spire tower model |
| Sunset - Nexus City | towers on a coast | Nexus buildings (procedural + building GLBs) | skyline silhouette not matched to the photo |
| Day - Solara Desert | river valley, grass and pines | Solara terrain | **missing**: arid rock/cactus models |
| Moonlight - Fracture Zone | rock pillars with a glowing tower | Fracture Moon in the sky | pillars/tower **missing** |

## Next steps that need a decision or an asset
1. Browser tuning of the sky moods (all six; unverified until seen).
2. Which of the missing models you want first; send GLBs (or approve a different source) and they plug into PolyFoliage-style isolated loaders with silent fallbacks.
3. Nexus rework (requested after the forest).
