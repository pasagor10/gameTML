import test from 'node:test';import assert from 'node:assert/strict';
import {Run,WORLDS,LAST_STAGE,MAX_LEVEL,WORLD_NAMES,WORLD_ROSTER,SKILLS,stageScale,STAGE_HP,LATE_HP,LATE_FROM,migrateHard,stageInfo,recommendedPower} from '../src/model.js';
import {TIERS} from '../src/weapons.js';
test('15 worlds reach stage 15-10 and the level cap is 150',()=>{
  assert.equal(WORLDS,15);assert.equal(LAST_STAGE,150);assert.equal(MAX_LEVEL,150);assert.equal(WORLD_NAMES.length,15);assert.equal(WORLD_ROSTER.length,15);
  assert.equal(stageInfo(150).label,'15-10');assert.equal(stageInfo(61).label,'7-1');
  const r=new Run(()=>.4,{job:'knight'});r.level=MAX_LEVEL;r.xp=0;r.gainXp?.(1e9);assert.equal(r.level,MAX_LEVEL);});
test('late stages scale gently and continuously after stage 60',()=>{
  assert.equal(stageScale(STAGE_HP,LATE_HP,LATE_FROM),STAGE_HP**(LATE_FROM-1));
  const r=stageScale(STAGE_HP,LATE_HP,LATE_FROM+1)/stageScale(STAGE_HP,LATE_HP,LATE_FROM);assert.ok(Math.abs(r-LATE_HP)<1e-9);
  for(let s=2;s<=LAST_STAGE;s++)assert.ok(recommendedPower(s)>=recommendedPower(s-1));});
test('new worlds drop the new gear tiers, up to the top tier on world 15 bosses',()=>{
  const r=new Run();let last=-1;for(let w=1;w<=WORLDS;w++){r.stage=(w-1)*10+1;const b=r.lootBase();assert.ok(b>=last);last=b;}
  r.stage=145;assert.equal(r.lootBase()+2,TIERS.length-1);});
test('Lv.100 passives: titan body is tankier, warlord hits harder',()=>{
  for(const id of ['titanbody','warlord']){const s=SKILLS.find(x=>x.id===id);assert.equal(s.kind,'passive');assert.equal(s.req,100);assert.equal(s.max,10);}
  const r=new Run(()=>.4,{job:'knight'});r.level=100;r.skillPoints=2;
  const hp0=r.maxHp,p0=r.power();assert.ok(r.learn('titanbody'));r.equipBest?.();r.applyGear?.();assert.ok(r.maxHp>hp0,'more max HP');
  assert.ok(r.learn('warlord'));assert.ok(r.power()>p0,'more damage');
  const low=new Run(()=>.4,{job:'knight'});low.level=99;low.skillPoints=1;assert.equal(low.canLearn('titanbody'),false);});
test('old Hard progress moves onto the new normal stages 61-150',()=>{
  const r={cleared:{normal:60,hard:25},stars:{n10:3,h5:2,h95:3},hard:true,stage:26};migrateHard(r);
  assert.deepEqual(r.cleared,{normal:85,hard:0});assert.equal(r.stars.n65,2);assert.equal(r.stars.h5,undefined);assert.equal(r.stars.h95,undefined);assert.equal(r.hard,false);assert.equal(r.stage,86);
  const run=new Run(()=>.4,{job:'knight'});const snap=run.serialize();snap.v=4;snap.cleared={normal:60,hard:60};const back=Run.restore(snap);assert.equal(back.cleared.normal,120);assert.equal(back.cleared.hard,0);});
