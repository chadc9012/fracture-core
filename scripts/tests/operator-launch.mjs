import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { launchDestination } from '../../src/game/launch-flow.ts';
const character = { classId: 'TITAN' };
test('new save opens character creation', () => assert.equal(launchDestination({character:null,completedMissions:[],tutorialComplete:false}), 'creation'));
test('created operator resumes opening mission', () => assert.equal(launchDestination({character,completedMissions:[],tutorialComplete:false}), 'mission'));
test('completed first mission opens destination map', () => assert.equal(launchDestination({character,completedMissions:['mission-01'],tutorialComplete:false}), 'director'));
test('migrated tutorial-complete save opens destination map', () => assert.equal(launchDestination({character,completedMissions:[],tutorialComplete:true}), 'director'));
