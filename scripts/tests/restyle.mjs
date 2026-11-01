import test from 'node:test';
import assert from 'node:assert/strict';
import { RESTYLE_PRICE, restyleCharacter, restyleQuote } from '../../src/game/restyle.ts';

const character = { deploymentId: 'd', operatorId: 'goliath', classId: 'TITAN', subclassId: 'x', bodyType: 'male', face: 'm-goliath', displayName: 'A', appearance: { armor: '#000000', cloth: '#000000', visor: '#000000', trim: '#000000', callsign: 'A' }, loadout: { weaponOrder: [] } };
const rich = { character, nexLedger: { earn: 1000 } };

test('a quote prices only what changes', () => {
  assert.equal(restyleQuote(character, {}).price, 0);
  assert.equal(restyleQuote(character, { hair: 'dreads' }).price, RESTYLE_PRICE.hair);
  assert.equal(restyleQuote(character, { marks: ['scar-cheek'] }).price, RESTYLE_PRICE.marks);
  assert.equal(restyleQuote(character, { hair: 'bald', marks: ['scar-cheek'] }).price, RESTYLE_PRICE.hair + RESTYLE_PRICE.marks);
  assert.equal(restyleQuote(character, { hair: 'not-a-style' }).price, 0, 'an unknown style is the current one');
});
test('a restyle charges once and writes the look on the character', () => {
  const r = restyleCharacter(rich, { hair: 'dreads', hairColor: 'auburn', marks: ['scar-cheek', 'bogus'] }, 1);
  assert.ok(!('error' in r));
  assert.equal(r.progression.character.hair, 'dreads');
  assert.equal(r.progression.character.hairColor, 'auburn');
  assert.deepEqual(r.progression.character.marks, ['scar-cheek']);
  assert.equal(r.progression.nexLedger['restyle:1'], -(RESTYLE_PRICE.hair + RESTYLE_PRICE.marks));
  assert.match(r.message, /new style and new markings/);
  assert.deepEqual(restyleCharacter(r.progression, { hair: 'dreads' }, 2), { error: 'Nothing to change' });
});
test('no Nex, no character, or a robot: refused without touching the save', () => {
  assert.match(restyleCharacter({ character, nexLedger: {} }, { hair: 'bald' }, 1).error, /Needs 250 Nex/);
  assert.match(restyleCharacter({ character: null, nexLedger: { e: 999 } }, { hair: 'bald' }, 1).error, /Identity Forge/);
  assert.match(restyleCharacter({ character: { ...character, bodyType: 'robot' }, nexLedger: { e: 999 } }, { hair: 'bald' }, 1).error, /plating/);
});
