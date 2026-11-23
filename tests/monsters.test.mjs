import test from 'node:test';import assert from 'node:assert/strict';import {Run,stageInfo} from '../src/model.js';
let seed=7;const rng=()=>((seed=(seed*16807)%2147483647)/2147483647);
test('later stages mix in brutes, bombers, imp packs and spitters',()=>{
  const r=new Run(rng);r.cleared.normal=19;assert.ok(r.startChallenge(20));const seen=new Set();
  for(let i=0;i<400;i++){r.enemies=[];r.spawnWave(r.stage,stageInfo(r.stage));for(const e of r.enemies)seen.add(e.type);}
  for(const t of ['slime','brute','bomber','imp','spitter'])assert.ok(seen.has(t),t);
  const early=new Run(rng),first=new Set();for(let i=0;i<200;i++){early.enemies=[];early.spawnWave(1,{sub:1,world:1});for(const e of early.enemies)first.add(e.type);}
  assert.ok(!first.has('bomber')&&!first.has('spitter')&&!first.has('imp'),'stage 1 stays gentle');});
test('a bomber arms near the hero, explodes and dies',()=>{
  const r=new Run(()=>.5);r.enemies=[];r.spawn=1e9;r.addEnemy('bomber',40,0);const b=r.enemies[0],hp=r.p.hp;b.hp=b.max=1e6;
  for(let i=0;i<40&&r.enemies.includes(b);i++)r.update(.05);assert.ok(!r.enemies.includes(b),'bomber is gone');assert.ok(r.p.hp<hp,'blast hurt the hero');});
test('bosses enrage below half HP and use their wider attack set',()=>{
  const r=new Run(rng);r.cleared.normal=9;assert.ok(r.startChallenge(10));r.stageKills=r.quota;r.update(.05);const boss=r.enemies.find(e=>e.guardian);
  const kinds=new Set();for(let i=0;i<80;i++){boss.warn=null;r.bossAttack(boss,r.p);kinds.add(boss.warn.kind);}
  for(const k of ['slam','dash','nova','meteor','summon'])assert.ok(kinds.has(k),k);
  boss.warn=null;boss.cd=99;boss.hp=boss.max*.4;r.update(.05);assert.ok(boss.rage,'enraged');assert.ok(r.events.some(e=>e.type==='boss_rage'));});
