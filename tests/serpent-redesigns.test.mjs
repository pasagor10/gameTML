import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../public/assets/sprites/',import.meta.url);
const index=JSON.parse(readFileSync(new URL('index.json',root)));
test('serpent and naga use high resolution painted replacements with consistent scale',()=>{
 for(const [type,height,count] of [['serpent',190,6],['naga',300,7]]){
  const set=index.monsters[type];assert.equal(set.dir,`monsters/${type}-v2`);
  assert.equal(set.height,height);assert.equal(set.pixel,false);assert.equal(set.facing,-1);
  assert.equal(Object.keys(set.actions).length,count);
  assert.ok(existsSync(new URL(`${set.dir}/portrait.webp`,root)));
  let body;
  for(const [action,folder] of Object.entries(set.actions)){
   const base=new URL(`${set.dir}/${folder}/`,root);
   const clip=JSON.parse(readFileSync(new URL('animation.json',base)));
   assert.equal(clip.frameCount,4);assert.equal(clip.sampling,'linear');
   assert.ok(clip.sourceSize[0]>=200,'keep detail rather than magnifying tiny pixels');
   assert.ok(clip.bodyHeightPx>100);
   body??=clip.bodyHeightPx;assert.equal(clip.bodyHeightPx,body,'same size through every action');
   assert.equal(clip.loop,['idle','move'].includes(action));
   for(const page of clip.fallback.pages)assert.ok(existsSync(new URL(page.file,base)));
   if(action==='attack'||action==='skill')assert.equal(clip.events[0].frame,2);
  }
 }
});
