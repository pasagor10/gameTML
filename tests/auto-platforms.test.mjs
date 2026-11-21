import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {maxMp} from '../shared/config.js';
import {dungeonPlatforms} from '../shared/dungeons.js';
const dir=mkdtempSync(path.join(tmpdir(),'tml-auto-stairs-'));
process.env.DB_PATH=path.join(dir,'test.sqlite');
const {db,loadCharacter}=await import('../server/database.js');
const world=await import('../server/world.js');
let serial=0;
function setup(job,floor,stage,start) {
  const id=`auto-stairs-${serial++}`;
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,id,null,Date.now());
  db.prepare('INSERT INTO characters VALUES(?,?,?,?)').run(id,id,id,JSON.stringify({class:job,gender:'female',level:60,exp:0,gold:0,inventory:{hp:0,mp:0,ore:0},quest:1,unlocked:1}));
  const p=world.makeRuntime(loadCharacter(id),{emit(){}});world.players.set(id,p);world.beginDungeon(p,1);
  const i=world.instances.get(p.instance), t=Date.now()/1000;
  Object.assign(i,{floor,stage,stageAt:t-3,completed:true,clear:false,reserve:null,tutorial:false,signs:[],hazards:[],nextHazardAt:t+100000});
  Object.assign(p,{auto:true,x:start,y:600,vx:0,vy:0,grounded:true,mp:0});
  return {p,i,t};
}
function hitTarget({p,i,t},type,x,y,skills=false) {
  if(skills) p.mp=maxMp(p);
  const e={...i.enemies[0],id:`target-${serial}`,type,x,y,homeX:x,homeY:y,hp:100000,maxHp:100000,boss:false,elite:false,tame:true,aggro:false,attackAt:t+100000,action:null,status:null};
  i.enemies=[e];
  for(let n=0;n<1600 && e.hp===100000;n++) {
    Object.assign(e,{x,y});if(!skills) p.mp=0;world.tick(.05,t+3+n*.05);
  }
  const result={hit:e.hp<100000,x:Math.round(p.x),y:Math.round(p.y),target:p.autoTarget,climb:p.climbX};
  world.returnTown(p);world.players.delete(p.id);
  return result;
}
test('AUTO reaches high ground and airborne monsters across main, mirrored and six-tier mine layouts',()=>{
  const failures=[];
  for(const job of ['swordsman','archer','mage','priest'])
  for(const floor of [1,2,3,4,5,6,7,8,9,10,41,80])
  for(const stage of [1,2,3])
  for(const type of ['slime','bat'])
  for(const start of [120,2180]) {
    const platforms=dungeonPlatforms(floor,stage).filter(p=>!p.step);
    const top=platforms.reduce((a,b)=>a.y<b.y?a:b);
    const x=top.x+top.w/2,y=top.y-(type==='bat'?30:0);
    const result=hitTarget(setup(job,floor,stage,start),type,x,y);
    if(!result.hit) failures.push({job,floor,stage,type,start,goal:{x,y},...result});
  }
  assert.deepEqual(failures,[]);
});
test('AUTO descends from an upper platform when the enemy is directly below it',()=>{
  for(const job of ['swordsman','archer','mage','priest']) {
    const top=dungeonPlatforms(2,1).filter(p=>!p.step).reduce((a,b)=>a.y<b.y?a:b);
    const state=setup(job,2,1,top.x+top.w/2);state.p.y=top.y;
    const result=hitTarget(state,'slime',state.p.x,600);
    assert.equal(result.hit,true,`${job}: ${JSON.stringify(result)}`);
  }
});
test('AUTO completes the last stair even when attack skills are ready',()=>{
  const top=dungeonPlatforms(6,2).filter(p=>!p.step).reduce((a,b)=>a.y<b.y?a:b);
  for(const job of ['swordsman','archer','mage','priest']) {
    const result=hitTarget(setup(job,6,2,2180),'slime',top.x+top.w/2,top.y,true);
    assert.equal(result.hit,true,`${job}: ${JSON.stringify(result)}`);
  }
});
test.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
