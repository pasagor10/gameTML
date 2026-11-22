import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const dir = mkdtempSync(path.join(tmpdir(), 'tml-ultimate-'));
process.env.DB_PATH = path.join(dir, 'test.sqlite');
const { db, loadCharacter } = await import('../server/database.js');
const world = await import('../server/world.js');
const { WORLD } = await import('../shared/config.js');
function create(id, job) {
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,id,null,Date.now());
  db.prepare('INSERT INTO characters VALUES(?,?,?,?)').run(id,id,id,JSON.stringify({class:job,gender:'female',level:20,quest:1,unlocked:2}));
  const p = world.makeRuntime(loadCharacter(id), {emit(){}});
  world.players.set('socket:'+id,p); world.beginDungeon(p,1);
  p.mp=200;p.x=800;p.y=WORLD.ground;
  const i=world.instances.get(p.instance);
  i.enemies.forEach((e,n)=>{e.hp=e.maxHp=100000;e.tame=true;e.x=1200+n*100;e.y=WORLD.ground;});
  return {p,i};
}
test('every ultimate completes while stunned; normal attacks and death still cancel',()=>{
  let count=0;
  for(const job of ['swordsman','archer','mage','priest']) {
    const {p,i}=create('ult-'+count++,job),t=Date.now()/1000;
    world.attack(p,5,t);assert.ok(p.pending);assert.equal(p.mp,150);
    p.status={stun:{until:t+10}};
    world.tick(.01,t+.1);assert.equal(p.pending?.skill,5);
    world.tick(.01,t+1.3);
    assert.ok(i.enemies.every(e=>e.hp<100000),job+' hits all enemies despite stun');
    assert.equal(p.pending,null);
    world.returnTown(p);
  }
  const {p,i}=create('normal','swordsman'),t=Date.now()/1000;
  world.attack(p,0,t);p.status={stun:{until:t+10}};world.tick(.01,t+.1);
  assert.equal(p.pending,null);assert.ok(i.enemies.every(e=>e.hp===100000));
  p.status={};p.action=null;world.attack(p,5,t+11);p.hp=0;world.tick(.01,t+13);
  assert.equal(p.pending,null);assert.ok(i.enemies.every(e=>e.hp===100000));
});
test('a real monster hit during ultimate windup does not consume the cast without damage',()=>{
  const {p,i}=create('hit','swordsman'),t=Date.now()/1000;
  const e=i.enemies[0];e.tame=false;e.aggro=true;e.x=p.x;
  e.action={kind:'slam',x:p.x,radius:200,direction:1,impactAt:t+.1,endsAt:t+1};
  world.attack(p,5,t);const hp=p.hp;
  world.tick(.01,t+.2);assert.ok(p.hp<hp);assert.equal(p.pending?.skill,5);
  world.tick(.01,t+1.3);assert.ok(i.enemies.every(e=>e.hp<100000));
});
after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
