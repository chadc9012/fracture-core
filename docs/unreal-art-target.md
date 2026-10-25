# Unreal art target

The owner's three in-game target frames are the visual bar for the Unreal port. They're paintovers of the web build's
own HUD, so they show exactly what each scene should look like:

- `docs/reference/target-nexus-night.png`: a Nexus street at night
- `docs/reference/target-neon-night.png`: a Neon City boulevard at night
- `docs/reference/target-wilds-day.png`: an open-wilds road by day
- `docs/reference/sky-cycle.png`: the sky through the day (dawn → late night)

The web build gets as close as a laptop GPU allows (see `docs/visual-polish.md`). Unreal is where these frames are
meant to be matched. The port today is gameplay-only (stand-in blocks on a template map); this is the art plan for the world.

## What each frame needs, and the UE tool for it

| Frame element | Web build today | Unreal approach |
| --- | --- | --- |
| Dense glass towers with thousands of lit rooms | Procedural GLBs + generated facade map (`facade-windows.ts`), shader windows on district blocks | City Sample buildings (free, Epic) or modular kits; emissive window atlases with per-instance variation; Nanite for density |
| Wet mirror streets reflecting signs and lamps | Glossy asphalt + per-light streak decals (`wet-reflections.ts`) | Lumen reflections (or SSR) on a wet-asphalt material with puddle masks driven by weather |
| Neon signs, holo banners, light bloom | Emissive meshes + bloom pass | Emissive materials + Lumen GI so signs light the street; post-process bloom and lens effects |
| Elevated rail crossing the boulevard | `nexus-skyrail.ts` (two lines, shuttling train) | Same layout data exported as a spline; train on a spline mover |
| Flying traffic with light trails | `sky-traffic.ts` lanes | Niagara light trails on spline-following cars, reusing the exported lanes |
| Huge cracked moon, shards breaking off | Sky dome shader (`SkyDome.tsx`) keyed by `SKY_KEYS` | Sky Atmosphere + a lit moon mesh with an emissive crack mask whose colour follows the same keyframes |
| Puffy cumulus, golden morning, fiery sunset | 2D cloud plane in the dome | Volumetric Clouds, coloured from the `SKY_KEYS` table |
| Night nebula band | Dome shader | Sky sphere material, or a high-resolution HDRI layer |
| Floating islands with buildings and spiky undersides | Instanced cones on the horizon (`broken-horizon.ts`) | Nanite rock meshes (Megascans cliffs, inverted) with small buildings; same seeded layout |
| Dirt road with ruts, rocks and scrub, dust in the air | Road ribbons, verge scatter (`road-dressing.ts`), dust haze | Landscape with road splines; PCG scatter for rocks and scrub (Megascans); Niagara dust and height fog with light shafts |
| Saturated cinematic grade | `color-grade.ts` per region | Post-process volumes per region using the same grade values (or LUTs baked from them) |

## Data to carry over unchanged
Layouts are pure TypeScript and seeded, so the exporters in `unreal/tools` can emit them as DataTables. That way
both builds put things in the same places: `SKY_KEYS` (sky colours by hour), `REGION_GRADE`, `railLines`/`piers`,
`brokenHorizon`, `vergeScatter`, the road lanes, Nexus `buildings()` and the Neon tower layout.

## Hardware note
Matching these frames needs a desktop GPU (RTX 3060 class or better) for Lumen and Volumetric Clouds. The current
project targets Windows (UE 5.8). It can't be built or run from Claude's cloud workspace.
