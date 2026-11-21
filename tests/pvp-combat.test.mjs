import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'tml-pvp-'));
process.env.DB_PATH=path.join(dir,'test.sqlite');
const {db,loadCharacter}=await import('../server/database.js');
const world=await import('../server/world.js');
const {maxHp}=await import('../shared/config.js');
function create(id,job='swordsman') {
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,id,null,Date.now());
  db.prepare('INSERT INTO characters VALUES(?,?,?,?)').run(id,id,id,JSON.stringify({class:job,gender:'female',level:10,exp:0,gold:100,inventory:{hp:5,mp:5,ore:0},quest:1,unlocked:2}));
  const p=world.makeRuntime(loadCharacter(id),{emit(){}});world.players.set(id,p);return p;
}
const start=Math.floor(Date.now()/1000/1800)*1800+1200;
test('PvP uses authoritative windup, directional reach and no friendly fire or dungeon rewards', () => {
  const heroes=Array.from({length:6},(_,n)=>create('pvp-'+n));
  heroes.forEach(p=>world.pvp.join(p,'3v3',start+1));world.tick(.01,start+300);
  const a=heroes[0],i=world.instances.get(a.instance);
  assert.ok(i.pvp);assert.equal(i.enemies.length,0);
  const ally=heroes.find(p=>p!==a && world.pvp.team(p,i)===world.pvp.team(a,i));
  const foe=heroes.find(p=>world.pvp.team(p,i)!==world.pvp.team(a,i));
  a.x=900;a.y=600;a.direction=1;ally.x=930;ally.y=600;foe.x=940;foe.y=600;
  const allyHp=ally.hp,foeHp=foe.hp,gold=a.gold;
  world.attack(a,0,start+301);assert.equal(a.pending,null,'no attacking during countdown');
  world.attack(a,0,start+304);assert.ok(a.pending);assert.equal(foe.hp,foeHp,'windup has no early damage');
  world.tick(.01,a.pending.impactAt+.01);
  assert.ok(foe.hp<foeHp,'a player can damage the enemy player');assert.equal(ally.hp,allyHp,'allies cannot be hit');
  assert.equal(a.gold,gold);assert.equal(i.clear,false);assert.equal(i.completed,false);
  assert.throws(()=>world.potion(a,'hp'),/PvP/);
  assert.throws(()=>world.nextStage(a),/PvP/);
  for(const p of heroes) world.returnTown(p);
  world.pvp.update(start+310);
});
test('a PvP kill stops actions and resolves the winner without awarding dungeon loot', () => {
  const a=create('duel-a'),b=create('duel-b');
  world.pvp.join(a,'1v1',start+1801);world.pvp.join(b,'1v1',start+1801);world.tick(.01,start+2100);
  const i=world.instances.get(a.instance);a.x=900;a.y=600;a.direction=1;b.x=930;b.y=600;b.hp=1;
  const gold=a.gold;world.attack(a,0,start+2104);world.tick(.01,a.pending.impactAt+.01);
  assert.equal(b.hp,0);assert.equal(b.auto,false);assert.equal(b.pending,null);
  world.tick(.01,start+2106);assert.equal(i.pvp.done,true);assert.equal(i.pvp.winner,world.pvp.team(a,i));
  world.tick(.01,start+2115);assert.equal(a.area,'town');assert.equal(b.hp,maxHp(b));assert.equal(a.gold,gold);
  assert.equal(world.pvp.view(a,start+2115).result.outcome,'ชนะ');
});
test.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
