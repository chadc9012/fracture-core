/** Dependency-free smoke tests for deterministic gameplay modules.
 * Run: node --experimental-strip-types --test scripts/tests/release-smoke.mjs
 * These checks do not replace Vitest, browser playtesting, or a production build.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyChainState, registerChainHit, resolveChainDamage } from '../../src/game/legendary-chain.ts';
import { VEHICLE_TUNING_PRESETS } from '../../src/stage/vehicles/vehicleDynamics.ts';

test('elemental chain combines distinct operators once, without replay damage', () => {
  const first = registerChainHit(emptyChainState(), { id: 'arc1', targetId: 'boss', sourceId: 'nyx', element: 'ARC', at: 100 });
  const second = registerChainHit(first.state, { id: 'fire1', targetId: 'boss', sourceId: 'cipher', element: 'THERMAL', at: 200 });
  assert.equal(second.reaction?.kind, 'THERMAL_SHOCK');
  assert.equal(resolveChainDamage(100, second.reaction), 120);
  assert.equal(registerChainHit(second.state, { id: 'fire1', targetId: 'boss', sourceId: 'cipher', element: 'THERMAL', at: 200 }).reaction, null);
});

test('chain rejects malformed, stale and invalid damage', () => {
  const first = registerChainHit(emptyChainState(), { id: 'arc1', targetId: 'boss', sourceId: 'nyx', element: 'ARC', at: 500 });
  assert.equal(registerChainHit(first.state, { id: 'bad id', targetId: 'boss', sourceId: 'cipher', element: 'THERMAL', at: 600 }).reaction, null);
  assert.equal(registerChainHit(first.state, { id: 'old', targetId: 'boss', sourceId: 'cipher', element: 'THERMAL', at: 400 }).reaction, null);
  assert.equal(resolveChainDamage(Number.NaN, null), 0);
  assert.equal(resolveChainDamage(100, { targetId: 'boss', kind: 'SHATTER', triggerId: 'bad', damageMultiplier: Infinity }), 100);
});

test('vehicle tuning covers all supported classes with finite safe limits', () => {
  assert.deepEqual(Object.keys(VEHICLE_TUNING_PRESETS).sort(), ['aircraft', 'boat', 'car', 'hovercraft', 'motorcycle', 'submarine', 'truck'].sort());
  for (const [name, tuning] of Object.entries(VEHICLE_TUNING_PRESETS)) {
    assert.ok(['ground', 'air', 'water', 'submersible'].includes(tuning.mode), name);
    for (const key of ['maxForwardSpeed', 'acceleration', 'braking', 'turnRate']) {
      assert.ok(Number.isFinite(tuning[key]) && tuning[key] > 0, `${name}.${key}`);
    }
  }
});


test('independent targets retain combo marks when hit clocks differ', () => {
  const a = registerChainHit(emptyChainState(), { id: 'a1', targetId: 'bossA', sourceId: 'nyx', element: 'ARC', at: 1000 });
  const b = registerChainHit(a.state, { id: 'b1', targetId: 'bossB', sourceId: 'nyx', element: 'ARC', at: 100 });
  assert.equal(b.state.marks.length, 2);
  const c = registerChainHit(b.state, { id: 'b2', targetId: 'bossB', sourceId: 'cipher', element: 'THERMAL', at: 200 });
  assert.equal(c.reaction?.kind, 'THERMAL_SHOCK');
  assert.ok(c.state.marks.some(mark => mark.targetId === 'bossA'));
});
