// Bundles a golden recorder and runs it. encounter-sim.ts's "./sim" import resolves to tools/shims/encounter-sim-shim.ts.
//   node unreal/tools/build-golden.mjs unreal/tools/gen-encounter-golden.ts
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const entry = process.argv[2];
const out = "/tmp/wf-golden-" + entry.split("/").pop().replace(/\.ts$/, ".mjs");
const shim = resolve("unreal/tools/shims/encounter-sim-shim.ts");
await build({
  entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "warning",
  alias: { "@": "./src" },
  plugins: [{ name: "encounter-sim-shim", setup(b) {
    b.onResolve({ filter: /^\.\/sim$/ }, (args) => (args.importer.endsWith("encounter-sim.ts") ? { path: shim } : undefined));
  } }],
});
execFileSync("node", [out], { stdio: "inherit" });
