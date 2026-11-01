import test from 'node:test';
import assert from 'node:assert/strict';
import { COSMETICS, COSMETIC_SLOTS, buyCosmetic, grantCosmetic, normalizeCosmetics, removeCosmetic, wearCosmetic, wornCosmetics } from '../../src/game/cosmetics.ts';
import { OUTFITS, buyOutfit, wearOutfit } from '../../src/game/clothing-sets.ts';
import { SEASONAL_EVENTS, activeEventIds, eventRuns } from '../../src/game/seasonal.ts';
import { normalizeTransmog, setTransmog, transmogOptions } from '../../src/game/transmog.ts';
import { cosmeticPieces } from '../../src/game/cosmetic-geometry.ts';

const character = { deploymentId: 'd', operatorId: 'goliath', classId: 'TITAN', subclassId: 'x', bodyType: 'male', displayName: 'A', appearance: { armor: '#111111', cloth: '#222222', visor: '#333333', trim: '#444444', callsign: 'A' }, loadout: { weaponOrder: [] } };
const fresh = () => ({ earnedRewards: [], nexLedger: { e: 5000 }, cosmetics: {}, character, outfit: null, inventory: [], transmog: {} });

test('every cosmetic has a slot, a unique id, a visual, and seasonal ones name a real event', () => {
  const ids = new Set(COSMETICS.map((c) => c.id)); assert.equal(ids.size, COSMETICS.length);
  for (const c of COSMETICS) { assert.ok(COSMETIC_SLOTS.includes(c.slot), c.id); if (c.event) assert.ok(SEASONAL_EVENTS.some((e) => e.id === c.event), `${c.id} event ${c.event}`); }
  for (const o of OUTFITS) if (o.event) assert.ok(SEASONAL_EVENTS.some((e) => e.id === o.event), o.id);
  assert.ok(cosmeticPieces(COSMETICS).length >= COSMETICS.length, 'every item draws');
});
test('buying a cosmetic charges once, wears it, and unowned or event-locked stock is refused', () => {
  let p = fresh();
  const r = buyCosmetic(p, 'cape-vanguard'); assert.ok(!('error' in r)); p = r.progression;
  assert.equal(p.cosmetics.back, 'cape-vanguard'); assert.equal(p.nexLedger['cosmetic:cape-vanguard'], -800);
  assert.match(buyCosmetic(p, 'cape-vanguard').message, /Wearing/);
  assert.match(buyCosmetic(p, 'wings-aether').error, /isn't for sale/);
  assert.match(buyCosmetic(p, 'wings-bat', []).error, /only sold during/);
  assert.ok(!('error' in buyCosmetic(p, 'wings-bat', ['halloween'])));
  assert.deepEqual(wearCosmetic(p, 'wings-aether').cosmetics, p.cosmetics, 'unowned is ignored');
  p = grantCosmetic(p, 'wings-aether'); p = wearCosmetic(p, 'wings-aether');
  assert.equal(p.cosmetics.back, 'wings-aether');
  assert.equal(wornCosmetics(p).length, 1);
  assert.deepEqual(removeCosmetic(p, 'back').cosmetics, {});
  assert.deepEqual(normalizeCosmetics({ back: 'wings-aether', neck: 'nope', hands: 'cape-vanguard' }, p.earnedRewards), { back: 'wings-aether' });
});
test('an outfit writes its colours on the character and remembers itself', () => {
  let p = fresh();
  const r = buyOutfit(p, 'cyberpunk'); assert.ok(!('error' in r)); p = r.progression;
  assert.equal(p.outfit, 'cyberpunk'); assert.equal(p.character.appearance.visor, '#41e6ff'); assert.equal(p.character.appearance.callsign, 'A');
  assert.match(buyOutfit(p, 'halloween-witch', []).error, /only sold during/);
  assert.deepEqual(wearOutfit(p, 'formal'), p, 'unowned');
  assert.match(buyOutfit({ ...fresh(), character: null }, 'casual').error, /Identity Forge/);
});
test('seasonal windows, including ones that wrap the new year', () => {
  const winter = SEASONAL_EVENTS.find((e) => e.id === 'winter');
  assert.ok(eventRuns(winter, 12, 25)); assert.ok(eventRuns(winter, 1, 3)); assert.ok(!eventRuns(winter, 2, 1));
  assert.ok(activeEventIds(new Date(2026, 9, 31)).includes('halloween'));
  assert.ok(activeEventIds(new Date(2026, 6, 4)).includes('independence'));
  assert.ok(!activeEventIds(new Date(2026, 4, 15)).includes('halloween'));
});
test('transmog shows only owned pieces of the right slot', () => {
  const helmetA = { id: 'h1', name: 'Hood', slot: 'helmet', power: 1, level: 1, element: 'ARC', source: '', setId: 'verdant-warden' };
  const chest = { id: 'c1', name: 'Plate', slot: 'chest', power: 1, level: 1, element: 'ARC', source: '' };
  let p = { ...fresh(), inventory: [helmetA, chest] };
  assert.deepEqual(transmogOptions(p, 'helmet').map((g) => g.id), ['h1']);
  p = setTransmog(p, 'helmet', 'c1'); assert.deepEqual(p.transmog, {});
  p = setTransmog(p, 'helmet', 'h1'); assert.deepEqual(p.transmog, { helmet: 'h1' });
  assert.deepEqual(normalizeTransmog({ helmet: 'h1', chest: 'gone' }, p.inventory), { helmet: 'h1' });
  assert.deepEqual(setTransmog(p, 'helmet', null).transmog, {});
});
