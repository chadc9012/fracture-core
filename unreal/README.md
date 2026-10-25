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
   `ListShops`, `Shop <id>`, `Buy <n>`, `Service <itemId> [element]`, `Inventory`, `ShopHour <h>`, `CloseShop`.

The default level is the engine's template map; the game mode adds a floor and lights if a level has none.

## What runs
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
| RewardCoreTest | sim.ts defeatMachine, inventory.ts claimDrops, xp.ts grantXP (Math.random replayed) incl. 18 scenarios + Vyrak covenant | 754 kills (319 scenario), 2,936 checks |
| MissionCoreTest | src/game/missions/* (12 machines) | 28,800 states |
| MissionRewardCoreTest | progression.ts rewardMission, persistence.ts applyMissionCompletion | 1,224 payouts, 1,576 checks |
| EncounterCoreTest | encounter-sim.ts, boss-poise.ts, boss-phases.ts, scenario-gimmicks.ts, sim.ts boss damage | 112 fights, 27,149 steps, 32,056 checks |
| DragoniteCastCoreTest | dragonite-cast.ts castDragonite / stepDragonite, live-build.ts energy | 9,600 operations, 35,122 checks |
| VehicleCoreTest | vehicle-handling.ts, vehicle-surface.ts, vehicle-condition.ts, rewardVehicle | 15,120 handling steps, 17,938 checks |
| RaceCoreTest | racing.ts, activities.ts (all 68 courses, attempts, payouts, records) | 286 runs, 41,602 ticks, 15,255 checks |
| VehicleWeaponsCoreTest | vehicle-weapons.ts, ordnance.ts, launchers.ts, sim.ts fireBullet / fireOrdnance, Scene.tsx fire loop | 2,310 armaments, 160 flights, 14,400 fire frames, 135,166 checks |
| AbilityCoreTest | ability-effects.ts, live-build.ts, ability-hud.ts, branch-effects.ts, subclass-verbs.ts, operator-abilities.ts | 8,000 operations (3,256 casts), 2,400 turret steps, 39,106 checks |
| ShopCoreTest | regional-shops.ts, weapon-catalog.ts, shop-hours.ts, living-world.ts, inventory.ts upgrade / infuse | 1,087 stock checks, 924 purchases, 702 services, 14,566 checks |
| DragonCoreTest | dragonite.ts, dragonite-cast.ts statsFor, vyrak-trust.ts | 2,099 states, 23,789 checks |

Regenerate goldens after changing the web build's rules (from the repo root):

    npx esbuild unreal/tools/<tool>.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/t.mjs && node /tmp/t.mjs

for `export-datatables`, `gen-quest-golden`, `gen-reward-golden`, `gen-mission-golden`, `gen-missionreward-golden`, `gen-dragon-golden`, `gen-vehicle-golden`, `gen-race-golden`, `gen-vweapons-golden`, `gen-shop-golden`; the encounter, Dragonite-cast and ability recorders (`gen-encounter-golden`, `gen-dragoncast-golden`, `gen-ability-golden`) run through `node unreal/tools/build-golden.mjs unreal/tools/<tool>.ts`, which routes their world calls to recording shims.

## Not ported yet
Boss models and attack effects (zones are debug circles, decoys are stand-ins), mid-mission saves, ability mastery XP and armor ability-recharge,
region kinds for abilities (the map counts as a war zone),
armor effects on combat, enemy perception/cover/line-of-sight, launchers and the sword, vehicle gadgets and fleet builds, gear power and armor damage bonuses on vehicle guns, knockback, the featured-activity rotation and
activity shader drops,
the Operations Hub preview marketplace (its wallet is not saved in the web build either), housing, cloud save merge, the world itself (regions, Neon City, Thalassia). Their data is already in
`DataTables/`.
