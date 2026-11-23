import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacterStore,CHARACTER_LIMIT} from '../src/characters.js';
const memory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test('migration preserves all legacy bytes and resumes the same character after reload',()=>{
 const s=memory();for(const k of ['save','profile','stash','runs'])s.setItem('tilmo-'+k,JSON.stringify({legacy:k}));
 const store=createCharacterStore(s);for(const k of ['save','profile','stash','runs'])assert.equal(store.getItem('tilmo-'+k),s.getItem('tilmo-'+k));
 store.setItem('tilmo-save','updated');const reload=createCharacterStore(s);assert.equal(reload.getItem('tilmo-save'),'updated');assert.equal(s.getItem('tilmo-save'),'{"legacy":"save"}');
});
test('new class characters never inherit another hero save, inventory, pets or history',()=>{
 const s=memory(),store=createCharacterStore(s),first=store.active;
 store.setItem('tilmo-save','original run');store.setItem('tilmo-stash','original pets and gear');store.setItem('tilmo-runs','original history');
 const mage=store.create({job:'mage',appearance:'b',name:'Mage'});for(const key of ['save','stash','runs'])assert.equal(store.getItem('tilmo-'+key),null);
 store.setItem('tilmo-save','mage run');store.setItem('tilmo-stash','mage gear');store.select(first);assert.equal(store.getItem('tilmo-save'),'original run');assert.equal(store.getItem('tilmo-stash'),'original pets and gear');store.select(mage);assert.equal(store.getItem('tilmo-save'),'mage run');
 store.removeItem('tilmo-save');store.select(first);assert.equal(store.getItem('tilmo-save'),'original run');assert.equal(createCharacterStore(s).active,first);
});
test('slot cap and failed writes preserve active character',()=>{
 const s=memory(),store=createCharacterStore(s);for(let i=1;i<CHARACTER_LIMIT;i++)store.create({job:'knight',appearance:'a',name:'Hero'});
 assert.throws(()=>store.create({job:'mage',appearance:'a',name:'Extra'}));assert.equal(store.list().length,CHARACTER_LIMIT);
 const active=store.active;s.setItem=()=>{throw Error('quota');};assert.throws(()=>store.select(store.list()[0].id));assert.equal(store.active,active);
});
test('all new heroes start as novices without changing an existing awakened profile',()=>{
 const s=memory();s.setItem('tilmo-profile',JSON.stringify({job:'mage',appearance:'b',name:'Existing'}));const store=createCharacterStore(s),first=store.active;
 for(const job of ['knight','mage','gunner',undefined]){store.create({job,appearance:'a',name:'New'});assert.equal(JSON.parse(store.getItem('tilmo-profile')).job,'novice');}
 store.select(first);assert.equal(JSON.parse(store.getItem('tilmo-profile')).job,'mage');
});
