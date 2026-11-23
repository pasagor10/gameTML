import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
import {Metrics,SEEN_MAX} from '../server/metrics.mjs';import {PartyHub} from '../server/party.mjs';

test('recently played keeps each hero with the time they were last online and survives a restart',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'tilmo-recent-'));try{
    const T=Date.now(),file=path.join(dir,'metrics.json'),h=new PartyHub(),a=h.connect(()=>{}),b=h.connect(()=>{}),m=new Metrics(file);m.getHub=()=>h;
    h.message(a,{t:'state',s:{name:'Aom',job:'mage',lv:40,stage:27}},T+1000);h.message(b,{t:'state',s:{name:'Toey',job:'gunner',lv:12,stage:4}},T+1000);
    let d=m.snapshot(h,{now:T+2000});assert.deepEqual(d.recent.map(p=>[p.name,p.online]).sort(),[['Aom',true],['Toey',true]]);
    h.message(a,{t:'state',s:{name:'Aom',job:'mage',lv:41,stage:28}},T+60000);
    d=m.snapshot(h,{now:T+90000});const aom=d.recent[0],toey=d.recent[1];
    assert.equal(aom.name,'Aom');assert.equal(aom.online,true);assert.equal(aom.level,41);
    assert.equal(toey.online,false,'went quiet');assert.equal(toey.last,T+2000,'keeps the last time they were seen');
    m.flush();const back=new Metrics(file);assert.equal(back.snapshot(new PartyHub(),{now:T+100000}).recent.length,2);
    const later=back.snapshot(new PartyHub(),{now:T+31*86400000});assert.equal(later.recent.length,0,'forgets after 30 days');
  }finally{rmSync(dir,{recursive:true,force:true});}});

test('the recent list is capped',()=>{
  const h=new PartyHub(),m=new Metrics();
  for(let i=0;i<SEEN_MAX+20;i++){const c=h.connect(()=>{});h.message(c,{t:'state',s:{name:'P'+i,job:'knight',lv:5,stage:1}},i*10);m.observe(h,i*10+1);h.close(c);h.clients?.delete?.(c);}
  assert.ok(Object.keys(m.seen).length<=SEEN_MAX);});
