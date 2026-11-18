import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {heroSkins} from '../shared/rpg.js';
const root=new URL('../public/assets/sprites/',import.meta.url);
test('female swordsman changes to the registered guardian and duelist costumes at both tiers',async()=>{
 const index=JSON.parse(await readFile(new URL('index.json',root)));
 for(const specialization of ['guardian','duelist']) for(const advanced of [false,true]){
  const player={class:'swordsman',gender:'female',specialization,advanced};
  const key=heroSkins(player)[0];
  assert.equal(key,`swordsman-female-${specialization}-${advanced?3:2}`);
  const set=index.sets[key];assert.ok(set,key);
  await access(new URL(`${set.dir}/${set.portrait}`,root));
  for(const state of ['idle','walk','run','jump','attack','skill','hit','death']){
   const folder=set.actions[state];assert.ok(folder,`${key}: ${state}`);
   const clip=JSON.parse(await readFile(new URL(`${set.dir}/${folder}/animation.json`,root)));
   assert.equal(clip.frameCount,4);assert.equal(clip.durationsMs.length,4);
   await access(new URL(`${set.dir}/${folder}/${clip.fallback.pages[0].file}`,root));
  }
 }
});
