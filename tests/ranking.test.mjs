import test from 'node:test';import assert from 'node:assert/strict';
import {rivals,townRivals,leaderboard,RIVAL_EPOCH} from '../src/rivals.js';
import {Metrics} from '../server/metrics.mjs';import {cleanState} from '../server/party.mjs';
const DAY=86400000;
test('NPC rivals are flagged, deterministic and climb toward the cap over time',()=>{
  const now=RIVAL_EPOCH+20*DAY,a=rivals(now),later=rivals(now+60*DAY);
  assert.deepEqual(a,rivals(now));assert.ok(a.every(r=>r.npc===true));
  a.forEach((r,i)=>{assert.ok(later[i].level>=r.level);assert.ok(r.level>=1&&r.level<=150);});
  assert.ok(rivals(RIVAL_EPOCH+3000*DAY).some(r=>r.level===150));
  assert.ok(townRivals(now).every(r=>r.npc));});
test('leaderboard merges real players, the local hero and rivals, real players never tagged NPC',()=>{
  const real=[{name:'แท้จริง',job:'mage',level:149,cleared:150,cp:9e6,online:true}],me={name:'ฉัน',job:'knight',level:1,cleared:0,cp:10};
  const rows=leaderboard(real,me,RIVAL_EPOCH);assert.equal(rows[0].name,'แท้จริง');assert.equal(rows[0].npc,false);
  const mine=rows.find(r=>r.you);assert.equal(mine.npc,false);assert.equal(mine.rank,rows.length);
  rows.forEach((r,i)=>assert.equal(r.rank,i+1));});
test('ranking endpoint data lists connected heroes and keeps their best cleared stage',()=>{
  const m=new Metrics(),now=Date.now(),s=cleanState({name:'เอ',job:'gunner',lv:120,stage:130,cleared:129,cp:5000});
  assert.equal(s.stage,130);assert.equal(s.cleared,129);
  const hub={clients:new Set([{state:s,at:now}])};const r=m.ranking(hub,now);
  assert.equal(r.online.length,1);assert.equal(r.top[0].cleared,129);assert.equal(r.top[0].online,true);});
