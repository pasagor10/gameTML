import test from 'node:test';
import assert from 'node:assert/strict';
import { ULTIMATES } from '../shared/ultimates.js';
import { access } from 'node:fs/promises';
test('each class has a distinct cut-in row and both gender sheets exist',async()=>{
  assert.equal(new Set(Object.values(ULTIMATES).map(x=>x.row)).size,4);
  for(const gender of ['male','female']) await access(new URL(`../public/assets/ultimates/${gender}.webp`,import.meta.url));
});
