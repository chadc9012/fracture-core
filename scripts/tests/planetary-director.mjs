import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../src/', import.meta.url);
const director = readFileSync(new URL('components/game/OrbitalDirector.tsx', root), 'utf8');
test('director uses real planetary terrain and not orbital artwork', () => {
  assert.match(director, /useTerrainMap\(/);
  assert.match(director, /<MapLayers art=\{terrain\.url\}/);
  assert.doesNotMatch(director, /const positions:|<Orbit|radial-gradient\(ellipse/);
});
test('all cities and regions derive from live geographical coordinates', () => {
  assert.match(director, /\.\.\.REGIONS, \.\.\.CITY_DESTINATIONS/);
  assert.match(director, /translate\(\$\{city\.x\} \$\{city\.z\}\)/);
  assert.match(director, /selected\.x - focusSpan/);
  assert.match(director, /dropPoint\(selected\)/);
});
test('region zoom, real landing coordinates, and launch remain wired', () => {
  assert.match(director, /useDetailMap\(/);
  assert.match(director, /setZoomed\(true\)/);
  assert.match(director, /onDeploy\(\{ id: selected\.id/);
});
test('destination index remains accessible and uses the same world destination records', () => {
  assert.match(director, /aria-label="All planetary destinations"/);
  assert.match(director, /destinations\.map\(\(d\) =>/);
  assert.match(director, /onClick=\{\(\) => select\(d\.id\)\}/);
  assert.match(director, /aria-pressed=\{showIndex\}/);
});
