import {drawSpriteHero} from './sprites.js';
// Code-native cartoon art: independent of collision sizes and combat timing.
export function drawHero(c,x,y,{time=0,moving=false,job='novice',appearance='a',inv=0,facing=1,attacking=false,direction='se',distance,tier=0}={}){
if(drawSpriteHero(c,x,y,{time,moving,job,appearance,inv,facing,attacking,direction,distance,tier}))return;
c.save();c.translate(x,y);const bob=moving?Math.sin(time*13)*2:Math.sin(time*3)*1.2;
const metal=job==='mage'?'#c5b6ff':job==='gunner'?'#a6e3c6':'#d8eafa',trim='#ffe09a',dark='#23364f',cape=job==='mage'?'#7555b8':job==='gunner'?'#248b83':'#ce4e62';
const ellipse=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
const shape=(p,color,stroke='#27394c')=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();c.strokeStyle=stroke;c.lineWidth=1.8;c.lineJoin='round';c.stroke();};
const line=(x,y,xx,yy,color,width)=>{c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();};
ellipse(0,12,28,10,'#183a4b55');c.translate(0,bob);c.scale(facing,1);if(inv>0&&Math.floor(inv*15)%2)c.globalAlpha=.45;
// Scarf, long hair and coat move independently of the body.
const flutter=Math.sin(time*7)*6;
if(appearance==='b')shape([[-17,-49],[-27,-35],[-29,8],[-10,-6],[18,-10],[25,4],[26,-36],[14,-52]],'#cbdcf4','#6f83a3');
shape([[-9,-26],[-33,-21+flutter],[-50,-31+flutter],[-39,-10],[-18,-4]],cape);
shape([[-13,-21],[-21,7],[-7,14],[1,3],[12,15],[23,6],[12,-24]],dark);
const step=moving?Math.sin(time*13)*4:0;
line(-9,3,-12,17+step,dark,10);line(9,3,13,17-step,dark,10);line(-12,17+step,-5,17+step,'#637f9e',7);line(13,17-step,20,17-step,'#637f9e',7);
shape([[-14,-26],[12,-26],[17,-1],[2,6],[-16,-1]],metal);shape([[-9,-23],[7,-23],[5,-5],[-5,-4]],'#45749a');
line(-14,-24,-21,-8,metal,11);line(-21,-8,-12,-2,dark,7);line(14,-24,23,-9,metal,11);line(23,-9,30,-3,dark,7);
shape([[-22,-27],[-11,-31],[-7,-23],[-18,-18]],trim);shape([[10,-28],[21,-26],[23,-19],[12,-18]],trim);
line(-13,-1,14,-1,'#6c5148',5);shape([[0,-5],[5,0],[0,5],[-5,0]],trim);
ellipse(0,-45,20,21,'#ffe0c2');ellipse(-17,-42,4,6,'#f3bf9c');ellipse(17,-42,4,6,'#f3bf9c');
shape([[-21,-47],[-24,-58],[-13,-58],[-7,-72],[0,-65],[13,-73],[13,-62],[25,-60],[20,-44],[13,-39],[9,-51],[-1,-43],[-6,-52],[-18,-37]],'#f1f7ff','#748ba9');
shape([[-18,-58],[-8,-65],[-3,-57],[9,-64],[18,-60],[6,-54]],'#ffffff','#dbe6f3');
ellipse(-8,-44,4.5,6,'#ffffff');ellipse(8,-44,4.5,6,'#ffffff');ellipse(-7,-43,3,4.7,'#288dbc');ellipse(9,-43,3,4.7,'#288dbc');ellipse(-6,-45,1.2,1.4,'#fff');ellipse(10,-45,1.2,1.4,'#fff');
line(-12,-51,-5,-50,'#58738d',1.8);line(5,-50,12,-52,'#58738d',1.8);line(-3,-33,3,-34,'#a85e62',1.6);
ellipse(-13,-36,3,1.5,'#efa0a080');ellipse(14,-36,3,1.5,'#efa0a080');
line(-14,-60,16,-60,'#8b6239',5);for(const gx of [-9,10]){ellipse(gx,-60,7,5.5,'#ffda80');ellipse(gx,-60,4.8,3.8,'#459fc9');line(gx-2,-62,gx+1,-62,'#d8f9ff',1.5);}
shape([[-13,-29],[0,-25],[15,-29],[10,-21],[-8,-20]],cape);
if(job==='mage'){line(29,3,43,-56,'#9e80bd',5);shape([[44,-75],[55,-58],[45,-42],[35,-58]],'#9ff4ff','#e8e4ff');ellipse(45,-58,5,8,'#fff4fa');line(35,-43,54,-47,trim,3);}
else{c.save();c.translate(28,-3);c.rotate(attacking?-.55:.16);shape([[0,0],[10,-37],[8,-56],[-2,-40],[-6,-4]],'#c3f6ff','#557c9b');shape([[1,-5],[7,-36],[8,-51],[3,-34]],'#f5ffff','#c3f6ff');line(-10,-5,12,0,trim,5);line(-1,0,-4,10,dark,5);ellipse(-4,10,3,3,trim);c.restore();}
c.restore();}
const glowCache=new Map();
export function glow(c,x,y,r,color){
let sprite=glowCache.get(color);
if(!sprite){sprite=document.createElement('canvas');sprite.width=sprite.height=96;const painter=sprite.getContext('2d');const g=painter.createRadialGradient(48,48,0,48,48,48);g.addColorStop(0,color);g.addColorStop(1,'#ffffff00');painter.fillStyle=g;painter.fillRect(0,0,96,96);glowCache.set(color,sprite);}
c.drawImage(sprite,x-r,y-r,r*2,r*2);
}
export function drawFire(c,x,y,a,time,evolved){c.save();c.translate(x,y);c.rotate(a+Math.PI/2);glow(c,0,0,30,evolved?'#ffce5a70':'#ff9a4455');for(let i=5;i>=0;i--){c.fillStyle=i%2?'#ff8b42':'#ffd271';c.globalAlpha=1-i*.13;c.beginPath();c.ellipse(Math.sin(time*15+i)*3,i*6,Math.max(2,11-i*1.4),15-i,0,0,Math.PI*2);c.fill();}c.globalAlpha=1;c.fillStyle='#fff8c7';c.beginPath();c.ellipse(0,-3,5,9,0,0,Math.PI*2);c.fill();c.restore();}
export function drawEffect(c,f,time){const q=1-f.life/f.max;c.save();c.globalAlpha=Math.min(1,f.life/f.max*2);if(f.kind==='slash'){c.translate(f.x,f.y);c.scale(1,.72);for(let i=0;i<5;i++){c.strokeStyle=['#45bffb33','#57cfff66','#73ddff','#d4fbff','#ffffff'][i];c.lineWidth=22-i*4;c.beginPath();c.arc(0,0,f.r-i*2,.1+q*4,4.8+q*4);c.stroke();}for(let i=0;i<7;i++){const a=q*4+i*.7,r=f.r*(.8+i%2*.2);glow(c,Math.cos(a)*r,Math.sin(a)*r,7,'#efffffaa');}}
else if(f.kind==='lightning'){glow(c,f.tx,f.ty,50,'#b1b6ff88');for(let layer=0;layer<3;layer++){c.strokeStyle=['#887fff66','#9edaff','#ffffff'][layer];c.lineWidth=[13,5,1.8][layer];c.beginPath();for(let i=0;i<=8;i++){const t=i/8,j=i===0||i===8?0:Math.sin(i*13+Math.floor(time*25))*17;const x=f.x+(f.tx-f.x)*t+j,y=f.y+(f.ty-f.y)*t;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}}
else if(f.kind==='ascend'){for(let i=0;i<12;i++){const a=i*Math.PI/6+q*2;c.strokeStyle='#ffe4a5';c.lineWidth=2;c.beginPath();c.moveTo(f.x+Math.cos(a)*30,f.y+Math.sin(a)*30);c.lineTo(f.x+Math.cos(a)*(50+q*90),f.y+Math.sin(a)*(50+q*90));c.stroke();}glow(c,f.x,f.y-25,100,'#ffe4a570');}
else if(f.kind==='gust'||f.kind==='slam'||f.kind==='hurt'){const color=f.kind==='gust'?'#aeffe5':'#ff998c';c.strokeStyle=color;for(let i=0;i<3;i++){c.lineWidth=5-i;c.beginPath();c.arc(f.x,f.y,(f.r||45)*Math.min(1,q+i*.08),time+i,5.4+time+i);c.stroke();}if(f.kind==='gust')for(let i=0;i<12;i++){const a=i*.524+q*2;c.fillStyle='#dffff0';c.beginPath();c.ellipse(f.x+Math.cos(a)*f.r*q,f.y+Math.sin(a)*f.r*q,7,2,a,0,Math.PI*2);c.fill();}}
c.restore();}
