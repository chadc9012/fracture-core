# Unreal migration kit

World Fracture is moving to Unreal Engine 5.8 (Windows, C++ project on Lyra Starter Game).
The web build stays as the playable spec; this folder carries its data across.

- `DataTables/` — every authored table from `src/game` as Unreal DataTable JSON (import these),
  a CSV of each for review, `WFDataTableRows.h` with the matching `F<Table>Row` structs, and
  `MANIFEST.tsv` with row counts.
- `tools/export-datatables.ts` — regenerates `DataTables/` from the current source. Re-run it
  whenever tuning changes in the web build:

      npx esbuild unreal-migration/tools/export-datatables.ts --bundle --platform=node --format=esm \
        --alias:@=./src --outfile=/tmp/wf-export.mjs && node /tmp/wf-export.mjs

## Importing into Unreal
1. Copy `WFDataTableRows.h` into your game module's `Public/` folder and build the project.
2. Content Browser → Import → pick a `.json`, choose the matching `F<Table>Row` struct.
3. Row names are the web build's ids (`AUTO`, `fd-01`, `scrap-interceptor`), so code can look rows up by the same ids.

Fields ending in `Json` hold nested data (objectives, rewards, positions) as JSON text until they get
their own structs. A data field called `name` is exported as `DisplayName`, because Unreal reserves `Name`
for the row key.
