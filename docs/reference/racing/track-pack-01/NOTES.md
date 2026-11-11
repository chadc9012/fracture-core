# Track Pack 01: the owner's race tracks (Nov 11 2026)

Sent by the owner on Nov 11 at 08:23 with the "Racing Expansion · New Race Tracks" board (`racing-expansion-board.png`). This is
input for the racing session's claim on TASKBOARD (item 3, "Track Pack 01's eight long routes"); it is filed here, not built,
because that session holds the racing work.

## What is in it

- 8 GLB track meshes (road, shoulders, dashed centre line, checkpoint posts, start/finish), full scale in metres.
- `tracks.json`: per track `centerline_xyz` (240 samples, closed loops), `checkpoints` (12), `road_width_m`, `environment`,
  `target_km`.
- `PLAYABLE_RACING_DEMO.html`: the owner's top-down 2D driving proof of concept (W/A/S/D, Space handbrake, R restart).

| Track | Board region | Type | Length (measured) | Road width | Height range |
| --- | --- | --- | --- | --- | --- |
| Neon Midnight Run | Neon City | Street / underground, 3–5 laps | 12.0 km | 38 m | flat |
| Neon Ring Express | Neon City | Highway circuit, 3–7 laps | 24.0 km | 48 m | 1–17 m |
| Nexus Grand Prix | Nexus City | Professional circuit, 5–10 laps | 18.0 km | 42 m | flat |
| Nexus Outlaw Highway | Nexus Region | Highway / pursuit, 1 lap | 42.0 km | 44 m | 1–17 m |
| Glass Flats Rally | Solmara | Desert rally / off-road, 1 lap | 86.0 km | 75 m | flat |
| Frostveil Summit | Frostveil | Mountain / drift, 2–4 laps | 54.0 km | 52 m | −26–13 m |
| Azure Coastal Rush | Azure Isles | Coastal / scenic, 3–6 laps | 32.0 km | 48 m | 2–8 m |
| Azure Hover Challenge | Azure Isles | Water / hovercraft, 3–5 laps | 28.0 km | 65 m | flat |

On the board but **not in the zip**: Eldergrove Circuit (36.8 km, forest / technical), Obsidian Volcano Run (67.4 km,
volcanic / endurance), Shattered Expanse GP (59.7 km, fracture / high risk).

## Things to settle before building them (found when checking the files)

- **Scale.** The loops are 12–86 km at full scale. The Godot driving areas today are street slices and regions a few km
  across, so most of these need their own region or a scaled course (the board's "race distances" table lists them as
  intended lengths).
- **Road width.** 38–75 m is three to six times a real road (Nexus Speedway's track is about 14 m). Likely a modelling
  default; check with the owner before building to it.
- **Terrain.** The centre lines are flat or gently ramped, not fitted to any region's ground (the README says so).
- **Coarse samples.** 240 points per loop is a point every 50–360 m; the Godot `track.gd` Catmull-Rom centre line will
  smooth them, but corners on the long tracks will be soft.
- **Board names vs the canon map.** The board's globe uses names that differ from the canon "12 Continents" map
  (Aetherion, Eldergrove, Solmara, Frostveil, Obsidian Reach, Azure Isles, Shattered Expanse); the owner may want them
  mapped onto the canon continents (Frost Spire, Ember Peaks, The Shattered Reefs, …).
