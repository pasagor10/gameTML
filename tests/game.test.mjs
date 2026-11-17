import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements=new Map();
function el(key){if(!elements.has(key))elements.set(key,{textContent:'',innerHTML:'',style:{},dataset:{},classList:{hidden:true,add(){this.hidden=true},remove(){this.hidden=false},toggle(){},contains(){return this.hidden}},replaceChildren(){},append(){},focus(){},addEventListener(){},getContext(){return {}},click(){this.onclick?.()}});return elements.get(key);}
const storage=new Map();const context=vm.createContext({document:{querySelector:el,querySelectorAll:()=>[],createElement:()=>el(Symbol())},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},requestAnimationFrame(){},addEventListener(){},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},innerWidth:1200,innerHeight:800,console,Math,window:{}});
vm.runInContext(readFileSync('public/game.js','utf8'),context);
const run=s=>vm.runInContext(s,context);
for(const hero of ['knight','mage','archer']){
 run(`chosen='${hero}';startGame()`);
 assert.equal(run('game.hp'),run('classes[chosen].hp'));
 run('game.hp-=70;potion()');assert.equal(run('game.potions'),2);assert.equal(run('game.hp'),run('classes[chosen].hp-10'));
 run('returnHub();game.gold=100;game.x=870;game.y=430;interact()');
 el('#dialog-actions'); run("document.querySelector('#dialog').classList.add('hidden');enterFloor(1)");
 assert.equal(run('game.enemies.length'),4);
 // Combat range, damage, cooldown and enemy defeat use actual attack implementation.
 run('game.enemies.forEach(e=>{e.x=game.x+20;e.y=game.y});game.time=10;attack()');
 assert.ok(run('game.enemies[0].hp<game.enemies[0].max'));
 const hp=run('game.enemies[0].hp');run('attack()');assert.equal(run('game.enemies[0].hp'),hp);
 for(let floor=1;floor<=3;floor++){
 run(`enterFloor(${floor});game.enemies.forEach(e=>{e.x=game.x+20;e.y=game.y})`);
 for(let i=0;i<100&&run('game.enemies.length');i++)run('game.time+=.6;attack();attack(true)');
 assert.equal(run('game.enemies.length'),0);
 }
 run('finishDungeon()');assert.equal(run('game.completed'),true);assert.equal(run('game.level'),2);assert.ok(run('game.gold')>=100);
 run('returnHub();startGame()');assert.equal(run('game.completed'),true);assert.equal(run('game.level'),2);
 run("document.querySelector('#dialog').classList.add('hidden');enterFloor(1);game.hp=1;game.enemies.forEach(e=>{e.x=game.x;e.y=game.y});game.time=100;update(.01)");assert.equal(run('game.dead'),true);assert.equal(run('game.hp'),0);
 console.log(`${hero}: HP, potions, cooldown, all floors, victory, save/load, defeat passed`);
}
