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

**Rift Gate — Fracture bosses** (`scripts/combat/boss.gd`, `boss_view.gd`, `boss_arena.gd`; the RIFT GATE button; asset
catalog gap 5): the six creatures on the owner's board — Rift Hound, Crystal Stalker, Abyssal Leviathan, Vyrak the Ashen
Covenant, Astravore, Rust Colossus — as boss fights at the Verdant Forest crash-site clearing on the authored boss / elite
hulls (models/bosses: frost-wolf, aberration-elite, abyssal-boss, skyborn-boss, aberration-boss, guardian-boss, scaled to
2.6–9 m). `boss.gd` is the web game's boss systems ported pure: three phases by hull (ENGAGED / OVERDRIVEN / OVERLOADED,
speed / damage / cooldown multipliers), poise from sustained fire (×1.6 per damage, 4/s decay) breaking into a 4 s stagger
at ×2.25 damage with a 6 s refractory, a weak point (×1.6) for 5 s on every phase flare, and an attack cycle per boss —
telegraph (red ring on the ground, the row's seconds ÷ phase speed), then LUNGE / SLAM (area hits), VOLLEY (bolts), BREATH
(a burning cone) or SUMMON (adds through enemies.gd, more per phase), then a cooldown. The HUD carries the boss bar with
hull, phase and poise; the core glows cyan in a punish window. A first clear pays the row's Nex / XP (600 / 400 for the
Hound up to 2500 / 1500 for the Colossus), repeats a third; `profile.boss_clears` remembers. Tests:
tests/combat/boss_test.gd. Shots: `boss[:<id>][:fight]`.

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
middle zone opens and whoever holds it takes it, first to 5 — and if nobody has taken it 60 s past the buzzer
(`OVERTIME_S`, pvp.ts), the side with more fighters standing takes the round, a tie replaying it for no point (Nov 11,
parity with the web clean-up). The bots step off when stuck (`enemies.gd` `STUCK_S`: wanting to move but going
nowhere for 1.2 s — a rail, a prop, a ledge corner — they walk 4 m in a fresh level direction and pick the way again;
`stepped_off` counts them for the tests). Shots: `killbox[:<arena>][:dominion|:freefall|:lockdown|:ascendancy][:fight]`. Shot: `killbox[:fracture|:prime|:skydock][:fight]`.

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

**Trees, rocks and weather** (asset catalog item 7; `scripts/region_flora.gd`, `scripts/region_weather.gd`): every region
deals its forest places out between species by a hash of their position — broadleaf oaks (they follow the seasons with
the conifers), cherry blossom (pink in spring, red in autumn, bare in winter) in the temperate regions and towns, baobabs
in Solara and the Wastelands, bamboo clumps among the Azure Isles and Shattered Reefs palms, and glowing alien flora
(stalks with pulsing teal or magenta bulbs) in the Crystal Badlands and on the Storm Islands. Vines hang and sway under
the floating islands. Eroded sandstone arches stand in the deserts and the badlands (and sea arches at the isles' and
reefs' waterlines), cave mouths open in the mountain and forest slopes, ice spires stand in groups on the ice. Lava now
flows: crust plates drift over molten seams that breathe. The Crystal Badlands' void rifts split upward as tall violet
tears with dark shards floating round them. Weather: snow falls round the camera on the ice and the high mountains, and
wherever winter comes when the header is on WINTER; lightning strikes round what the camera is looking at every few
seconds on the Storm Islands and in the Shrouded Swamps, flashing the scene. Shot option `bolt` strikes at once and holds.

**Portals, holograms, energy fields** (`scripts/vfx/fx.gd`, reusable): `portal()` is a dark ring on two footings with a
glowing lip, a swirling vortex inside (spiral noise pulled inward) and sparks drawn into it — the Nexus hub's RIFT GATE,
the Fracture Tear, the Void Rifts and the Wastelands' Vault Gate (12 m off the place, facing it). `hologram()` is a
projector, its light cone and a slowly turning figure with scanlines, rim light and flicker — globes over the cities'
plazas and campuses, figures over the shops, emblems over the venues (Nexus, Neon City, Thalassia, on the tallest roof
nearby). `energy_field()` is a hex-plated dome with a bright rim, rising pulses and a glow where it meets the ground —
over research stations (blue) and the vaults and bunkered bases (amber), sized to the buildings under it.

**Cinematics and voiced dialogue** (owner, Nov 9: "give it a Destiny feel … visuals for the cutaway and cutscenes for
storyline audio for dialogue"; two packages, see `docs/story/dialogue-integration.md`):
- `scripts/cinema/cutscene.gd` plays in-engine cutscenes on a shot list: camera moves between positions and look-at
  targets (or following Callables), letterbox bars, a filmic grade (vignette, teal-and-amber split, grain, chromatic
  fringe with the shake), wide-tracked title cards, voiced subtitles, score cues and effects from `audio/cinema/`,
  comic-style art cutaways, tap to advance and hold to skip. A newer `play()` takes over from one already running.
- `scripts/cinema/lines.gd` is the voiced-line index (`data/dialogue/voices.json`): every line of the owner's campaign
  draft and of Mission 01's opening, by id or by [speaker, text]. PLAYER lines play in the voice of the body the player
  built (`_m` / `_f` / `_r`). The mission's subtitles look every line up and play it, holding the subtitle for the line.
- `scripts/cinema/barks.gd`: ambient voices in every region's Street View (AMB_*), and one-off calls (`say(id)`; the
  races use it).
- Mission 01 (`scripts/mission/m01_cinema.gd`): "The Day the World Fractured" — sunrise over Nexus City and the
  apartment on a new game; the news, the disturbance, the sky splitting and NOVA's interface when the player watches
  the news (now the last step of a morning at home); the broken stairwell on 12 (the draft's Missions 01–02, the first
  power) the first time the player takes the stairs in the alarm; the new world and the title after the Breach.
  Captures: `--shot … m1:op-0`, `m1:fr-4` (from that shot index), `m1:fp-0`, `m1:nw-0`; `Mission.skip_cinema` skips them
  (the play test sets it).
- Voices: `tools/make_voices.py` (Piper local TTS from github.com/rhasspy/piper v0.0.2 voices, a cast voice per speaker,
  per-character treatment in ffmpeg; the owner's ten recordings from `assets-src/voices-provided/` are kept as
  recorded). Music and effects: `tools/make_cinema_audio.py` (synthesized). Re-run either after changing the lines.

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

**The front door and the loop** (`scripts/front/`, schedule step 7, Nov 9): the game now opens on a **title screen**
(`title.gd`, over the owner's Nexus City art) — CONTINUE / GAME MODES / WORLD MAP / NEW OPERATOR once an operator is saved,
NEW OPERATOR alone on a first launch, SETTINGS and ACCOUNT below. NEW OPERATOR runs the creator and then Apartment 12-04,
and the opening ends on the **Nexus street hub**, the game's home; CONTINUE goes there directly. The hub's systems are
**in-world doors** on the sidewalks (`street_slice.gd` DOORS: Apartment 12-04, the KILLBOX TERMINAL kiosk, the SKYWAYS
SHUTTLE and CRASH-SITE TRANSPORT stops, the RIFT GATE portal, the garage forecourt, the Galleria, the Skyline Casino, the
Sports District), each drawn as what it is with its name over it; walking up shows ENTER <name> (the ENTER button on touch,
"<name> · E" under the crosshair with a keyboard). The street's own overlays open in place; the others (`main.gd`
`_street_door`) open over the street, which is hidden and paused, not rebuilt, and comes back where you left it when they
close. **Settings** (`settings_store.gd`, `settings_view.gd`, `user://settings.json`): graphics tier AUTO / LOW / MEDIUM /
HIGH (feeds `phone.gd` — render scale, MSAA, shadows), look sensitivity and invert, Master / Music / SFX / Voices volumes
(the audio buses, for step 8), a simple HUD switch. The globe stays the travel map (WORLD MAP). The loop is played
headlessly by `tests/front/loop_play.tscn` (title → settings → CONTINUE → every door and back); shots: `--shot out.png
title`, `settings`, `slicewalk:doors`.

**Wear** (asset catalog part 2 §4, Nov 10): the creator's GEAR tab gained a WEAR section — a gold chain with the ▽ pendant,
hoop earrings, a steel watch with a lit face on the left wrist, a slim tactical backpack, two rings on the right hand —
any mix (`look.wear`, a list; robots wear none). `character_rig.gd` builds each piece upright at its bone's rest and
hangs it on a BoneAttachment3D, so it rides the bone through every clip. Hairstyles (48), beards, markings, glasses /
shades / eyepiece / earpiece and headgear were already there; casual shoes and formal clothing wait on the clothing
meshes (after Dec 4 per the roadmap). `--shot out.png char:male:m-veteran:GEAR:wear=chain+watch` renders it.

**Civilian life on the sidewalks** (`scripts/city/civic_props.gd`, asset catalog part 2 §3, Nov 9): vending machines
with lit fronts, ATMs, street food stalls (counter, awning, hot lamp, three stools), café seating under umbrellas and
stacks of delivery parcels with a hand truck, placed against the building faces of every Nexus and Neon tile (a prop
every ~22 m a side, mixed, clear of the hub's doors), each carrying a `size` footprint so the operator walks round them.
Primitives with a visibility range, so the static batch merges them into the tile's cells.

**Combat details** (asset catalog part 2 §5, Nov 9): shell casings eject from every shot (brass slivers thrown right and
up, tumbling, landing and lying for a moment; the fusion frame throws none; capped at 14 live so a burst on the phone
stays a few draws), bullet impacts leave a scorched disc on surfaces for five seconds, and enemies **flinch** when hit — a
jolt back along the shot and a lean that eases out (more for a headshot). With the gore setting and the blood colours
that makes four of the ten on the board.

**Destructible cover** (Nov 10, §5): in the Killbox the crates, barriers, vents, HVAC units, consoles and signs are
`Gunplay.Target`s with a hull by kind (`Arena.BREAKABLE`: crate 40, vent 60, barrier 70, sign 80, console 90, HVAC 120);
the structural cover (tanks, containers, pillars, monoliths, dropships, planters) stays solid. Bolts chip a prop (dust
of its own colour, no headshot, no kill, no scavenged ammo) and the last one breaks it: the mesh goes, a dozen chips
tumble out and land at its base (`Gunplay.debris`), the arena marks the row broken (`arena.break_cover(id)`) and
`arena.boxes()` leaves it out, so the operator's obstacle list — the one array the bots read for sight lines and for
their movers — loses the box in place (`_sync_obstacles`), the fracture event's rebuild keeps the gap, and the prop
never stands again. `tests/killbox/cover_play.tscn` plays it (12 checks); `killbox:prime:cover` shoots it. Holsters,
magazines, attachments, armour damage, energy shields remain.

**The Fracture set** (`scripts/vfx/fracture_set.gd`, Nov 9; asset catalog part 2 §9): builders for the fantasy and
dimensional dressing — emissive crystal clusters (one MultiMesh), floating ruins that drift and turn, energy conduits
with a scrolling core and rings, a relic container ringed with blinking inscriptions, and `arena_ring` for boss arena
structures (broken pillars, cables overhead to a halo, crystals, ruins). Placed at the Rift Gate's fight (centred on the
operator and the boss) and around the Stitched Neon Core (four pylons feeding the crown). Rift tears, the portal, the
hologram and the energy field were already in `scripts/vfx/fx.gd` and `region_flora.gd`; the Shattered Expanse regions
can take the set when they get their pass. The Rift Gate measures 247 draws / 0.73 M triangles on medium.

**Extraction** (Killbox, Nov 9; asset-gap item 2 closed): `killbox_match.gd` kind `extract` ports pvp.ts `stepExtract` —
the data core drops at the arena's objective, a team standing on it unopposed for 1.2 s takes it, the carrier runs it to
their own pad (the middle of their spawns, 4 m), it drops where the carrier goes down, lies 15 s untouched then resets
home; kills do not score; first to 3. `arena_view.gd` draws the core (a lit cube that rides over the carrier) and the two
EXTRACT pads, feeds the rules everyone's position, steers the bots (the carrier for its pad, the carrier's team around it,
the other team at the carrier or the loose core) and toasts the core's events. Ranked plays as Dominion to 150. Only
Fracture Royale is still hidden from the Godot picker. `tests/killbox/modes_test.gd` covers the rules.

**Ship** (schedule step 13, Nov 9, prepared): the `Godot APK` workflow gained a **release** job (run it by hand from the
Actions tab once the signing keystore is in the repository secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_USER`,
`ANDROID_KEYSTORE_PASS`) — a release-signed APK, version code from the run number, published as the `godot-release`
release; without the secrets it stops at the keystore step and says what to add. The `godot-latest` debug build keeps
publishing on every push with up-to-date notes. **Store screenshots** at phone resolution (1080 × 2340) are rendered
by the shot hooks into `docs/store/` (title, the Nexus street, Killbox, the Rift Gate, Skyways, Vyrak at the core, the
operator panel). Left for the owner: the keystore, the phone fps reading, and the cloud save checked both ways on the
phone (`cloud` from the title: sign in, save, load on the Mac).

**Polish, first pass** (schedule step 12, Nov 9 — the known items while the owner's playtest list is awaited): the
**simple phone HUD** (settings "Simple phone HUD", on by default; `touch_controls.gd simple()`) keeps the stick, FIRE,
JUMP and ENTER: sprint is the stick pushed to its edge, a tap on the weapon's name swaps, an empty magazine reloads
itself on the pull; RELOAD / SWAP / SPRINT come back with the switch off. The **gore** setting (OFF / REDUCED / FULL,
default reduced) drives `gunplay.spark`: off is a grey puff, reduced one spark in the target's colour, full a spray of
droplets that fall and a splash that lingers; colours follow the owner's board — troopers red, machines (drones) cyan
coolant, Fracture creatures violet, wildlife green (a target's `blood` meta). Kills return half a magazine to every
carried gun (`gunplay.scavenge`).

**Operator grenades** (`scripts/combat/grenades.gd`, owner ask Nov 10, port of the web's grenades.ts — same nine
grenades and numbers, damage ×10 for the Godot hull scale): each frame carries three of its own and equips one (saved per
frame in `user://grenades.json`). GOLIATH: Breacher Frag (heavy blast, knockback), Thermite (burning pool), Concussion
(wide stun). NYX: Shroud (smoke — bots see nothing in or out past 15% of their range), Tripmine (sticks, arms, goes off
when a bot comes within 3 m; two at a time), Tracer (marks: +33% from bolts and grenades for 6 s). CIPHER: Singularity
(pulls bots in, then bursts), Arc Chain (stuns and arcs to the three nearest), Rift Well (heals the operator's hull
9/s, bots in it fire at half rate). gunplay.gd owns and steps it, so every combat view has grenades with no wiring:
**J** throws and **K** cycles on the desk, **GRENADE** and **⟳** on the phone (hidden in the simple HUD); the read-out
sits above the weapon's name. Damage goes through `gunplay.grenade_hit` (the bolt's hit / killed signals); stuns and
marks are `Target.stun` / `Target.mark`, which enemies.gd and gunplay read; the operator's own team is never touched.
Test: tests/combat/grenades_test.gd.

**Act 1: the story past the forest** (`scripts/mission/descent.gd`, `cutscene.gd`, schedule step 11, Nov 9): the Fracture
Descent now runs fd-02 to fd-07, the web chain's words and rewards (quests.ts). After the forest, **fd-05 Crossing the
Shrouded Swamps** (region `swamps`, from the Drowned Ruins: hold out 90 s in the fog while patrols come out of the reeds,
then purge the Drowned Relay's three guards), **fd-06 Signals in the Static** (Neon City, the Underlink: hold the Blackout
Protocol terminal 30 s while the district answers with drones, heat rising), **fd-07 Full Lockdown** (Neon City, the
Directorate: three lockdown waves at the Stitched Neon Core, then **Vyrak, the Ashen Covenant** as the act boss — the
Rift Gate's boss rules and hull, counted as a Rift Gate clear). Each quest names its world; moving on rebuilds the
region under the same operator, guns, troopers and gear (wildlife in the wilds only). **Cutscenes** (`cutscene.gd`:
letterbox, an orbiting camera, speaker and caption, tap to advance, SKIP) open each quest and carry the owner's
recordings — Mara at the crash site, Dr Aris's World Anchor log from the terminal, Serik Vale's recording at the core,
Vaelith's first contact as the act's last word (Act 2 is the Ember Peaks) — with Vyrak's lines from dragon-covenant.ts
before and after the fight. The beats speak: `Cutscene.line(id)` takes a voiced campaign line (`scripts/cinema/lines.gd`; the forest arrival M06, Fixer
Sable in Neon City M11, Vyrak's Covenant of Ash M09 / M10 before, at the stagger and after the fight — the owner's
canon over the web's placeholder lines), and a written beat whose speaker and text are in the index is voiced too.
`tests/mission/descent_play.tscn` plays the whole act headless: the forest on foot, the
crossing, the fog skipped forward, the relay, the terminal under drones, three waves, Vyrak shot down, the Covenant.

**Economy and progression** (`scripts/progress/`, schedule step 10, Nov 9): one profile. Every mode pays through
`progression.gd` `grant()` — Killbox (a win 250 + 25 Nex a kill to 600, a loss 100 + 15; XP likewise), the Rift Gate
bosses, Descent quests, the Hollow Star, races, Skyways courses, Mission 01 — onto `user://profile.json` (cloud-merged).
The **level** follows the web's curve (level N needs N × 400 XP; the campaign ends near 11) and is worth +2 operator
power and +4 hull a level, applied wherever the operator fights. **Loot** lands in the inventory from every end: a Killbox
win rolls the elite pool (a loss the common one), a boss clear the boss pool every time, a Descent quest the elite pool.
Three **daily goals** are picked from a ten-goal pool by the day (play / win Killbox, drop 20 hostiles, land 8 headshots,
clear a boss, finish a quest or a race, fly 10 rings, drive 2 km, buy at the Galleria), count what you do in any mode and
pay once each; the last twenty payments are a ledger. The **OPERATOR** panel (`profile_view.gd`: level, XP bar, Nex,
power / hull, today's goals, recent payments) opens from the title (the button carries `LV · NEX · goals left`) and the
street's OPERATOR button. Tests: `tests/progress/progression_test.gd` (the curve, grants, the ledger, goals that count,
pay once and reset with the day).

**Phone performance** (schedule step 9, Nov 9): a **frame-time readout** sits bottom-right on every screen
(`scripts/front/perf_hud.gd`: fps · ms (worst) · draw calls · triangles · video memory, averaged over half a second, green
at 30 fps and above, amber under, red under 20; settings "Frame-time readout", on by default for the test builds). The
measured fixes behind it, all by graphics tier (`phone.gd`): every texture is **VRAM-compressed** (ETC2 / ASTC on Android)
at 1024 px, 512 for normal / roughness / metallic maps — before this the headless import left 379 textures lossless
(uncompressed in GPU memory); the `.import` files now ship in git (`.gitignore`) so the CI import cannot fall back;
static batching groups repeated props by what their materials look like, not which material object they hold (tinted
copies now share a MultiMesh; one-off copies stay plain nodes), merges primitives in 96 m cells on medium / 130 m on low
(48 m on high), stops shadows on props under 4 m (medium), fades small dressing at 95 m (medium) / 60 m (low) and parked
cars at 90 / 55 m; the sun casts one orthogonal cascade to 70 m on the phone (every caster drawn once for the shadow);
mesh LOD switches at 4 px (medium) / 8 px (low); crowds and traffic run at 70 % / 45 % of the desktop count. The Nexus
firefight (`--shot out.png slicewalk:fight perf:out.json`) went from 1382 draws / 1.56 M triangles to **1086 draws / 1.21 M**
on medium and **763 / 0.81 M** on low; Killbox, the Rift Gate, Skyways and the Descent sit at 200–600 draws. The gate is
the owner's S22 Ultra at 30 fps in that firefight; the readout is there to read it off.

**Sound** (`scripts/audio/`, schedule step 8, Nov 9): the Godot build has a mixer. Four buses (`default_bus_layout.tres`:
Master, Music, SFX, Voices — the settings sliders), the `Audio` autoload (`audio.gd`) behind the static front `Sound`
(`sound.gd`; scripts call `Sound.sfx("rifle")`, and in the headless `--script` tests, where autoload names do not
resolve, every call is a silent no-op). What plays: **cues** from `audio/sfx/` — every gun frame, reload, dry click, hit /
headshot / down, hurt, footsteps / jump / land, doors and the Rift portal, UI, captures and buzzers, boss roars and
staggers, explosions, engine / hover / rotor / jet / wind / water loops (`godot-world-fracture/tools/make_sfx.py` builds the set as layered
24 kHz WAVs, since the web's authored SFX live only on the Lovable CDN; an authored WAV of the same name replaces one);
**ambience** from `audio/ambience/` — the web's regional beds (forest-wilds, nexus-hum, swamp-marsh, underwater-city,
frost-spire, solara-dunes, wasteland-wind, ember-peaks) crossfaded by region or street style (`Sound.bed_for`); the
**radio** (`radio.gd` over `data/radio.json`, exported from `src/game/radio-stations.ts` by
`scripts/export-godot-radio.ts`): the owner's seven recorded stations as linear broadcasts — station ID, the rotation in
order, a commercial after every two programs, never mid-song; the archived spoiler episodes and ad are not exported and
never ship — playing in any car on the street (the RADIO button steps the dial and remembers the station); **music** on
the title (Vektor Lane's Night Drive); **voices** from `audio/voices/` — NOVA's first words at the Mission 01 surge and
Mara at the crash site (fd-02) are the owner's recordings; Vaelith, Serik Vale and Dr Aris's log wait for step 11. Tests:
`tests/audio/audio_test.gd` (the broadcast rules, every exported file present, the autoload playing headless) and the loop
play test's sound checks. Phone: 65 MB of audio, Ogg / MP3 streamed, WAV cues in memory.

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
# a screenshot without a window (xvfb): --shot <png> [garage[:shop[:car[:item,kit-racing,...]]]] [drive[:car[:throttle[:steer[:garage]]]]] [slice[night][coast|neon][walk[:run|:jump|:fight|:drive|:inventory|:shop[:haven]|:fire[:sniper|:fusion][:aim]]][:x,y,z:tx,ty,tz]] [mall[:view]] [casino[:view 0-8]] [sports[:view 0-7]] [descent[:fight]] [race[:go]] [slicewalk:district] [slicewalk:doors] [title] [settings] [killbox[:fight]] [cloud] [char[:body[:face[:TAB[:key=value,...]]]]] [select:<continent>] [map:<id>] [sat] [zoom:<factor>] [3d] [street:<place id>] [frames:<n>]
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

## Nexus City districts

The Nexus avenue (street_slice.gd, `style == "nexus"`) is the hub tile (Central Transit Plaza) and six streamed blocks, and
every block opens side streets into district courts built with the block by `scripts/city/nexus_districts.gd`:
Perimeter Wall & Operations and the Vanguard Command Citadel at the North Gate end, the Spire District, the Tech Faction
Central Tower (420 m, the tallest building in the game, always built) and Apex Gear, then south of the hub Rusty Trigger,
Cylinder & Co Heavy Motorworks, the Warrens, the Scrapyard Bazaar, and the Southern Docks / Marina & Aqua-Tech Shipyard at
the quay. Courts are tile-local boxes with obstacle markers; the avenue leaves each court's frontage to the court's own
blocks (`Nexus.in_frontage`, `_court_here`, `_in_mouth`). Apex Gear and Rusty Trigger sell from gear_store.gd
`shop_stock` / `buy_offer` (a daily stock); Cylinder & Co opens the garage on the `ironworks` shop. The casino is Neon
City's alone (the Neon City Grand Casino on the Neon hub). Shots: `--shot slicewalk:court=<id>[:still]`. Test:
`godot --headless --path godot-world-fracture --script res://tests/city/nexus_walk_test.gd`.

## Airports (owner, Nov 9)

Nexus City International (NXC, by day) and Neon City International (NEC, at night), after the owner's three reference
renders. The street's AIRPORT EXPRESS stop opens the city's own airport (`scripts/airport/airport_view.gd`): the
forecourt with the globe fountain, the check-in hall (TICKETS: one-way economy fares, refunds at 90%), the departures
board (`airport.gd departures`, live clock), the shops (Sky Duty Free → Nova Threads outfits, Aero Gear → Apex stock,
Cloud Nine Café), security (three lanes: through with a boarding pass from this airport or a hangar lease here), the
gate lounge with six gates and jet bridges, the apron door, the apron, taxiway and runway, the control tower and three
private hangars. **Weapons are stowed landside, in the terminal, the shops and the lounge; they come out on the
airstrip (apron / runway) and inside a hangar you lease**, and only once the story has armed the operator (Mission 01's
Surge). A leased hangar opens its door, keeps the aircraft you buy (helicopter / jet / airship) and has a target range;
YOUR AIRCRAFT → FLY takes one out over that city in Skyways (`skyways_view.gd region_id`). BOARD at your ticket's gate
plays the take-off and main.gd opens the destination: the other airport's arrivals hall (leaving it puts you on that
city's street) or the region on foot (`arrival_view.gd`, with a FLIGHTS desk home). Region airports (Nov 9, the owner's network, first three): Azure Isles International (AZI: island, lagoon, runway ends on
piers, seaplane terminal, resorts), Frostveil International (FRV: snow, falling snow, glaciers and peaks, pines, rescue
orange) and Solara Desert International (SOL: sandstone walls, a solar-panel roof, solar fields, dunes and mesas). Flights
to them land in their terminal; the forecourt EXIT walks you out into the region (`outside` signal → arrival_view.gd),
and that view's FLIGHTS desk walks you back in. Nov 10, three more, on the land the asset catalog gives their biomes: Thalassia Coast Seaplane
Terminal (THA: coast by the Verdant Forest, seaplanes, a submarine dock under a glass dome down to underwater Thalassia),
Obsidian Reach Airport (OBS, in the volcanic Ember Peaks: basalt, lava channels, smoking volcanoes, container stacks and
the heavy-lift airship) and Shattered Expanse Expedition Airfield (SHX, in the Crystal Badlands: giant rift crystals,
glowing cracks, floating ruins, a lightning storm). Aetherion and Eldergrove stay NOT YET OPEN (no land for them yet). The airliners are an authored model (`models/fleet/airliner.glb`, ~10k
triangles, built by `blender -b -P scripts/build-airliner.py`; its `Livery` material is repainted per airline; `-- --wide` builds `airliner-wide.glb`, the ~62 m long-haul that
stands on the remote stand, rolls down the runway and flies fares of 260 Nex and up), and each
airport's terminal has its own roof (`LOOKS` `roof_shape`: wave, tent, vault, terraces, gull, sawtooth, shards) and its own wall material for the plinth,
fascia and corner pylons (`walls`: plaster, ice, sandstone, timber, basalt, steel), frames, glass tint and hangars, and its own interior (`floor`, `ceil`, and a
check-in hall centrepiece `feature`: palm, hologram, ice sculpture, fountain, aquarium, lava pool, rift specimen). A flight
is a take-off and then a cruise over a cloud deck with a landing countdown (`TAKEOFF_S`, `FLIGHT_S`; SKIP ends it).
Shot a flight with `--shot <png> airport:<from>:board:<to>:<seconds>`. Each look is a `LOOKS` row in airport_view.gd. All rules are in `airport.gd`
(state in the profile under `air`, so it rides the cloud save); add an airport as an `AIRPORTS` row and a destination
as a `DESTINATIONS` row (a row with no region shows on the board as NOT YET OPEN: Aetherion, Eldergrove). Tests: `--script res://tests/airport/airport_test.gd` (rules) and `res://tests/airport/airport_play.tscn` (the
whole trip through main.gd). Shots: `--shot airport[:NXC|NEC[:x,y,z:tx,ty,tz]]`.
