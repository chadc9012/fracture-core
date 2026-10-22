import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../src/components/game/', import.meta.url);
test('both planetary map screens draw Thalassia from its live city coordinates', () => {
  const city = readFileSync(new URL('ThalassiaMapCity.tsx', root), 'utf8');
  assert.match(city, /CITY_DESTINATIONS\.find\(\(destination\) => destination\.id === "thalassia"\)/);
  assert.match(city, /translate\(\$\{city\.x\} \$\{city\.z\}\)/);
  assert.match(city, /pointerEvents="none"/);
  for (const screen of ['OrbitalDirector.tsx', 'WorldAtlas.tsx']) {
    assert.match(readFileSync(new URL(screen, root), 'utf8'), /<ThalassiaMapCity/);
  }
});
