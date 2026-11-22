import test from 'node:test';import assert from 'node:assert/strict';
import {Run,SKILLS,CLASSES,choices,cleanHeroName,randomHeroName} from '../src/model.js';
import {rollDrop,ARMOR} from '../src/loot.js';
import {TIERS,REQ_LEVEL,weaponName} from '../src/weapons.js';
import {directionFor,animationFrame} from '../src/sprite-layout.js';
const advance=(r,seconds)=>{for(let i=0;i<seconds*20&&r.state==='playing';i++)r.update(.05);};

test('only swordmaster, sorcerer and gunner are playable; each has three own skills',()=>{
  assert.deepEqual(CLASSES.map(c=>c.id),['knight','mage','gunner']);
  for(const c of CLASSES)assert.equal(SKILLS.filter(s=>s.job===c.id).length,3);
});
test('awakening offers that class skills and other classes never see them',()=>{
  for(const c of CLASSES){const r=new Run();r.level=9;r.xp=r.need;r.checkLevel();assert.ok(r.awaken(c.id,'a'));assert.deepEqual(r.offers.map(s=>s.job),[c.id,c.id,c.id]);}
  for(let i=0;i<30;i++)assert.ok(choices({},Math.random,'novice').every(s=>!s.job));
  for(let i=0;i<30;i++)assert.ok(choices({},Math.random,'mage').every(s=>!s.job||s.job==='mage'));
});
test('every class skill damages enemies',()=>{
  for(const s of SKILLS.filter(s=>s.job)){
    const r=new Run(()=>.3,{job:s.job});r.enemies=[];r.spawn=1000;r.attack=999;r.skills[s.id]=3;r.addEnemy('elite',110,0);const e=r.enemies[0],hp=e.hp;r.skillClock=2;
    for(let i=0;i<30;i++){r.update(.05);r.attack=999;}
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
  const drop=rollDrop('elite',1,'novice',()=>.5);assert.notEqual(drop.kind,'weapon');assert.equal(drop.tier,1);assert.equal(rollDrop('slime',1,'knight',()=>.5),null);
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

test('endless: class skills reach Lv.5 and upgrades never run out',()=>{
  const r=new Run(()=>.5,{job:'mage'});r.enemies=[];r.spawn=1000;
  r.skills={meteor:5,vortex:5,nova:5,area:3,haste:3};
  for(let i=0;i<30;i++){r.xp=r.need;r.state='playing';r.checkLevel();assert.equal(r.state,'upgrade');assert.ok(r.offers.length>=2);assert.ok(r.choose(r.offers[0].id));}
  assert.ok(r.level>30);assert.ok(r.boosts.might+r.boosts.vigor===30);
  assert.ok(!choices({meteor:5},Math.random,'mage').some(s=>s.id==='meteor'),'capped at Lv.5');
  assert.ok(choices({meteor:3},Math.random,'mage').length>0);
});
test('stage keeps climbing with no end besides death',()=>{
  const r=new Run(()=>.5,{job:'gunner'});
  for(let stage=1;stage<=8;stage++){r.t=r.stageStart+180+(stage===1?60:0);r.update(.05);const boss=r.enemies.find(e=>e.type==='boss');assert.ok(boss,`boss ${stage}`);r.hit(boss,1e9);r.gems=[];r.state='playing';}
  assert.equal(r.stage,9);assert.equal(r.state,'playing');
});
test('higher skill levels produce grander effects (lv carried to visuals)',()=>{
  for(const [id,job,kind] of [['nova','mage','nova'],['judgement','knight','blade'],['meteor','mage','meteor']]){
    const r=new Run(()=>.5,{job});r.enemies=[];r.spawn=1000;r.skills[id]=5;r.addEnemy('boss',120,0);r.castSkills(1);
    const f=r.effects.find(e=>e.kind===kind);assert.ok(f,id);assert.equal(f.lv,5);
  }
  const lv1=new Run(()=>.5,{job:'gunner'}),lv5=new Run(()=>.5,{job:'gunner'});
  lv1.skills.drone=1;lv5.skills.drone=5;assert.equal(lv1.dronePositions().length,1);assert.equal(lv5.dronePositions().length,3);
});
test('combat emits sound cues for attacks, kills and boss arrival; enemies remember their stage',()=>{
  const r=new Run(()=>.5,{job:'gunner'});r.enemies=[];r.spawn=1000;r.addEnemy('slime',120,0);r.enemies[0].hp=1;r.update(.05);
  const names=r.cues.map(c=>c.name);assert.ok(names.includes('shot'));
  let killed=false;for(let i=0;i<20;i++){r.update(.05);killed||=r.cues.some(c=>c.name==='kill');r.cues.length=0;}assert.ok(killed);
  const b=new Run();b.t=240;b.update(.05);assert.ok(b.cues.some(c=>c.name==='roar'));assert.equal(b.enemies[0].stage,1);
  assert.ok(r.cues.length<=48,'cue queue is bounded');
});

test('magnet pulls every crystal once a minute; auto mode moves, dodges and picks upgrades',()=>{
  const r=new Run(()=>.5,{job:'mage'});r.enemies=[];r.spawn=1000;r.gems=[{x:600,y:0,value:1},{x:-600,y:300,value:1}];
  assert.ok(r.magnet());assert.equal(r.magnet(),false,'cooldown');for(let i=0;i<40;i++)r.update(.05);assert.equal(r.gems.length,0);
  assert.ok(r.magnetClock>55);
  const a=new Run(()=>.5,{job:'gunner'});a.enemies=[];a.spawn=1000;a.addEnemy('slime',60,0);const step=a.autoInput();assert.ok(step.x<0,'backs away from a close enemy');
  a.enemies=[];a.addEnemy('elite',300,0);a.enemies[0].warn={x:a.p.x+20,y:a.p.y,t:1,kind:'slam'};assert.ok(a.autoInput().x<0,'steps out of a telegraph');
  a.offers=[...SKILLS.filter(s=>!s.job).slice(0,2),SKILLS.find(s=>s.id==='scatter')];assert.equal(a.autoChoose(),'scatter');
});
test('hero names are cleaned and can be rolled at random',()=>{
  assert.equal(cleanHeroName('  <b>ไค</b>  '),'bไค/b');assert.equal(cleanHeroName('x'.repeat(30)).length,12);
  assert.ok(randomHeroName(()=>0).length>1);
  const r=new Run(()=>.5);r.state='awakening';assert.ok(r.awaken('knight','a','ริวมอส'));assert.equal(r.name,'ริวมอส');
});

test('away from the screen, level-ups are banked and opened one by one on return',()=>{
  const r=new Run(()=>.5,{job:'mage'});r.enemies=[];r.spawn=1000;r.holdPicks=true;r.xp=200;r.checkLevel();
  assert.equal(r.state,'playing');assert.ok(r.pendingPicks>=3);const banked=r.pendingPicks,level=r.level;
  r.holdPicks=false;assert.ok(r.openPending());assert.equal(r.state,'upgrade');assert.equal(r.pendingPicks,banked-1);
  r.choose(r.offers[0].id);assert.equal(r.state,'upgrade','next banked pick opens right away');assert.equal(r.level,level);
  // A novice reaching Lv.10 while away gets the class pick first on return.
  const n=new Run(()=>.5);n.enemies=[];n.spawn=1000;n.holdPicks=true;n.xp=400;n.checkLevel();assert.ok(n.awaitingClass);assert.equal(n.state,'playing');
  n.holdPicks=false;n.openPending();assert.equal(n.state,'awakening');assert.ok(n.awaken('gunner','a','ไค'));assert.equal(n.awaitingClass,false);
});
test('auto-farming retreats instead of dying, and runs survive a save and restore',()=>{
  const r=new Run(()=>.5,{job:'knight',name:'ริว'});r.reviveOnDefeat=true;r.stage=3;r.t=500;r.p.hp=1;r.damage(50,'boss');
  assert.equal(r.state,'playing');assert.equal(r.p.hp,r.maxHp);assert.equal(r.stage,3);assert.equal(r.retreats,1);assert.equal(r.enemies.length,0);
  r.level=17;r.skills={whirl:3};r.addItem({kind:'armor',tier:2,job:null});r.equipBest();r.gold=321;r.pendingPicks=4;
  const back=Run.restore(JSON.parse(JSON.stringify(r.serialize())));
  for(const k of ['job','name','stage','level','pendingPicks','armorTier','gold','maxHp'])assert.deepEqual(back[k],r[k],k);
  assert.deepEqual(back.skills,{whirl:3});assert.equal(back.bag.length,1);assert.equal(back.state,'playing');
  const plain=new Run(()=>.5,{job:'knight'});plain.p.hp=1;plain.damage(50,'boss');assert.equal(plain.state,'ended');
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
