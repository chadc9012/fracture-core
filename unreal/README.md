# World Fracture — Unreal Engine 5 project

UE 5.8, Windows, C++. The web build in `../src` stays the reference implementation: every rule ported here is
golden-tested against the TypeScript code it came from, and that code stays authoritative until the port matches it.

## Layout

```
unreal/
  WorldFracture.uproject          UE 5.8 project (Enhanced Input enabled)
  Config/                          DefaultEngine/Game/Input.ini
  Source/WorldFracture/            game module: AWFGameMode, AWFCharacter, AWFEnemy, AWFHUD, weapon loader
  Plugins/WorldFractureCore/       rules plugin
    Source/.../Public/Core/        engine-free C++ (quests, rewards, missions, shared save) — compiles anywhere
    Source/.../Public/*.h          Unreal subsystems over the core: progression + rewards, quests, missions, save
    Tests/                         CMake golden tests for the core, recorded from the web build
  DataTables/                      every authored table from src/game as Unreal DataTable JSON (+ CSV)
  tools/                           exporters and golden recorders (TypeScript, bundled with esbuild)
```

## Opening it
1. Install Unreal Engine 5.8 and Visual Studio 2022 17.14+ or 2026 with the *Game development with C++* workload.
2. Right-click `WorldFracture.uproject` → *Generate Visual Studio project files*, open the `.sln`, build
   `WorldFractureEditor` (Development Editor, Win64), then run.
3. Press Play. The game loads `DataTables/*.json` directly, so no import step is needed. Controls: WASD, mouse,
   Space/C jump, Shift sprint, LMB fire, RMB aim, R/G reload, 1-5 / wheel weapons, F5 save, F6 cycle Operator class
   (Titan / Hunter / Warlock), 8 9 0 - = \ ; the seven Dragonite abilities (F7 also Wyrmcall), Q / F / X the class abilities (the web build's Q / E / R: E is the vehicle key here and R reloads), V ride Vyrak, E enter / exit a vehicle (driving: LMB / RMB fire its hardpoints, mouse aims), T call your vehicle, F8 summon a Unique Scenario boss, F9 finish the active quest.
   Console (~): `UpgradeDragonite <ability>`, `VyrakTrust ruin|puzzle|protect <id>`, `AncientBond`, `EternalCovenant`,
   `SpawnScenarioBoss <id>`, `ChooseStarterVehicle scrap-interceptor|wasteland-jeep`, `SpawnVehicle <id>`, `RepairVehicle`,
   `ListRaces`, `StartRace <id> [standard|advanced|legendary]`, `AbandonRace`,
   `Subclass <id>`, `EquipAbility <id>`, `AbilityBranch <ability> <branch>`, `ClassBuild`,
   `ListShops`, `Shop <id>`, `Buy <n>`, `Service <itemId> [element]`, `Inventory`, `ShopHour <h>`, `CloseShop`,
   `Fleet`, `BuyGarage <base>`, `BuyFleet <build>`, `FleetActive <build>`, `Tune <build> <node>`, `Paint <build> "<paint>"`, `Cosmetic <build> <key> <value>`,
   `Homes`, `BuyHome <id>`, `BuyDecor <id>`, `PlaceDecor <home> <room#> <slot> [decor]`, `Park <build> <residence>`, `Unpark <build>`.

The default level is the engine's template map; the game mode adds a floor and lights if a level has none, and builds
**Nexus City** at its real place in the world (below). A save whose current world is Nexus starts on the hub's spawn pad;
from anywhere else, `GoNexus` at the console walks you in.

Gamepad: left stick move, right stick look, A jump, RT fire, LT aim, L3 sprint, B crouch, X reload, Y interact,
RB / LB next / previous weapon, D-pad down call vehicle, up ride Vyrak, right hack.

## Android (APK)
Build it on the Windows PC (Unreal can't package for Android anywhere else):
1. Install Android Studio, then run `<UE 5.8>\Engine\Extras\Android\SetupAndroid.bat` once (it fetches the SDK and NDK the
   engine wants).
2. Either open the project and use *Platforms → Android → Package Project* (pick ASTC), or start the **Unreal Android APK**
   workflow on GitHub with the PC registered as a self-hosted runner (labels `self-hosted, Windows, unreal`); it publishes
   `WorldFractureUE.apk` to the `unreal-android-latest` release, which installs straight from the phone's browser.

`Config/DefaultEngine.ini` packages one self-contained APK (data inside, no OBB) for arm64 with Vulkan (ES 3.1 fallback),
landscape and full screen, and uses mobile deferred shading so all of Nexus City's pooled lights reach the buildings. On a
phone the engine's on-screen sticks move (left) and look (right) through the same Enhanced Input actions as WASD and the
mouse, and the HUD draws buttons for fire, aim, jump, reload, crouch, swap, sprint, interact, hack and the three class
abilities, which press those same actions (start any PC build with `-touchhud` to try the layout with a mouse).
Driving has no touch controls yet.

Until then the phone build is the web game (`mobile/`, the `android-latest` release), which is the whole game today.

## What runs
- **Weapon heat and foundries:** every gun shares one heat gauge, on foot and mounted (sim.ts weaponHeat): each pull adds
  7 x the weapon's heat (split across a shotgun's pellets), the guns vent at 100 and fire again once cooled to 6. The
  equipped weapon's foundry is a real rule (foundries.ts): Omolon -25% heat, SUROS -30% recoil, Tex Mechanica +25% from
  the hip, Häkke +20% to elites and bosses, Black Armory nanites hop 1.5 damage to the nearest hostile after a kill.
- **The Godforge and secrets:** NOVA hums near the region's hidden secrets (secrets.ts; within 60 m, a shimmer within
  25 m, claimed in reach when its condition holds: `ShopHour` sets the clock for the night-only ones). The three
  Forgewright's Marks (Frostspire, Ember Peaks, the Wastelands) open the Hollow Crown in the Wastelands; walking in wakes
  the Furnace Guardian, whose kill pays the Heart of the Hollow Crown and two forge catalysts. Standing at Vael:
  `ForgeRelic eclipse-devourer|crownfire|stillwater`, `SocketRune <id> <rune>`, `RemoveRune`, `AscendRelic <id>`,
  `CollectDust`; `Equip <id>` wields the relic and `Godforge` prints the state. Socketed runes act in combat: Devour
  (every 8th hit x2.5), Rift (x1.25 on elites and bosses), Ward (-15% damage taken), Reap (+6 health a kill), and 100
  kills awaken a relic (+30 power, x1.1 damage).
- **Wastelands activities:** in the Wastelands (or anywhere after `WastelandHere`) the three sites are laid out around you
  in the web build's layout. Stand on the amber Vault Gate pad to hold it against three raider waves (raiders within
  16 m wear the gate down); win for Legion trust and, once, the Vectal monoblade. Drive onto the cyan Rust Run start for
  the 10-checkpoint rally (gold 20 s, silver 27 s, bronze 40 s). Drive into the red Mash-Pit for a 75 s derby (gold 14
  wrecks, silver 10, bronze 6). Each medal tier pays once, and gold awards the Sun-Cutter (rally) or the Aegis Broadsword
  (derby). Runs pay through the side-contract payout, best times and scores are saved, and `Wasteland` prints the
  distances, your records and your Legion rank.
- **Nexus City:** built at play time from `DataTables/NexusCity.json`, which `tools/export-nexus-city.ts` writes from the web
  build's own layout code (nexus-districts.ts, nexus-signs.ts, city-streets.ts, building-models.ts), so the two cities match
  street for street: the hub plaza with its promenade, ring road, spawn pad and eight civic towers; 66 district buildings
  (Spire glass towers north, Market east, Arcology west, Shipyard sheds south) with setback crowns, lit floors and their roof
  kit; the facade kit (plinths, ledges, glass fins, shopfronts and awnings, balconies, lobbies, blade signs); sidewalks,
  kerbs, crossings, street furniture, 244 street lights, parked cars; and the night signage (87 violet banners, 13
  holographic screens, 146 cyan corner strips). Buildings, kerbs, cars, benches, planters and shelters are solid, and
  troopers use them as cover. Everything is instanced (one draw per shape and colour) for phones. In Nexus the sun dims to
  moonlight under a violet sky with street-level fog, and a pool of real lights (24 on PC, 8 on phones) follows you,
  lighting the nearest lamps, shopfronts and signs. The terrain isn't ported, so the city is levelled onto one flat slab.
  Shapes are the engine's basic meshes and colours go through BasicShapeMaterial; set the actor's `SurfaceMaterial` /
  `NeonMaterial` (a "Color" vector parameter) once real materials exist, and replace the hub towers' stand-in boxes with
  the imported building GLBs. Re-export after a layout change in the web build:
  `npx esbuild unreal/tools/export-nexus-city.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/nc.mjs && node /tmp/nc.mjs`
- **Movement kit:** Titans get one weighty air jump, Hunters two quick ones, Warlocks one and then a glide while jump is
  held (movement.ts). Left Ctrl crouches, or slides out of a sprint (the armor slide bonus stretches it); Z toggles
  prone. Crouched and prone you are slower and harder to hit (enemyHitChance). A running jump vaults further and higher,
  and quick jumps chain into a small speed bonus (parkour.ts). The camera sinks and the FOV widens with the stance,
  sprint and slide.
- **Boss bounties and real cover:** a scenario boss's real kill pays its Nex bounty to the operator being played, a first
  kill and then a daily repeat, ranked by boss (activity-payouts.ts); older saves' bounties go to the operator played when
  they load. A wounded trooper looks for chest-high cover in the level geometry that hides it from you, hides, leans out
  to fire, and ducks back; if you walk round it, it fights (enemy-cover.ts).
- **Squad tactics:** alert troopers move by squad role (assault presses, ranged holds 28 m, flankers circle, leaders
  anchor; everyone rushes a player under 35% hull, spreads out against a hot one, and your ability build shifts them)
  (enemy-intelligence.ts). A player out of sight for 3 s gets up to two flankers swinging round to a spot that sees
  them; after 2.5 s Raiders and Vanguard lob a grenade over the cover (one squad grenade at a time, a danger ring, 34
  damage at the centre, softened by cover). Troopers dive out of incoming rockets when they read them in time (elites
  more often) (enemy-tactics.ts, enemy-evasion.ts).
- **Armor in combat:** worn armor works as in the web build (armor-attributes.ts loadoutEffects): 2- and 4-piece set
  bonuses scaled by level, every set piece's perk, INTELLECT / MOBILITY / DEFENSE with soft caps and trade-offs, and the
  mixed-gear flexibility bonus. Resistance (capped at 50%) cuts incoming damage, regen heals all the time, weapon damage
  raises every gun, launcher and vehicle gun, move speed raises walking and sprinting, and INTELLECT speeds ability
  cooldowns and energy. The equipped weapon's power scales its damage (up to x1.7).
- **Heavy arms:** the mouse wheel reaches the Fracture Blade and the four launchers after the five guns. The blade swings
  a 1-2-3 combo through a 150-degree arc (6 m, the finisher 8 m and x1.8), shoves and staggers; an owned monoblade
  (`EquipBlade vectal|aegis-broadsword|sun-cutter|none`) adds damage, reach, the Aegis finisher shockwave or the
  Sun-Cutter's deflect window. Breacher, Cinder, Frostbite (guided) and Vitriol fire real ordnance rounds with splash and
  their element. Bullets, swings and blasts knock enemies back; bosses move a fourteenth as far (boss-poise.ts).
- **Enemy perception:** troopers patrol, grow suspicious, lock on and search the last place they saw you
  (enemy-perception.ts): sight (85 m, elites further, Phase Veil hides you), hearing (your gunfire and combat heat) and
  damage raise awareness; lines of sight are traced every 0.25 s. Bosses, and anyone near a badly hurt player, are always
  alert. A wounded trooper breaks off to a retreat point. Shots land with line-of-sight.ts enemyHitChance (worse at
  range and against a fast target), reach you while you drive (wearing the vehicle) and miss while your flares burn.
- **Heat and the quest bridge:** shots, blasts, crashes, rams, melee and flame jets raise combat heat (decays 6/s), which
  scales kill XP and drives the 1-5 Neon City heat meter on the HUD (heat.ts). Every frame the quest-signals.ts bridge
  reports entering the region, kills, survive time, heat levels, the Nexus lockdown tier and hack, so the whole story
  chain can advance. A wreck-level vehicle (or a heavily damaged one stopped by a crash) throws you out (chase-ai.ts).
- **Safe-zone turrets and Nexus surveillance:** 8 turrets on the Nexus rim and 5 on the Verdant Forest's track and shoot
  hostiles (kills pay nothing); in Nexus they are vision-cone sensors that fill the detection meter (stealth.ts).
  Hold H to hack: it stalls under YELLOW and loses progress under RED.
- **Boss pacing:** scenario bosses have 520 hull (x challenge), poise builds at 1.6 per damage and not at all for 6 s
  after a stagger (boss-poise.ts). Astravore calls in real troops (Void Reavers, a Void Vanguard with Void Arcanists,
  a Void Sentinel; at most six at once) that fight and pay like any enemy and leave when the fight ends or resets. They
  fight in role (summon-skills.ts): a Reaver rushes you and strikes from just behind you, an Arcanist keeps 16-28 m away
  and lobs void orbs that leave a slowing pool, and a Sentinel deploys up to three Void Turrets that last 25 s.
- **Separate operators:** Titan, Hunter and Warlock each have their own level, XP, Nex, fracture shards and materials
  (operator-pockets.ts); F6 switches operator and loads that operator's pocket. Gear, vehicles, homes, story and
  one-time claims stay shared. Old saves give everything to the operator being played. `Operators` lists all three.
- **Combat loop:** first-person Operator, five guns with the exported tuning (fire rate, bursts, spread, recoil,
  magazines, reload, shotgun pellets), health 100 with health.ts regeneration, respawn on death.
- **Enemies:** the current region's troopers (RegionalEncounters.json), health from sim.ts spawnMachine scaled by
  difficulty challenge, aggro/speed/wind-up/cooldowns from enemy-tuning.ts, ranged 2/4/6 and melee 7/12/17 damage.
- **Rewards:** every kill pays through the ported sim.ts defeatMachine → claimDrops → grantXP: credits, region
  materials with power pacing, armor set drops and upgrades, weapon drops, boss relics, XP with challenge scaling.
- **Unique Scenarios:** the 18 scenario bosses can be summoned (F8 or `SpawnScenarioBoss <id>`); a kill with 5+ player
  hits pays its signature loot once per run (duplicates level up, then turn into shards), records the class's
  encounter journal, and Vyrak clears pay the per-class covenant bond, Dragonite, rolled Covenant pieces and the
  measurable challenges, stamping the rematch cooldown. The six authored encounters (Dark Knight, Rime
  Alpha, Drowned Monarch, Hollow Saint, Vaelith, Vyrak's three phases) run the ported fight: tells, slams, lunges,
  pounces, fans, hazard zones, False Saint decoys, Vaelith's truce, the finale window and its hp floor, and a reset
  when you die. All bosses take damage through the ported poise / weak point / stagger rules, each scenario's gimmick
  (adaptive, attune, closing) and its near-immunity outside the openings, and escalate through three phases.
- **Vyrak and Dragonite (per class):** ability upgrades for Dragonite (3/6/10/15) and every ability's numbers from
  upgrades and worn Covenant armor; trust from challenges, encounters, ruins, puzzles and protected runs with its
  stages; the Ancient Bond (unlocks riding, Wingmantle) and Eternal Covenant (Eternal Crest) ceremonies; Wyrmcall (F7)
  runs the ported ally state machine and its strafes, breath, interrupts and boss finisher hit real enemies; riding
  (V) uses the ported flight model with terrain skimming and the no-fly rules (Nexus, Neon, dungeons, missions,
  indoors). All seven Dragonite abilities cast through the ported dragonite-cast.ts: Dragonfire cones (and the eruption),
  Wyrmwing launch / glide / air dash, Dragonhide resistance, Roar of Ruin stagger / knockback / vulnerability,
  Scalebreaker strikes and shield break, Skyfall's delayed dive, Wyrmcall; they spend ability energy (100, +9/s).
  Vyrak's model and voice lines are not in yet; the mount is a stand-in block.
- **Vehicles:** all 14 drive on the ported vehicle-handling.ts model for their type (racer, off-road, tank, jet,
  heli, boat, sub): acceleration, braking, steering, drift and handbrake, takeoff speed and climb, floating and diving,
  ground grip by region surface and slope, top speed from region and vehicle stats, and wear from crashes and hard
  landings (a wrecked engine stops it; `RepairVehicle` pays Nex). The garage (owned, 3-slot loadout, selection,
  conditions) is saved. Bodies are stand-in blocks, and the prototype map has no water, so boats and the sub are beached.
- **Vehicle weapons:** every vehicle fires its own hardpoints (vehicle-weapons.ts armamentFor for its class and id):
  LMB primary gun, RMB the secondary gun or the ordnance salvo (missiles, rocket pods, torpedoes), the mouse aims
  (turrets follow it, fixed guns follow the nose with a little pitch and converge ahead). Rounds leave the real barrel
  offsets, carry the vehicle's velocity and fly as projectiles; cannon shells and ordnance burst with splash falloff,
  guided rounds lock the nearest enemy in a forward cone and steer at their turn rate. The shared weapon heat
  overheats and vents as in sim.ts, and a vehicle at 65%+ body damage has its weapons offline (chase-ai.ts).
- **Class abilities:** the equipped build (saved, account-wide as in the web build; `ClassBuild` equips your class's
  own three) casts through the ported ability-effects.ts: Siege Mode (+30% damage, slower, steadier), Kinetic Slam
  (shockwave, knockback, interrupt), Bastion Shield (barrier), Phase Veil (enemies see you at 15% range until you fire),
  Rift Dash (dash with i-frames, stops at obstacles), Shadow Strike (lands behind the nearest enemy, doubled from the
  veil), Recon Swarm (marks: +25% damage taken), Disruption Pulse (stuns, holds ordinary enemies' fire, poise on
  bosses), Rift Turret (up to two, 1 damage every 0.45 s), and the bonded Covenant abilities Ember Bulwark, Wyrm Dash
  and Ash Nova. Evolution branches (+18% power / +25% duration / -15% cost, a calibration token each), cross-class
  synergy, subclass verbs (Weaken, Marked, Volatile, Suppress, Rage, Overshield, Haste), costs from the energy pool
  shared with Dragonite, and death cancelling everything in flight all follow the web rules.
- **Racing:** the 68 courses (street circuits, off-road, hazard and foot courses, hidden runs once their markers are
  found) on the ported racing.ts / activities.ts rules: attempts per day and cooldowns, racing-rank and difficulty gates,
  staging and countdown, ordered checkpoints, timed reality gates, shortcuts, off-course recovery, track obstacles that
  slow the car, collision / recovery / wreck penalties, time limits, and rivals on their deterministic pace with a live
  place. A valid finish pays the activity (Nex, XP, reputation, materials, challenge bonus) and then the race records
  (placement Nex, medals, personal bests, championship points, racing rank). The web world is not ported, so
  `StartRace` lays a course out with its start line just ahead of you; dive courses need water and are refused.
- **Housing:** the seven listed homes (Undercity capsule flat to the Aegis Spire penthouse, garage quarters that need
  their base) and the twelve walk-in residences of Nexus and Neon City, each a one-time Nex purchase; 17 decor items
  bought once and placed by slot and room in any owned home; fleet builds parked in a residence's garage bays. All
  saved in the web build's nexLedger / housing fields. The rooms themselves are not built in the level yet.
- **Fleet and gadgets:** the four garage bases and the 21 fleet builds (fleet.ts): bought at their home base for
  materials and Nex, each unlocks its chassis and becomes the active vehicle; tuning nodes raise speed / hull / handling /
  ram, plus paint and cosmetics, all saved. Driving the active build's chassis uses its tuned stats, its own hardpoints
  and its gadget on RMB: mine and EMP-mine droppers (EMP stuns and slows), caltrops (slow and chew), flame jets (burn
  and build heat), flare pods, the Remora drone (orbits and shoots what it can see), the ramming grill and the breach
  thruster (more ram damage, less self-damage, a speed burst). Ramming an enemy follows sim.ts's force rule.
- **Merchants:** the 21 regional shops (weapon dealers, armor shops, the Bastion armorsmith, gunsmiths, mod shops,
  outfitters, vehicle workshops, the Dune Gate exotic trader, the Underlink black market, faction quartermasters) on the
  ported regional-shops.ts rules: daily stock per shop, this week's named catalogue weapons, armor collection pieces up
  to the city's tier, material packs, Tuning Cores, one daily deal, level and story gates, city hours and night-only
  black markets, and Living World standing (hostile factions refuse, Trusted / Honored pay less, fallen districts close,
  secured ones discount). Buying pays in the shop's regional material; gunsmiths, the armorsmith and vehicle shops
  upgrade gear (with the Forge Catalyst / Tuning Core gates) and mod shops infuse elements. Faction standing and
  district outcomes are saved. `Shop <id>` opens a counter on screen, as there is no walkable map yet.
- **Quests:** the Fracture Descent chain (fd-01 to fd-18) with world unlocks and corruption.
- **Missions:** all twelve story mission machines with their NOVA lines. A finished mission pays once through the
  ported rewardMission / applyMissionCompletion (XP, materials, loot box, first-clear weapon and campaign exotic, armor
  collection piece with bad-luck protection, NEX, repeat-run taper) and then fires its quest event.
- **Save:** one slot, JSON in the web build's PlayerProgression field names.

## Tests
```
cd Plugins/WorldFractureCore/Tests
cmake -S . -B build -G Ninja && cmake --build build && ctest --test-dir build --output-on-failure
```
| Suite | Recorded from | Checks |
| --- | --- | --- |
| QuestCoreTest | quests.ts gameTick / reconcileQuests / finishActiveQuest | 4,200 states |
| RewardCoreTest | sim.ts defeatMachine, inventory.ts claimDrops, xp.ts grantXP (Math.random replayed) incl. 18 scenarios + Vyrak covenant | 734 kills, 2,846 checks |
| MissionCoreTest | src/game/missions/* (12 machines) | 28,800 states |
| MissionRewardCoreTest | progression.ts rewardMission, persistence.ts applyMissionCompletion | 1,224 payouts, 1,576 checks |
| EncounterCoreTest | encounter-sim.ts (incl. summoned troops), summon-skills.ts, boss-poise.ts (pacing, post-stagger gap), boss-phases.ts, scenario-gimmicks.ts, sim.ts boss damage | 152 fights, 41,959 steps, 46,950 checks |
| DragoniteCastCoreTest | dragonite-cast.ts castDragonite / stepDragonite, live-build.ts energy | 9,600 operations, 35,122 checks |
| VehicleCoreTest | vehicle-handling.ts, vehicle-surface.ts, vehicle-condition.ts, rewardVehicle | 15,120 handling steps, 17,938 checks |
| RaceCoreTest | racing.ts, activities.ts (all 68 courses, attempts, payouts, records) | 286 runs, 49,814 ticks, 17,120 checks |
| VehicleWeaponsCoreTest | vehicle-weapons.ts, ordnance.ts, launchers.ts, sim.ts fireBullet / fireOrdnance, Scene.tsx fire loop | 2,310 armaments, 160 flights, 14,400 fire frames, 135,166 checks |
| AbilityCoreTest | ability-effects.ts, live-build.ts, ability-hud.ts, branch-effects.ts, subclass-verbs.ts, operator-abilities.ts | 8,000 operations (3,256 casts), 2,400 turret steps, 39,106 checks |
| ShopCoreTest | regional-shops.ts, weapon-catalog.ts, shop-hours.ts, living-world.ts, inventory.ts upgrade / infuse | 1,087 stock checks, 924 purchases, 702 services, 14,566 checks |
| FleetCoreTest | fleet.ts, vehicle-gadgets.ts | 2,400 fleet operations, 2,100 gadget operations, 13,060 checks |
| HousingCoreTest | housing.ts, residence-deeds.ts | 4,500 operations, 80 normalized saves, 9,821 checks |
| DragonCoreTest | dragonite.ts, dragonite-cast.ts statsFor, vyrak-trust.ts | 2,099 states, 23,789 checks |
| CityCoreTest | heat.ts, stealth.ts, chase-ai.ts, quest-signals.ts, sim.ts turret layout | 4,800 quest snapshots, 13 turrets, 19,883 checks |
| PerceptionCoreTest | enemy-perception.ts, enemy-tuning.ts, line-of-sight.ts enemyHitChance | 300 awareness tracks (18,000 steps), 24,004 checks |
| ArmsCoreTest | melee-arc.ts, foundries.ts blades / swingStats / inShockwave, launchers.ts via ordnance.ts fireRound | 3 blades, 4 launchers, 1,500 launches, 8,309 checks |
| ArmorCoreTest | armor-sets.ts, armor-perks.ts, armor-attributes.ts, inventory.ts weaponDamageMultiplier | 36 sets, 1,500 loadouts, 10,510 checks |
| TacticsCoreTest | enemy-intelligence.ts, ability-network.ts buildSynergy, enemy-tactics.ts, enemy-evasion.ts, enemy-cover.ts | 2,000 flank searches, 2,500 cover searches, 200 grenade flights, 3,000 round threats, 21,755 checks |
| BountyCoreTest | activity-payouts.ts payoutFor / payInto / tagLegacyPayouts / payFlat (raids reset weekly) | 400 ledgers, 8,939 payouts, 17,866 checks |
| GodforgeCoreTest | godforge.ts, secrets.ts, foundries.ts foundryOf, sim.ts fireBullet / fireLauncher heat | 1,590 foundry names, 3,000 trigger pulls, 10,516 forge actions, 1,084 queries, 37,843 checks |
| WastelandCoreTest | wasteland-activities.ts, wasteland-runtime.ts | 15,600 machine steps, 2,400 resolves, 24,000 runtime frames, 132,024 checks |
| MoveCoreTest | movement.ts, parkour.ts | 300 tracks, 18,000 frames, 36,067 checks |
| OperatorCoreTest | operator-pockets.ts switchOperator, xp.ts grantXP, nex.ts spendNex | 6,400 operations (846 switches), 25,600 checks |

The golden files (`Plugins/WorldFractureCore/Tests/<name>_golden.txt`) are **generated, not committed**: together they run to ~60 MB,
which broke the Lovable preview build. Record all of them from the repo root before configuring the tests (and again after changing
the web build's rules):

    node unreal/tools/gen-goldens.mjs            # all twenty-four
    node unreal/tools/gen-goldens.mjs race shop  # just these

`export-datatables` (the DataTables, which are committed) still runs on its own:

    npx esbuild unreal/tools/export-datatables.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/t.mjs && node /tmp/t.mjs

The encounter, Dragonite-cast, ability, tactics and Wastelands recorders route their world calls to recording shims (`build-golden.mjs`); `gen-goldens.mjs` handles that.

## Not ported yet
Boss models and attack effects (zones are debug circles, decoys are stand-ins), mid-mission saves, ability mastery XP,
region kinds for abilities (the map counts as a war zone),
troopers running out of orbital strike circles (no strike beacons yet), the rune bursts (Storm, Ember, Frost, Bloom and Sun need weapon-evolution.ts, which is not ported; their element still applies), nemeses (so the nemesis-gated runes and relic tiers wait), weather (storm secrets), the Neon City pledge, the featured-activity rotation and
activity shader drops,
diving (the thalassia-dive survive timer), the Neon City police response itself (the web build has only the heat meter and its labels; chase-ai.ts pursuit helpers are unused there), the Operations Hub preview marketplace (its wallet is not saved in the web build either), home interiors, cloud save merge, the rest of the world (terrain, the other regions, Neon City, Thalassia; Nexus City is in). Their data is already in
`DataTables/`.
