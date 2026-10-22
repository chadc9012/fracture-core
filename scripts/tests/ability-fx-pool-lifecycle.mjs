import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../src/components/game/AbilityFx.tsx', import.meta.url), 'utf8');
test('expired ability casts release their pooled slot before signature rendering', () => {
  assert.match(source, /if \(slot && f && !f\.active\) slots\.current\[i\] = null/);
  const release = source.indexOf('slots.current[i] = null');
  const draw = source.indexOf('drawSignature(sig.current, slots.current, now');
  assert.ok(release >= 0 && draw > release, 'signature must draw after expiration');
});
