// Records every golden file for the Unreal core tests (Plugins/WorldFractureCore/Tests/<name>_golden.txt) from the web build.
// The goldens are generated, not committed: together they run to ~60 MB of text, which the Lovable preview build choked on.
// Run from the repo root before configuring the CMake tests:
//   node unreal/tools/gen-goldens.mjs            (all of them)
//   node unreal/tools/gen-goldens.mjs race shop  (just these)
import { build } from "esbuild";
import { execFileSync } from "node:child_process";

// recorders whose world calls go through the recording shims (build-golden.mjs); the rest bundle plainly
const SHIMMED = new Set(["encounter", "dragoncast", "ability", "tactics", "wasteland"]);
const ALL = ["quest", "reward", "mission", "missionreward", "dragon", "vehicle", "race", "vweapons", "shop", "fleet", "housing", "encounter", "dragoncast", "ability", "operator", "city", "perception", "arms", "armor", "tactics", "bounty", "move", "wasteland"];

const pick = process.argv.slice(2);
const todo = pick.length ? ALL.filter((n) => pick.includes(n)) : ALL;
for (const name of todo) {
  const entry = `unreal/tools/gen-${name}-golden.ts`;
  const t0 = Date.now();
  if (SHIMMED.has(name)) execFileSync("node", ["unreal/tools/build-golden.mjs", entry], { stdio: "inherit" });
  else {
    const out = `/tmp/wf-golden-plain-${name}.mjs`;
    await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "warning", alias: { "@": "./src" } });
    execFileSync("node", [out], { stdio: "inherit" });
  }
  console.log(`golden ${name}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
