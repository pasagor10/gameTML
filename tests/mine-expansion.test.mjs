import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'tml-mine-')), 'game.sqlite');
const { db, loadCharacter } = await import('../server/database.js');
const world = await import('../server/world.js');
const { FLOORS, WORLD } = await import('../shared/config.js');
const { dungeonPlatforms, dungeonSigns } = await import('../shared/dungeons.js');
const { FLOOR_LOOT, GEAR } = await import('../shared/rpg.js');
function hero(id, extra = {}) {
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,id,null,Date.now());
  db.prepare('INSERT INTO characters VALUES(?,?,?,?)').run(id,id,id,JSON.stringify({
    class:'swordsman',gender:'male',level:60,quest:40,unlocked:40,townId:'riverside',
    gold:0,inventory:{hp:10,mp:10,ore:0},...extra,
  }));
  const p=world.makeRuntime(loadCharacter(id),{emit(){}});world.players.set(id,p);p.x=WORLD.portal;return p;
}
test('disconnect and rejoin restore either saved town and upgrade existing floor-40 clears',()=>{
  for(const townId of ['cave','riverside']) {
    const p=hero('rejoin-'+townId,{townId});world.disconnect(p);world.players.delete(p.id);
    const rejoined=world.makeRuntime(loadCharacter(p.id),{emit(){}});
    assert.equal(rejoined.area,'town');assert.equal(rejoined.townId,townId);assert.equal(rejoined.unlocked,41);
  }
});
test('all 40 mine floors spawn six reachable levels, award their own gear and progress through floor 80',()=>{
  for(let floor=41;floor<=80;floor++) {
    const p=hero('mine-'+floor,{quest:floor-1,unlocked:floor});world.beginMine(p,floor);
    const i=world.instances.get(p.instance);assert.ok(i.mine);assert.equal(i.floor,floor);
    for(let stage=1;stage<=3;stage++) {
      assert.equal(i.stage,stage);
      const ledges=dungeonPlatforms(floor,stage).filter(l=>!l.step);
      assert.equal(new Set(ledges.map(l=>l.y)).size,6);
      assert.ok(i.enemies.length <= 36);
      assert.ok(i.enemies.every(e=>Number.isFinite(e.maxHp)&&e.maxHp>0));
      if(stage<3){assert.equal(i.enemies.length,stage===1?30:36);i.clear=true;world.nextStage(p);}
    }
    i.nextHazardAt=Infinity;
    const boss=i.enemies.find(e=>e.boss);i.enemies=[boss];
    Object.assign(boss,{hp:1,x:p.x+30,y:p.y});p.direction=1;
    const t=Date.now()/1000+floor*100;world.attack(p,0,t);world.tick(.05,t+.17);
    assert.ok(i.completed);assert.equal(p.quest,floor);assert.equal(p.unlocked,Math.min(80,floor+1));
    const drop=FLOOR_LOOT[floor].weapons[p.class];assert.ok(p.ownedEquipment.includes(drop));assert.equal(GEAR[drop].floor,floor);
    assert.equal(i.results[p.id].hasNext,floor<80);world.nextStage(p);
    if(floor===80){assert.equal(p.area,'town');assert.equal(p.townId,'riverside');}
    else {assert.equal(i.floor,floor+1);assert.equal(i.stage,1);world.returnTown(p);}
    world.players.delete(p.id);
  }
});
test('ultimate damages distant mobs without waking them or their neighbors',()=>{
  const p=hero('ultimate');world.beginMine(p);const i=world.instances.get(p.instance);i.nextHazardAt=Infinity;
  p.x=500;p.y=600;p.mp=200;i.enemies=i.enemies.slice(0,3);
  for(const [n,e] of i.enemies.entries())Object.assign(e,{x:[600,1900,1970][n],y:600,homeY:600,hp:100000,maxHp:100000,speed:0,aggro:false});
  const t=Date.now()/1000;world.attack(p,5,t);world.tick(.01,t+1.26);
  assert.ok(i.enemies.every(e=>e.hp<100000));assert.ok(i.enemies[0].aggro);
  assert.equal(i.enemies[1].aggro,false);assert.equal(i.enemies[2].aggro,false);
  p.action=null;p.pending=null;p.x=1800;world.tick(.01,t+2);assert.ok(i.enemies[1].aggro);
  world.returnTown(p);world.players.delete(p.id);
});
test('auto collects high mine runes from both sides for every class',()=>{
  world.players.clear();
  for(const job of ['swordsman','archer','mage','priest'])for(const start of [120,2100]) {
    const p=hero(`mine-runes-${job}-${start}`,{class:job});world.beginMine(p);const i=world.instances.get(p.instance);
    let t=Date.now()/1000;
    Object.assign(i,{stage:2,stageAt:t-world.STAGE_INTRO-1,enemies:[],clear:true,clearedAt:t,completed:true,signs:dungeonSigns(41,2),collectedSigns:new Map()});
    Object.assign(p,{auto:true,x:start,y:600,vx:0,vy:0,grounded:true});
    for(let n=0;n<2400&&i.collectedSigns.get(p.id)?.size!==i.signs.length;n++)world.tick(.05,t+=.05);
    assert.equal(i.collectedSigns.get(p.id)?.size,i.signs.length,`${job} from ${start} stuck ${p.x},${p.y}`);
    world.returnTown(p);world.players.delete(p.id);
  }
});
