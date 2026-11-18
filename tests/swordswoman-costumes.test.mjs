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
   const dir=set.layers?`${set.dir}/body`:set.dir;
   const clip=JSON.parse(await readFile(new URL(`${dir}/${folder}/animation.json`,root)));
   assert.equal(clip.frameCount,4);assert.equal(clip.durationsMs.length,4);
   await access(new URL(`${dir}/${folder}/${clip.fallback.pages[0].file}`,root));
  }
 }
});

test('costumes fit every class of their gender, need owning, and drop from bosses', async () => {
 const {COSTUMES, COSTUME_ITEMS, costumeItem, rollCostumeDrop, costumeDropChance} = await import('../shared/costumes.js');
 const index=JSON.parse(await readFile(new URL('index.json',root)));
 for (const cls of ['swordsman','archer','mage','priest']) for (const c of COSTUMES) {
  const key=heroSkins({class:cls,gender:c.gender,skin:c.id,specialization:null})[0];
  assert.equal(key,`${c.gender}-costume-${c.id}`);
  const set=index.sets[key];assert.ok(set,key);
  await access(new URL(`${set.dir}/${set.portrait}`,root));
  for (const folder of Object.values(set.actions)) {
   await access(new URL(`${set.dir}/body/${folder}/animation.json`,root));
   await access(new URL(`${set.dir}/hand/${folder}/animation.json`,root));
  }
  assert.ok(COSTUME_ITEMS[costumeItem(c.id)].price > 0);
 }
 // Male heroes and unknown costumes keep the class look.
 assert.deepEqual(heroSkins({class:'swordsman',gender:'male',skin:'5'}),['swordsman-male']);
 assert.deepEqual(heroSkins({class:'mage',gender:'female',skin:'mnoble'}),['mage-female']);
 // Three in four drops fit the hero's gender.
 const seq=[0.01,0.1,0.01]; const male=rollCostumeDrop(1,()=>seq.shift()??0.01,'male');
 assert.equal(COSTUME_ITEMS[male].gender,'male');
 assert.deepEqual(heroSkins({class:'swordsman',gender:'female',skin:'nope'}),['swordsman-female']);
 // Drops: none above the chance, a known costume below it; deeper is likelier.
 assert.equal(rollCostumeDrop(1,()=>0.99),null);
 assert.ok(COSTUME_ITEMS[rollCostumeDrop(1,()=>0.01)]);
 assert.ok(costumeDropChance(12)>costumeDropChance(9) && costumeDropChance(9)>costumeDropChance(5) && costumeDropChance(5)>costumeDropChance(1));
});
