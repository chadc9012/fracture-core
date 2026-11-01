import test from 'node:test';
import assert from 'node:assert/strict';
import { HAIR_COLORS, HAIR_STYLES, MARKINGS, MAX_MARKINGS, effectiveHairHex, hairColorOr, hairOr, markingsOr, styleLook, toggleMarking } from '../../src/game/operator-styling.ts';
import { MARKING_SHAPES, skinProgram } from '../../src/game/operator-skin-shader.ts';
import { DEFAULT_SKULL, fitSkull, hairGeometry, scalpGeometry } from '../../src/game/hair-geometry.ts';

test('old saves and junk fall back to the face\'s own hair and no markings', () => {
  assert.equal(hairOr(undefined), 'authored');
  assert.equal(hairOr('beehive'), 'authored');
  assert.equal(hairColorOr(42), 'natural');
  assert.deepEqual(markingsOr(undefined), []);
  assert.deepEqual(markingsOr(['scar-cheek', 'nope', 'scar-cheek', 7]), ['scar-cheek']);
});
test('a built style always has a real colour; "as modelled" and bald keep the swatch', () => {
  assert.equal(effectiveHairHex('dreads', 'natural'), HAIR_COLORS[1].hex);
  assert.equal(effectiveHairHex('dreads', 'auburn'), HAIR_COLORS.find((c) => c.id === 'auburn').hex);
  assert.equal(effectiveHairHex('authored', 'natural'), '');
});
test('at most four markings, toggled on and off', () => {
  let m = [];
  for (const d of MARKINGS) m = toggleMarking(m, d.id);
  assert.equal(m.length, MAX_MARKINGS);
  m = toggleMarking(m, m[0]);
  assert.equal(m.length, MAX_MARKINGS - 1);
  assert.deepEqual(toggleMarking(m, 'not-a-mark'), m);
});
test('every marking has shapes and compiles into the skin program', () => {
  for (const d of MARKINGS) assert.ok(MARKING_SHAPES[d.id]?.length, d.id);
  const look = styleLook({ hair: 'bald', hairColor: 'black', marks: MARKINGS.map((d) => d.id).slice(0, 4) });
  const p = skinProgram({ skinHex: '#a8764f', skinLum: 0.2, hairMode: 1, hairHex: look.hairHex, marks: look.marks });
  assert.match(p.fragmentBody, /discard/);
  assert.match(p.fragmentBody, /wfLine\(q/);
  assert.match(p.key, /scar-cheek/);
  // no marks, no hair change and no skin tone: nothing to patch but the retint guard
  const plain = skinProgram({ skinHex: '', skinLum: 0.2, hairMode: 0, hairHex: '', marks: [] });
  assert.doesNotMatch(plain.fragmentBody, /wfLine\(q/);
});
test('every hairstyle builds on the typical skull and on a measured one', () => {
  // a synthetic head: an ellipsoid of vertices with a tail sticking out behind
  const xyz = [];
  for (let i = 0; i < 4000; i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI; xyz.push(0.075 * Math.sin(b) * Math.sin(a), 0.085 + 0.095 * Math.cos(b), -0.005 + 0.09 * Math.sin(b) * Math.cos(a)); }
  for (let i = 0; i < 300; i++) xyz.push((Math.random() - 0.5) * 0.03, 0.12 + Math.random() * 0.05, -0.12 - Math.random() * 0.08);
  const skull = fitSkull(xyz);
  assert.ok(skull.radii.x > 0.05 && skull.radii.x < 0.075, `width ${skull.radii.x}`);
  assert.ok(skull.radii.y > 0.07 && skull.radii.y < 0.1, `height ${skull.radii.y}`);
  for (const h of HAIR_STYLES) {
    const g = hairGeometry(h, skull), g2 = hairGeometry(h, DEFAULT_SKULL);
    if (h.kind === 'authored' || h.kind === 'none') { assert.equal(g, null); continue; }
    assert.ok(g && g.getAttribute('position').count > 100, h.id);
    assert.ok(g2 && g2.getAttribute('color'), h.id);
    assert.ok(g.boundingSphere.radius < 0.45, `${h.id} fits a head`);
  }
  assert.ok(scalpGeometry(skull).getAttribute('position').count > 1000);
});
