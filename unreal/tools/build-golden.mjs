// Bundles a golden recorder and runs it. The "./sim" imports of encounter-sim.ts and dragonite-cast.ts resolve to the
// recording shims in tools/shims/.
//   node unreal/tools/build-golden.mjs unreal/tools/gen-encounter-golden.ts
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const entry = process.argv[2];
const out = "/tmp/wf-golden-" + entry.split("/").pop().replace(/\.ts$/, ".mjs");
// importer file -> the shim its "./sim" import resolves to
const shims = { "encounter-sim.ts": resolve("unreal/tools/shims/encounter-sim-shim.ts"), "dragonite-cast.ts": resolve("unreal/tools/shims/dragonite-cast-shim.ts") };
await build({
  entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "warning",
  alias: { "@": "./src" },
  plugins: [{ name: "encounter-sim-shim", setup(b) {
    b.onResolve({ filter: /^\.\/sim$/ }, (args) => { const hit = Object.keys(shims).find((f) => args.importer.endsWith(f)); return hit ? { path: shims[hit] } : undefined; });
  } }],
});
execFileSync("node", [out], { stdio: "inherit" });
