# Trailer references → design plan

Two owner-supplied reference videos (October 2026). Each shot is mapped below to what it means for the game, and to what the game has.
Status words: **built** (code, tests), **live-checked** (seen in the running preview), **planned** (not built).

## Video A — "Fracture storm" (Kling, 15 s)

| Shot | What it shows | In the game |
|---|---|---|
| 0–3 s | A city block torn loose, floating over a storm sea, violet lightning crawling through it | Broken horizon islands (`broken-horizon.ts`, `BrokenHorizon.tsx`): built. Violet fracture lightning: storm bolts are now jagged violet with a fork, and storm flashes tint violet (`Actors.tsx` HazardMarkers, Scene storm flash): built |
| 4–7 s | Rain-slick neon street, cars, violet lightning crawling over a facade | Neon City wet asphalt, rain and fog already exist (`neon-tiers.ts`). Violet arcs crawling down the Aegis Spire every ~5.5 s (`facadeArc`, `FacadeArcs`): built |
| 8–11 s | Jungle-reclaimed city, armoured Operator, hovering drone, violet strike | NOVA field drone keeps station at the Operator's shoulder (`nova-drone.ts`, `NovaDrone.tsx`): built. Overgrown city ruins: planned (Wastelands/Verdant edge district) |
| 12–15 s | Operator on a cracked ledge over the skyline, violet energy, drone | Same drone; skyline vista: planned (a lookout point above Nexus) |

## Video B — "Opening shots" (Seedance, 15 s)

| Shot | What it shows | In the game |
|---|---|---|
| 0–2 s | Floating ruined islands at dusk above cloud | Broken horizon islands, one inverted city block: built |
| 3–5 s | A glowing tear in the sky leaking lines of code, sun on the horizon | Sky Rift in the sky dome (`sky-dome.ts` `SKY_RIFT`/`riftGlow`, `SkyDome.tsx`): white-hot seam, shattered-glass cracks, leaking code, violet edge; brighter at night and in storms. Replaces the old billboard tear (`FracturePortal`), which also showed through the sea at Thalassia: built |
| 5–7 s | Giant redwoods, god rays, a leaf frozen mid-fall with ripples | Time-glitch anomalies beside the Verdant trail (`glitch-anomalies.ts`, `GlitchAnomalies.tsx`): built. Forest light shafts already existed (`LightShafts`) |
| 8–10 s | Looking up a vertical city canyon, light streaks, a vortex in the sky | Fracture vortex over the Aegis Spire (`neon-tiers.ts` `VORTEX`, `FractureVortex`): built |
| 10–11 s | A glass shard tumbling through light streaks | Planned: shard pickups as the visual for fracture shards (currency) |
| 12–15 s | An inverted city hanging upside down, sky crack | Inverted island in the broken horizon: built (distant scenery only) |

The intro flythrough (`intro-camera.ts`) now opens on the broken horizon under the Sky Rift and tilts up the tear before sweeping to spawn,
following Video B's shot order.

All of the above is presentation only: none of it changes combat, rewards, saves or collisions.
