import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {PartyHub,PARTY_MAX,cleanState,attachParty} from '../server/party.mjs';import {PartyLink} from '../src/party.js';import {Run} from '../src/model.js';
let seed=7;const rng=()=>((seed=(seed*16807)%2147483647)/2147483647);
const client=hub=>{const box=[];const c=hub.connect(m=>box.push(m));c.box=box;return c;};

test('party codes are 6 characters; friends join, see state and leave',()=>{
  const hub=new PartyHub(rng),a=client(hub),b=client(hub),c=client(hub);
  hub.message(a,{t:'create'});const code=a.box.at(-1).code;assert.match(code,/^[A-Z2-9]{6}$/);
  hub.message(a,{t:'state',s:{name:'A',stage:31,x:10,y:5}},1000);
  hub.message(b,{t:'join',code:code.toLowerCase()});const joined=b.box.at(-1);assert.equal(joined.t,'party');assert.equal(joined.members[0].s.name,'A');
  hub.message(b,{t:'state',s:{name:'B',stage:39,job:'hacker',x:1e9}},1000);const seen=a.box.at(-1);
  assert.equal(seen.t,'state');assert.equal(seen.s.job,'novice','unknown classes are cleaned');assert.equal(seen.s.x,5000,'positions are clamped');
  hub.message(c,{t:'join',code:'ZZZZZZ'});assert.equal(c.box.at(-1).why,'notfound');
  hub.message(b,{t:'leave'});assert.deepEqual(a.box.at(-1),{t:'gone',id:b.id});
  hub.message(a,{t:'leave'});assert.equal(hub.parties.size,0,'empty parties close');});

test('a party holds at most 4 and state floods are throttled',()=>{
  const hub=new PartyHub(rng),list=Array.from({length:PARTY_MAX+1},()=>client(hub));hub.message(list[0],{t:'create'});const code=list[0].box[0].code;
  for(const c of list.slice(1))hub.message(c,{t:'join',code});assert.equal(list.at(-1).box.at(-1).why,'full');
  const before=list[1].box.length;for(let i=0;i<100;i++)hub.message(list[0],{t:'state',s:{}},5000);assert.ok(list[1].box.length-before<=21);
  assert.equal(cleanState({hp:3}).hp,1);});

test('the client joins, tracks members and remembers the code',()=>{
  const sent=[],mem={};class Sock{constructor(){this.readyState=1;setTimeout(()=>{});}send(x){sent.push(JSON.parse(x));}close(){}}
  const store={getItem:k=>mem[k]??null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}};
  const p=new PartyLink({url:'ws://x/ws',Socket:Sock,store});p.join('abc-123');assert.deepEqual(sent.at(-1),{t:'join',code:'ABC123'});
  p.handle({t:'party',code:'ABC123',you:2,members:[{id:1,s:{name:'A',x:0,y:0,stage:12}}]});assert.equal(mem['tilmo-party'],'ABC123');assert.equal(p.members.size,1);
  p.handle({t:'state',id:1,s:{name:'A',x:100,y:0,stage:12}});p.tick(.05,{name:'me'});assert.ok(p.list()[0].x>0&&p.list()[0].x<100,'moves smoothly');
  assert.equal(sent.at(-1).t,'state');p.handle({t:'gone',id:1});assert.equal(p.members.size,0);
  p.leave();assert.equal(mem['tilmo-party'],undefined);assert.equal(p.join('ab'),false);});

test('allies in the world hit local monsters; you can travel back to help',()=>{
  const r=new Run(rng);r.state='playing';r.cleared.normal=30;r.farmAt(25);r.enemies=[];r.addEnemy('brute',200);const e=r.enemies[0];
  e.hp=e.max=1e6;r.allies=[{id:9,x:e.x+40,y:e.y,job:'gunner',tier:2,hit:500}];r.allyCd={};
  for(let i=0;i<20;i++){r.p.inv=9;r.allyStep(.05);}assert.ok(e.hp<1e6,'ally damaged the monster');
  const st=r.partyState();assert.equal(st.stage,25);assert.ok(st.hit>0&&st.cp>0);
  assert.ok(r.canHelp(12));assert.ok(r.helpAt(12));assert.equal(r.stage,12);assert.equal(r.mode,'farm');
  assert.equal(r.canHelp(45),false,'cannot jump past your progress');});

test('the relay speaks WebSocket',async()=>{
  const server=http.createServer();const hub=attachParty(server);await new Promise(f=>server.listen(0,'127.0.0.1',f));const url=`ws://127.0.0.1:${server.address().port}/ws`;
  const open=()=>new Promise((ok,bad)=>{const ws=new WebSocket(url);ws.inbox=[];ws.onmessage=e=>ws.inbox.push(JSON.parse(e.data));ws.onopen=()=>ok(ws);ws.onerror=bad;});
  const until=(ws,t)=>new Promise(ok=>{const iv=setInterval(()=>{const m=ws.inbox.find(x=>x.t===t);if(m){clearInterval(iv);ok(m);}},5);});
  const a=await open(),b=await open();a.send(JSON.stringify({t:'create'}));const {code}=await until(a,'party');
  b.send(JSON.stringify({t:'join',code}));await until(b,'party');b.send(JSON.stringify({t:'state',s:{name:'Bee',stage:3}}));
  const m=await until(a,'state');assert.equal(m.s.name,'Bee');a.close();b.close();await new Promise(f=>setTimeout(f,50));
  assert.equal(hub.parties.size,0);server.close();});
