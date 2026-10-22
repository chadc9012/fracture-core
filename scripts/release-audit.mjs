/** Dependency-free source/asset preflight. Run: node scripts/release-audit.mjs */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, extname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.svg', '.png', '.jpg', '.webp', '.glb', '.d.ts', '/index.ts', '/index.tsx', '/index.js'];
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
  });
}
function resolves(base) { return extensions.some(suffix => existsSync(base + suffix) && statSync(base + suffix).isFile()); }
function inspect() {
  const files = walk(src);
  const problems = [];
  let imports = 0;
  let metadata = 0;
  for (const file of files) {
    if (/\.(?:ts|tsx|js|jsx)$/.test(file)) {
      const content = readFileSync(file, 'utf8');
      const pattern = /(?:\bfrom\s*|\bimport\s*\(|\bimport\s*)["'`]([^"'`]+)["'`]/g;
      for (const match of content.matchAll(pattern)) {
        const specifier = match[1].split('?')[0].split('#')[0];
        if (!specifier.startsWith('@/') && !specifier.startsWith('./') && !specifier.startsWith('../')) continue;
        imports++;
        const target = specifier.startsWith('@/') ? resolve(src, specifier.slice(2)) : resolve(dirname(file), specifier);
        if (!resolves(target)) problems.push({ file: relative(root, file), problem: `Missing import: ${specifier}` });
      }
    }
    if (file.endsWith('.asset.json')) {
      metadata++;
      try {
        const data = JSON.parse(readFileSync(file, 'utf8'));
        if (typeof data.url !== 'string' || !data.url.startsWith('/') || typeof data.asset_id !== 'string' || !Number.isFinite(data.size) || data.size <= 0) {
          problems.push({ file: relative(root, file), problem: 'Invalid hosted-asset metadata' });
        }
      } catch { problems.push({ file: relative(root, file), problem: 'Invalid asset JSON' }); }
    }
  }
  const report = { sourceFiles: files.length, testFiles: files.filter(f => /\.test\.[cm]?[jt]sx?$/.test(f)).length, checkedLocalImports: imports, hostedAssetManifests: metadata, problems };
  return report;
}
const report = inspect();
console.log(JSON.stringify(report, null, 2));
if (report.problems.length) process.exitCode = 1;
