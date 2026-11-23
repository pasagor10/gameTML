import test from 'node:test';import assert from 'node:assert/strict';import {Run} from '../src/model.js';import {RAID_EVERY,RAID_OPEN,raidOpen,makeRaiders} from '../src/raid.js';
let seed=5;const rng=()=>((seed=(seed*16807)%2147483647)/2147483647);
test('raid opens for 3 minutes every 10 and can be joined once per window',()=>{
  assert.ok(raidOpen(0));assert.ok(raidOpen(RAID_OPEN-1));assert.ok(!raidOpen(RAID_OPEN));assert.ok(raidOpen(RAID_EVERY*3+5));
  const r=new Run(rng);r.state='playing';r.cleared.normal=5;r.farmAt(5);
  assert.equal(r.canJoinRaid(RAID_OPEN+10),false,'closed');assert.ok(r.joinRaid(RAID_EVERY+1000));assert.equal(r.mode,'raid');
  const n=r.raid.raiders.length;assert.ok(n>=10&&n<=15,`${n} raiders`);assert.equal(r.canJoinRaid(RAID_EVERY+2000),false,'already in');
  const eggs=r.supplies.egg,luck=r.supplies.luck;for(let i=0;i<1300&&r.mode==='raid';i++){r.p.inv=9;r.update(.05);}
  assert.equal(r.state,'raidResult');assert.equal(r.mode,'farm');assert.equal(r.stage,5,'back to the stage it left');
  assert.equal(r.supplies.egg,eggs+10);assert.equal(r.supplies.luck,luck+3);const res=r.lastRaid;assert.ok(res.rank>=1&&res.rank<=res.total);assert.equal(!!res.rewards.gear,res.rank<=5);
  r.state='playing';assert.equal(r.joinRaid(RAID_EVERY+5000),false,'once per window');assert.ok(r.joinRaid(RAID_EVERY*2+1));});
test('falling in a raid ends it with rewards instead of a retreat; top ranks win gear',()=>{
  const r=new Run(rng);r.state='playing';assert.ok(r.joinRaid(0));const boss=r.enemies.find(e=>e.raid);r.hit(boss,1e9);assert.ok(r.raid.dmg>=1e9);
  r.p.inv=0;r.damage(1e12,'boss');assert.equal(r.state,'raidResult');assert.equal(r.lastRaid.fell,true);assert.equal(r.lastRaid.rank,1,'huge damage tops the board');
  assert.ok(r.lastRaid.rewards.gear&&r.lastRaid.rewards.gear.tier>=3);assert.equal(r.retreats,0);
  const hatched=r.hatchEggs(10,{free:true});assert.equal(hatched.length,10);assert.equal(r.supplies.egg,0);assert.equal(r.hatchEggs(1,{free:true}),null);});
test('raiders get distinct names',()=>{const list=makeRaiders(rng,30);assert.equal(new Set(list.map(x=>x.name)).size,list.length);});
test('older saves without an egg counter still receive raid eggs',()=>{
  const r=new Run(rng);r.state='playing';const snap=r.serialize();delete snap.supplies.egg;snap.supplies.potion=null;
  const back=Run.restore(snap,rng);assert.equal(back.supplies.egg,0);assert.equal(back.supplies.potion,0);
  back.state='playing';back.joinRaid(0);back.finishRaid(false);assert.equal(back.supplies.egg,10);});
