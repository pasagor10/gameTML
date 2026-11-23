import {drawToonHero,drawToonMonster} from './toon.js';
export function paintHeroPortrait(canvas,hero={}){
 const c=canvas.getContext('2d'),s=canvas.width/180;c.clearRect(0,0,canvas.width,canvas.height);c.save();c.scale(s,s);
 c.fillStyle='#b9d7b1';c.beginPath();c.ellipse(90,154,52,12,0,0,Math.PI*2);c.fill();
 c.translate(90,139);c.scale(1.45,1.45);drawToonHero(c,0,0,{job:hero.job||'novice',appearance:hero.appearance||'a',time:0,tier:0,direction:'se'});c.restore();
}
export function paintLobby(canvas,hero={}){
 const c=canvas.getContext('2d');c.clearRect(0,0,960,720);c.fillStyle='#d3e7bb';c.fillRect(0,0,960,720);
 // Hand-drawn meadow, matching the simple shapes and warm outlines of the arena.
 for(let i=0;i<60;i++){const x=(i*157)%960,y=240+(i*113)%470;c.fillStyle=i%2?'#abc88f':'#bdd5a0';c.beginPath();c.ellipse(x,y,24+i%4*7,8+i%3*3,-.2,0,Math.PI*2);c.fill();}
 const path=c.createLinearGradient(0,0,960,720);path.addColorStop(0,'#e9d9ab');path.addColorStop(1,'#d6c28d');c.fillStyle=path;c.beginPath();c.moveTo(0,600);c.quadraticCurveTo(450,280,960,490);c.lineTo(960,660);c.quadraticCurveTo(450,440,0,720);c.fill();
 function tree(x,y,s){c.save();c.translate(x,y);c.scale(s,s);c.lineJoin='round';c.lineWidth=6;c.strokeStyle='#38483a';c.fillStyle='#95704e';c.fillRect(-12,-45,24,70);for(const [dx,dy,r] of [[-35,-65,45],[28,-80,48],[0,-116,50]]){c.fillStyle=dy===-116?'#7fa16d':'#62895e';c.beginPath();c.arc(dx,dy,r,0,Math.PI*2);c.fill();c.stroke();}c.restore();}
 tree(45,440,1.1);tree(895,400,1.25);tree(810,620,.8);
 function heroAt(x,y,job,appearance,scale){c.save();c.translate(x,y);c.scale(scale,scale);drawToonHero(c,0,0,{job,appearance,time:0,tier:0,direction:'se'});c.restore();}
 heroAt(480,540,hero.job||'novice',hero.appearance||'a',2.5);heroAt(300,465,'mage','b',1.8);heroAt(665,455,'gunner','a',1.8);
 for(const [i,x,y,type] of [[0,180,610,'slime'],[1,730,590,'slime'],[2,590,650,'slime']]){c.save();c.translate(x,y);c.scale(1.8,1.8);drawToonMonster(c,{id:i,x:0,y:0,r:16,type,stage:1,hp:30,max:30,flash:0,slow:0},0,{x:-50,y:0});c.restore();}
}
