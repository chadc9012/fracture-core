// Copies every Lovable-hosted asset (src/**/*.asset.json, served at /__l5e/assets-v1/... on the website) into the Android app's web
// folder at the same path, so the APK has them. Without this the app asked its own built-in server for /__l5e/... and got nothing:
// ferns, shrubs, mossy rocks, fallen logs, audio, menu art and region models were missing on the owner's phone (Oct 26 2026).
//
// usage: node scripts/bundle-hosted-assets.mjs <outDir>   (CI: mobile/www). Hosts tried in order: $WF_ASSET_HOSTS (space separated),
// then the project's two Lovable hosts. A file that no host serves is reported and skipped (the game shows its fallback for it).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const out = process.argv[2];
if (!out) { console.error("usage: bundle-hosted-assets.mjs <outDir>"); process.exit(2); }
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".asset.json") ? [join(d, e.name)] : []));
const assets = walk("src").map((f) => JSON.parse(readFileSync(f, "utf8"))).filter((a) => typeof a.url === "string" && a.url.startsWith("/__l5e/"));
const projects = [...new Set(assets.map((a) => a.project_id))];
const hosts = [...(process.env.WF_ASSET_HOSTS ?? "").split(/\s+/).filter(Boolean), ...projects.flatMap((p) => [`https://${p}.lovableproject.com`, `https://id-preview--${p}.lovable.app`])];
let ok = 0, bytes = 0; const failed = [];
for (const a of assets) {
  const dest = join(out, a.url);
  if (existsSync(dest) && statSync(dest).size === a.size) { ok++; continue; }
  let got = null, why = "";
  for (const h of hosts) {
    try {
      const res = await fetch(h + a.url, { redirect: "follow" });
      if (!res.ok) { why = `${h}: ${res.status}`; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (a.size && buf.length !== a.size) { why = `${h}: ${buf.length} bytes, expected ${a.size}`; continue; }
      got = buf; break;
    } catch (e) { why = `${h}: ${e.message}`; }
  }
  if (!got) { failed.push(`${a.original_filename} (${why})`); continue; }
  mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, got); ok++; bytes += got.length;
}
console.log(`hosted assets: ${ok}/${assets.length} bundled (${(bytes / 1e6).toFixed(1)} MB downloaded)`);
if (failed.length) console.log("not bundled:\n  " + failed.join("\n  "));
