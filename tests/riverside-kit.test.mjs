import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {RIVER_LAYOUT,RIVER_PIECES,RIVER_DOCKS} from '../shared/riverside-layout.js';
import {WORLD} from '../shared/config.js';
import {TRAVEL_GATE} from '../shared/towns.js';
test('riverside uses twelve separate pieces aligned with existing NPC services and portals',()=>{
 assert.equal(Object.keys(RIVER_PIECES).length,12);
 const manifest=JSON.parse(readFileSync(new URL('../public/assets/river-kit/kit.json',import.meta.url)));
 assert.deepEqual(manifest,RIVER_PIECES);
 for(const [name,size] of Object.entries(RIVER_PIECES)){
  assert.ok(size.w>0&&size.h>0);
  assert.ok(existsSync(new URL(`../public/assets/river-kit/${name}.webp`,import.meta.url)));
 }
 for(const [npc,piece] of [['elder','pavilion'],['potion','potion'],['weapon','weapon'],['forge','smithy'],['trainer','classhall'],['stones','gemshop']])
  assert.equal(RIVER_LAYOUT.find(p=>p.piece===piece).x,WORLD.npcs.find(n=>n.id===npc).x);
 assert.equal(RIVER_LAYOUT.find(p=>p.piece==='travelarch').x,TRAVEL_GATE.x);
 assert.equal(RIVER_LAYOUT.find(p=>p.piece==='minegate').x,WORLD.portal);
 assert.ok(existsSync(new URL('../public/assets/river-kit/far-river.webp',import.meta.url)));
});
test('raised dock surfaces have a reachable jump path and stay inside town bounds',()=>{
 for(const dock of RIVER_DOCKS){
  assert.ok(dock.x>0&&dock.x+dock.w<WORLD.townWidth);
  assert.ok(600-dock.y < 650*650/(2*1150),'each deck is below the town jump apex');
 }
});
