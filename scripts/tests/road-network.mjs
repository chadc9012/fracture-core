import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../../src/game/lanes.ts', import.meta.url), 'utf8');
test('surface destinations have multiple road connections and no open-ocean road', () => {
 const edges = [...src.matchAll(/road\("[^"]+", "([^"]+)", "([^"]+)",/g)].map((m)=>[m[1],m[2]]);
 assert.equal(edges.length,14);
 const destinations=['nexus','neon','veridan','frostspire','ember','wastelands','solara','swamps'];
 for(const d of destinations) assert.ok(edges.filter(([a,b])=>a===d||b===d).length>=2,`${d} has two approaches`);
 const visited=new Set(['nexus']);
 let changed=true;
 while(changed){changed=false;for(const [a,b] of edges){if(visited.has(a)&&!visited.has(b)){visited.add(b);changed=true;}if(visited.has(b)&&!visited.has(a)){visited.add(a);changed=true;}}}
 assert.deepEqual([...visited].sort(),destinations.sort());
 assert.ok(!edges.some(([a,b])=>a==='thalassia'||b==='thalassia'));
});
