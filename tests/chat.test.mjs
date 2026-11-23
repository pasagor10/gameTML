import test from 'node:test';
import assert from 'node:assert/strict';
import {PartyHub} from '../server/party.mjs';
import {PartyLink} from '../src/party.js';
const connect=(hub,name)=>{const box=[];const c=hub.connect(m=>box.push(m));c.box=box;hub.message(c,{t:'state',s:{name,job:'mage',lv:10,hp:.4}},1000);return c;};
test('world chat reaches all connected players and party chat is private',()=>{
 const h=new PartyHub(),a=connect(h,'A'),b=connect(h,'B'),c=connect(h,'C');h.message(a,{t:'create'});h.message(b,{t:'join',code:a.code});
 h.message(a,{t:'chat',channel:'party',text:'private'},2000);assert.equal(b.box.at(-1).text,'private');assert.ok(!c.box.some(m=>m.text==='private'));
 h.message(c,{t:'chat',channel:'world',text:'hello'},2000);for(const x of [a,b,c])assert.equal(x.box.at(-1).text,'hello');
 h.message(c,{t:'chat',channel:'party',text:'spy'},3000);assert.equal(c.box.at(-1).t,'chatError');assert.ok(!a.box.some(m=>m.text==='spy'));
 h.close(c);const n=c.box.length;h.message(a,{t:'chat',channel:'world',text:'after close'},4000);assert.equal(c.box.length,n);
});
test('chat bounds payloads, strips controls, ignores spoofed names and rate limits spam',()=>{
 const h=new PartyHub(),a=connect(h,'Real'),b=connect(h,'B');h.message(a,{t:'chat',channel:'world',name:'Fake',text:'\u0000'+ 'x'.repeat(300)},2000);const m=b.box.at(-1);assert.equal(m.name,'Real');assert.equal(m.text.length,200);assert.ok(!m.text.includes('\u0000'));
 for(let i=0;i<10;i++)h.message(a,{t:'chat',channel:'world',text:'spam'},2000);assert.equal(a.box.at(-1).why,'rate');assert.equal(b.box.filter(m=>m.t==='chat').length,5);
});
test('party client keeps bounded channel histories and clears private chat on leave',()=>{
 const p=new PartyLink({url:'ws://x',store:null,Socket:null});for(let i=0;i<80;i++)p.handle({t:'chat',channel:'world',text:String(i)});assert.equal(p.messages.world.length,60);
 p.handle({t:'party',code:'ABC123',you:1,members:[]});p.handle({t:'chat',channel:'party',text:'private'});p.leave();assert.equal(p.messages.party.length,0);assert.equal(p.messages.world.length,60);
 assert.equal(p.chat('world','offline'),false);
});
test('malformed state packets cannot crash the public chat relay',()=>{
 const h=new PartyHub(),a=connect(h,'A');assert.doesNotThrow(()=>h.message(a,{t:'state',s:null},3000));assert.equal(a.state.job,'novice');
});
