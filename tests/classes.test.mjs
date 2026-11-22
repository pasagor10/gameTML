import test from 'node:test';import assert from 'node:assert/strict';
import {Run,SKILLS,CLASSES,choices} from '../src/model.js';
import {TIERS,FORGE_COST,tierForForge,weaponName} from '../src/weapons.js';
import {directionFor,animationFrame} from '../src/sprite-layout.js';
const advance=(r,seconds)=>{for(let i=0;i<seconds*20&&r.state==='playing';i++)r.update(.05);};

test('only swordmaster, sorcerer and gunner are playable; each has three own skills',()=>{
  assert.deepEqual(CLASSES.map(c=>c.id),['knight','mage','gunner']);
  for(const c of CLASSES)assert.equal(SKILLS.filter(s=>s.job===c.id).length,3);
});
test('awakening offers that class skills and other classes never see them',()=>{
  for(const c of CLASSES){const r=new Run();r.level=9;r.xp=r.need;r.checkLevel();assert.ok(r.awaken(c.id,'a'));assert.deepEqual(r.offers.map(s=>s.job),[c.id,c.id,c.id]);}
  for(let i=0;i<30;i++)assert.ok(choices({},Math.random,'novice').every(s=>!s.job));
  for(let i=0;i<30;i++)assert.ok(choices({},Math.random,'mage').every(s=>!s.job||s.job==='mage'));
});
test('every class skill damages enemies',()=>{
  for(const s of SKILLS.filter(s=>s.job)){
    const r=new Run(()=>.3,{job:s.job});r.enemies=[];r.spawn=1000;r.attack=999;r.skills[s.id]=3;r.addEnemy('elite',110,0);const e=r.enemies[0],hp=e.hp;r.skillClock=2;
    for(let i=0;i<30;i++){r.update(.05);r.attack=999;}
    assert.ok(e.hp<hp,s.id);
  }
});
test('weapon climbs six tiers from levels, elites and bosses and grows damage',()=>{
  assert.equal(TIERS.length,6);assert.equal(tierForForge(0),0);assert.equal(tierForForge(FORGE_COST[5]),5);
  const r=new Run(()=>.5,{job:'gunner'});r.addForge(FORGE_COST[2],'test');assert.equal(r.weaponTier,2);assert.equal(r.events.at(-1).type,'weapon_up');
  assert.ok(r.power()>1.5);assert.equal(weaponName('gunner',5),'ปืนเทพสายรุ้ง');
  const damage=[];for(const tier of [0,5]){const g=new Run(()=>.5,{job:'knight'});g.enemies=[];g.spawn=1000;g.weaponTier=tier;g.addEnemy('boss',60,0);g.update(.05);damage.push(g.enemies[0].max-g.enemies[0].hp);}
  assert.ok(damage[1]>damage[0]*2);
});
test('higher gun tiers fire more bullets per shot',()=>{
  const count=tier=>{const r=new Run(()=>.5,{job:'gunner'});r.enemies=[];r.spawn=1000;r.weaponTier=tier;r.addEnemy('elite',200,0);r.update(.05);return r.shots.filter(s=>s.style==='bullet').length;};
  assert.equal(count(0),1);assert.equal(count(2),2);assert.equal(count(3),3);
});
test('direction keeps its row near a sector edge instead of flickering',()=>{
  const edge=Math.PI/8;// boundary between e and se
  assert.equal(directionFor(Math.cos(edge+.05),Math.sin(edge+.05),'e'),'e');
  assert.equal(directionFor(Math.cos(edge-.05),Math.sin(edge-.05),'se'),'se');
  assert.equal(directionFor(0,1,'e'),'s');
});
test('measured timing spreads frames unevenly but still visits every frame once per stride',()=>{
  const timing=[.6,1.4,1,1,1,1,.8,1.2],seen=[];
  for(let d=0;d<96;d+=.5)seen.push(animationFrame(0,true,8,d,timing));
  assert.deepEqual([...new Set(seen)],[0,1,2,3,4,5,6,7]);
  assert.ok(seen.filter(f=>f===1).length>seen.filter(f=>f===0).length*2-1);
});

test('endless: class skills reach Lv.5 and upgrades never run out',()=>{
  const r=new Run(()=>.5,{job:'mage'});r.enemies=[];r.spawn=1000;
  r.skills={meteor:5,vortex:5,nova:5,area:3,haste:3};
  for(let i=0;i<30;i++){r.xp=r.need;r.state='playing';r.checkLevel();assert.equal(r.state,'upgrade');assert.ok(r.offers.length>=2);assert.ok(r.choose(r.offers[0].id));}
  assert.ok(r.level>30);assert.ok(r.boosts.might+r.boosts.vigor===30);
  assert.ok(!choices({meteor:5},Math.random,'mage').some(s=>s.id==='meteor'),'capped at Lv.5');
  assert.ok(choices({meteor:3},Math.random,'mage').length>0);
});
test('stage keeps climbing with no end besides death',()=>{
  const r=new Run(()=>.5,{job:'gunner'});
  for(let stage=1;stage<=8;stage++){r.t=r.stageStart+180+(stage===1?60:0);r.update(.05);const boss=r.enemies.find(e=>e.type==='boss');assert.ok(boss,`boss ${stage}`);r.hit(boss,1e9);r.gems=[];r.state='playing';}
  assert.equal(r.stage,9);assert.equal(r.state,'playing');
});
test('higher skill levels produce grander effects (lv carried to visuals)',()=>{
  for(const [id,job,kind] of [['nova','mage','nova'],['judgement','knight','blade'],['meteor','mage','meteor']]){
    const r=new Run(()=>.5,{job});r.enemies=[];r.spawn=1000;r.skills[id]=5;r.addEnemy('boss',120,0);r.castSkills(1);
    const f=r.effects.find(e=>e.kind===kind);assert.ok(f,id);assert.equal(f.lv,5);
  }
  const lv1=new Run(()=>.5,{job:'gunner'}),lv5=new Run(()=>.5,{job:'gunner'});
  lv1.skills.drone=1;lv5.skills.drone=5;assert.equal(lv1.dronePositions().length,1);assert.equal(lv5.dronePositions().length,3);
});
test('combat emits sound cues for attacks, kills and boss arrival; enemies remember their stage',()=>{
  const r=new Run(()=>.5,{job:'gunner'});r.enemies=[];r.spawn=1000;r.addEnemy('slime',120,0);r.enemies[0].hp=1;r.update(.05);
  const names=r.cues.map(c=>c.name);assert.ok(names.includes('shot'));
  let killed=false;for(let i=0;i<20;i++){r.update(.05);killed||=r.cues.some(c=>c.name==='kill');r.cues.length=0;}assert.ok(killed);
  const b=new Run();b.t=240;b.update(.05);assert.ok(b.cues.some(c=>c.name==='roar'));assert.equal(b.enemies[0].stage,1);
  assert.ok(r.cues.length<=48,'cue queue is bounded');
});
