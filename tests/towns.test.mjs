import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
process.env.DB_PATH=path.join(mkdtempSync(path.join(tmpdir(),'tml-towns-')),'test.sqlite');
const {db,loadCharacter}=await import('../server/database.js');
const world=await import('../server/world.js');
const {TOWNS,TRAVEL_GATE}=await import('../shared/towns.js');
const {WORLD}=await import('../shared/config.js');
function hero(id,townId='cave'){
 db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,id,null,Date.now());
 db.prepare('INSERT INTO characters VALUES(?,?,?,?)').run(id,id,id,JSON.stringify({class:'swordsman',gender:'male',level:60,unlocked:40,quest:40,gold:100000,inventory:{ore:0},townId}));
 const p=world.makeRuntime(loadCharacter(id),{emit(){}});world.players.set(id,p);return p;
}
test('town travel checks distance, destination and trades, and persists across reconnect',()=>{
 const p=hero('traveller');assert.equal(p.townId,'cave');
 assert.throws(()=>world.travelTown(p,'riverside'),/ประตู/);
 p.x=TRAVEL_GATE.x;assert.throws(()=>world.travelTown(p,'unknown'),/ปลายทาง/);
 world.trades.set('pending',{members:[p.id]});assert.throws(()=>world.travelTown(p,'riverside'),/แลกเปลี่ยน/);world.trades.clear();
 world.travelTown(p,'riverside');assert.equal(p.townId,'riverside');assert.equal(p.area,'town');
 assert.equal(world.snapshot(p).town.name,TOWNS.riverside.name);
 assert.equal(loadCharacter(p.id).townId,'riverside');
 const reload=world.makeRuntime(loadCharacter(p.id),{emit(){}});assert.equal(reload.townId,'riverside');
 world.ensureTown(p);world.specialize(p,'guardian');
 p.x=TRAVEL_GATE.x;world.travelTown(p,'cave');assert.equal(p.townId,'cave');
});
test('towns isolate player visibility and prevent remote trading and mixed-town dungeon parties',()=>{
 const a=hero('city-a'),b=hero('city-b','riverside');
 assert.ok(!world.snapshot(a).players.some(p=>p.id===b.id));
 assert.throws(()=>world.tradeAction(a,{action:'request',target:b.id}));
 const party={id:'mixed',leader:a.id,members:[a.id,b.id],ready:new Set([b.id])};world.parties.set(party.id,party);a.party=b.party=party.id;
 assert.throws(()=>world.beginDungeon(a,1),/เมือง/);
 a.party=b.party=null;world.parties.delete(party.id);
});
test('riverside ground has no invisible old rooftops and mine returns to the right town',()=>{
 const p=hero('miner','riverside');assert.throws(()=>world.beginMine(p),/ทางเข้า/);
 p.x=WORLD.portal;world.beginMine(p);let i=world.instances.get(p.instance);
 assert.equal(i.mine,true);assert.equal(world.snapshot(p).dungeon.mine,true);assert.ok(i.enemies.length>0);
 for(let stage=1;stage<3;stage++){i.clear=true;world.nextStage(p);}
 assert.equal(i.stage,3);i.clear=true;i.completed=true;i.results={};world.nextStage(p);
 assert.equal(p.area,'town');assert.equal(p.townId,'riverside');
 // A hero falling onto an old town roof position must reach the new street.
 p.x=1300;p.y=400;p.vy=0;p.grounded=false;
 let t=Date.now()/1000;for(let n=0;n<30;n++)world.tick(0.05,t+=0.05);
 assert.equal(p.y,600);
 p.x=3900;p.y=600;p.vy=0;p.grounded=true;p.jump=true;
 for(let n=0;n<30;n++)world.tick(0.05,t+=0.05);
 assert.equal(p.y,528,"land on the visible lower timber dock");
 p.x=4150;p.y=600;p.vy=0;p.grounded=true;p.jump=true;
 for(let n=0;n<30;n++)world.tick(0.05,t+=0.05);
 assert.equal(p.y,480,"land on the visible upper timber dock");
});
test('both region paintings and the shared NPC services are present',()=>{
 assert.equal(WORLD.npcs.length,6);
 for(const name of ['riverside-town','rare-earth-mine'])assert.ok(existsSync(new URL(`../public/assets/regions/${name}.webp`,import.meta.url)));
});
