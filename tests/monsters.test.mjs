import test from 'node:test';import assert from 'node:assert/strict';import {Run,stageInfo} from '../src/model.js';
let seed=7;const rng=()=>((seed=(seed*16807)%2147483647)/2147483647);
test('every world fields its own monster mix',()=>{
  const mix=stage=>{const r=new Run(rng);r.stage=stage;const seen=new Set();for(let i=0;i<300;i++){r.enemies=[];r.spawnWave(r.stage,stageInfo(stage));for(const e of r.enemies)seen.add(e.type);}return [...seen].sort().join(',');};
  const worlds=[9,19,29,39,49,59].map(mix);assert.equal(new Set(worlds).size,6,worlds.join(' | '));
  assert.ok(!mix(1).includes('bomber')&&!mix(1).includes('spitter'),'stage 1 stays gentle');
  assert.ok(mix(59).split(',').length>=7,'the last world mixes everything');});
test('a bomber arms near the hero, explodes and dies',()=>{
  const r=new Run(()=>.5);r.enemies=[];r.spawn=1e9;r.addEnemy('bomber',40,0);const b=r.enemies[0],hp=r.p.hp;b.hp=b.max=1e6;
  for(let i=0;i<40&&r.enemies.includes(b);i++)r.update(.05);assert.ok(!r.enemies.includes(b),'bomber is gone');assert.ok(r.p.hp<hp,'blast hurt the hero');});
test('bosses enrage below half HP and use their wider attack set',()=>{
  const r=new Run(rng);r.cleared.normal=9;assert.ok(r.startChallenge(10));r.stageKills=r.quota;r.update(.05);const boss=r.enemies.find(e=>e.guardian);
  const kinds=new Set();for(let i=0;i<80;i++){boss.warn=null;r.bossAttack(boss,r.p);kinds.add(boss.warn.kind);}
  for(const k of ['slam','dash','nova','meteor','summon'])assert.ok(kinds.has(k),k);
  boss.warn=null;boss.cd=99;boss.hp=boss.max*.4;r.update(.05);assert.ok(boss.rage,'enraged');assert.ok(r.events.some(e=>e.type==='boss_rage'));
  assert.equal(r.enemies.filter(e=>e.type==='elite').length,2,'rage calls two elite guards');
  r.p.inv=0;r.damage(10,'test');const calm=r.maxHp-r.p.hp;r.p.hp=r.maxHp;boss.born=r.t-46;r.update(.05);assert.ok(boss.berserk,'berserk after the timer');
  r.p.inv=0;r.damage(10,'test');assert.ok(Math.abs((r.maxHp-r.p.hp)-calm*2)<.01,'berserk doubles incoming damage');});
test('selling many pieces at once skips worn gear and picks out junk',()=>{
  const r=new Run(()=>.5);r.level=30;r.job='knight';
  const worn=r.addItem({kind:'armor',tier:2,job:null});r.equipped.armor=worn.id;
  const weak=r.addItem({kind:'armor',tier:1,job:null}),good=r.addItem({kind:'armor',tier:3,job:null}),other=r.addItem({kind:'weapon',tier:2,job:'mage'});
  const junk=r.junkIds();assert.ok(junk.includes(weak.id)&&junk.includes(other.id));assert.ok(!junk.includes(good.id)&&!junk.includes(worn.id));
  const gold=r.gold,got=r.sellItems([weak.id,other.id,worn.id]);assert.ok(got>0);assert.equal(r.gold,gold+got);
  assert.ok(r.bag.some(i=>i.id===worn.id),'worn piece kept');assert.ok(!r.bag.some(i=>i.id===weak.id||i.id===other.id));assert.equal(r.sellItems([]),0);});
test('shop supplies stay affordable in the last stages',async()=>{
  const {supplyPrice}=await import('../src/shop.js');
  assert.ok(supplyPrice('potion',38)<1500,`stage 38 potion ${supplyPrice('potion',38)}`);assert.ok(supplyPrice('xp',60)<25000);assert.ok(supplyPrice('potion',10)>supplyPrice('potion',1));});
test('defeats never slide the hero below the first stage of the current world',()=>{
  const r=new Run(()=>.5);r.cleared.normal=31;assert.ok(r.startChallenge(32));
  r.p.inv=0;r.damage(1e9,'boss');assert.equal(r.mode,'farm');assert.equal(r.stage,31,'4-2 fails → farm 4-1');
  for(let i=0;i<3;i++){r.p.inv=0;r.damage(1e9,'boss');}assert.equal(r.stage,31,'farming defeats stay put');
  r.cleared.normal=30;assert.ok(r.startChallenge(31));r.p.inv=0;r.damage(1e9,'boss');assert.equal(r.stage,31,'4-1 fails → farm 4-1, not 3-10');
  const w1=new Run(()=>.5);w1.cleared.normal=2;w1.startChallenge(3);w1.p.inv=0;w1.damage(1e9,'slime');assert.equal(w1.stage,2);});
