import test from 'node:test';import assert from 'node:assert/strict';import {Run} from '../src/model.js';import {PITY,eggPrice,PET_PRICE} from '../src/pets.js';
let seed=11;const rng=()=>((seed=(seed*16807)%2147483647)/2147483647);
test('magnet is free early, then 10 charges at stage 4 and one per new stage, carried over',()=>{
  const r=new Run(()=>.5);r.state='playing';assert.ok(!r.magnetLimited());assert.ok(r.magnet());r.magnetClock=0;
  r.cleared.normal=3;assert.ok(r.startChallenge(4));assert.ok(r.magnetLimited());assert.equal(r.magnetCharges,10);
  for(let i=0;i<4;i++){r.magnetClock=0;assert.ok(r.magnet());}assert.equal(r.magnetCharges,6);
  r.magnetClock=0;r.magnetCharges=0;assert.equal(r.magnet(),false,'out of charges');r.magnetCharges=6;
  assert.ok(r.startChallenge(4));assert.equal(r.magnetCharges,6,'retrying a stage grants nothing');
  r.cleared.normal=4;assert.ok(r.startChallenge(5));assert.equal(r.magnetCharges,7,'one more charge, unused ones carry over');
  const back=Run.restore(r.serialize(),()=>.5);assert.equal(back.magnetCharges,7,'restore does not grant again');});
test('pets: buy the chick, hatch eggs with pity, and fetch far crystals',()=>{
  const r=new Run(rng);r.state='playing';r.gold=PET_PRICE;assert.ok(r.buyPet());assert.equal(r.petId,'chick');assert.equal(r.buyPet(),false,'only once');
  r.gold=eggPrice(r.stage)*PITY;r.petPity=0;let best=0;for(let i=0;i<PITY;i++){const [o]=r.hatchEggs(1);best=Math.max(best,o.tier);if(o.tier>=4)break;}assert.ok(best>=4,'pity guarantees Legendary+');
  const out=r.hatchEggs(1)||[];assert.ok(r.gold>=0);
  r.setPet('chick');r.enemies=[];r.spawn=1e9;r.gems=[{x:r.p.x+200,y:r.p.y,value:5}];const xp=r.xp,lv=r.level;
  for(let i=0;i<200&&r.gems.length;i++)r.update(.05);assert.equal(r.gems.length,0,'the pet fetched the crystal');assert.ok(r.xp>xp||r.level>lv);
  const keep=r.stash(),fresh=new Run(rng);fresh.loadStash(keep);assert.deepEqual(fresh.pets,r.pets);assert.equal(fresh.petId,'chick');});
test('pets bite monsters and level up for gold',()=>{
  const r=new Run(()=>.5);r.state='playing';r.pets=['fox'];r.setPet('fox');r.enemies=[];r.spawn=1e9;r.attack=1e9;
  r.addEnemy('elite',120,0);const e=r.enemies[0],hp=e.hp;for(let i=0;i<60;i++){r.attack=1e9;r.update(.05);}assert.ok(e.hp<hp,'the pet hit the elite');
  const atk=r.pet().atk;r.gold=0;assert.equal(r.upgradePet('fox'),false,'needs gold');r.gold=1e9;assert.ok(r.upgradePet('fox'));assert.equal(r.petLevel('fox'),2);assert.ok(r.pet().atk>atk);
  assert.equal(r.upgradePet('cat'),false,'not owned');for(let i=0;i<20;i++)r.upgradePet('fox');assert.equal(r.petLevel('fox'),10,'capped at Lv.10');
  const back=new Run();back.loadStash(r.stash());assert.equal(back.petLevel('fox'),10);});
