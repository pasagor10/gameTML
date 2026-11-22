import { ARENA_HALF, ARENA_SIZE } from './arena.js';
const images = {};
const slimeVariants=new Map();
let forestCache=null,forestPixels=0;
function prepareSlimeVariants(base){
  for(const [type,pixels,filter] of [['slime',256,'none'],['elite',384,'hue-rotate(20deg)'],['boss',512,'hue-rotate(65deg)']]){
    for(const hit of [false,true]){
      const buffer=document.createElement('canvas');buffer.width=pixels;buffer.height=Math.round(pixels*524/512);
      const painter=buffer.getContext('2d');painter.imageSmoothingQuality='high';
      painter.filter=hit?(filter==='none'?'brightness(1.7)':filter+' brightness(1.7)'):filter;
      painter.drawImage(base,0,0,buffer.width,buffer.height);
      slimeVariants.set(`${type}-${hit}`,buffer);
    }
  }
}
export const sceneStatus = { ground: false, slime: false, errors: [] };
export async function loadSceneArt(){
  await Promise.all(Object.entries({ground:'/assets/scenes/forest/ground.webp',slime:'/assets/monsters/slime-leaf.webp'}).map(([key,url])=>new Promise(resolve=>{
    const image=new Image();image.onload=()=>{
      if(key==='slime'){
        // Downsample the large cutout once, rather than filtering it for every monster every frame.
        const buffer=document.createElement('canvas');buffer.width=512;buffer.height=524;
        const painter=buffer.getContext('2d');painter.imageSmoothingEnabled=true;painter.imageSmoothingQuality='high';
        painter.drawImage(image,124,65,1015,1039,0,0,512,524);images[key]=buffer;prepareSlimeVariants(buffer);
      }else images[key]=image;
      sceneStatus[key]=true;resolve();};
    image.onerror=()=>{sceneStatus.errors.push(key);console.warn(`Scene art unavailable: ${key}`);resolve();};image.src=url;
  })));
}
export function drawForest(c,time){
  if(!sceneStatus.ground)return false;
  const transform=c.getTransform();
  const pixels=Math.max(256,Math.min(2048,Math.round(ARENA_SIZE*Math.abs(transform.a)/64)*64));
  if(pixels!==forestPixels){
    forestPixels=pixels;forestCache=document.createElement('canvas');forestCache.width=forestCache.height=pixels;
    const painter=forestCache.getContext('2d');painter.imageSmoothingQuality='high';painter.drawImage(images.ground,0,0,pixels,pixels);
  }
  c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='low';
  // Mirrored copies continue the forest past the arena so the backdrop fills any screen shape;
  // a light shade keeps the playable clearing readable.
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;c.save();c.translate(dx*ARENA_SIZE,dy*ARENA_SIZE);c.scale(dx?-1:1,dy?-1:1);
    c.drawImage(forestCache,-ARENA_HALF,-ARENA_HALF,ARENA_SIZE,ARENA_SIZE);c.restore();
  }
  c.fillStyle='#0b2a2a40';c.beginPath();c.rect(-ARENA_HALF*3,-ARENA_HALF*3,ARENA_SIZE*3,ARENA_SIZE*3);c.rect(-ARENA_HALF,-ARENA_HALF,ARENA_SIZE,ARENA_SIZE);c.fill('evenodd');
  c.drawImage(forestCache,-ARENA_HALF,-ARENA_HALF,ARENA_SIZE,ARENA_SIZE);
  // Ambient glints remain separate from the flat background and never obscure telegraphs.
  for(let i=0;i<18;i++){
    const x=Math.sin(i*7.13)*780+Math.sin(time*.35+i)*18;
    const y=Math.cos(i*3.71)*710+Math.sin(time*.5+i*2)*12;
    c.globalAlpha=.12+(Math.sin(time*1.4+i)+1)*.13;c.fillStyle='#fff3b8';
    c.beginPath();c.ellipse(x,y,2.2,2.2,0,0,Math.PI*2);c.fill();
  }
  c.restore();return true;
}
export function drawSlime(c,enemy,time,player){
  if(!sceneStatus.slime||!['slime','elite','boss'].includes(enemy.type))return false;
  const size=enemy.type==='boss'?128:enemy.type==='elite'?86:48;
  const breath=Math.sin(time*5+enemy.id*.8),stretch=enemy.warn?1-.055*Math.sin(time*14):1+breath*.035;
  c.save();c.translate(enemy.x,enemy.y);
  c.fillStyle='#183e454d';c.beginPath();c.ellipse(0,3,enemy.r*1.1,enemy.r*.32,0,0,Math.PI*2);c.fill();
  if(player.x>enemy.x)c.scale(-1,1);
  const width=size*stretch,height=size/stretch;
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='low';
  c.drawImage(slimeVariants.get(`${enemy.type}-${enemy.flash>0}`),-width/2,-height,width,height);
  if(enemy.type==='boss'){
    c.fillStyle='#ffdc86';c.strokeStyle='#886345';c.lineWidth=2;
    c.beginPath();c.moveTo(-20,-height+24);c.lineTo(-23,-height+6);c.lineTo(-10,-height+14);c.lineTo(0,-height-1);c.lineTo(10,-height+14);c.lineTo(23,-height+6);c.lineTo(20,-height+24);c.closePath();c.fill();c.stroke();
  }
  c.restore();
  if(enemy.hp<enemy.max){
    const width=Math.min(size*.65,80),top=enemy.y-size-10;
    c.fillStyle='#163840';c.fillRect(enemy.x-width/2,top,width,5);
    c.fillStyle=enemy.type==='boss'?'#f6a48a':'#b9eb8e';c.fillRect(enemy.x-width/2,top,width*Math.max(0,enemy.hp/enemy.max),5);
  }
  return true;
}
