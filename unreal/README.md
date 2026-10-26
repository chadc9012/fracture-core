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

The default level is the engine's template map; the game mode adds a floor and lights if a level has none.

## What runs
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
  after a stagger (boss-poise.ts). Astravore calls in real troops (Void Hounds, a Dimensional Knight with Reality
  Mages, a Star Sentinel; at most six at once) that fight and pay like any enemy and leave when the fight ends or resets.
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
| EncounterCoreTest | encounter-sim.ts (incl. summoned troops), boss-poise.ts (pacing, post-stagger gap), boss-phases.ts, scenario-gimmicks.ts, sim.ts boss damage | 112 fights, 27,871 steps, 32,852 checks |
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
| TacticsCoreTest | enemy-intelligence.ts, ability-network.ts buildSynergy, enemy-tactics.ts, enemy-evasion.ts | 2,000 flank searches, 200 grenade flights, 3,000 round threats, 19,223 checks |
| OperatorCoreTest | operator-pockets.ts switchOperator, xp.ts grantXP, nex.ts spendNex | 6,400 operations (846 switches), 25,600 checks |

The golden files (`Plugins/WorldFractureCore/Tests/<name>_golden.txt`) are **generated, not committed**: together they run to ~60 MB,
which broke the Lovable preview build. Record all of them from the repo root before configuring the tests (and again after changing
the web build's rules):

    node unreal/tools/gen-goldens.mjs            # all twenty
    node unreal/tools/gen-goldens.mjs race shop  # just these

`export-datatables` (the DataTables, which are committed) still runs on its own:

    npx esbuild unreal/tools/export-datatables.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/t.mjs && node /tmp/t.mjs

The encounter, Dragonite-cast and ability recorders route their world calls to recording shims (`build-golden.mjs`); `gen-goldens.mjs` handles that.

## Not ported yet
Boss models and attack effects (zones are debug circles, decoys are stand-ins), mid-mission saves, ability mastery XP, slides (the armor slide bonus),
region kinds for abilities (the map counts as a war zone),
real cover behind obstacles (enemy-cover.ts), troopers running out of orbital strike circles (no strike beacons yet), earning monoblades (wasteland-activities.ts gold medals), on-foot weapon heat, the featured-activity rotation and
activity shader drops,
diving (the thalassia-dive survive timer), the Neon City police response itself (the web build has only the heat meter and its labels; chase-ai.ts pursuit helpers are unused there), the Operations Hub preview marketplace (its wallet is not saved in the web build either), home interiors, cloud save merge, the world itself (regions, Neon City, Thalassia). Their data is already in
`DataTables/`.
