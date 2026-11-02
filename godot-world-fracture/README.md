# World Fracture — Godot 4.6

The Godot version of World Fracture, moving over from the web game (`src/`) one piece at a time. The web game stays the source
of truth for world data until each system lives here.

So far: the **Planetary Director** — the canon "12 Continents, 7 Oceans" globe (spin, pinch, tap a continent) and every
**region map** (land cover, roads, buildings by use, places, Map / Satellite), including the two lands built for it
(Crystal Badlands and The Shattered Reefs, `src/game/new-lands.ts`) — and every region in **3D** (`scripts/region_3d.gd`):
the **3D City** orbit view and **Street View** at eye height, built from the exported heights, land cover, buildings (real
heights), roads, rings and places, each region lit after the owner's target frames (gritty day in the wilds with the
cracked planet overhead, the cities at night with lit windows and wet streets, Ember under ash, Thalassia under the sea).

**Garages** (`scripts/garage/`, the GARAGE button on the globe): four shops (Nexus Customs, Neon Performance, Ironworks
Garage, Fracture Dynamics), six cars from the web game's fleet on a turntable, and paint and finish, body kits (front and rear
bumpers, skirts, fenders, wings, hoods, exhausts, bull bars, roof racks, Street / Racing / Widebody presets), wheels and tyres,
performance, armour, lights and Fracture mods, drawn on the car before you buy. One order per visit is priced at the shop's
rates, gated by your standing there, and checked out all or nothing; repairs, credits and every car's build save to
`user://garage.json`. It merges the design of the owner's Unity garage packages into one system (catalog, order, state, kit,
view). Rules are tested headless: `godot --headless --path godot-world-fracture --script res://tests/garage_test.gd`.

```sh
bun scripts/export-godot-data.ts          # from the repo root: writes godot-world-fracture/generated/ (gitignored)
godot --path godot-world-fracture         # run it
# a screenshot without a window (xvfb): --shot <png> [garage[:shop[:car[:item,kit-racing,...]]]] [select:<continent>] [map:<id>] [sat] [zoom:<factor>] [3d] [street:<place id>] [frames:<n>]
xvfb-run godot --path godot-world-fracture --rendering-driver opengl3 --resolution 540x1170 -- --shot out.png map:nexus
```

`.github/workflows/godot-world-fracture.yml` builds the Android APK and publishes it as the `godot-latest` release.
