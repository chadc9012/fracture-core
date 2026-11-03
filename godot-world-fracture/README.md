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
boards with café seating. ENTER SKYLINE CASINO rides into the tower at the head of the block
(`scripts/city/casino_interior.gd`): the gaming floor (slot banks with live reels, blackjack, spinning roulette wheels,
craps, the round Gilded bar, the cashier cage, coffered chandeliers), the Level 60 penthouse (glass walls over the night
city, a grand piano, a kitchen and wine wall, a bedroom, the private crafting studio, a lit armory wall and the
equipment vault, a terrace with an infinity pool) and the Skydeck rooftop concert (truss stage, LED wall, speaker stacks,
sweeping beams, a band and a crowd dancing to the beat). SPORTS DISTRICT (`scripts/city/sports_district.gd`) holds
Pulse Arena, home of the Nexus Voltage (a maple court with full markings, glass backboards, a 22-row bowl of cheering
fans, ribbon boards and a centre-hung scoreboard, a game in progress), the floodlit Sunset Courts by the water (two
painted street courts, chain-link, a mural wall, bleachers, palms, pickup games) and Iron Pulse Fitness (squat racks,
benches and barbells, a dumbbell rack, kettlebells, a cable crossover, treadmills and bikes, heavy bags and a boxing
ring, mirrors and screens).

**Operator creator** (`scripts/character/`): the first launch opens it (afterwards it's the OPERATOR button). A lit
turntable of the operator — drag to turn — beside tabs for the body (male, female or robot on the Titan, Hunter or
Warlock frame), the 40 named faces from the web game, the ten sculpt sliders, skin tone (plating and optics for robots),
48 hairstyles built around the chosen head and 22 colours, eight beards, 26 scars, tattoos, paint and Resonance marks (up
to four), and glasses, shades, a cyber eyepiece, an earpiece and headgear. CONFIRM saves to `user://character.json`.
The cut heads are skinned onto the body's own skeleton, so they follow its idle; the sculpt, markings and beard are the
web game's (ported to `face_morphs.gd` and a generated skin shader). The catalogue comes from the web game:
`bun scripts/export-godot-character.ts` rewrites `data/character.json`.

**On foot** (`scripts/player/`, phase 2 of the owner's Dec 4 plan): the street slices open with the saved operator standing
on the sidewalk and a chase camera behind the shoulder. Phone: a virtual stick where the left thumb lands, look-drag on the
right half, JUMP and SPRINT buttons. Keyboard: WASD / arrows, Space, Shift, mouse-drag look. Movement is the operator's own
rules (`operator_player.gd`: a ground height function, obstacle boxes it slides around, the kerb stepped onto, a jump) rather
than the physics server, because the street is merged visual meshes with no collision shapes; `street_slice.gd` builds the
boxes from the props' sizes, the parked cars, the facade line and the garage shell. Clips idle / walk / run follow the speed.
Test: `godot --headless --path godot-world-fracture --script res://tests/player/operator_player_test.gd`. Shots: `slicewalk`
puts the operator on the street; `slicewalk:run` and `slicewalk:jump` drive the stick for the frames captured; plain `slice`
keeps the look-dev camera.

**Shooting** (`scripts/combat/`): the web game's three rifle frames — Auto Rifle, Sniper Rifle, Fusion Rifle (five-bolt
volley) — with its numbers (`weapons.gd`: damage, fire rate, burst, spread steadied when standing, mag, reserve, reload,
range falloff, headshot multiplier) and its authored rifle models in the operator's right hand. Bolts are hitscan from the
muzzle to where the crosshair points, stopped by the scene's obstacle boxes, with tracers, a muzzle flash, impact sparks,
recoil that settles and the combat stance. FIRE, RELOAD and SWAP on the phone; left mouse, R and Q on the desk. Practice
dummies stand on the Nexus sidewalk (hull 30; a plate hit scores, the head more) until the enemies arrive. Tests:
`--script res://tests/combat/weapons_test.gd`. Shots: `slicewalk:fire[:sniper|:fusion][:aim]` holds the trigger (aim turns
the crosshair onto the first dummy) and prints shots / hits / kills.

**Enemies** (`scripts/combat/enemies.gd`): Nexus City's cyber troopers on the robot operator bodies — Data Drone Scout
(rifle, holds 14 m, strafes), Data Drone Elite (fusion bursts, walks in), Executor (blade, runs you down), Grid Marksman
(one hard shot from 30 m) and a hovering Surveillance Drone — moved by the operator's own rules, patrolling a beat until
they see you (40 m, clear of the scene's boxes), then holding their range and shooting back with cyan bolts. The
operator has 100 hull (bar, red wash, regen after 4 s); at 0 you are DOWN for 5 s and stand again at the spawn. Downed
troopers stand again after 8 s. Test: `--script res://tests/combat/enemies_test.gd`. Shot: `slicewalk:fight` sprints down
the street into them and prints hull, deaths, kills and every trooper's state.

**Inventory and wardrobe** (`scripts/gear/`, phase 3): the web game's gear rules over its catalogues (`data/gear.json`, from
`bun scripts/export-godot-gear.ts`: the starter loadout, the 135 named weapons with the frame each fires as, the 51 armour
sets, outfits and cosmetics). The INVENTORY button on the street opens the screen: worn slots (Kinetic / Energy / Power /
Melee, Helmet / Chest / Gauntlets / Legs / Class Item), the bag per slot, tap to wear, operator power at the top, and for
armour slots a transmog row choosing which set's look the slot wears. What you wear is what you fire: the gun list is the
worn weapons (a looted Static Bow fires as the sniper frame, its power scales the damage); worn armour adds hull. Kills
roll drops from the catalogue's loot and boss pools (18% / 40% elite) into the bag. Saved to `user://inventory.json`.
Test: `--script res://tests/gear/gear_store_test.gd`. Shot: `slicewalk:inventory`.

**Cloud save** (`scripts/cloud/`, phase 3): the CLOUD button on the globe signs you in by an emailed magic link (opened on
the phone it lands back in the app through the same local callback; a code in the email also works) or with Google — the PKCE flow through the
phone's own browser, landing on `http://localhost:4321/callback`, which the app catches on a local port (the project's
redirect allowlist must carry that URL; no deep link or custom Android build needed) — keeps the
session in `user://session.json`, and syncs the operator (`character.json`), profile (XP, level, Nex), inventory and
Mission 01 progress into the same `player_saves` row the web game uses, under `data.godot`. A sync runs on launch and
whenever a view closes; each file keeps the later copy, the profile never loses XP and the bags join (`cloud_merge.gd`,
tested headless: `--script res://tests/cloud/cloud_merge_test.gd`); the web game keeps the newer copy on its own merges
(`mergeGodot`). Test: `--script res://tests/cloud/google_callback_test.gd`. Shot: `cloud` opens the panel.

**On foot ↔ driving** (`scripts/driving/street_car.gd`, phase 5): walk up to any parked car on the street and ENTER (the
prompt button on the phone, E on the desk) — it drives with the garage's build for that car (drive_profile.gd), stick or
WASD, the JUMP button becomes BRAKE, EXIT (E) gets out on the kerb side once it's slow. The car keeps out of the scene's
boxes (facades, props, the other cars, the garage shell) with three discs along its length and loses its speed on a hit;
its own box moves with it so the operator and the troopers walk around it where it parks. The chase camera rides behind the
car; the troopers shoot at it. Test: `--script res://tests/driving/street_car_test.gd`. Shot: `slicewalk:drive` takes the
nearest car and pulls out; the log prints the car's speed, hits and place.

**Traffic** (`scripts/driving/traffic.gd`): eight civilian fleet cars run the block's two lanes (right-hand traffic) on the
same car rules — holding the lane, keeping a gap to the car ahead, stopping for the operator on foot or in a car, and
pooling back to the far end when they leave the block. Their boxes move in the scene's obstacle list, so the operator,
the troopers and your car all keep out of them (and crash into them if you cross the line). Test:
`--script res://tests/driving/traffic_test.gd`.

**Nexus Speedway** (`scripts/racing/`, the RACE button on the globe): the first racing venue — a stadium oval with a
chicane laid as data (`track.gd`: a closed centreline, width, start line, pit lane, stands), built as asphalt and
red-and-white kerbs over grass with tyre walls past the run-off, two grandstands of coloured tiers under a roof with a
crowd, the pit lane with its wall and garages, and a start-light gantry. You race the car you last drove (its garage
build) from the back of the grid against three rivals who follow the centreline and ease off for the corners; five
lights, three laps, live positions and lap times, grass that cuts your grip, the best lap into `drive_records.json`
and the prize Nex (900 / 500 / 250 / 100) plus 150 XP into the profile. Rules are tested headless
(`--script res://tests/racing/race_test.gd`); the shot `race:go` skips the lights and lets the car drive itself.

**Mall shops** (`scripts/gear/shop_view.gd`, from the Galleria's NOVA THREADS and HAVEN HOME buttons): Nova Threads sells
the web game's outfits (gear.json) for the profile's Nex — owned ones are free to wear again, event outfits only during
their event — and the worn outfit tints the operator's plate and undersuit (`outfit_look.gd`) until clothing is modelled;
Haven Home sells furnishings for Apartment 12-04 (sofas, tables, lamps, rugs, art, a plant, a bed; `gear_store.gd` FURNITURE)
that appear in the apartment the next time you're home: the newest piece per room slot replaces the apartment's own (the
sofa, the coffee table, the rug, the bed) or joins it (a floor lamp, a framed print on the north wall, a fern by the window). Test: `--script res://tests/gear/shop_test.gd`. Shot: `slicewalk:shop[:haven]`.

**The Fracture Descent, fd-02 to fd-04** (`scripts/mission/descent.gd`, the FRACTURE DESCENT button on the globe): the
web game's quest chain after Mission 01, played on foot in the Verdant Forest region (region_3d.gd's new PLAY mode: the
exported terrain, buildings and trees with the shared operator, guns, troopers and gear). From the Fracture Crash Site:
fd-02 *First Resonance* clears five patrols that come out of the trees; fd-03 *Broken Signal* traces the signal through
three relay beacons to its guarded source; fd-04 *Into the Shrouded Swamps* walks to where the treeline ends. Rewards
pay the profile's XP and Nex; progress is `user://quests.json` (synced to the cloud). Shot: `descent[:fight]`.

```sh
bun scripts/export-godot-data.ts          # from the repo root: writes godot-world-fracture/generated/ (gitignored)
bun scripts/export-godot-character.ts     # from the repo root: rewrites godot-world-fracture/data/character.json
bun scripts/export-godot-gear.ts          # from the repo root: rewrites godot-world-fracture/data/gear.json
godot --path godot-world-fracture         # run it
# a screenshot without a window (xvfb): --shot <png> [garage[:shop[:car[:item,kit-racing,...]]]] [drive[:car[:throttle[:steer[:garage]]]]] [slice[night][coast|neon][walk[:run|:jump|:fight|:drive|:inventory|:shop[:haven]|:fire[:sniper|:fusion][:aim]]][:x,y,z:tx,ty,tz]] [mall[:view]] [casino[:view 0-8]] [sports[:view 0-7]] [descent[:fight]] [race[:go]] [cloud] [char[:body[:face[:TAB[:key=value,...]]]]] [select:<continent>] [map:<id>] [sat] [zoom:<factor>] [3d] [street:<place id>] [frames:<n>]
xvfb-run godot --path godot-world-fracture --rendering-driver opengl3 --resolution 540x1170 -- --shot out.png map:nexus
```

`.github/workflows/godot-world-fracture.yml` builds the Android APK and publishes it as the `godot-latest` release.
