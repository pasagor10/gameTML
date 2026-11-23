import test from 'node:test';import assert from 'node:assert/strict';
import {Run,SKILLS,CLASSES,cleanHeroName,randomHeroName,LAST_STAGE,recommendedPower} from '../src/model.js';
import {rollDrop,ARMOR} from '../src/loot.js';
import {TIERS,REQ_LEVEL,weaponName} from '../src/weapons.js';
import {directionFor,animationFrame} from '../src/sprite-layout.js';
const advance=(r,seconds)=>{for(let i=0;i<seconds*20&&r.state==='playing';i++)r.update(.05);};

test('only swordmaster, sorcerer and gunner are playable; each has six actives and two passives of its own',()=>{
  assert.deepEqual(CLASSES.map(c=>c.id),['knight','mage','gunner']);
  for(const c of CLASSES){const own=SKILLS.filter(s=>s.job===c.id);assert.equal(own.filter(s=>s.kind==='active').length,6);assert.equal(own.filter(s=>s.kind==='passive').length,2);}
  for(const s of SKILLS){assert.ok(s.max>=3&&s.req>=1,s.id);}
});
test('class skills open after awakening and other classes never get them',()=>{
  for(const c of CLASSES){const r=new Run();r.level=9;r.xp=r.need;r.checkLevel();assert.ok(r.awaken(c.id,'a'));assert.equal(r.state,'playing');r.skillPoints=5;
    const own=SKILLS.find(s=>s.job===c.id&&s.req<=10),other=SKILLS.find(s=>s.job&&s.job!==c.id&&s.req<=10),late=SKILLS.find(s=>s.job===c.id&&s.req>10);
    assert.ok(r.canLearn(own.id));assert.equal(r.canLearn(other.id),false);assert.equal(r.canLearn(late.id),false,'needs a higher level');}
  const n=new Run();n.skillPoints=5;n.level=40;assert.ok(SKILLS.filter(s=>s.job).every(s=>!n.canLearn(s.id)));
});
test('every class active skill damages enemies',()=>{
  for(const s of SKILLS.filter(s=>s.job&&s.kind==='active')){
    let seed=7;const r=new Run(()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),{job:s.job});r.enemies=[];r.spawn=1000;r.attack=999;r.skills[s.id]=3;r.slots=[s.id];r.addEnemy('elite',110,0);const e=r.enemies[0],hp=e.hp;
    for(let i=0;i<60;i++){r.update(.05);r.attack=999;}
    assert.ok(e.hp<hp,s.id);
  }
});
test('gear drops from monsters and is only worn once the hero level allows it',()=>{
  assert.equal(TIERS.length,6);assert.equal(REQ_LEVEL.length,6);assert.equal(REQ_LEVEL[0],1);
  const r=new Run(()=>.5,{job:'gunner'});assert.equal(r.weaponTier,0);
  // A Rare gun needs Lv.12: picked up at Lv.1 it waits in the bag.
  r.loot.push({kind:'weapon',tier:2,job:'gunner',x:r.p.x,y:r.p.y,id:999});r.enemies=[];r.spawn=1000;r.update(.05);
  assert.equal(r.loot.length,0);assert.equal(r.bag.length,1);assert.equal(r.weaponTier,0);assert.equal(r.lockedUpgrade().tier,2);
  r.level=REQ_LEVEL[2];r.equipBest();assert.equal(r.weaponTier,2);assert.ok(r.events.some(e=>e.type==='weapon_up'));
  // Another class's weapon never fits; armour fits anyone and adds HP and damage reduction.
  r.addItem({kind:'weapon',tier:5,job:'mage'});r.addItem({kind:'armor',tier:1,job:null});r.equipBest();assert.equal(r.weaponTier,2);assert.equal(r.armorTier,1);assert.equal(r.maxHp,100+ARMOR[1].hp);
  // Elites always drop; novices never find weapons.
  const drop=rollDrop('elite',0,'novice',()=>.5);assert.notEqual(drop.kind,'weapon');assert.equal(drop.tier,1);assert.equal(rollDrop('slime',0,'knight',()=>.5),null);
  r.weaponTier=2;
  assert.ok(r.power()>1.5);assert.equal(weaponName('gunner',5),'ปืนเทพสายรุ้ง');
  const damage=[];for(const tier of [0,5]){const g=new Run(()=>.5,{job:'knight'});g.enemies=[];g.spawn=1000;g.weaponTier=tier;g.addEnemy('boss',60,0);g.update(.05);damage.push(g.enemies[0].max-g.enemies[0].hp);}
  assert.ok(damage[1]>damage[0]*2);
});
test('higher gun tiers fire more bullets per shot',()=>{
  const count=tier=>{const r=new Run(()=>.5,{job:'gunner'});r.enemies=[];r.spawn=1000;r.weaponTier=tier;r.addEnemy('elite',200,0);r.update(.05);return r.shots.filter(s=>s.style==='bullet').length;};
  assert.equal(count(0),1);assert.equal(count(2),2);assert.equal(count(3),3);
});
test('direction keeps its row near a sector edge instead of flickering',()=>{
  const edge=Math.PI/8;// boundary between e and se
  assert.equal(directionFor(Math.cos(edge+.05),Math.sin(edge+.05),'e'),'e');
  assert.equal(directionFor(Math.cos(edge-.05),Math.sin(edge-.05),'se'),'se');
  assert.equal(directionFor(0,1,'e'),'s');
});
test('measured timing spreads frames unevenly but still visits every frame once per stride',()=>{
  const timing=[.6,1.4,1,1,1,1,.8,1.2],seen=[];
  for(let d=0;d<96;d+=.5)seen.push(animationFrame(0,true,8,d,timing));
  assert.deepEqual([...new Set(seen)],[0,1,2,3,4,5,6,7]);
  assert.ok(seen.filter(f=>f===1).length>seen.filter(f=>f===0).length*2-1);
});

test('class skills cap at Lv.5 while the shared passives go to Lv.20',()=>{
  const r=new Run(()=>.5,{job:'mage'});r.level=60;r.skillPoints=200;
  for(let i=0;i<5;i++)assert.ok(r.learn('meteor'));assert.equal(r.learn('meteor'),false);
  for(let i=0;i<20;i++)assert.ok(r.learn('might'));assert.equal(r.learn('might'),false);assert.ok(Math.abs(r.power()-3)<1e-9);
  r.autoLearn();assert.ok(r.spentPoints()>40);assert.ok(r.slots.length<=4);
});
test('sixty stages across six worlds, then Hard mode opens and continues the curve',()=>{
  const r=new Run(()=>.5,{job:'gunner'});
  for(let stage=1;stage<=LAST_STAGE;stage++){assert.equal(r.stage,stage);r.stageKills=r.quota;r.enemies=[];r.update(.05);const g=r.enemies.find(e=>e.guardian);assert.ok(g,`guardian ${stage}`);r.hit(g,1e12);}
  assert.equal(r.cleared.normal,LAST_STAGE);assert.ok(r.events.some(e=>e.type==='hard_unlocked'));assert.equal(r.mode,'farm');
  assert.ok(r.startChallenge(1,true));assert.ok(r.hard);assert.ok(recommendedPower(1,true)>recommendedPower(60));
  r.stageKills=r.quota;r.enemies=[];r.update(.05);assert.ok(r.enemies.find(e=>e.guardian).max>1e5);
});
test('higher skill levels produce grander effects (lv carried to visuals)',()=>{
  for(const [id,job,kind] of [['nova','mage','nova'],['judgement','knight','blade'],['meteor','mage','meteor']]){
    const r=new Run(()=>.5,{job});r.enemies=[];r.spawn=1000;r.skills[id]=5;r.slots=[id];r.addEnemy('boss',120,0);r.castSkills(1);
    const f=r.effects.find(e=>e.kind===kind);assert.ok(f,id);assert.equal(f.lv,5);
  }
  const lv1=new Run(()=>.5,{job:'gunner'}),lv5=new Run(()=>.5,{job:'gunner'});
  lv1.skills.drone=1;lv5.skills.drone=5;lv1.slots=lv5.slots=['drone'];assert.equal(lv1.dronePositions().length,1);assert.equal(lv5.dronePositions().length,3);
});
test('combat emits sound cues for attacks, kills and boss arrival; enemies remember their stage',()=>{
  const r=new Run(()=>.5,{job:'gunner'});r.enemies=[];r.spawn=1000;r.addEnemy('slime',120,0);r.enemies[0].hp=1;r.update(.05);
  const names=r.cues.map(c=>c.name);assert.ok(names.includes('shot'));
  let killed=false;for(let i=0;i<20;i++){r.update(.05);killed||=r.cues.some(c=>c.name==='kill');r.cues.length=0;}assert.ok(killed);
  const b=new Run();b.stageKills=b.quota;b.update(.05);assert.ok(b.cues.some(c=>c.name==='roar'));assert.ok(b.enemies.every(e=>e.stage===1));
  assert.ok(r.cues.length<=48,'cue queue is bounded');
});

test('magnet pulls every crystal once a minute; auto mode moves and dodges',()=>{
  const r=new Run(()=>.5,{job:'mage'});r.enemies=[];r.spawn=1000;r.gems=[{x:600,y:0,value:1},{x:-600,y:300,value:1}];
  assert.ok(r.magnet());assert.equal(r.magnet(),false,'cooldown');for(let i=0;i<40;i++)r.update(.05);assert.equal(r.gems.length,0);
  assert.ok(r.magnetClock>55);
  const a=new Run(()=>.5,{job:'gunner'});a.enemies=[];a.spawn=1000;a.addEnemy('slime',60,0);const step=a.autoInput();assert.ok(step.x<0,'backs away from a close enemy');
  a.enemies=[];a.addEnemy('elite',300,0);a.enemies[0].warn={x:a.p.x+20,y:a.p.y,t:1,kind:'slam'};assert.ok(a.autoInput().x<0,'steps out of a telegraph');
});
test('hero names are cleaned and can be rolled at random',()=>{
  assert.equal(cleanHeroName('  <b>ไค</b>  '),'bไค/b');assert.equal(cleanHeroName('x'.repeat(30)).length,12);
  assert.ok(randomHeroName(()=>0).length>1);
  const r=new Run(()=>.5);r.state='awakening';assert.ok(r.awaken('knight','a','ริวมอส'));assert.equal(r.name,'ริวมอส');
});

test('away from the screen, level-ups bank skill points and the class pick waits for return',()=>{
  const r=new Run(()=>.5,{job:'mage'});r.enemies=[];r.spawn=1000;r.holdPicks=true;r.xp=200;r.checkLevel();
  assert.equal(r.state,'playing');assert.ok(r.skillPoints>=3);assert.equal(r.skillPoints,r.level-1);
  const n=new Run(()=>.5);n.enemies=[];n.spawn=1000;n.holdPicks=true;n.xp=800;n.checkLevel();assert.ok(n.awaitingClass);assert.equal(n.state,'playing');
  n.holdPicks=false;n.openPending();assert.equal(n.state,'awakening');assert.ok(n.awaken('gunner','a','ไค'));assert.equal(n.awaitingClass,false);
});
test('progress survives a save and restore, including stages, stars and skills',()=>{
  const r=new Run(()=>.5,{job:'knight',name:'ริว'});r.cleared.normal=12;r.stars={n12:3};r.startChallenge(13);
  r.level=17;r.skills={whirl:3,ironwill:2};r.slots=['whirl'];r.skillPoints=4;r.addItem({kind:'armor',tier:1,job:null});r.equipBest();r.applyGear();r.gold=321;assert.equal(r.equipped.armor,1);
  const back=Run.restore(JSON.parse(JSON.stringify(r.serialize())));
  for(const k of ['job','name','stage','level','skillPoints','armorTier','gold','maxHp','guard','mode'])assert.deepEqual(back[k],r[k],k);
  assert.deepEqual(back.skills,r.skills);assert.deepEqual(back.slots,['whirl']);assert.deepEqual(back.cleared,r.cleared);assert.deepEqual(back.stars,{n12:3});assert.equal(back.bag.length,1);assert.equal(back.state,'playing');
  assert.ok(r.guard>.1,'iron will adds damage reduction');
});
test('gold, bag, swapping, selling and enhancing gear',()=>{
  const r=new Run(()=>.5,{job:'knight'});r.enemies=[];r.spawn=1000;r.level=30;
  const old=r.addItem({kind:'helmet',tier:1}),better=r.addItem({kind:'helmet',tier:3}),ring=r.addItem({kind:'ring',tier:2});
  assert.ok(r.equipItem(old.id));const hp1=r.maxHp;assert.ok(r.equipItem(better.id),'swap to the better helmet');assert.ok(r.maxHp>hp1);
  assert.equal(r.sellItem(better.id),false,'worn gear cannot be sold');const price=r.sellItem(old.id);assert.ok(price>0);assert.equal(r.gold,price);
  const base=r.power();assert.ok(r.equipItem(ring.id));assert.ok(r.power()>base);
  assert.equal(r.enhance('ring'),false,'needs gold');r.gold=10000;assert.ok(r.enhance('ring'));assert.equal(r.gearItem('ring').plus,1);
  assert.ok(r.unequip('ring'));assert.equal(r.power(),base);
  // Kills drop coins that add to the wallet; gear and gold carry into the next run.
  r.addEnemy('elite',40,0);r.enemies[0].hp=1;r.hit(r.enemies[0],5);assert.ok(r.coins.length>0);r.coins[0].x=r.p.x;r.coins[0].y=r.p.y;const before=r.gold;r.update(.05);assert.ok(r.gold>before);
  const next=new Run(()=>.5,{job:'knight'});next.loadStash(r.stash());assert.equal(next.gold,r.gold);assert.equal(next.gearItem('helmet').tier,3);
});

test('EXP crystals vary by monster and roll, with rare gold crystals',()=>{
  const seq=[.05,.9,.3,.9,.9,.9,.5,.1,.5,.5];let i=0;const r=new Run(()=>.5);r.rng=()=>seq[i++%seq.length];r.enemies=[];r.spawn=1000;r.gems=[];
  r.dropGems({type:'slime',x:0,y:0});assert.deepEqual(r.gems.map(g=>g.value),[3],'x3 roll, no gold');
  r.gems=[];r.dropGems({type:'archer',x:0,y:0});assert.deepEqual(r.gems.map(g=>g.value),[4]);
  r.gems=[];r.dropGems({type:'slime',x:0,y:0});assert.deepEqual(r.gems.map(g=>g.value),[1]);
  r.gems=[];r.dropGems({type:'elite',x:0,y:0});assert.equal(r.gems.length,2);assert.ok(r.gems[1].gold);assert.equal(r.gems[1].value,100);
  r.gems=[];r.dropGems({type:'boss',x:0,y:0});assert.ok(r.gems.some(g=>g.gold&&g.value===600));
});

test('town shop sells gear, potions, buffs and stones for gold',async()=>{
  const {supplyPrice,refreshPrice,GEAR_PRICE}=await import('../src/shop.js');
  const r=new Run(()=>.5,{job:'knight'});r.enemies=[];r.spawn=1000;r.level=15;r.gold=5000;
  const stock=r.ensureShop();assert.equal(stock.length,6);assert.ok(stock.every(o=>o.tier<=1));assert.ok(stock.some(o=>o.kind==='weapon'&&o.job==='knight'));
  const i=stock.findIndex(o=>o.kind==='weapon'),before=r.gold,item=r.buyGear(i);assert.ok(item);assert.equal(r.gold,before-stock[i].price);assert.equal(r.buyGear(i),false,'sold out');
  assert.ok(r.buySupply('potion',5));assert.equal(r.supplies.potion,5);assert.ok(r.buySupply('xp'));assert.equal(r.buffs.xp,300);
  assert.ok(r.buySupply('luck'));assert.equal(r.supplies.luck,1);assert.equal(r.buySupply('nope'),false);
  const g=r.gold;assert.ok(r.refreshShop());assert.equal(r.gold,g-refreshPrice(1));assert.ok(supplyPrice('potion',3)>supplyPrice('potion',1));assert.equal(GEAR_PRICE.length,5);
  // EXP buff doubles crystals; the potion drinks itself at low HP.
  r.gems=[{x:r.p.x,y:r.p.y,value:3}];const xp=r.xpEarned;r.update(.05);assert.equal(r.xpEarned-xp,6);
  r.p.hp=r.maxHp*.2;r.update(.05);assert.equal(r.supplies.potion,4);assert.ok(r.p.hp>r.maxHp*.6);
  const st=r.stash();assert.equal(st.supplies.potion,4);const n=new Run();n.loadStash(st);assert.equal(n.supplies.luck,1);
});
test('enhancing can fail from +3, drops a level from +6, and stones help',()=>{
  const r=new Run(()=>.5,{job:'knight'});r.enemies=[];r.spawn=1000;r.gold=1e7;r.level=10;const it=r.addItem({kind:'armor',tier:0});r.equipItem(it.id);
  for(let k=0;k<3;k++)assert.equal(r.enhance('armor'),'success');
  r.rng=()=>.95;assert.equal(r.enhance('armor'),'fail');assert.equal(it.plus,3);
  r.rng=()=>.0;while(it.plus<6)r.enhance('armor');
  r.rng=()=>.99;assert.equal(r.enhance('armor'),'drop');assert.equal(it.plus,5);
  r.rng=()=>.0;r.enhance('armor');r.supplies.guard=1;r.rng=()=>.99;assert.equal(r.enhance('armor',{guard:true}),'fail');assert.equal(it.plus,6);assert.equal(r.supplies.guard,0);
  r.supplies.luck=1;assert.ok(Math.abs(r.enhanceChance('armor',true)-(.6+.25))<1e-9);r.rng=()=>.8;assert.equal(r.enhance('armor',{luck:true}),'success');assert.equal(r.supplies.luck,0);
});
