import test from 'node:test';
import assert from 'node:assert/strict';
import { createDungeonLobby, inviteToDungeon, joinDungeon, setDungeonReady, launchDungeon } from '../../src/game/dungeon-lobby.ts';
import { beginDungeonRun, advanceDungeonObjective, recordDungeonDeath, restartDungeonAtCheckpoint } from '../../src/game/dungeon-run.ts';

function launched() {
  let lobby = createDungeonLobby('dungeon-test', 'arcology_vaults', 'host', 'NYX');
  assert.ok(lobby);
  lobby = inviteToDungeon(lobby, 'host', 'guest').lobby;
  lobby = joinDungeon(lobby, 'guest', 'CIPHER').lobby;
  lobby = setDungeonReady(lobby, 'host', true).lobby;
  lobby = setDungeonReady(lobby, 'guest', true).lobby;
  return launchDungeon(lobby, 'host').lobby;
}
test('launched two-player dungeon advances stages and clears exactly once', () => {
  let run = beginDungeonRun(launched());
  assert.ok(run);
  assert.equal(advanceDungeonObjective(run, 'outsider', 'entry_burial_gates').error, 'Actor is not in fireteam');
  assert.equal(advanceDungeonObjective(run, 'host', 'archive_corridors').error, 'Wrong stage');
  for (const [stage, target] of [['entry_burial_gates',3],['archive_corridors',4],['data_flood_chambers',3],['core_shaft_descent',4],['archive_guardian_boss',8]]) {
    const result = advanceDungeonObjective(run, 'guest', stage, target);
    assert.equal(result.error, undefined);
    run = result.run;
  }
  assert.equal(run.status, 'CLEARED');
  assert.equal(run.completedStageIds.length, 5);
  assert.equal(advanceDungeonObjective(run, 'guest', 'archive_guardian_boss').error, 'Run is not active');
});
test('wipe consumes shared lives and resumes after last checkpoint', () => {
  let run = beginDungeonRun(launched());
  run = advanceDungeonObjective(run, 'host', 'entry_burial_gates', 3).run;
  for (let i=0;i<3;i++) run = recordDungeonDeath(run, 'host').run;
  assert.equal(run.status, 'WIPED');
  assert.equal(recordDungeonDeath(run, 'host').error, 'Run is not active');
  const restarted = restartDungeonAtCheckpoint(run);
  assert.equal(restarted.stageIndex, 1);
  assert.equal(restarted.livesRemaining, 3);
  assert.deepEqual(restarted.completedStageIds, ['entry_burial_gates']);
});
test('unlaunched lobbies and invalid progress cannot create rewards or progress', () => {
  assert.equal(beginDungeonRun(createDungeonLobby('id', 'arcology_vaults', 'host', 'NYX')), null);
  const run = beginDungeonRun(launched());
  for (const amount of [0, -1, 1.2, Infinity, NaN, 101]) {
    assert.equal(advanceDungeonObjective(run, 'host', 'entry_burial_gates', amount).run, run);
  }
});

test('checkpoint restart discards stale post-checkpoint stage records', () => {
  let run = beginDungeonRun(launched());
  assert.ok(run);
  run = advanceDungeonObjective(run, 'host', 'entry_burial_gates', 3).run;
  // A damaged/legacy run snapshot may contain a noncheckpoint stage past the durable checkpoint.
  const stale = { ...run, completedStageIds: ['entry_burial_gates', 'archive_guardian_boss'], status: 'WIPED', livesRemaining: 0 };
  const restarted = restartDungeonAtCheckpoint(stale);
  assert.deepEqual(restarted.completedStageIds, ['entry_burial_gates']);
  assert.equal(restarted.stageIndex, 1);
});
