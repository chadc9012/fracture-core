import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../../src/game/lanes.ts', import.meta.url), 'utf8');
test('every surface destination is reachable by road, and no road crosses open ocean', () => {
 const edges = [...src.matchAll(/road\("[^"]+", "([^"]+)", "([^"]+)",/g)].map((m)=>[m[1],m[2]]);
 const destinations=['nexus','neon','veridan','frostspire','ember','wastelands','solara','swamps'];
 // lanes.ts lists which proposed roads are still waiting on grading work; until then some places have one approach
 for(const d of destinations) assert.ok(edges.some(([a,b])=>a===d||b===d),`${d} has a road`);
 const visited=new Set(['nexus']);
 let changed=true;
 while(changed){changed=false;for(const [a,b] of edges){if(visited.has(a)&&!visited.has(b)){visited.add(b);changed=true;}if(visited.has(b)&&!visited.has(a)){visited.add(a);changed=true;}}}
 assert.deepEqual([...visited].sort(),destinations.sort());
 assert.ok(!edges.some(([a,b])=>a==='thalassia'||b==='thalassia'));
});
