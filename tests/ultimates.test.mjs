import test from 'node:test';
import assert from 'node:assert/strict';
import { ultimateArea, inUltimateArea, ULTIMATES } from '../shared/ultimates.js';
import { access } from 'node:fs/promises';
test('ultimate area rejects unbounded coordinates and always contains its caster',()=>{
  const p={x:800,y:600};
  for(const view of [undefined,{x:Infinity,y:NaN,width:Infinity,height:-1},{x:1e9,y:-1e9,width:1e9,height:1e9}]) {
    const a=ultimateArea(p,view);
    assert.ok(a.width<=2400&&a.height<=2400&&a.width>=360&&a.height>=360);
    assert.ok(inUltimateArea(p,a));
    assert.equal(inUltimateArea({x:1e8,y:600},a),false);
  }
});
test('each class has a distinct cut-in row and both gender sheets exist',async()=>{
  assert.equal(new Set(Object.values(ULTIMATES).map(x=>x.row)).size,4);
  for(const gender of ['male','female']) await access(new URL(`../public/assets/ultimates/${gender}.webp`,import.meta.url));
});
