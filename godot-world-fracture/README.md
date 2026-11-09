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

**District streaming** (`scripts/city/district.gd`, phase 5): the street slice is now a run of seven block tiles along
the avenue (260 m each; the authored block with the garage, mall and casino is tile 0 and always stands). Whatever carries
the camera — the operator or the driven car — is the focus: the tile it is on and its neighbours are **Active** (meshes,
props, parked cars, signs, boxes), the ring beyond is **Simulated** (no meshes, boxes kept, traffic ticking hidden), the
rest **Frozen** (obstacle slots parked out of the world). Tiles are built deterministically per index with the same
builders as the hub block under one root node, their boxes go into the shared obstacle list through index-stable slots
(traffic and the driven car hold indexes), and the focus tile only changes 18 m past an edge so standing on a boundary
never thrashes. Traffic lanes span the simulated extent and re-enter at its ends. Shot: `slicenightwalk:district` (walks
+z across the first boundary).

**Authored sets from the web build** (Nov 8): `models/fleet` now holds every web fleet GLB (30, 33 MB), `models/weapons`
the rifle frames plus pistol / shotgun / SMG / heavy / launcher / sword (12, 11 MB), `models/foliage` the three palms and
two trees (5 MB), `models/buildings` the 18 web buildings (10 MB) — about 105 MB of models in all, nothing over 7 MB.
`weapons.gd` fires SMG / SHOTGUN (8 pellets a shell) / SIDEARM / LMG / HEAVY with the web numbers and the gear export
gives every catalogue weapon its real frame (launchers fire as HEAVY for now). **Civilians** (`scripts/city/civilians.gd`):
ten walkers on the sidewalks of the active blocks, random catalog faces in casual tints, strolling, turning at the ends and
running from gunfire; not obstacles, not targets.

**Android fit** (owner, Nov 8: "upgrade game and rigged images to fit android"): `scripts/phone.gd` is the one phone
budget — every 3D view calls `Phone.fit_viewport` (2× MSAA + FXAA, 3D at 80 % scale, 2048 px shadow atlas on mobile; 4×
MSAA on desktop) and `Phone.fit_sun` (two-split 2048 px directional shadows, shorter distance, hard filtering); project.godot
sets the mobile shadow and LOD defaults and a 540 × 1170 base viewport for the S22 Ultra. Every model was put through
`blender -b -P scripts/fit-godot-android.py -- godot-world-fracture/models` — 1.91 M → 0.79 M triangles over 98 GLBs
(planter 87k → 13k, palm 20k → 7k, muscle car 80k → 12k, operator bodies 17–27k → 12k with skins, shape keys and the four
clips intact; leaf clouds are thinned by whole leaves, solids collapse with a 15 % floor, textures capped at 1024 / 512).
Rerun it after adding models; it skips anything already under its caps. The slice places a 13k planter every 36 m across
three streamed blocks, so the caps matter more than any one model.

**Nexus City by the references** (Nov 8, `docs/reference/nexus-city-*.png`): the Nexus slice opens at night (DAY toggles
back) with a violet-cyan city bounce instead of crushed darks, cyan bollard lights along both kerbs, WORLD FRACTURE
banners on the lamp posts, cherry blossoms between the palms, a monorail beam on pylons over the far lane with a
three-car train looping the district, three holo rings turning round the spire's crown, a DISTRICT 03 direction board by
the spawn (trading hub / armory / garage / arena / apartments) and five lit billboards carrying crops of the owner's own
concept art (`textures/billboards/`). Every block tile gets the bollards, banners, blossoms and track; the hub block adds
the rings, sign, billboards and train. Shots: `slicewalk` is now the night; `slicedaywalk` the day.

**Skyways** (`scripts/flying/skyways_view.gd`, the SKYWAYS button; asset catalog gap 3): aircraft and watercraft with the
web game's handling (`scripts/driving/vehicle_handling.gd`, a pure port of vehicle-handling.ts — RACER / OFFROAD / TANK /
JET / HELI / BOAT / SUB profiles, `step`, exits, chase distances; tests/driving/handling_test.gd) over the exported Nexus
City in region PLAY mode. Pick the Rift-Jumper helicopter (lifts from a hover), the Resonant Strike jet (needs 32 m/s on
the runway, sinks when slow), the Scrap-Iron patrol boat (rides the water, beaches on land) or the Hydro-Sub skiff (dives
between the floor and the surface). Aircraft start on the Nexus airport apron facing the clearest run, watercraft at the
seaport facing open water; eight rings make a course (over the roofs for aircraft, out across the water for boats) with a
Nex / XP prize, buildings are solid (a crash and hard landings cost hull; a wreck goes back to the pad). The Leviathan
cargo airship (AIRSHIP profile: slow, VTOL, wide turns) flies too. Phone controls in `fly` mode: stick = throttle / steer,
UP climbs, DOWN descends. Shots: `skyways[:heli|:jet|:boat|:sub|:airship][:go]`. On the street, the hub block parks the
Goliath heavy tank (pivots on the spot, drive_physics `pivot`) and the hover-car (floats 0.9 m) across from the garage —
ENTER them like any car; their numbers come from vehicle_handling.gd (`hull_perf`). Shot: `slicewalk:tank`.

**Wildlife** (`scripts/wildlife/`, asset catalog gap 4): `wildlife.gd` is the pure rule set, a port of the web game's
wildlife.ts with the board's behaviours added — prey (deer, boar, rabbit, fox, reptile) graze and wander inside a home
radius, freeze at the alert radius and bolt at the flee radius with the whole herd sharing one alarm; predators (wolf pack,
bear, panther, crocodile) stalk the nearest prey in sight, chase inside 12 m, catch at arm's length and feed a while, the
pack sharing its quarry; nocturnal species rest at home by day, diurnal ones by night; the raptor circles its range and
stoops on rabbits; songbirds feed, flush, circle and land elsewhere; fish school in their pond and dart from a swimmer, the
shark hunts them; the crocodile is the one land animal that enters water. `wildlife_view.gd` draws them — the fox is the
real rigged fox GLB (Survey / Walk / Run by speed; models/animals, CC0 model / CC-BY rig, see LICENSE-fox.md), the rest
are stand-in bodies in species colours with gaits, heads and wings until the Meshy animals land — and makes every ground
animal a gunplay target. The Fracture Descent forest is populated by `populate()`. Test: tests/wildlife/wildlife_test.gd.
Shot: `descent:wild`.

**Killbox** (`scripts/killbox/`, the KILLBOX button on the globe): the web game's arenas (`data/killbox.json`, from
`scripts/export-godot-killbox.ts` over `src/game/killbox-arenas.ts`) in Godot — Kaiju Complex first: six rooftops in two
blocks over a Neon City street, joined by the west catwalk, the billboard bridge and the east catwalk, with the cover,
ledges, parapets and stairs the data lists, neon trim, lit facades and the KAIJU sign. `arena.gd` turns the data into the
on-foot rules (roofs are the ground, `surface_at`; parapets, cover and rails are the obstacle boxes; `spawn(side,
threats)` picks the team spawn farthest from the enemy); `killbox_match.gd` keeps the score. Clash: your team of five
trooper bots against six (enemies.gd with teams — blue band for allies, red for rivals; allies fight the other team),
every elimination scores, first to 75 or the clock (10 min) decides. Falling below the kill plane is a death; respawns
go to the team spawns; the Billboard Blackout event douses the signs for 30 s. Winning pays 400 Nex / 300 XP, losing
150 / 120. The worn gear carries over (guns, hull bonus, outfit tint). The KILLBOX button opens the arena picker: Fracture
Floor (nexus-grid look; Grid Rewrite sinks the standing data pillars and raises others, swapping the obstacle boxes) and
Killbox Prime (prime-roof; Containment Lock rings the capture zone in glass) are built from the same data with their own
palette, sign and zone rings. Skydock (the other session's fourth map) plays through the same view with a dusk palette. **Modes** (Nov 8, after the
arena a mode picker lists what the map allows, rules in `killbox_match.gd` mirroring pvp.ts): Clash; Dominion — zones
A / B / C capture by unopposed presence in 5 s, a contested zone holds, every held zone ticks a point each 2 s on top of
kills, first to 150, rings recolour to the holder and bots walk to zones their team doesn't hold; Freefall — 12 players
each for themselves, a board of kills (the rival who last hit you takes yours), first to 20; Lockdown — 4v4, attack and
defend alternate, no respawns in a round, attackers win by a wipe or 10 s unopposed on the objective, defenders by a wipe,
the clock or an unopposed plant, first to 4 rounds; Ascendancy — 3v3, a wipe takes the round, at the 90 s buzzer the
middle zone opens and whoever holds it takes it, first to 5. Shots: `killbox[:<arena>][:dominion|:freefall|:lockdown|:ascendancy][:fight]`. Shot: `killbox[:fracture|:prime|:skydock][:fight]`.

**The planetary board's regions and seasons** (owner, Nov 8 21:43: "work on the rest of the regions and maps", with the
Planetary World Overview board): three more lands in `src/game/board-lands.ts`, built exactly like new-lands.ts (own ground,
cover, towns, roads, names; street map, satellite and 3D all from the same data; baked into `public/maps/carto`):
**Goldenreach Farmlands** (farmland: a patchwork of wheat — the new `crop` cover — green crops, pasture and ploughed earth on
a farm-lane grid, hedgerows, farmsteads with barns and silos, Windmill Ridge, Goldenreach Ranch, orchards, the river and its
mill, Harvest Hollow), **Azure Isles** (tropical isles, beaches, resorts: a jungle volcano with a crater lake, the Coral Bay
resort strip, Azure Marina and Shipyard, the Turquoise Lagoon, a lighthouse cay; the 3D view grows the city's palms) and
**Frostveil Ice Cap** (the ice sheet, crevasse fields, nunataks, an ice shelf with bergs, Frostveil Station, the Glacier
Cave). On the globe they open from Verdant Forest, The Shattered Reefs and Frost Spire. **Seasons**: the region 3D view's
header steps SPRING / SUMMER / AUTUMN / WINTER (it starts on the real calendar's season): the growing covers and every tree
recolour live — blossom and fresh green, gold and rust, snow on the ground and bare crowns where winter comes (not in the
tropics, deserts, volcano, ice or the deep). Shots: `map:<id> 3d`, `season:0..3`.

**The Town and Floating Islands regions, deepened** (owner, Nov 8 22:12: "start"): **Old Harrow** (`board-lands.ts`,
off Verdant Forest on the globe — Riverdale stays as it is because the live world plays there) is the board's town region:
a walled old quarter of crooked lanes and gabled houses round the market square and its stalls, the Guildhall · Quest Board,
the Gilded Tankard, smithy and stables, the cathedral and the Dawn Spire, gates in the walls, Harrow Keep and the castle on
its hill, three hamlets, the mill on the river, the canal and the King's Road, all under a dusk sky. Every region's low
houses, shops, civic and works buildings (under 18 m, outside the glass cities, Thalassia, the badlands and the ice) now
get pitched gable roofs instead of flat tops, and autumn and winter recolour only about half the trees so the conifers stay
green. **The Storm Islands** get 5–7 small islets drifting round each island, waterfalls pouring off the rims (scrolling
additive curtains), violet crystal clusters on top and hanging beneath, glowing violet light under the named islands,
tumbling debris (one MultiMesh, rotated and bobbed in the vertex shader) and a storm sky. Shots: `map:old-harrow 3d`,
`map:storm 3d`.

**Wet night and the street set** (owner, Nov 8 19:26: "better quality … add more … looks basic"; the target is
`docs/reference/nexus-city-*.png`): at night the street slice rains. `scripts/city/wet_night.gd` lays a thin additive
mirror over the road and both walks — the mobile renderer has no SSR, so the overlay marches the mirrored view ray through
the depth buffer (14 steps) and adds what the screen shows where it lands, blurred down the mips and smeared vertically
like wet asphalt, weighted by a puddle mask, rain-ring wobble and Fresnel; nothing is added where the ray misses, so dry
patches stay matte (skipped on gl_compatibility). The paving goes dark and glossy with puddles (`wet` in `paving()`), and
a GPU particle box of rain streaks follows the camera (700 on a phone). The Meshy street set (`models/city/street/`, made
from concept images in the owner's Meshy account, shrunk in the page to phone budgets): neon benches by the shopfronts,
holo info kiosks, drinks machines against the buildings, superbikes on the pavement, and on the hub block the NEXUS CITY
· CENTRAL DISTRICT gateway arch over the avenue (solid only at its pillars). Placed per tile by `_street_set()`.
Shot: `slice:look=x,y,z,tx,ty,tz` aims the look-dev camera.

**Game Modes** (`scripts/modes/modes_hub.gd`, the ⚔ GAME MODES button on the globe; the owner, Nov 8: PvP, Raids and
Races are separate modes): a hub of three tiles in the look of the owner's boards (`docs/reference/pvp-maps.png` — navy
panels with glowing edges, angled title plates, a picture per tile, a strip of modes and features), each opening its own
lobby, which hosts the mode's view so LEAVE comes back to the lobby. Bots fill every slot; online play comes later (the
owner's call). Tile pictures are `textures/ui/modes/<id>.jpg` (in-game shots; the coming PvP maps are crops of the board),
with a painted gradient when one is missing.
- **PvP**: every Killbox arena as a tile (straight into the match), the board's coming maps greyed, the PvP modes strip.
- **Raids**: Raid 01 · The Hollow Star (`scripts/raid/`): `hollow_star.gd` is the rules (pure; `tests/raid/hollow_star_test.gd`),
  `raid_view.gd` the scene on the shared operator / guns / enemies stack with a fireteam of five bots (team 1; three hold
  the pylons or conduits, two roam) against the void army (team 0, the trooper bodies tinted violet under the raid's
  names, no respawn). *The Broken Gate*: the Nexus subway gate hall, a cracked ring gate with the rift in it, three
  pylons that charge while someone of yours stands in their ring and drain while an enemy does, six waves; the gate holds
  when all three are online and the last wave is down, and that is the checkpoint (`user://raids.json`). *The Hollow
  Star*: the final chamber 3.8 km down — a round floor of stone rings over the abyss and Astravore (the web build's
  AstravoreBody: a colossal crowned upper body rising out of the abyss, arms that lift for a beam, a halo of plates, the
  star caged in its chest as the target, its colour by phase). Beams (a telegraphed line, then the beam from the star),
  shockwave rings to jump, guardians; Phase II shields the boss behind three conduits while the overload climbs; Phase
  III splits reality (half the floor burns, and it swaps); Phase IV exposes the core (double damage), collapses the
  floor inward and starts a 90 s overload clock. Eight shared lives; a wipe restarts the encounter. The first clear pays
  2500 Nex, the Hollow Star Lens (exotic) into the bag and the Starbreaker title; repeats 1200 Nex. Play test:
  `tests/raid/raid_play.tscn`. The middle four encounters are listed and greyed.
- **Races**: Nexus Speedway and the **Neon Night Circuit** (`track.gd` kind `street`): 780 m round Neon City's blocks at
  night — wet asphalt, lane paint, jersey barriers (striped on the corners) that are the track's edge (a car is held on
  the road and scrubs speed), street lights, towers on every free lot with lit windows and neon signs, a chequered line
  and banner; three laps against Ghost, Vex and Nightjar, who brake for the right-angle corners. Play test:
  `tests/racing/street_race_play.tscn`. Open-world races against other players are the greyed tile, waiting on online play.

Shots: `modes[:pvp|:raids|:races]`, `raid[:boss][:fight]` (fight = the operator fires at the fight and can't go down),
`street-race[:go]`.

```sh
bun scripts/export-godot-data.ts          # from the repo root: writes godot-world-fracture/generated/ (gitignored)
bun scripts/export-godot-character.ts     # from the repo root: rewrites godot-world-fracture/data/character.json
bun scripts/export-godot-gear.ts          # from the repo root: rewrites godot-world-fracture/data/gear.json
bun scripts/export-godot-killbox.ts       # from the repo root: rewrites godot-world-fracture/data/killbox.json
godot --path godot-world-fracture         # run it
# a screenshot without a window (xvfb): --shot <png> [garage[:shop[:car[:item,kit-racing,...]]]] [drive[:car[:throttle[:steer[:garage]]]]] [slice[night][coast|neon][walk[:run|:jump|:fight|:drive|:inventory|:shop[:haven]|:fire[:sniper|:fusion][:aim]]][:x,y,z:tx,ty,tz]] [mall[:view]] [casino[:view 0-8]] [sports[:view 0-7]] [descent[:fight]] [race[:go]] [slicewalk:district] [killbox[:fight]] [cloud] [char[:body[:face[:TAB[:key=value,...]]]]] [select:<continent>] [map:<id>] [sat] [zoom:<factor>] [3d] [street:<place id>] [frames:<n>]
xvfb-run godot --path godot-world-fracture --rendering-driver opengl3 --resolution 540x1170 -- --shot out.png map:nexus
```

`.github/workflows/godot-world-fracture.yml` builds the Android APK and publishes it as the `godot-latest` release.

## Whole-game playthrough and phone performance

`godot --headless --path godot-world-fracture --script res://tests/play/playthrough.gd` plays everything a player can reach
(garage, driving, every street style day and night with its overlays, the operator creator, every region's map and 3D view,
Mission 01, the descent, every Killbox arena, a raid, a street race, the speedway). It flags screens that don't open or
close, cars that don't move, leaked nodes and any node with a NaN transform. The mission play tests run as scenes:
`godot --headless --path godot-world-fracture res://tests/mission/descent_play.tscn` (also `m01_play`, `raid/raid_play`,
`racing/street_race_play`, `racing/speedway_play`).

Static scenery is merged after a build by `scripts/static_batch.gd`: primitive pieces by material per 48 m cell, repeated
models into MultiMeshes, lights fading with distance. Anything that moves or animates must carry `set_meta("dynamic", true)`
or it gets frozen into a batch. Measuring tools live in `tests/tools/` (`draw_breakdown`, `street_profile`, `overlap_scan`,
`region_spacing`); the `--shot … perf:<json>` capture writes draw calls and the heaviest nodes.
