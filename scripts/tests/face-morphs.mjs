import test from 'node:test';
import assert from 'node:assert/strict';
import { MORPHS, morphDisplacement, morphPositions, morphsEqual, morphsOr } from '../../src/game/face-morphs.ts';
import { FEMALE_FACES, MALE_FACES } from '../../src/game/face-catalog.ts';
import { FACES } from '../../src/game/operators.ts';
import { HAIR_STYLES, MARKINGS, BEARDS, ACCESSORIES } from '../../src/game/operator-styling.ts';
import { restyleCharacter, RESTYLE_PRICE } from '../../src/game/restyle.ts';

test('morph values are clamped, rounded and pruned', () => {
  assert.deepEqual(morphsOr({ jaw: 1.7, nose: -0.333, bogus: 1, chin: 0, lips: 'x' }), { jaw: 1, nose: -0.33 });
  assert.deepEqual(morphsOr(undefined), {});
  assert.ok(morphsEqual({ jaw: 0 }, {}));
});
test('every morph moves its own feature and leaves the back of the head and neck alone', () => {
  for (const m of MORPHS) {
    const one = { [m.id]: 1 };
    const back = morphDisplacement(one, 0, 0.08, -0.09), neck = morphDisplacement(one, 0.02, -0.03, 0.0);
    assert.ok(Math.hypot(...back) < 1e-6, `${m.id} moved the back of the head`);
    assert.ok(Math.hypot(...neck) < 1e-6, `${m.id} moved the neck`);
  }
  assert.ok(morphDisplacement({ nose: 1 }, 0, 0.045, 0.1)[2] > 0.005, 'nose tip comes forward');
  assert.ok(morphDisplacement({ jaw: 1 }, 0.06, 0.02, 0.025)[0] > 0.005, 'left jaw corner moves left');
  assert.ok(morphDisplacement({ jaw: 1 }, -0.06, 0.02, 0.025)[0] < -0.005, 'right jaw corner moves right');
  assert.ok(morphDisplacement({ chin: -1 }, 0, 0, 0.078)[1] > 0.005, 'a short chin rises');
});
test('the board\'s 20 + 20 named faces reference real heads, styles, markings, beards and accessories', () => {
  assert.equal(MALE_FACES.length, 20); assert.equal(FEMALE_FACES.length, 20);
  const ids = new Set([...MALE_FACES, ...FEMALE_FACES].map((x) => x.id)); assert.equal(ids.size, 40);
  for (const [body, list] of [['male', MALE_FACES], ['female', FEMALE_FACES]]) for (const x of list) {
    assert.ok(FACES[body].some((h) => h.id === x.head), `${x.id} head ${x.head}`);
    if (x.hair) assert.ok(HAIR_STYLES.some((h) => h.id === x.hair), `${x.id} hair ${x.hair}`);
    for (const m of x.marks ?? []) assert.ok(MARKINGS.some((d) => d.id === m), `${x.id} mark ${m}`);
    if (x.beard) assert.ok(BEARDS.some((b) => b.id === x.beard), `${x.id} beard`);
    if (x.accessory) assert.ok(ACCESSORIES.some((a) => a.id === x.accessory), `${x.id} accessory`);
    assert.deepEqual(morphsOr(x.morphs), x.morphs, `${x.id} morphs in range`);
  }
});
test('morphPositions applies a sculpt in place', () => {
  const xyz = new Float32Array([0, 0.045, 0.1, 0, 0.08, -0.09]);
  morphPositions(xyz, { nose: 1 });
  assert.ok(xyz[2] > 0.1 && xyz[5] === Math.fround(-0.09));
});
test('a sculpt after creation is a priced restyle', () => {
  const character = { deploymentId: 'd', operatorId: 'nyx', classId: 'HUNTER', subclassId: 'x', bodyType: 'female', displayName: 'A', appearance: { armor: '#000000', cloth: '#000000', visor: '#000000', trim: '#000000', callsign: 'A' }, loadout: { weaponOrder: [] } };
  const r = restyleCharacter({ character, nexLedger: { e: 5000 } }, { faceMorphs: { jaw: 0.5, nose: 0.2 } }, 9);
  assert.ok(!('error' in r));
  assert.deepEqual(r.progression.character.faceMorphs, { jaw: 0.5, nose: 0.2 });
  assert.equal(r.progression.nexLedger['restyle:9'], -RESTYLE_PRICE.face);
});
