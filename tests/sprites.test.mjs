import {constrainToArena} from '../src/arena.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DIRECTIONS,FRAME_SIZE,FOOT_ANCHOR,directionFor,animationFrame,sourceRect,RUN_STRIDE,HERO_SCALE,cameraZoom} from '../src/sprite-layout.js';
import {Run} from '../src/model.js';

test('movement selects all eight real sheet rows and idle retains last direction',()=>{
  const vectors=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
  vectors.forEach(([x,y],i)=>{assert.equal(directionFor(x,y),DIRECTIONS[i]);const r=new Run();r.update(.01,{x,y});assert.equal(r.direction,DIRECTIONS[i]);assert.equal(r.moving,true);for(let k=0;k<20;k++)r.update(.02);assert.equal(r.direction,DIRECTIONS[i]);assert.equal(r.moving,false);});
});
test('frame selection loops correctly without reading adjacent direction rows',()=>{
  assert.equal(animationFrame(0,true),0);assert.equal(animationFrame(8/12+.001,true),0);assert.equal(animationFrame(1.01,false),0);
  for(const moving of [true,false])for(const direction of DIRECTIONS)for(let i=0;i<50;i++){
    const columns=moving?8:4,frame=animationFrame(i*.13,moving,columns);assert.ok(frame>=0&&frame<columns);
    const rect=sourceRect(direction,frame,columns);assert.equal(rect.y,DIRECTIONS.indexOf(direction)*256);assert.ok(rect.x+rect.width<=columns*256);
  }
});
test('all 192 imported frames have matching image dimensions and stable ground anchors',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../assets/sprites/heroes/manifest.json',import.meta.url),'utf8'));
  let total=0;for(const sex of ['male','female'])for(const state of ['idle','run']){
    const entry=manifest.characters[sex][state],columns=state==='run'?8:4;
    const image=await readFile(new URL(`../assets/sprites/heroes/${sex}/${state}.png`,import.meta.url));
    assert.equal(image.subarray(1,4).toString(),'PNG');assert.equal(image.readUInt32BE(16),columns*FRAME_SIZE);assert.equal(image.readUInt32BE(20),8*FRAME_SIZE);
    assert.equal(Object.keys(entry.frames).length,columns*8);
    for(const f of Object.values(entry.frames)){assert.deepEqual(f.foot,FOOT_ANCHOR);assert.equal(f.width,256);assert.ok(f.x+256<=columns*256);assert.ok(f.y+256<=2048);assert.ok(f.hand.x>0&&f.hand.x<256);total++;}
  }assert.equal(total,192);
});

test('run cycle follows actual distance rather than time or input speed',()=>{
  assert.equal(animationFrame(100,true,8,0),0);
  assert.equal(animationFrame(0,true,8,RUN_STRIDE/2),4);
  assert.equal(animationFrame(0,true,8,RUN_STRIDE),0);
  const slow=new Run(),fast=new Run();slow.enemies=[];fast.enemies=[];
  for(let i=0;i<10;i++){slow.update(.05,{x:.5,y:0});fast.update(.05,{x:1,y:0});}
  assert.ok(Math.abs(slow.motionDistance*2-fast.motionDistance)<.001);
  const r=new Run();Object.assign(r.p,constrainToArena({x:0,y:-2000},16));r.update(.05,{x:0,y:-1});assert.equal(r.motionDistance,0);assert.equal(r.moving,false);
});
test('mobile presentation keeps hero readable without changing combat speed',()=>{
  for(const width of [360,390,430]){assert.ok(188*HERO_SCALE*cameraZoom(width,844)>85);assert.ok(cameraZoom(width,844)<.82);}
  assert.ok(cameraZoom(1440,900)<=.88);
});
test('run import preserves leg-pose heights instead of forcing boots to one baseline',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../assets/sprites/heroes/manifest.json',import.meta.url),'utf8'));
  for(const sex of ['male','female']){
    const run=manifest.characters[sex].run;assert.equal(run.preserveFlight,true);
    for(const dir of DIRECTIONS){const bottoms=Array.from({length:8},(_,i)=>run.frames[`${dir}-${i}`].contentBounds[3]);assert.ok(new Set(bottoms).size>1,`${sex}-${dir} must retain pose height differences`);}
  }
});
test('registered run head does not jump at the loop seam or drift horizontally',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../assets/sprites/heroes/manifest.json',import.meta.url),'utf8'));
  for(const sex of ['male','female'])for(const direction of DIRECTIONS){
    const run=manifest.characters[sex].run;
    assert.equal(run.registeredHead,true);
    assert.deepEqual(run.frameOrder,[0,1,2,3,4,5,6,7]);
    const heads=Array.from({length:8},(_,i)=>run.frames[`${direction}-${i}`].registeredHead);
    assert.ok(Math.max(...heads.map(h=>h[0]))-Math.min(...heads.map(h=>h[0]))<1.5,`${sex}-${direction} x drift`);
    assert.ok(Math.abs(heads[7][1]-heads[0][1])<4,`${sex}-${direction} 8→1 seam`);
  }
});
test('weapon hand socket follows the painted arm swing in every run row',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../assets/sprites/heroes/manifest.json',import.meta.url),'utf8'));
  for(const sex of ['male','female'])for(const direction of DIRECTIONS){
    const hands=Array.from({length:8},(_,i)=>manifest.characters[sex].run.frames[`${direction}-${i}`].hand);
    assert.ok(hands.every(h=>h.x>40&&h.x<216&&h.y>100&&h.y<175),`${sex}-${direction} hand inside the body area`);
    const spread=Math.max(...hands.map(h=>h.x))-Math.min(...hands.map(h=>h.x))+Math.max(...hands.map(h=>h.y))-Math.min(...hands.map(h=>h.y));
    assert.ok(spread>=3,`${sex}-${direction} hand must move with the stride`);
    for(let i=0;i<8;i++){const a=hands[i],b=hands[(i+1)%8];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<26,`${sex}-${direction} hand jump at ${i}`);}
  }
});

test('class recolor re-hues only the red scarf, keeping skin and leather',async()=>{
  const {recolorPixels}=await import('../src/sprites.js');
  const px=new Uint8ClampedArray([200,30,40,255, 230,180,150,255, 110,70,40,255, 200,30,40,0]);
  recolorPixels(px,265);
  assert.ok(px[2]>px[0]&&px[2]>px[1],'red scarf turns purple');
  assert.deepEqual([...px.slice(4,12)],[230,180,150,255,110,70,40,255]);
  assert.deepEqual([...px.slice(12)],[200,30,40,0]);
});
