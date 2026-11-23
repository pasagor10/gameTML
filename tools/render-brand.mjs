// Rebuild the installed app icons using the exact code-drawn hero used in-game.
// Install @napi-rs/canvas separately or set TILMO_CANVAS_MODULE to its entry point.
const {createCanvas}=await import(process.env.TILMO_CANVAS_MODULE||'@napi-rs/canvas');
import {writeFile} from 'node:fs/promises';
import {drawToonHero} from '../src/toon.js';
const canvas=createCanvas(512,512),c=canvas.getContext('2d');
c.fillStyle='#d3e7bb';c.fillRect(0,0,512,512);c.fillStyle='#bdd59f';c.beginPath();c.ellipse(256,431,170,48,0,0,Math.PI*2);c.fill();
c.save();c.translate(256,406);c.scale(4,4);drawToonHero(c,0,0,{job:'knight',appearance:'a',time:0,direction:'se',tier:0});c.restore();
for(const size of [32,180,192,512]){const out=createCanvas(size,size);out.getContext('2d').drawImage(canvas,0,0,size,size);await writeFile(new URL(`../assets/brand/icon-${size}.png`,import.meta.url),out.toBuffer('image/png'));}
const mask=createCanvas(512,512),m=mask.getContext('2d');m.fillStyle='#d3e7bb';m.fillRect(0,0,512,512);m.drawImage(canvas,64,64,384,384);await writeFile(new URL('../assets/brand/icon-maskable-512.png',import.meta.url),mask.toBuffer('image/png'));
