import { DIRECTIONS, animationFrame, RUN_STRIDE } from './sprite-layout.js';
import { loadSprites, drawSpriteHero, spriteStatus, animationColumns } from './sprites.js';
const $ = id => document.getElementById(id);
const DEMO_SPEED = 145;
let appearance = 'a', time = 0, playing = true, last = 0, playbackSpeed = 1;
function tile(parent, label) {
  const section = document.createElement('section');section.className = 'tile';
  const canvas = document.createElement('canvas');canvas.width = canvas.height = 512;
  canvas.setAttribute('aria-label', label);
  const title = document.createElement('b');title.textContent = label;
  section.append(canvas, title);parent.append(section);return { canvas, section };
}
const canvases = DIRECTIONS.map(direction => ({ ...tile($('grid'), direction.toUpperCase()), direction }));
const cycle = Array.from({length:8},(_,index)=>{
  const item=tile($('cycle'),`#${index+1}`);
  item.section.setAttribute('role','button');item.section.tabIndex=0;item.section.setAttribute('aria-label',`ดูเฟรม ${index+1}`);
  item.section.onclick=()=>{playing=false;time=index*cycleDuration()/columns();syncPlay();};
  item.section.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();item.section.click();}};
  return item;
});
const moving = () => $('state').value === 'run';
const columns = () => animationColumns(appearance,moving());
const cycleDuration = () => moving() ? RUN_STRIDE/DEMO_SPEED : columns()/4;
const currentFrame = () => animationFrame(time,moving(),columns(),moving()?time*DEMO_SPEED:undefined);
function syncPlay(){ $('play').textContent=playing?'หยุดแอนิเมชัน':'เล่นแอนิเมชัน';render(); }
function step(delta){
  playing=false;const count=columns(),index=(currentFrame()+delta+count)%count;
  time=index*cycleDuration()/count;syncPlay();
}
document.querySelectorAll('[data-sex]').forEach(button=>button.onclick=()=>{
  appearance=button.dataset.sex;
  document.querySelectorAll('[data-sex]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sex===appearance)));render();
});
$('play').onclick=()=>{playing=!playing;syncPlay();};
$('step').onclick=()=>step(1);$('previous').onclick=()=>step(-1);
$('state').onchange=()=>{time=0;render();};
$('speed').onchange=()=>{playbackSpeed=Number($('speed').value);render();};
await loadSprites();
function paint(canvas,direction,frameIndex){
  const c=canvas.getContext('2d'),pixels=Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,3));
  if(!pixels)return;
  if(canvas.width!==pixels)canvas.width=canvas.height=pixels;
  c.setTransform(pixels/256,0,0,pixels/256,0,0);
  c.clearRect(0,0,256,256);c.save();c.translate(128,220);c.scale(1.15,1.15);
  drawSpriteHero(c,0,0,{time,moving:moving(),appearance,direction,frameIndex,distance:moving()?time*DEMO_SPEED:undefined});
  if($('sockets').checked){c.strokeStyle='#ffe1a1';c.lineWidth=1;c.beginPath();c.moveTo(-8,0);c.lineTo(8,0);c.moveTo(0,-8);c.lineTo(0,8);c.stroke();}
  c.restore();
}
function render(){
  const active=currentFrame();
  $('status').textContent=spriteStatus.error||`เฟรม ${active+1} / ${columns()} · ${playbackSpeed}×`;
  canvases.forEach(({canvas,direction})=>paint(canvas,direction));
  cycle.forEach(({canvas,section},i)=>{
    section.hidden=i>=columns();section.style.borderColor=i===active?'#ffe1a1':'#4d736b';
    if(i<columns())paint(canvas,$('direction').value,i);
  });
}
function frame(now){
  if(playing)time+=Math.min(.05,(now-last)/1000||0)*playbackSpeed;last=now;
  render();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
