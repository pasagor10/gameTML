import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { EXTRA_MONSTERS, BIOME_ROSTERS, flyingMonster } from '../shared/extra-monsters.js';
import { DUNGEON_ROSTERS, FLOOR_VARIANTS, enemyStep } from '../shared/dungeons.js';
import { MONSTERS, recordKill, bestiaryBonuses } from '../shared/quests.js';

test('six new monster silhouettes have complete runtime animation sets and portraits',()=>{
  const index=JSON.parse(readFileSync(new URL('../public/assets/sprites/index.json',import.meta.url)));
  assert.equal(Object.keys(EXTRA_MONSTERS).length,6);
  for(const [type,spec] of Object.entries(EXTRA_MONSTERS)){
    const set=index.monsters[type];
    assert.ok(set,`${type}: registered art`);
    assert.equal(set.height,spec.height);
    assert.equal(set.facing,-1);
    assert.equal(set.flyer,!!spec.flyer);
    assert.ok(existsSync(new URL(`../public/assets/sprites/${set.dir}/portrait.webp`,import.meta.url)));
    for(const action of ['idle','move','attack','hit','death','spawn']){
      assert.equal(set.actions[action],action);
      const path=new URL(`../public/assets/sprites/${set.dir}/${action}/`,import.meta.url);
      const clip=JSON.parse(readFileSync(new URL('animation.json',path)));
      assert.equal(clip.frameCount,4);
      assert.equal(clip.durationsMs.length,4);
      assert.ok(clip.bodyHeightPx>10);
      assert.equal(clip.loop,['idle','move'].includes(action));
      assert.ok(existsSync(new URL(clip.fallback.pages[0].file,path)));
      if(action==='attack')assert.equal(clip.events[0].frame,2);
    }
  }
});

test('new monsters populate normal and deep floors and count toward the monster book',()=>{
  for(const type of Object.keys(EXTRA_MONSTERS)){
    assert.ok(DUNGEON_ROSTERS.some(roster=>roster.includes(type)));
    assert.ok(MONSTERS[type]?.name);
    const p={};for(let n=0;n<50;n++)recordKill(p,type);
    assert.equal(p.bestiary[type],50);
    assert.ok(bestiaryBonuses(p.bestiary)[MONSTERS[type].stat]>0);
  }
  assert.equal(Object.keys(BIOME_ROSTERS).length,5);
  for(let floor=16;floor<=40;floor++){
    assert.ok(DUNGEON_ROSTERS[floor-1].filter(type=>EXTRA_MONSTERS[type]).length>=2);
    assert.ok(FLOOR_VARIANTS[floor].every(v=>v.name&&!v.name.includes('undefined')));
  }
});

test('harpies and reapers hover toward elevated heroes while ground creatures use gravity',()=>{
  for(const type of Object.keys(EXTRA_MONSTERS)){
    const e={type,x:400,y:600,spawnAt:1};
    enemyStep(e,{x:400,y:400},[],0.1,2);
    if(flyingMonster(type))assert.ok(e.y<600,type);
    else assert.equal(e.y,600,type);
  }
});
