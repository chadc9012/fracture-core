# World Fracture — Godot 4.6

The Godot version of World Fracture, moving over from the web game (`src/`) one piece at a time. The web game stays the source
of truth for world data until each system lives here.

So far: the **Planetary Director** — the canon "12 Continents, 7 Oceans" globe (spin, pinch, tap a continent) and every
**region map** (land cover, roads, buildings by use, places, Map / Satellite).

```sh
bun scripts/export-godot-data.ts          # from the repo root: writes godot-world-fracture/generated/ (gitignored)
godot --path godot-world-fracture         # run it
# a screenshot without a window (xvfb): --shot <png> [select:<continent>] [map:<id>] [sat] [zoom:<factor>]
xvfb-run godot --path godot-world-fracture --rendering-driver opengl3 --resolution 540x1170 -- --shot out.png map:nexus
```

`.github/workflows/godot-world-fracture.yml` builds the Android APK and publishes it as the `godot-latest` release.
