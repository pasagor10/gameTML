import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pvpSchedule, PVP } from '../shared/pvp.js';
import { worldBossAt } from '../shared/world-boss.js';
import { createPvpSystem } from '../server/pvp.js';
function setup() {
  const players = new Map(), instances = new Map(), notices = [];
  const pvp = createPvpSystem({ players, instances,
    createBot(model,id,n) { return { id, name:`Bot ${n}`, level:model.level, class:model.class, area:"town", hp:100, mp:100 }; },
    eligible(p) { if(p.area !== 'town' || p.hp <= 0 || p.trading) throw Error('town required'); },
    enter(p,i) { Object.assign(p,{ area:'dungeon',instance:i.id,hp:100,mp:100 }); },
    returnTown(p) { const i = instances.get(p.instance); if(i) i.members = i.members.filter(id => id !== p.id); Object.assign(p,{area:'town',instance:null,hp:100,mp:100}); },
    maxHp: () => 100, maxMp: () => 100, notify(p,msg) { notices.push([p.id,msg]); } });
  function add(id, level=1) { const p={ id,name:id,level,area:'town',hp:100,mp:100 };players.set("socket:"+id,p);return p; }
  return {pvp,players,instances,add,notices};
}
test('PvP registration and matches fit into the gap between every world boss', () => {
  for(let start=1200;start<86400;start+=1800) {
    assert.equal(pvpSchedule(start).open,true);
    assert.equal(pvpSchedule(start+299).open,true);
    assert.equal(pvpSchedule(start+300).open,false);
    assert.equal(pvpSchedule(start-1).open,false);
    for(let t=start;t<=start+PVP.registration+PVP.countdown+PVP.match+PVP.result;t++) assert.equal(worldBossAt(t).open,false);
  }
});
test('registration validates mode, location, duplicates and no cross-mode duplicate queues', () => {
  const {pvp,add}=setup(), p=add('one');
  assert.throws(()=>pvp.join(p,'5v5',1201));
  assert.throws(()=>pvp.join(p,'1v1',1100));
  p.trading=true;assert.throws(()=>pvp.join(p,'1v1',1201));p.trading=false;
  pvp.join(p,'1v1',1201);assert.throws(()=>pvp.join(p,'3v3',1201));
  pvp.cancel(p);pvp.join(p,'3v3',1201);assert.equal(pvp.view(p,1201).queued,'3v3');
});
test('1v1 starts once at closing, waits for countdown, resolves victory and restores heroes', () => {
  const {pvp,add,instances}=setup(), a=add('a'),b=add('b');
  pvp.join(a,'1v1',1201);pvp.join(b,'1v1',1202);pvp.update(1499);assert.equal(instances.size,0);
  pvp.update(1500);assert.equal(instances.size,1);
  assert.equal(pvp.canFight(a,1502),false);assert.equal(pvp.canFight(a,1503),true);
  assert.equal(pvp.view(a,1504).match.teams.length,2);
  b.hp=0;pvp.update(1505);assert.equal(pvp.view(a,1505).match.done,true);
  assert.equal(pvp.canFight(a,1506),false);
  pvp.update(1513);assert.equal(a.area,'town');assert.equal(b.hp,100);assert.equal(instances.size,0);
  assert.equal(pvp.view(a,1513).result.outcome,'ชนะ');
});
test('3v3 forms equal teams, allies exclude opponents, and disconnected heroes cannot keep teams alive', () => {
  const {pvp,add,instances,players}=setup();const heroes=Array.from({length:6},(_,n)=>add('p'+n,60-n*5));
  heroes.forEach(p=>pvp.join(p,'3v3',1201));pvp.update(1500);
  const i=[...instances.values()][0];assert.deepEqual(i.pvp.teams.map(t=>t.length),[3,3]);
  assert.equal(pvp.allies(heroes[0],i).length,3);
  i.pvp.teams[1].forEach(id=>players.delete("socket:"+id));pvp.update(1505);
  assert.equal(i.pvp.winner,0);assert.equal(i.pvp.done,true);
});
test('unmatched players get bots, town departures cancel queues, timeout uses HP ratio and allows ties', () => {
  const {pvp,add,instances}=setup(), a=add('a'),b=add('b'),c=add('c');
  pvp.join(c,'3v3',1201);pvp.update(1500);assert.equal(pvp.view(c,1500).queued,null);
  assert.equal(pvp.bots.size,5);pvp.update(1684);pvp.update(1693);assert.equal(pvp.bots.size,0);
  pvp.join(a,'1v1',3001);pvp.join(b,'1v1',3001);pvp.update(3300);
  const i=[...instances.values()][0];pvp.update(i.pvp.endsAt);assert.equal(i.pvp.winner,null);assert.equal(i.pvp.done,true);
  const d=add('d');pvp.join(d,'1v1',4801);d.area='dungeon';pvp.update(4802);assert.equal(pvp.view(d,4802).queued,null);
});
test('leaving a live match forfeits it and never leaves a stale instance', () => {
  const {pvp,add,instances}=setup(),a=add('a'),b=add('b');
  pvp.join(a,'1v1',1201);pvp.join(b,'1v1',1201);pvp.update(1500);
  pvp.leave(a,1504);a.instance=null;a.area='town';pvp.update(1505);
  assert.equal(pvp.view(a,1505).result.reason,'สละสิทธิ์');
  assert.equal(pvp.view(b,1505).match.done,true);pvp.update(1513);assert.equal(instances.size,0);
});

test('partial 3v3 queues fill only missing slots and mirror the opposite human level', () => {
  for(let count=1;count<6;count++) {
    const {pvp,add,instances}=setup();
    const humans=Array.from({length:count},(_,n)=>add('mixed-'+n,10+n*9));
    humans.forEach(p=>pvp.join(p,'3v3',1201));pvp.update(1500);
    const i=[...instances.values()][0];
    assert.equal(pvp.bots.size,6-count);
    assert.deepEqual(i.pvp.teams.map(ids=>ids.length),[3,3]);
    const roster=pvp.view(humans[0],1500).match.teams;
    for(let side=0;side<2;side++) for(let slot=0;slot<3;slot++) {
      if(roster[side][slot].bot) assert.equal(roster[side][slot].level,roster[1-side][slot].level);
    }
    humans.forEach(p=>{p.instance=null;p.area='town';});pvp.update(1501);
    assert.equal(pvp.bots.size,0);assert.equal(instances.size,0);
  }
});
