import {isInArena} from '../src/arena.js';
import test from 'node:test';import assert from 'node:assert/strict';import {Run,evolutions,stageQuota,activeSlots} from '../src/model.js';
const advance=(r,seconds,input={x:0,y:0})=>{for(let i=0;i<seconds*20&&r.state==='playing';i++)r.update(.05,input);};
test('first level-up gives a skill point without pausing; learning an active fills a slot',()=>{const r=new Run(()=>.4);advance(r,30);assert.equal(r.state,'playing');assert.ok(r.level>=2);assert.ok(r.kills>0);assert.ok(r.skillPoints>=1);assert.ok(r.learn('fire'));assert.deepEqual(r.slots,['fire']);assert.equal(r.skills.fire,1);});
test('keyboard direction eases to normalized speed and world stays bounded',()=>{const r=new Run();r.enemies=[];r.spawn=1000;r.update(.05,{x:1,y:1});const first=Math.hypot(r.p.x,r.p.y);assert.ok(first>0&&first<7.25);for(let i=0;i<10;i++)r.update(.05,{x:1,y:1});assert.ok(Math.abs(Math.hypot(r.vel.x,r.vel.y)-145)<1);r.p.x=780;r.update(.05,{x:1,y:0});assert.ok(isInArena(r.p,16));});
test('learning respects points, hero level, slots and max level; evolutions need both prerequisites',()=>{
  const r=new Run();assert.equal(r.learn('fire'),false,'no points yet');r.skillPoints=30;r.level=5;
  assert.equal(r.learn('haste'),false,'haste needs Lv.6');assert.equal(r.learn('whirl'),false,'class skills need the class');
  for(let i=0;i<3;i++)assert.ok(r.learn('fire'));assert.equal(r.learn('fire'),false,'max Lv.3');
  assert.ok(r.learn('ice'));assert.ok(r.learn('spark'));assert.equal(activeSlots('novice'),2);assert.deepEqual(r.slots,['fire','ice'],'third active waits outside the slots');
  assert.equal(r.equipSkill('spark'),false);assert.ok(r.unequipSkill('ice'));assert.ok(r.equipSkill('spark'));assert.deepEqual(r.slots,['fire','spark']);
  assert.deepEqual(evolutions({fire:3,ice:2,area:2,haste:1}),{inferno:true,blizzard:false});});
test('a defeat never ends the game: the hero falls back to farm the stage below',()=>{
  const r=new Run();r.cleared.normal=2;assert.ok(r.startChallenge(3));r.damage(50,'slime');const left=r.p.hp;assert.ok(left<55&&left>40,'stage 3 hits a little harder');r.damage(50,'slime');assert.equal(r.p.hp,left,'invulnerability frames');
  r.p.inv=0;r.damage(500,'slime');assert.equal(r.state,'playing');assert.equal(r.mode,'farm');assert.equal(r.stage,2);assert.equal(r.retreats,1);assert.equal(r.p.hp,r.maxHp);
  assert.ok(r.events.some(e=>e.type==='stage_failed'&&e.stage===3));});
test('a kill quota brings the guardian; beating it clears the stage and opens the next',()=>{
  const r=new Run();assert.equal(r.quota,stageQuota(1));r.stageKills=r.quota;r.update(.05);const g=r.enemies.find(e=>e.guardian);assert.ok(g);assert.equal(g.type,'elite');
  const slime1=r.enemies.find(e=>e.type==='slime').max;r.hit(g,1e9);assert.equal(r.stage,2);assert.equal(r.cleared.normal,1);assert.ok(r.stars.n1>=1);assert.equal(r.mode,'challenge');
  r.gems=[];r.enemies=[];r.spawn=0;r.update(.05);assert.ok(r.enemies[0].max>slime1,'stage 2 enemies are tougher');
  r.cleared.normal=4;assert.ok(r.startChallenge(5));r.stageKills=r.quota;r.update(.05);const mini=r.enemies.find(e=>e.guardian);assert.ok(mini.mini&&mini.type==='boss');assert.equal(r.enemies.length,1,'swarm cleared for bosses');
  r.cleared.normal=9;assert.ok(r.startChallenge(10));r.stageKills=r.quota;r.update(.05);const boss=r.enemies.find(e=>e.guardian);assert.ok(!boss.mini&&boss.max>mini.max);
  assert.equal(r.startChallenge(12),false,'cannot skip ahead');});
test('pause excludes time; re-skill refunds every point for gold; vigor raises HP',()=>{
  const r=new Run();r.state='paused';r.update(.05);assert.equal(r.t,0);r.state='playing';
  r.level=20;r.skillPoints=19;assert.ok(r.learn('vigor'));assert.equal(r.maxHp,115);r.autoLearn();assert.equal(r.skillPoints,0);assert.equal(r.spentPoints(),19);
  r.gold=0;assert.equal(r.respec(),false,'needs gold');r.gold=1e6;assert.ok(r.respec());assert.equal(r.skillPoints,19);assert.deepEqual(r.skills,{});assert.deepEqual(r.slots,[]);assert.equal(r.maxHp,100);});
test('all four shared active skills damage enemies once slotted; frost applies slow',()=>{for(const id of ['fire','ice','spark','gust']){const r=new Run(()=>.2);r.enemies=[];r.spawn=1000;r.skills[id]=3;r.slots=[id];r.addEnemy('elite',id==='fire'?85:130,0);const e=r.enemies[0],hp=e.hp;r.skillClock=2;advance(r,.8);assert.ok(e.hp<hp,id);if(id==='ice')assert.ok(e.slow>0);}
  const idle=new Run(()=>.2);idle.enemies=[];idle.spawn=1000;idle.skills.gust=3;idle.addEnemy('elite',130,0);const e=idle.enemies[0];idle.skillClock=2;idle.attack=99;idle.update(.05);assert.equal(e.hp,e.max,'unslotted skills do not cast');});
test('level ten pauses for class and appearance, then play resumes',()=>{const r=new Run();assert.equal(r.job,'novice');assert.equal(r.awaken('mage','b'),false);r.level=9;r.xp=r.need;r.checkLevel();assert.equal(r.level,10);assert.equal(r.state,'awakening');const time=r.t;r.update(.05);assert.equal(r.t,time);assert.equal(r.awaken('invalid','a'),false);assert.equal(r.awaken('mage','invalid'),false);assert.equal(r.awaken('mage','b'),true);assert.equal(r.job,'mage');assert.equal(r.appearance,'b');assert.equal(r.state,'playing');assert.equal(r.events.filter(e=>e.type==='class_chosen').length,1);});
test('saved class persists into a fresh run but run levels reset',()=>{const r=new Run(Math.random,{job:'ranger',appearance:'b'});assert.equal(r.job,'gunner','old ranger saves become gunner');assert.equal(r.level,1);r.level=9;r.xp=r.need;r.checkLevel();assert.equal(r.state,'playing');assert.equal(r.skillPoints,1);assert.equal(new Run(Math.random,{job:'cheat'}).job,'novice');});
test('gunner shoots at distant target and knight has stronger melee; looks do not alter damage',()=>{for(const look of ['a','b']){const r=new Run(()=>.5,{job:'gunner',appearance:look});r.enemies=[];r.spawn=1000;r.addEnemy('elite',240,0);advance(r,.7);assert.ok(r.enemies[0].hp<r.enemies[0].max);assert.equal(r.enemies[0].slow,0);}const damage=[];for(const job of ['novice','knight']){const r=new Run(()=>.5,{job});r.enemies=[];r.addEnemy('elite',60,0);r.update(.05);damage.push(r.enemies[0].max-r.enemies[0].hp);}assert.ok(damage[1]>damage[0]);});
test('continuous damage keeps exact HP loss while bounding floating-number allocations',()=>{
 const r=new Run();r.enemies=[];r.addEnemy('elite',80,0);const enemy=r.enemies[0],before=enemy.hp;
 for(let i=0;i<120;i++)r.hit(enemy,.25,true);
 assert.equal(before-enemy.hp,30);assert.equal(r.effects.filter(f=>f.kind==='number').length,1);assert.equal(r.effects[0].value,30);
 enemy.damageText.life=.1;r.hit(enemy,1,true);assert.equal(r.effects.filter(f=>f.kind==='number').length,2);
 r.hit(enemy,10);assert.equal(r.effects.filter(f=>f.kind==='number').length,3);assert.equal(before-enemy.hp,41);
});
