const $=id=>document.getElementById(id),canvas=$('bench'),c=canvas.getContext('2d');
const reports=[];let measuring=false;
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)]||0;
async function benchmark(){
 if(measuring)return;measuring=true;$('run').disabled=true;
 const version=$('version').value,prefix=version==='baseline'?'./baseline/':'../';
 $('status').textContent='กำลังเตรียมภาพ…';
 const [scene,art,sprites,model]=await Promise.all([import(prefix+'scene-art.js'),import(prefix+'art.js'),import(prefix+'sprites.js'),import(prefix+'model.js')]);
 await Promise.all([scene.loadSceneArt(),sprites.loadSprites()]);
 let seed=42;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const run=new model.Run(rng,{job:'knight',appearance:'a'});run.t=45;run.welcome=true;run.spawn=1e9;run.enemies=[];run.p.hp=1e8;
 run.skills={fire:3,spark:3,area:3,haste:3};run.evolved.inferno=true;
 for(let i=0;i<95;i++){run.addEnemy(i%7===0?'runner':'slime',50+rng()*480,i*2.399);const e=run.enemies.at(-1);e.hp=e.max=1e6;}
 const intervals=[],cpu=[];let start=0,last=0,frames=0,warm=0;
 function draw(now){
  if(!start){start=last=now;}
  const interval=now-last;last=now;const begin=performance.now();
  run.update(1/60,{x:Math.cos(run.t*.6)*.5,y:Math.sin(run.t*.6)*.5});
  c.setTransform(1,0,0,1,0,0);c.fillStyle='#173e43';c.fillRect(0,0,960,540);
  c.save();c.translate(480,300);c.scale(.6,.6);c.translate(-run.p.x,-run.p.y);
  scene.drawForest(c,run.t);
  const objects=run.enemies.map(e=>({y:e.y,draw:()=>{if(!scene.drawSlime(c,e,run.t,run.p)){c.fillStyle='#9f91c7';c.fillRect(e.x-15,e.y-15,30,30);}}}));
  objects.push({y:run.p.y,draw:()=>art.drawHero(c,run.p.x,run.p.y,{time:run.t,moving:true,direction:run.direction,distance:run.motionDistance,job:run.job})});
  objects.sort((a,b)=>a.y-b.y).forEach(o=>o.draw());
  for(let i=0;i<6;i++){const a=run.t*2.4+i*Math.PI/3;art.drawFire(c,run.p.x+Math.cos(a)*136,run.p.y+Math.sin(a)*136,a,run.t,true);}
  for(const f of run.effects)if(f.kind!=='number')art.drawEffect(c,f,run.t);
  c.restore();
  cpu.push(performance.now()-begin);if(frames>warm&&interval>0)intervals.push(interval);frames++;
  if(frames===45){intervals.length=0;cpu.length=0;warm=45;start=now;}
  if(frames<45||now-start<6000){$('status').textContent=`${version==='baseline'?'ก่อนแก้':'หลังแก้'} · กำลังวัด ${Math.max(0,((now-start)/1000)).toFixed(1)} / 6 วินาที`;requestAnimationFrame(draw);return;}
  const seconds=intervals.reduce((a,b)=>a+b,0)/1000;
  const report={version,viewport:'960×540 @1x',fixture:'95 enemies, 6 orbit flames, chain lightning, moving player',frames:intervals.length,fps:+(intervals.length/seconds).toFixed(1),frameP95Ms:+percentile(intervals,.95).toFixed(2),cpuP50Ms:+percentile(cpu,.5).toFixed(2),cpuP95Ms:+percentile(cpu,.95).toFixed(2),over33Ms:intervals.filter(t=>t>33.4).length,visibility:document.visibilityState};
  reports.push(report);$('result').textContent=JSON.stringify(reports,null,2);$('status').textContent='วัดเสร็จ · ตัวเลขของฉากควบคุมนี้ ไม่ใช่ผลมือถือทุกเครื่อง';measuring=false;$('run').disabled=false;
 }
 requestAnimationFrame(draw);
}
$('run').onclick=()=>benchmark().catch(error=>{$('status').textContent=error.message;measuring=false;$('run').disabled=false;});
