# World Fracture — Godot 4.6

The Godot version of World Fracture, moving over from the web game (`src/`) one piece at a time. The web game stays the source
of truth for world data until each system lives here.

So far: the **Planetary Director** — the canon "12 Continents, 7 Oceans" globe (spin, pinch, tap a continent) and every
**region map** (land cover, roads, buildings by use, places, Map / Satellite), including the two lands built for it
(Crystal Badlands and The Shattered Reefs, `src/game/new-lands.ts`) — and every region in **3D** (`scripts/region_3d.gd`):
the **3D City** orbit view and **Street View** at eye height, built from the exported heights, land cover, buildings (real
heights), roads, rings and places, each region lit after the owner's target frames (gritty day in the wilds with the
cracked planet overhead, the cities at night with lit windows and wet streets, Ember under ash, Thalassia under the sea).

**Garages** (`scripts/garage/`, the GARAGE button on the globe): five shops (Nexus Customs, Neon Performance, Ironworks
Garage, Sunset Kustoms, Fracture Dynamics), six cars from the web game's fleet on a turntable, and paint and finish, body kits (front and rear
bumpers, skirts, fenders, wings, hoods, exhausts, bull bars, roof racks, Street / Racing / Widebody presets), wheels and tyres,
performance, armour, lights and Fracture mods, drawn on the car before you buy. One order per visit is priced at the shop's
rates, gated by your standing there, and checked out all or nothing; repairs, credits and every car's build save to
`user://garage.json`. It merges the design of the owner's Unity garage packages into one system (catalog, order, state, kit,
view). Rules are tested headless: `godot --headless --path godot-world-fracture --script res://tests/garage_test.gd`.

**Driving** (`scripts/driving/`, the DRIVE button on the globe): the garage's six cars in a Nexus City practice district,
with keyboard, gamepad and on-screen controls, a chase camera, a boulevard and cross avenue (lane lines, zebra crossings,
kerbs, sidewalks, street lights, buildings), a four-checkpoint lap with best lap per car (`user://drive_records.json`), and
total distance per car (`user://drive_session.json`). What you fitted in the garage changes how the car drives, and damage
slows it. Park on the cyan Nexus Customs platform to open the garage over the street; the car comes back out with the new
build. Built from the owner's driving packages (stages 284-308 and 334-358); stages 309-333 never arrived, so their files
(road, boundaries, course, lap progress, lap records, session store) were written here to match. Tests:
`--script res://tests/driving/<test>.gd`. This is a practice district, not the full Nexus City map, and has no traffic AI or
collisions with the buildings.

**Nexus street** (`scripts/city/street_slice.gd`, the NEXUS STREET button): one block of a Nexus avenue at golden hour,
the first look-development slice toward the owner's concept frames. Wet asphalt with puddles that mirror the sky, warm
stone paving, mid-rise apartment blocks over shopfronts, glass towers behind, palms, planters, street lamps, a bus shelter
and a café terrace (Meshy-generated models in `models/city/`, decimated to game budgets), the fleet cars parked at the
kerb, low sun with long shadows, haze and volumetric light. Forward+ adds screen-space reflections, SSAO/SSIL and
volumetric fog; SDFGI is opt-in (`SLICE_GI=1`) because it couldn't be checked on the software renderer used for testing. The NIGHT
button turns it into the Las Vegas / New York version: lit towers, neon blade signs and shop signs for made-up in-world
brands, video billboards, street lamps on, and the wet street mirroring all of it. The MIAMI COAST button swaps the
block for the coastal city: pastel Art Deco hotels and Caribbean villas with terracotta roofs, pink terrazzo, palms on
every post, no glass skyline. The Nexus block mixes apartment, red-brick New York walk-up and glass office blocks with a
casino podium; all were made in Meshy for this. A third style, NEON CITY, is Hollywood and Long Beach after dark:
palms under twice the neon. Each city has its own drive-in car garage on the street (Nexus Customs, Neon Performance,
and Sunset Kustoms, a new beach-cruise shop on the coast) with the shop's sign in its colour and a lit workshop behind
the open door; ENTER opens the full garage for that shop. ENTER GALLERIA MALL walks into the Nexus Galleria
(`scripts/city/mall_interior.gd`): a two-level skylit atrium with a fountain, palms and escalators, shopfronts for the
in-world brands with their own displays (Nova Threads clothing, Haven Home furnishings, Quanta Electronics, Fade & Co
barbers, Velvet Salon, Ironclad Arms & Armor, Pulse Gym, Volta Mobile), and a food court of six counters under lit menu
boards with café seating.

**Operator creator** (`scripts/character/`): the first launch opens it (afterwards it's the OPERATOR button). A lit
turntable of the operator — drag to turn — beside tabs for the body (male, female or robot on the Titan, Hunter or
Warlock frame), the 40 named faces from the web game, the ten sculpt sliders, skin tone (plating and optics for robots),
48 hairstyles built around the chosen head and 22 colours, eight beards, 26 scars, tattoos, paint and Resonance marks (up
to four), and glasses, shades, a cyber eyepiece, an earpiece and headgear. CONFIRM saves to `user://character.json`.
The cut heads are skinned onto the body's own skeleton, so they follow its idle; the sculpt, markings and beard are the
web game's (ported to `face_morphs.gd` and a generated skin shader). The catalogue comes from the web game:
`bun scripts/export-godot-character.ts` rewrites `data/character.json`.

```sh
bun scripts/export-godot-data.ts          # from the repo root: writes godot-world-fracture/generated/ (gitignored)
bun scripts/export-godot-character.ts     # from the repo root: rewrites godot-world-fracture/data/character.json
godot --path godot-world-fracture         # run it
# a screenshot without a window (xvfb): --shot <png> [garage[:shop[:car[:item,kit-racing,...]]]] [drive[:car[:throttle[:steer[:garage]]]]] [slice[night][coast][:x,y,z:tx,ty,tz]] [mall[:view]] [char[:body[:face[:TAB[:key=value,...]]]]] [select:<continent>] [map:<id>] [sat] [zoom:<factor>] [3d] [street:<place id>] [frames:<n>]
xvfb-run godot --path godot-world-fracture --rendering-driver opengl3 --resolution 540x1170 -- --shot out.png map:nexus
```

`.github/workflows/godot-world-fracture.yml` builds the Android APK and publishes it as the `godot-latest` release.
