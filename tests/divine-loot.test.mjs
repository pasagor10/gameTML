import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { rollDivineLoot, GRAND_BOSS_RELICS, GEAR, DIVINE_DROP_CHANCE, FLOOR_LOOT } from '../shared/rpg.js';
import { lookTier } from '../shared/appearance.js';
const hero = (more={}) => ({level:40,ownedEquipment:[],...more});
test('celestial drops require level 40 and floor 10, with a separate 5% roll',()=>{
  assert.equal(DIVINE_DROP_CHANCE,.05);
  assert.equal(rollDivineLoot(hero({level:39}),40,()=>0),null);
  assert.equal(rollDivineLoot(hero(),9,()=>0),null);
  assert.ok(GRAND_BOSS_RELICS.includes(rollDivineLoot(hero(),10,()=>.049)));
  assert.equal(rollDivineLoot(hero(),40,()=>.05),null);
  assert.equal(Array.from({length:100},(_,n)=>rollDivineLoot(hero(),10,()=>n/100)).filter(Boolean).length,5);
});
test('relics exclude owned items and remain absent from ordinary shops and loot tables',()=>{
  const [a,b,c]=GRAND_BOSS_RELICS;
  assert.equal(rollDivineLoot(hero({ownedEquipment:[a,b]}),10,()=>0),c);
  assert.equal(rollDivineLoot(hero({ownedEquipment:[a,b,c]}),10,()=>0),null);
  for(const id of GRAND_BOSS_RELICS){const item=GEAR[id];assert.equal(item.rarity,'divine');assert.equal(item.price,undefined);assert.equal(lookTier(item),4);assert.ok(existsSync(`public/assets/items/divine/${item.slot}.webp`));for(const table of Object.values(FLOOR_LOOT))assert.ok(!table.pool.includes(id));}
});
