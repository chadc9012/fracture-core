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
   (Titan / Hunter / Warlock), F8 summon a Unique Scenario boss, F9 finish the active quest.

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
  measurable challenges, stamping the rematch cooldown. Scenario gimmicks and Vyrak's three phases are not in yet:
  they fight as plain bosses.
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

Regenerate goldens after changing the web build's rules (from the repo root):

    npx esbuild unreal/tools/<tool>.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/t.mjs && node /tmp/t.mjs

for `export-datatables`, `gen-quest-golden`, `gen-reward-golden`, `gen-mission-golden`, `gen-missionreward-golden`.

## Not ported yet
Unique Scenario fights (gimmicks, Vyrak's three phases), Dragonite upgrades, the Wyrmling and dragon riding (rewardMission/applyMissionCompletion) and mid-mission saves, abilities (Q/E/R),
armor effects on combat, enemy perception/cover/line-of-sight, launchers and the sword, vehicles and racing,
merchants and housing, cloud save merge, the world itself (regions, Neon City, Thalassia). Their data is already in
`DataTables/`.
