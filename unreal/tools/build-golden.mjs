// Bundles a golden recorder and runs it. The world imports of encounter-sim.ts, dragonite-cast.ts and ability-effects.ts
// resolve to the recording shims in tools/shims/.
//   node unreal/tools/build-golden.mjs unreal/tools/gen-encounter-golden.ts
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const entry = process.argv[2];
const out = "/tmp/wf-golden-" + entry.split("/").pop().replace(/\.ts$/, ".mjs");
// importer file -> { import specifier -> the shim it resolves to }
const shims = {
  "encounter-sim.ts": { "./sim": resolve("unreal/tools/shims/encounter-sim-shim.ts") },
  "dragonite-cast.ts": { "./sim": resolve("unreal/tools/shims/dragonite-cast-shim.ts") },
  "ability-effects.ts": { "./sim": resolve("unreal/tools/shims/ability-sim-shim.ts"), "./boss-poise": resolve("unreal/tools/shims/ability-poise-shim.ts"), "./obstacles": resolve("unreal/tools/shims/ability-obstacles-shim.ts") },
};
await build({
  entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "warning",
  alias: { "@": "./src" },
  plugins: [{ name: "encounter-sim-shim", setup(b) {
    b.onResolve({ filter: /^\.\/(sim|boss-poise|obstacles)$/ }, (args) => { const hit = Object.keys(shims).find((f) => args.importer.endsWith(f)); const to = hit && shims[hit][args.path]; return to ? { path: to } : undefined; });
  } }],
});
execFileSync("node", [out], { stdio: "inherit" });
