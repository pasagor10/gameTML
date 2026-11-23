import test from 'node:test';import assert from 'node:assert/strict';
import {TIERS,REQ_LEVEL,WEAPON_NAMES,TIER_PERKS,weaponName} from '../src/weapons.js';import {ARMOR,HELMET,RING,itemName,itemStats,sellPrice,canEquip} from '../src/loot.js';import {Run} from '../src/model.js';
test('Lv.50-80 tiers exist for every slot and class, each stronger than the last',()=>{
  assert.deepEqual(REQ_LEVEL.slice(6,11),[50,55,60,70,80]);assert.deepEqual(REQ_LEVEL.slice(11),[90,100,115,130,145]);
  for(const list of [ARMOR,HELMET,RING,...Object.values(TIER_PERKS),WEAPON_NAMES.knight,WEAPON_NAMES.mage,WEAPON_NAMES.gunner])assert.equal(list.length,TIERS.length);
  for(let t=1;t<TIERS.length;t++){assert.ok(TIERS[t].power>TIERS[t-1].power);assert.ok(ARMOR[t].hp>ARMOR[t-1].hp);assert.ok(HELMET[t].hp>HELMET[t-1].hp);assert.ok(RING[t].dmg>RING[t-1].dmg);}
  for(let t=6;t<TIERS.length;t++)for(const kind of ['weapon','armor','helmet','ring']){const item={kind,tier:t,job:kind==='weapon'?'knight':null};assert.ok(itemName(item));assert.ok(sellPrice(item)>0);assert.ok(Object.values(itemStats(item)).every(Number.isFinite));}
  assert.equal(canEquip({kind:'armor',tier:9},69,'knight'),false);assert.equal(canEquip({kind:'armor',tier:9},70,'knight'),true);
  assert.equal(weaponName('mage',10),'คทานิรันดร์กาล');});
test('world 5-6 bosses drop Lv.50+ gear and late hard mode reaches Lv.80',()=>{
  const r=new Run();r.stage=45;assert.equal(r.lootBase()+2,6,'5-x boss: Ancient');r.stage=55;assert.equal(r.lootBase()+2,7,'6-x boss: Celestial');
  r.stage=15;assert.equal(r.lootBase(),0);r.hard=true;r.cleared.normal=60;r.stage=55;assert.equal(r.lootBase()+2,10,'hard 6-x boss: Eternal');});
test('a hero wearing a late tier is drawn without errors',()=>{const r=new Run(()=>.4,{job:'gunner'});r.level=80;for(const kind of ['weapon','armor','helmet','ring'])r.addItem({kind,tier:10,job:kind==='weapon'?'gunner':null});r.equipBest();assert.equal(r.weaponTier,10);assert.equal(r.armorTier,10);assert.ok(r.power()>7);});
