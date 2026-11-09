# World Fracture — render asset catalog (owner's boards, Nov 8 2026)

The owner's three boards are the asset reference for the game. Pictures: `docs/reference/asset-catalog.png`,
`docs/reference/asset-catalog-part2.png`, `docs/reference/pvp-maps.png`. Every item below is one the game needs to render;
the **Have** column is what is authored today (`public/models/` for the web build, `godot-world-fracture/models/` for the
Godot build — the Godot build copies from the web set as systems move over, so "web" means it exists and can be copied).
Anything else is a procedural stand-in or missing. Sessions adding assets update this file.

Direction, standing: gritty realistic everywhere, neon cyberpunk in Neon City; authored GLBs or the detailed generators, never
raw low-segment primitives (AGENTS.md).

## Character sheets (Nov 8)
`docs/reference/characters/armored-operator-turnaround.png` (front / side / back, blue-lit black armour with red accents) and
`hunter-raider-turnaround.png` (the white-haired hunter in the torn coat, the red-haired raider in the layered skirt) are
the briefs for three rigged player bodies / outfits. Pipeline: Meshy image-to-3D from the front view with the side and
back as references → Meshy rig (humanoid) → `blender -b -P scripts/fit-godot-android.py` caps them at 12k triangles / 1024
px → `godot-world-fracture/models/operators/bodies/` once the skeleton is checked against character_rig.gd's bone names.
Status: briefs saved; Meshy generation waits on the owner's account (the API is not reachable from the build sandbox).

## Part 1 — core categories

| Category | Items on the board | Have |
| --- | --- | --- |
| Environments & biomes | Nexus City (metro), Neon City (cyber), Verdant Forest (tropical), Solmara Desert (arid), Frostveil (arctic), Obsidian Reach (volcanic), Azure Isles (coastal), Thalassia (underwater), Shattered Expanse (reality rift) | all nine exist as terrain/regions in the web build (terrain.ts, new-lands.ts); Godot renders any exported region (region_3d.gd) |
| City & world builds | Apartments (12-04), Residential, Commercial, Industrial, Corporate, Research Lab, Faction Base, Dungeon (interior) | web: 18 building GLBs + Neon towers; Godot: 34 city GLBs + the 18 web buildings (models/buildings; nexus-civic / terrace and neon-block / tower join the slice's street wall); Apartment 12-04 interior built (Mission 01); research lab / faction base / dungeon interiors procedural |
| Vegetation | Palm, Oak, Pine, Cherry Blossom, Baobab, Bamboo, Alien Flora, Bushes, Grass, Vines | web: 5 foliage GLBs + Lovable-hosted ferns/shrubs; Godot: the 5 copied (models/foliage, the three palms on the Miami Coast slice); cherry blossom, baobab, bamboo, alien flora, vines missing |
| Rocks & terrain | Boulder, Cliff, Rock Spire, Arch, Cave Entrance, Crystal Formation, Volcanic Rock, Ice Formation | procedural (organic-geometry.ts organicRock, wild-geometry.ts basalt/obsidian); arch, cave entrance, ice formation missing |
| Vehicles | Sports Car, Muscle Car, SUV / Off-Road, Motorcycle, ATV / Buggy, Truck (Heavy), Tank, VTOL Aircraft, Jet, Helicopter, Cargo Airship, Boat / Yacht, Submarine, Hovercraft | web fleet: 24 GLBs (cars, trucks, bikes); Godot fleet: all 30 (web set copied Nov 8); the helicopter, jet, patrol boat and sub fly / sail in Skyways with the web's handling rules (Nov 8); the Goliath tank and hover-car drive on the street, the Leviathan airship flies in Skyways (Nov 8). Yacht and a true hovercraft hull still to author. Tank, VTOL, jet, helicopter, airship, boat, submarine, hovercraft: web has flight/boat rules (aerial-warfare-audit.md) but few authored hulls |
| Characters & NPCs | Player (customize), Civilian, Security, Faction Operative, Scientist, Merchant, Trainer, Rival Operator, Boss / Elite | web: 18 operator GLBs, 3 NPCs, 21 enemies, 6 robots, 2 bosses; Godot: operator built by character_rig.gd from character.json; Godot civilians are catalog faces on operator movers (scripts/city/civilians.gd, Nov 8); scientist / merchant / trainer bodies not yet |
| Clothing & armor | Casual (streetwear), Tactical (military), Light / Medium / Heavy armor, Exotic / Legendary | web: armor-sets / clothing-sets as stats + tints; clothing meshes out of scope until after Dec 4 (TASKBOARD) |
| Weapons | Assault Rifle, SMG, Shotgun, Sniper Rifle, LMG, Pistol, Revolver, Melee (sword / axe / spear), Energy Weapon, Exotic / Relic | web: 16 weapon GLBs; Godot: 12 — rifle frames plus the authored pistol (SIDEARM), shotgun, SMG, heavy (LMG / HEAVY), launcher and sword (Nov 8; frames in weapons.gd fire with the web numbers). Melee is Fracture Blade skins (option 1); revolver, axe, spear models missing |
| Equipment & gear | Backpack, Gloves, Boots, Helmet, Visor, Cloak, Gadget, Drone, Grapple, Scanner | stats only; grapple waits for the weapons pass in Godot |
| Animals & creatures | Deer, Boar, Wolf, Bear, Big Cat (panther), Crocodile, Shark, Bird (raptor), Reptile | Godot: every species lives and behaves (scripts/wildlife, Nov 8) on stand-in bodies; the fox is the rigged fox GLB. Models still to author for all nine. |
| Fracture creatures & bosses | Rift Hound, Crystal Stalker, Abyssal Leviathan, Vyrak (Ashen Covenant), Astravore, Colossus | Godot: all six fightable at the Rift Gate (Nov 9) on the authored boss / elite hulls (frost-wolf, aberration-elite, abyssal-boss, skyborn-boss, aberration-boss, guardian-boss); bespoke models for each still to author. Web: 2 boss GLBs; Astravore not in the encounter core yet |
| World props & interactables | Street Light, Bench, Trash Bin, Vendor Kiosk, Billboard (dynamic), Signage, Crates, Barrels, Barricade, Terminal (computer), Health / Pickup, Loot Chest | street-geometry.ts / organic-geometry.ts generators + 3 prop GLBs + 11 placeholders; Godot slices use city GLB props |
| Natural & atmospheric | Waterfall, River / Stream, Ocean, Lava Flow, Snow, Sand Dune, Fog / Mist, Clouds, Rain, Storm (lightning) | web: rivers, ocean, rain (ArenaWeather), fog; waterfall / lava / snowfall / lightning partial |
| VFX & world effects | Fracture Rift, Energy Field, Explosion, Fire, Smoke, Dust, Magic / Ability, Portal, Hologram | web: rift / ability / explosion effects; Godot: tracers, flashes, sparks only |

## Part 2 — 100 additional assets

| Category | Items on the board |
| --- | --- |
| City infrastructure (10) | Traffic lights, intersections, parking garages, subway stations, bus terminals, gas stations, bridges, tunnels, highway interchanges, construction sites |
| Realistic buildings & interiors (10) | Hospitals, police stations, fire stations, shopping malls, hotels, nightclubs, restaurants, schools, office interiors, underground parking |
| Everyday civilian life (12) | Shopping bags, smartphones, laptops, ATMs, vending machines, shopping carts, umbrellas, strollers, wheelchairs, delivery packages, street food stalls, outdoor seating |
| Character appearance (10) | Hairstyles, facial hair, skin materials, tattoos, jewelry, watches, sunglasses, backpacks, casual shoes, formal clothing |
| Combat details (10) | Holsters, ammo magazines, shell casings, bullet impacts, armor damage, weapon attachments, energy shields, combat debris, hit reactions, destructible cover |
| Natural environments (10) | Tree roots, fallen logs, moss, mushrooms, wildflowers, reeds, coral reefs, underwater caves, sandstone cliffs, glaciers |
| Wildlife behavior (10) | Bird nests, animal tracks, fish schools, insect swarms, animal dens, predator hunting, fleeing herds, roosting birds, underwater predators, nocturnal wildlife |
| Vehicles & transportation (10) | Car dashboards, vehicle interiors, motorcycle helmets, traffic signs, aircraft cockpits, ship bridges, vehicle damage, tire smoke, exhaust effects, landing gear |
| Fantasy & dimensional (10) | Fracture crystals, floating ruins, ancient structures, dimensional gates, corrupted vegetation, energy conduits, relic containers, magical inscriptions, reality distortions, boss arena structures |

Have today (web): fallen logs, mushrooms, lily pads, reeds, basalt (wild-geometry.ts); traffic lights / lamps / rails
(street-geometry.ts, road-dressing.ts); mall shops; shell casings / impacts / tire smoke partial. Everything else is open.

## PvP maps board

Reworked: Killbox Prime, Fracture Floor, Kaiju Complex. New: Skydock, Neon Yard, Glass Spire, Riverfront, Solara Outpost,
Frostveil Ring, Thalassia Dome, Void Rift. Modes on the board: Team Deathmatch, Domination, Control, Extraction, Kill
Confirmed, Free For All, Ranked. Features: multi-level, tactical cover, vertical play, dynamic events, day / night / weather.

Have: the first four maps as data in `src/game/killbox-arenas.ts` (session_01HeBvGGZzSqLVyhhF3TcmJd is adding the rest in
board order) and exported to Godot (`godot-world-fracture/data/killbox.json`), where `scripts/killbox/` plays Clash, Dominion, Freefall, Lockdown and Ascendancy on every arena (Nov 8). The game's mode ids map to the board as: clash → Team Deathmatch, dominion → Domination,
lockdown → Control, ascendancy → Kill Confirmed, freefall → Free For All, royale → Fracture Royale (board: none). Extraction
and Ranked are not in `pvp.ts` yet.
