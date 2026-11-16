# Meshy full upgrade (owner, Nov 15)

> "use meshy to recreate everything in the game from trees to builds animals to weapons i want all better models not the
> shit we have now build everything the is missing as well ... triple check every model for pixelization"

Every model in `godot-world-fracture/models/` is regenerated in Meshy, and the missing ones are added. They are made
through the owner's signed-in Meshy web app (the Meshy API and CLI are blocked from the build machines), downloaded as
GLB and brought in under the same file names, so the game picks them up without code changes.

## Quality gate: every model is checked three times before it goes in

1. **Meshy preview**: the right subject, complete, nothing melted, no text or logos baked in.
2. **Texture check** (`scripts/check-meshy-textures.py`): base colour at least 2048 px (hero pieces, vehicles and
   buildings at 4096), not upscaled mush (high-frequency energy against a 2× down-up resample), no flat colour blocks.
   A model that fails is regenerated, never used.
3. **In-game render**: a look-dev shot at play distance and close up.

Settings: Meshy 7.1 High Detail or Smart Topology (game budget), PBR (base colour, normal, metallic, roughness), 2K or
4K textures, upright, base at the origin, real-world scale set on import.

## Polygon budgets (mobile)

| Kind | Triangles | Texture |
| --- | --- | --- |
| Weapons (first person) | 8–15k | 2K |
| Trees, bushes, rocks | 3–8k (leaf cards alpha) | 2K |
| Animals | 6–12k | 2K |
| Street props | 1–6k | 2K |
| Interior furniture | 2–8k | 2K |
| Buildings | 10–30k | 4K |
| Vehicles | 15–30k | 4K |
| Bosses, heroes | 20–40k | 4K |

## Batches and prompts

Common prompt tail: *"realistic AAA game asset, PBR, neutral studio background, whole object in frame, no text"*.

### 1. Weapons → `models/weapons/`
| File | Prompt |
| --- | --- |
| rifle.glb | modern assault rifle, black polymer and gunmetal, rail optic, angled foregrip, side view |
| rifle-smg.glb | compact submachine gun, folding stock, suppressor, black and tan, side view |
| rifle-sniper.glb | long-range bolt-action sniper rifle, large scope, bipod, matte olive, side view |
| rifle-fusion.glb | sci-fi fusion rifle, glowing cyan energy cells in the body, white and graphite panels, side view |
| pistol.glb | modern semi-automatic pistol, black slide, textured grip, side view |
| shotgun.glb | tactical pump-action shotgun, black synthetic stock, heat shield, side view |
| heavy.glb | belt-fed light machine gun, box magazine, bipod, gunmetal, side view |
| launcher.glb | shoulder rocket launcher, olive tube, optics and grip, side view |
| sword.glb | sci-fi katana, dark steel blade with a faint violet edge, wrapped hilt, side view |

### 2. Trees and nature → `models/foliage/`
broadleaf (oak, full canopy), conifer (pine), palm-a/b/c (three heights and lean), plus new: bush, flowering shrub,
hedge block, rock cluster, boulder, grass clump, dead tree, birch, cypress, potted city tree.

### 3. Animals → `models/animals/` (new, plus the fox)
fox, dog (shepherd), dog (small terrier), cat, pigeon, crow, seagull, rat, squirrel, deer, wolf, horse, raccoon.
Meshy rigging is biped-only: animals come static and move with the existing walk-cycle bob, or with Meshy's animal
animation presets where they exist.

### 4. Street props → `models/city/street/` and `models/city/`
street lamp, bench, bus shelter, kiosk, vending machine, motorbike, plaza arch, planter, trash bin, dumpster, fire
hydrant, traffic light, road barrier, bollard, newspaper box, mailbox, neon sign pole, phone booth, parking meter,
food cart, scooter, ATM.

### 5. Interiors → `models/city/`
bed, sofa, kitchen island, café set, reception desk, concierge desk, office desk and chair, bar counter and stools,
slot machine, roulette table, shelving, TV wall.

### 6. Buildings → `models/buildings/` and `models/city/`
neon blocks a–b, neon towers a–c, neon-v A–F, nexus civic a–c, nexus spire, nexus terraces a–b, riverdale corner,
apartment, brick, casino, deco, office, villa, shopfront, wreck.

### 7. Vehicles → `models/fleet/` and `models/city/police-car.glb`
all 27 fleet models under the same names (goliath-tank keeps separate `Body` and `Turret` nodes, made with
Split on, so the turret still traverses).

### 8. Bosses and characters
the seven bosses, then the hero lineup in `NPC_LINEUP.md` (rigged in Meshy, retargeted to the game's skeleton).

## Log

| Batch | Status |
| --- | --- |
| 1 Weapons | 9 made in Meshy (4K PBR, remeshed to ~12k tris); **in the game: rifle, rifle-smg, heavy (LMG), shotgun, rifle-fusion**; pistol, sniper, launcher, sword waiting on the download |
| 2 Nature | **in the game: palm-a (coconut palm), conifer (pine); new: birch, tree-dead, rocks, boulder** (remeshed in Meshy, ~4-12k tris). Rejected after the remesh: the flowering shrub (lost its blossoms) and the street tree (too sparse) — to be remeshed again at a higher count. 13 made (oak, pine, 3 palms, bush, flowering shrub, rocks, boulder, grass, dead tree, birch, street tree); the hedge failed twice and was dropped |
| 3 Animals (Nov 8 set) | **in the game (Nov 16, lead): boar, shark** from the owner's Nov 8 downloads (Wild Boar 1.35M tris, Deep Sea Hunter 122k), simplified with `gltfpack -si` (meshoptimizer keeps fur shells whole; Blender's collapse decimate left the boar speckled with holes) and through import-meshy.py at 1024. **Rejected: the bear** (base colour failed the pixelation gate, detail 0.015); Moonlit Majesty is an untextured generate, not used |
| 3 Animals | 13 made (fox, shepherd, terrier, cat, pigeon, crow, seagull, rat, squirrel, deer, wolf, horse, raccoon); **in the game (Nov 15): all but the fox** (the Khronos fox keeps its walk cycle) from the agent's ~10k remeshes — deer, wolf and a new HORSE herd in the wild (`wildlife.gd`); pigeons, crow, cat, shepherd, terrier, rat, raccoon, squirrel on the city walks and gulls on the coast (`street_slice.gd` MESHY_FAUNA, drawn within ~30 m, a pecking bob) |
| 4 Street props | **in the game (Nov 15): hydrant, trash-bin, parking-meter, mailbox, news-box, dumpster, bollard, food-cart, atm, barrier** (remeshed in Meshy to ~5-10k, or decimated in Blender with the normal map dropped where Meshy would not remesh); the phone booth was rejected (black shards in its glass). 20 made (lamp, bench, bus shelter, kiosk, vending, motorbike, plaza arch, planter, bin, dumpster, hydrant, barrier, bollard, news box, mailbox, phone booth, parking meter, food cart, ATM; the traffic light concept was dropped by the agent) |
| 5 Interiors | **in the game (Nov 16)**, remeshed to ~10k in Meshy (reception and TV wall decimated in Blender): bed, sofa and kitchen island back in apartment 1204 (off the TORN list), café set, reception desk; drop-in wiring is in: hotel concierge desk, bar counter and lobby TV wall, office desks and shelving (`interiors.gd`), slot machines and roulette (`casino_interior.gd`) — `models/city/{concierge-desk,bar-counter,tv-wall,office-desk,shelving,slot-machine,roulette}.glb`; bed, sofa and kitchen island come off mission_01's TORN list when their remeshes land. 12 made (bed, sofa, kitchen island, cafe set, reception, concierge, office desk, bar, slot machine, roulette, shelving, TV wall) |
| 6 Buildings | **in the game (Nov 16): all 24**, remeshed to ~30k in Meshy (neon-v-D decimated in Blender), textures 2048, placed with `--match` on the old ones: neon blocks a-b, neon towers a-c, neon-v A-F (the six slim towers), nexus civic a-c, spire, terraces a-b, riverdale corner, and city apartment, brick (brownstone), casino, deco, office (glass curtain wall), villa. 24 made at 4K (2 neon offices, 3 neon skyscrapers, 6 neon towers, 3 civic, spire, 2 terraces, brick corner, apartment, brownstone, casino, art deco hotel, glass office, villa) |
| Remesh | weapons ~12k; animals ~10k and nature (trees ~12k, shrubs ~6k, rocks ~4k) requested in Meshy |
| Not yet | bosses and hero characters (needs a credit top-up: ~560 left after the batches above) |
| Vehicles | being re-made separately on the account from the vehicle roster sheets ("Recreate the exact vehicle"), not duplicated here |

## Drop-in wiring (lead session, Nov 15)

The new kinds place themselves the moment their GLB is in the repo — no code change per model:
- **Street props** (batch 4): `street_slice.gd` `MESHY_PROPS` rows place hydrant, trash-bin, parking-meter, mailbox,
  news-box, phone-booth, dumpster, bollard, scooter, food-cart, atm and barrier per tile from `models/city/street/<file>`
  (kerb line facing the road, or against the buildings), skipping the garage and the side-court mouths. Add a row for a
  new prop; a file that is not there places nothing.
- **Animals** (batch 3): `wildlife_view.gd` `_body` uses `models/animals/<species>.glb` (the SPECIES key in lower
  case: deer, boar, wolf, …) when it exists — fitted to the rules' body height, nose +z, its first clip looped if it
  has one, the procedural body otherwise. The fox keeps its own path.
- **Weapons, buildings, furniture, fleet**: same file names, picked up as before.

## Simplifying (lead, Nov 16)

`gltfpack -i SRC.glb -o OUT.glb -si <ratio> -sa -noq -kn` (meshoptimizer; `npm i -g gltfpack`) simplifies without opening
holes in fur and multi-shell meshes, where Blender's collapse decimate speckles them. Pines and other needle trees
do not simplify below ~3k whatever the tool — a forest (a thousand trees a tile) cannot carry Meshy trees; those
need authored low-poly leaf-card trees. `region_3d.gd` has `_multimesh_lod` for when they come.

## How a model comes in

1. Download the GLB from the Meshy canvas (the file name carries the model name).
2. `python3 scripts/import-meshy.py SRC.glb godot-world-fracture/models/<dir>/<name>.glb --match <the old model> [--weapon [--flip]]`
   or `--height <metres>`: placed where the old one was, textures to 2048 px JPEG, the pixelation gate run on the
   result (a fail deletes it).
3. `tests/tools/model_compare.gd -- out.png old.glb new.glb [--close]`: old and new side by side, then a close crop.
4. Old extracted textures of the replaced model removed; the old `.import` kept (`generate_lods=false`).
