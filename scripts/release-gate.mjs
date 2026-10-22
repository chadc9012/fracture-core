/** Release gate: executes all available checks, never equates preflight with release approval. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const vite = resolve(root, 'node_modules', '.bin', 'vite');
const vitest = resolve(root, 'node_modules', '.bin', 'vitest');
const tsc = resolve(root, 'node_modules', '.bin', 'tsc');
const dependenciesInstalled = existsSync(vite) && existsSync(vitest) && existsSync(tsc);
const packageManager = existsSync(resolve(root, 'bun.lock')) ? 'bun' : existsSync(resolve(root, 'package-lock.json')) ? 'npm' : 'unknown';
const installGuidance = packageManager === 'bun' ? 'Use bun install --frozen-lockfile; npm ci is incompatible with this Bun-only lockfile.' : packageManager === 'npm' ? 'Use npm ci.' : 'No supported lockfile found; resolve package-manager setup before building.';
const gameplayTests = readdirSync(resolve(root, 'scripts', 'tests')).filter(name => name.endsWith('.mjs')).sort().map(name => `scripts/tests/${name}`);
const checks = [
  { name: 'source-audit', command: node, args: ['scripts/release-audit.mjs'], required: true },
  { name: 'gameplay-core', command: node, args: ['--experimental-strip-types', '--test', ...gameplayTests], required: true },
  { name: 'typescript', command: tsc, args: ['--noEmit', '-p', 'tsconfig.json'], required: true, available: existsSync(tsc) },
  { name: 'unit-tests', command: vitest, args: ['run'], required: true, available: existsSync(vitest) },
  { name: 'production-build', command: vite, args: ['build'], required: true, available: dependenciesInstalled },
];
const results = checks.map(({ name, command, args, available = true }) => {
  if (!available) return { name, status: 'blocked', exitCode: null, durationMs: 0, error: 'Required project dependency is not installed' };
  const started = Date.now();
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { name, status: result.status === 0 && !result.error ? 'passed' : 'failed', exitCode: result.status, durationMs: Date.now() - started, error: result.error?.message ?? null };
});
const blockers = [
  ...results.filter(r => r.status !== 'passed').map(r => `${r.name}: ${r.status}${r.error ? ` (${r.error})` : ''}`),
  'Browser gameplay, controller operation, performance, and save migrations require hands-on verification',
  'Multiplayer is explicitly deferred from the single-player release scope',
];
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'Automated checks with explicit blocked status for missing dependencies',
  checks: results,
  dependenciesInstalled,
  packageManager,
  installGuidance,
  automatedChecksPassed: results.every(r => r.status === 'passed'),
  releaseReady: false,
  blockers,
};
const out = resolve(root, 'release-reports', 'latest-preflight.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`Release preflight report: ${out}`);
console.log(`Automated checks: ${results.filter(r => r.status === 'passed').length}/${results.length} passed`);
if (!dependenciesInstalled) console.log(`Dependency blocker: ${installGuidance}`);
console.log('Release-ready: NO (full build and manual single-player checks outstanding; multiplayer deferred)');
if (results.some(r => r.status !== 'passed')) process.exitCode = 1;
