import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {constrainToArena,isInArena,enemySpawn,cameraPosition,ARENA_HALF} from '../src/arena.js';
import {Run} from '../src/model.js';
test('painted clearing contains the start and blocks stream/ruins/tree boundaries',()=>{
  assert.ok(isInArena({x:0,y:0},16));
  for(const point of [{x:1000,y:0},{x:0,y:-950},{x:-1000,y:0},{x:0,y:1000}]){
    assert.equal(isInArena(point,16),false);assert.ok(isInArena(constrainToArena(point,16),16));
  }
  for(let x=-1800;x<=1800;x+=180)for(let y=-1800;y<=1800;y+=180)assert.ok(isInArena(constrainToArena({x,y},42),42));
});
test('enemy spawning stays in clearing and cannot materialize on boundary player',()=>{
  const player=constrainToArena({x:1600,y:-1500},16);
  for(let i=0;i<24;i++){const point=enemySpawn(player,430,i*.27,16);assert.ok(isInArena(point,16));assert.ok(Math.hypot(point.x-player.x,point.y-player.y)>=220);}
});
test('camera clamps at map edges and centers when view is wider than painted map',()=>{
  const width=1000,height=700,zoom=.8,view=cameraPosition({x:1000,y:1000},width,height,zoom);
  assert.ok(view.x+width/(2*zoom)<=ARENA_HALF+.001);assert.ok(view.y+(height/2-35)/zoom<=ARENA_HALF+.001);
  assert.equal(cameraPosition({x:600,y:0},3000,700,.8).x,0);
});
test('enemies and player stay in painted arena through chase, knockback and movement',()=>{
  const run=new Run(()=>.25);run.enemies=[];run.p.hp=1e9;run.skills.gust=3;run.spawn=1000;
  Object.assign(run.p,constrainToArena({x:1600,y:0},16));run.addEnemy('elite',150,0);
  for(let i=0;i<100;i++){run.update(.05,{x:1,y:0});assert.ok(isInArena(run.p,16));for(const enemy of run.enemies)assert.ok(isInArena(enemy,enemy.r));}
});
test('scene delivery assets exist as WebP while source PNGs remain intact',async()=>{
  for(const path of ['assets/scenes/forest/ground.webp','assets/monsters/slime-leaf.webp']){
    const bytes=await readFile(new URL('../'+path,import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  }
  for(const path of ['forest-arena.png','slime-leaf.png'])assert.ok((await readFile(new URL('../assets/generated/v1/'+path,import.meta.url))).length>0);
});
