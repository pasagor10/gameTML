import test from 'node:test';import assert from 'node:assert/strict';import {Run,STAGE_HP,WORLD_BOSS_HP,xpNeed} from '../src/model.js';
function ready(seed=1){let n=seed;const r=new Run(()=>((n=n*16807%2147483647)/2147483647),{job:'mage',appearance:'a',name:'Balance Lv59'});r.level=59;r.need=xpNeed(59);r.skillPoints=58;r.autoLearn();for(const [kind,tier,plus]of[['weapon',2,8],['armor',4,7],['helmet',5,6],['ring',3,5]]){const item=r.addItem({kind,tier,job:kind==='weapon'?'mage':null});item.plus=plus;r.equipped[kind]=item.id;}r.applyGear();r.supplies.potion=24;r.setPotionAt(.65);r.cleared.normal=39;r.startChallenge(40);r.summonBoss();r.update(.05);return r;}
test('normal 4-10 gives a geared Lv59 mage a viable solo clear before berserk',()=>{
 const r=ready(),boss=r.enemies.find(e=>e.type==='boss');assert.ok(boss.max<950000);assert.ok(boss.max>750000);for(let i=0;i<1800&&r.cleared.normal<40&&!r.stageFailed;i++)r.update(.05,r.autoInput());assert.ok(r.cleared.normal>=40);assert.ok(r.t<90);assert.ok(r.supplies.potion>0);
});
test('while the 4-10 guardian lives, its hits, projectiles and its guards all hit softer',()=>{
 const r=ready(),boss=r.enemies.find(e=>e.type==='boss');r.p.inv=0;r.p.hp=1e9;r.damage(10,'boss');const bossDamage=r.events.at(-1).damage;r.p.inv=0;r.damage(10,'boss_projectile');const projectile=r.events.at(-1).damage;r.p.inv=0;r.damage(10,'archer');const mobDamage=r.events.at(-1).damage;assert.equal(bossDamage,projectile);assert.equal(bossDamage,mobDamage);assert.equal(boss.damageScale,.6);assert.equal(boss.berserkAt,90);
});
test('earlier bosses, hard finals, mini bosses and world raid retain their previous scaling',()=>{
 for(const [stage,hard]of[[30,false],[40,true],[50,true],[60,true]]){const r=new Run();r.stage=stage;r.hard=hard;r.enemies=[];r.addEnemy('boss',100,0,{guardian:true});const boss=r.enemies[0];assert.equal(boss.max,WORLD_BOSS_HP*STAGE_HP**(stage+(hard?60:0)-1));assert.equal(boss.berserkAt,45);assert.equal(boss.damageScale,1);}
 const r=new Run();r.stage=40;r.enemies=[];r.addEnemy('boss',100,0,{guardian:true,mini:true});assert.equal(r.enemies[0].damageScale,1);r.joinRaid(0);assert.equal(r.enemies.find(e=>e.raid).damageScale,1);
});
test('5-10 and 6-10 guardians are tuned for the gear those worlds drop',()=>{
 for(const [stage,max]of[[50,2e6],[60,1.8e6]]){const r=new Run();r.stage=stage;r.enemies=[];r.addEnemy('boss',100,0,{guardian:true});const boss=r.enemies[0];assert.ok(boss.max<max,`${stage}: ${boss.max}`);assert.ok(boss.damageScale<.5);assert.ok(boss.berserkAt>=100);}
});
