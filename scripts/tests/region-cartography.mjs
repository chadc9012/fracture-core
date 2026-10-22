import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const chart = readFileSync(new URL('../../src/game/region-cartography.ts', import.meta.url), 'utf8');
const atlas = readFileSync(new URL('../../src/components/game/WorldAtlas.tsx', import.meta.url), 'utf8');
test('every playable region and city has its own local chart treatment', () => {
  for (const id of ['nexus', 'neon-city', 'thalassia', 'veridan', 'frostspire', 'ember', 'wastelands', 'solara', 'swamps']) assert.match(chart, new RegExp(`(?:^|\\n)  ['"]?${id}['"]?: \\{`, 'm'));
});
test('cartographic overlays are anchored to world coordinates and noninteractive', () => {
  assert.match(atlas, /<RegionChartPattern regionId=\{chartRegionId\} x=\{focus\.x\} z=\{focus\.z\}/);
  assert.match(atlas, /pointerEvents="none" opacity=\{0\.32\}/);
});
