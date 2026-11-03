import test from 'node:test';
import assert from 'node:assert/strict';
import { MELEE_CLASS, MELEE_CLASSES, activeBlade, catalogBlade, meleeClassOf, swingStats, BLADES } from '../../src/game/foundries.ts';
import { WEAPON_CATALOG } from '../../src/game/weapon-catalog.ts';
import { migrateMeleeSlots } from '../../src/game/weapon-loot.ts';

const gear = (name, slot = 'melee', power = 200, extra = {}) => ({ id: `drop-x-${name}`, name, slot, power, level: 1, element: 'KINETIC', source: 't', ...extra });

test('every catalogue melee item resolves to its class and swings as a blade', () => {
  const melee = WEAPON_CATALOG.filter((w) => w.archetype === 'BLADE');
  assert.ok(melee.length >= 40);
  for (const w of melee) {
    const item = gear(w.name);
    assert.equal(meleeClassOf(item), w.cls, w.name);
    const b = catalogBlade(item);
    assert.ok(b && b.damage > 0 && b.cls === w.cls, w.name);
  }
  for (const c of MELEE_CLASSES) assert.ok(MELEE_CLASS[c].speed > 0);
});

test('class numbers: daggers fast and short, greatswords slow and long, hammers crack armour with a shockwave', () => {
  const d = catalogBlade(gear('Scrap Shiv')), g = catalogBlade(gear('Bulwark Claymore')), h = catalogBlade(gear('Breaker Maul')), p = catalogBlade(gear('Picket Spear'));
  assert.ok(d.speed > 1.5 && d.reach < 0 && d.damage < g.damage);
  assert.ok(g.speed < 0.7 && g.reach > 1 && g.shockwave);
  assert.ok(h.armored >= 1.5 && h.shockwave && h.shockwave.length > g.shockwave.length);
  assert.ok(p.reach >= 3);
  const base = { damage: 10, reach: 6 };
  assert.ok(swingStats(h, 1, base, true).damage > swingStats(h, 1, base, false).damage);
  assert.equal(swingStats(d, 3, base, false).shockwave, null);
  assert.ok(swingStats(g, 3, base, false).shockwave);
});

test('power and rarity scale the blade a little; manifest blades classify by name', () => {
  const low = catalogBlade(gear('Neon Katana', 'melee', 100)), high = catalogBlade(gear('Neon Katana', 'melee', 400)), exotic = catalogBlade(gear('Neon Katana', 'melee', 100, { rarity: 'EXOTIC' }));
  assert.ok(high.damage > low.damage && high.damage <= low.damage * 1.35);
  assert.ok(exotic.damage > low.damage);
  assert.equal(meleeClassOf(gear('Ash-Born Thermal-Slade Maul')), 'warhammer');
  assert.equal(meleeClassOf(gear('Void-Shard Blade')), 'sword');
  assert.equal(meleeClassOf(gear('Neon Katana', 'primary')), null);
});

test('the worn melee item wins over a monoblade; without one the monoblade swings', () => {
  const p = { earnedRewards: ['blade:vectal'], blade: 'vectal' };
  assert.equal(activeBlade(p), BLADES.vectal);
  assert.equal(activeBlade({ ...p, melee: gear('Thunder Axe') }).cls, 'axe');
  assert.equal(activeBlade({ earnedRewards: [], blade: 'vectal' }), null);
});

test('old saves: primary-slot catalogue blades move to the melee slot and the strongest rifle takes the primary', () => {
  const save = { inventory: [gear('Neon Katana', 'primary'), gear('Axiom AR', 'primary', 150), gear('Titan Auto', 'primary', 220)], equippedGear: { primary: 'drop-x-Neon Katana' } };
  const out = migrateMeleeSlots(save);
  assert.equal(out.inventory[0].slot, 'melee');
  assert.equal(out.inventory[1].slot, 'primary');
  assert.equal(out.equippedGear.primary, 'drop-x-Titan Auto');
  assert.equal(migrateMeleeSlots(out), out);
});
