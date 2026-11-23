import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {RestoreStore,restorePath,cleanRestoreCode} from '../server/restore.mjs';
import {applyRestore} from '../src/restore.js';import {Run,xpNeed} from '../src/model.js';
test('a restore code is created once and can be redeemed only once',()=>{
  const store=new RestoreStore(join(mkdtempSync(join(tmpdir(),'restore-')),'codes.json'));
  const code=store.create({level:97,cleared:64,note:'เคเค mage'});assert.equal(code.length,10);
  assert.deepEqual(store.redeem(code.toLowerCase().replace(/(.{5})/,'$1-'),{name:'เคเค',job:'mage'}),{level:97,cleared:64});
  assert.deepEqual(store.redeem(code),{error:'used'});assert.deepEqual(store.redeem('ZZZZZZZZZZ'),{error:'notfound'});
  assert.equal(store.create({level:999,cleared:999}).length,10);assert.equal(cleanRestoreCode(' ab-cd '),'ABCD');
  assert.equal(restorePath({METRICS_PATH:'/var/lib/tilmo/metrics.json'}),'/var/lib/tilmo/restore-codes.json');});
test('redeeming gives back level, skill points and cleared stage but never lowers them',()=>{
  const r=new Run(()=>.4,{job:'mage'});r.level=14;r.skillPoints=0;r.cleared.normal=3;
  const out=applyRestore(r,{level:97,cleared:64});assert.equal(out.gained,83);assert.equal(r.level,97);assert.equal(r.skillPoints,83);assert.equal(r.need,xpNeed(97));assert.equal(r.cleared.normal,64);
  const again=applyRestore(r,{level:50,cleared:10});assert.equal(again.gained,0);assert.equal(r.level,97);assert.equal(r.cleared.normal,64);
  const n=new Run(()=>.4,{job:'novice'});applyRestore(n,{level:20,cleared:5});assert.equal(n.awaitingClass,true);});
