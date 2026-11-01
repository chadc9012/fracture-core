import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_PRESETS, MORPHS, morphDisplacement, morphPositions, morphsEqual, morphsOr } from '../../src/game/face-morphs.ts';
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
test('presets are distinct and morphPositions applies them in place', () => {
  const ids = new Set(FACE_PRESETS.map((p) => p.id));
  assert.equal(ids.size, FACE_PRESETS.length);
  for (let i = 0; i < FACE_PRESETS.length; i++) for (let j = i + 1; j < FACE_PRESETS.length; j++) assert.ok(!morphsEqual(FACE_PRESETS[i].morphs, FACE_PRESETS[j].morphs));
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
