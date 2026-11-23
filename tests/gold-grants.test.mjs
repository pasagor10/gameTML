import test from 'node:test';import assert from 'node:assert/strict';import {deliverGoldGrant,mergeGoldGrants} from '../src/gold-grants.js';import {Run} from '../src/model.js';
const storage=()=>{const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('gold delivery is atomic with receipt, retries do not duplicate, and other heroes are untouched',()=>{
 const s=storage();s.setItem('tilmo-characters-v1',JSON.stringify({slots:[{id:'hero-1'},{id:'hero-2'}]}));s.setItem('hero-1:tilmo-save',JSON.stringify({run:{gold:150,paidGrants:[]}}));const grant={id:'GX-ABC123',character:'hero-1',gold:10000};deliverGoldGrant(grant,s);deliverGoldGrant(grant,s);const snap=JSON.parse(s.getItem('hero-1:tilmo-save'));assert.equal(snap.run.gold,10150);assert.deepEqual(snap.run.paidGrants,['GX-ABC123']);const other={gold:20};assert.equal(mergeGoldGrants(other,'hero-2',s),0);assert.equal(other.gold,20);
 const stale={gold:150,paidGrants:[]};mergeGoldGrants(stale,'hero-1',s);mergeGoldGrants(stale,'hero-1',s);assert.equal(stale.gold,10150);assert.throws(()=>deliverGoldGrant({...grant,character:'missing'},s));
});
test('paid gold receipts survive game saves, restored runs and new-run stash',()=>{
 const r=new Run();r.gold=10000;r.paidGrants=['GX-ABC123'];const back=Run.restore(r.serialize());assert.equal(back.gold,10000);assert.deepEqual(back.paidGrants,r.paidGrants);const next=new Run();next.loadStash(r.stash());assert.equal(next.gold,10000);assert.deepEqual(next.paidGrants,r.paidGrants);
});
