import test from 'node:test';
import assert from 'node:assert/strict';
import { createDungeonLobby, inviteToDungeon, joinDungeon, setDungeonReady, launchDungeon } from '../../src/game/dungeon-lobby.ts';
import { beginDungeonRun, advanceDungeonObjective, restoreDungeonRun, validateDungeonRunSnapshot } from '../../src/game/dungeon-run.ts';
function start() {
 let lobby = createDungeonLobby('persist-1', 'arcology_vaults', 'host', 'NYX');
 lobby = inviteToDungeon(lobby, 'host', 'guest').lobby;
 lobby = joinDungeon(lobby, 'guest', 'CIPHER').lobby;
 lobby = setDungeonReady(lobby, 'host', true).lobby;
 lobby = setDungeonReady(lobby, 'guest', true).lobby;
 return beginDungeonRun(launchDungeon(lobby, 'host').lobby);
}
test('dungeon run restores a valid saved checkpoint without sharing arrays', () => {
 const run = advanceDungeonObjective(start(), 'host', 'entry_burial_gates', 3).run;
 const restored = restoreDungeonRun(JSON.parse(JSON.stringify(run)));
 assert.deepEqual(restored, run);
 assert.notEqual(restored.completedStageIds, run.completedStageIds);
 assert.notEqual(restored.memberIds, run.memberIds);
});
test('dungeon run rejects forged clears, skipped stages and invalid lives', () => {
 const run = start();
 for (const patch of [
  { status: 'CLEARED' }, { stageIndex: 2 }, { stageProgress: -1 },
  { livesRemaining: -1 }, { status: 'WIPED' },
  { memberIds: ['host', 'host'] }, { completedStageIds: ['archive_guardian_boss'] },
  { stageProgress: Number.NaN }, { memberIds: ['host', 'guest', 'other', 'fourth'] },
 ]) assert.equal(validateDungeonRunSnapshot({ ...run, ...patch }), false, JSON.stringify(patch));
 assert.equal(restoreDungeonRun(null), null);
});
