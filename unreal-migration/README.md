# Unreal migration kit

World Fracture is moving to Unreal Engine 5.8 (Windows, C++ project on Lyra Starter Game).
The web build stays as the playable spec; this folder carries its data and rules across.

## What's here

- `DataTables/` — every authored table from `src/game` as Unreal DataTable JSON (import these),
  a CSV of each for review, and `MANIFEST.tsv` with row counts.
- `Plugins/WorldFractureCore/` — an Unreal plugin to drop into the project's `Plugins/` folder:
  - `Public/Data/WFDataTableRows.h` — the `F<Table>Row` structs every DataTable imports against.
  - `Public/Core/WFQuestCore.h` + `Private/Core/WFQuestCore.cpp` — the Fracture Descent quest engine,
    ported line for line from `src/game/quests.ts` in plain C++ (no engine types).
  - `UWFQuestSubsystem` — the game-instance subsystem gameplay talks to: `ReportKill`, `ReportMissionComplete`,
    `ReportBossDefeated`… plus the active quest's title, story line and objectives for the HUD, and
    `OnQuestCompleted` / `OnActiveQuestChanged` / `OnWorldUnlocked` events.
  - `UWFCoreSettings` — Project Settings → Game → World Fracture: which DataTable holds the quests,
    starting worlds and shards.
  - `Tests/` — a standalone golden test (below).
- `tools/` — `export-datatables.ts` (regenerates `DataTables/` and the row-struct header) and
  `gen-quest-golden.ts` (records quest states from the TypeScript engine for the C++ test).

## Setting it up in Unreal
1. Create the project from Lyra Starter Game (Fab → Add to My Library → Create Project), as a C++ project.
2. Copy `Plugins/WorldFractureCore` into the project's `Plugins/` folder and regenerate project files; build.
3. Content Browser → Import → `DataTables/Quests.json` → row struct `QuestsRow`. Import the other tables the same way.
4. Project Settings → Game → World Fracture → set **Quest Table** to the imported Quests table.
5. From gameplay (Blueprint or C++): `GetGameInstance()->GetSubsystem<UWFQuestSubsystem>()->ReportKill("veridan")` etc.

Row names are the web build's ids (`AUTO`, `fd-01`, `scrap-interceptor`). Fields ending in `Json` hold nested
data (objectives, rewards, positions) as JSON text until they get their own structs. A data field called `name`
is exported as `DisplayName`, because Unreal reserves `Name` for the row key.

## Keeping it in sync with the web build
Re-run after any tuning or quest change in `src/game` (from the repo root):

    npx esbuild unreal-migration/tools/export-datatables.ts --bundle --platform=node --format=esm \
      --alias:@=./src --outfile=/tmp/wf-export.mjs && node /tmp/wf-export.mjs
    npx esbuild unreal-migration/tools/gen-quest-golden.ts --bundle --platform=node --format=esm \
      --alias:@=./src --outfile=/tmp/wf-golden.mjs && node /tmp/wf-golden.mjs

## Quest engine test
The C++ quest core is checked against 4,200 states recorded from the TypeScript engine (105 cases covering every
quest, pre-filled saves that cascade, the Wastelands corruption unlock, and the end of the chain). From
`Plugins/WorldFractureCore/Tests`:

    g++ -std=c++17 -I../Source/WorldFractureCore/Public QuestCoreTest.cpp \
      ../Source/WorldFractureCore/Private/Core/WFQuestCore.cpp -o quest_test && ./quest_test quest_golden.txt

Expected: `18 quests, 105 cases, 4200 states checked, 0 mismatches`. The Unreal-facing classes
(`UWFQuestSubsystem`, settings, module) have not been compiled inside Unreal yet; the first build on the new PC
is their check.
