import test from 'node:test';import assert from 'node:assert/strict';
import {PartyHub} from '../server/party.mjs';import {PartyLink} from '../src/party.js';import {Run} from '../src/model.js';
const client=hub=>{const box=[];const c=hub.connect(m=>box.push(m));c.box=box;return c;};
const st=(name,raid,rw,extra={})=>({t:'state',s:{name,job:'mage',lv:30,raid,rw,dmg:raid?5000:0,rx:40,ry:-10,...extra}});

test('world boss: real players in the same window see each other, party or not',()=>{
  const hub=new PartyHub(),a=client(hub),b=client(hub),idle=client(hub),late=client(hub);
  hub.message(a,st('Aom',true,7),1000);hub.message(b,st('Bee',true,7),1000);hub.message(idle,st('Idle',false,0),1000);hub.message(late,st('Late',true,8),1000);
  hub.message(a,st('Aom',true,7),1300);
  const seen=b.box.filter(m=>m.t==='raider');assert.equal(seen.at(-1).s.name,'Aom');assert.equal(seen.at(-1).s.dmg,5000);assert.equal(seen.at(-1).s.rx,40);
  assert.equal(idle.box.filter(m=>m.t==='raider').length,0,'not in the raid');assert.equal(late.box.filter(m=>m.t==='raider').length,0,'other window');
  hub.message(a,st('Aom',false,0),2000);assert.deepEqual(b.box.at(-1),{t:'raidGone',id:a.id},'leaving the raid removes you');
  hub.message(a,st('Aom',true,7),3000);hub.close(a);assert.deepEqual(b.box.at(-1),{t:'raidGone',id:a.id},'disconnect removes you');});

test('raider updates are throttled',()=>{
  const hub=new PartyHub(),a=client(hub),b=client(hub);hub.message(b,st('Bee',true,3),0);
  for(let i=0;i<20;i++)hub.message(a,st('Aom',true,3),1000+i*50);assert.ok(a.box.length===0&&b.box.filter(m=>m.t==='raider').length<=5);});

test('the raid board holds only you plus the real players the relay reports',()=>{
  const r=new Run(()=>.5);r.state='playing';assert.ok(r.joinRaid(0));assert.equal(r.raidBoard().length,1,'alone: just you');
  const b=r.enemies.find(e=>e.raid);r.p.x=b.x+50;r.p.y=b.y+20;const me=r.partyState();assert.equal(me.raid,true);assert.equal(me.rw,r.raidJoined);assert.equal(me.rx,50);assert.equal(me.ry,20);
  const link=new PartyLink({url:'ws://x',Socket:class{constructor(){this.readyState=0;}send(){}close(){}},store:null});
  link.handle({t:'raider',id:4,s:{name:'Bee',job:'gunner',lv:44,rw:r.raidJoined,dmg:9e9,rx:-100,ry:0,atk:true}});link.handle({t:'raider',id:5,s:{name:'Old',rw:r.raidJoined-1,dmg:1}});
  const list=link.raidList(r.raidJoined);assert.deepEqual(list.map(x=>x.s.name),['Bee']);
  r.raid.raiders=list.map(x=>({id:x.id,name:x.s.name,job:x.s.job,lv:x.s.lv,dmg:x.s.dmg,x:b.x+x.x,y:b.y+x.y,atk:x.s.atk}));
  const board=r.raidBoard();assert.equal(board[0].name,'Bee');assert.equal(board[1].you,true);
  let shots=0;for(let i=0;i<30;i++){r.p.inv=9;r.update(.05);shots+=r.effects.filter(f=>f.kind==='muzzle').length;}assert.ok(shots>0,'their attacks are drawn');
  link.handle({t:'raidGone',id:4});assert.equal(link.raidList(r.raidJoined).length,0);});

test('rewards: gear is certain only with 5 real players; solo is a 20% chance and idling gets nothing',async()=>{
  const {raidGearChance}=await import('../src/raid.js');assert.equal(raidGearChance(1),.2);assert.equal(raidGearChance(3),.6);assert.equal(raidGearChance(9),1);
  const play=(others,hit,seed)=>{let n=seed;const r=new Run(()=>((n=n*16807%2147483647)/2147483647));r.state='playing';r.joinRaid(0);
    r.raid.raiders=Array.from({length:others},(_,i)=>({name:'P'+i,lv:9,dmg:1}));r.hit(r.enemies.find(e=>e.raid),hit);r.finishRaid(false);return r.lastRaid.rewards;};
  const big=1e12;let solo=0;for(let s=1;s<=400;s++)if(play(0,big,s*7919).gear)solo++;assert.ok(solo>40&&solo<130,`solo gear ${solo}/400`);
  for(let s=1;s<=20;s++)assert.ok(play(4,big,s*31).gear,'a full raid always pays the top 5');
  const idle=play(4,1,3);assert.equal(idle.gear,null);assert.equal(idle.miss,'damage');});
