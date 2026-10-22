import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const activities = readFileSync(new URL('../../src/game/map-activities.ts', import.meta.url), 'utf8');
const atlas = readFileSync(new URL('../../src/components/game/WorldAtlas.tsx', import.meta.url), 'utf8');
test('future story chapters are omitted from activity data, not just hidden by CSS', () => {
  assert.match(activities, /if \(!p\.completedMissions\.includes\(c\.id\) && next\?\.id !== c\.id\) return;/);
  assert.match(activities, /kind: "STORY"/);
});
test('all destination maps default to safe zones and revealed story markers', () => {
  assert.match(atlas, /a\.kind === "SAFE_ZONE" \|\| a\.kind === "STORY"/);
  assert.match(atlas, /Show patrols, bosses and other activities/);
  assert.match(atlas, /destinationActivities\(progression, dest\)/);
});
