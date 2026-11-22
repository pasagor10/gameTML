import {constrainToArena,enemySpawn} from './arena.js';
import {ARMOR,SLOTS,BAG_MAX,MAX_PLUS,GOLD_DROP,rollDrop,canEquip,itemName,itemStats,sellPrice,enhanceCost} from './loot.js';
import {directionFor} from './sprite-layout.js';
import {TIERS} from './weapons.js';

export const CLASSES=[
{id:'knight',icon:'⚔',name:'นักดาบ',en:'SWORDMASTER',desc:'ฟันกวาดฝูงระยะใกล้ แรงที่สุด อาวุธระดับ Epic ปล่อยคลื่นดาบทะลุ',tag:'ดาบ · ประชิด · โจมตีหนัก'},
{id:'mage',icon:'✧',name:'นักเวท',en:'SORCERER',desc:'ระเบิดเวทรอบตัวพื้นที่กว้าง อาวุธระดับสูงระเบิดซ้ำและลามสายฟ้า',tag:'คทา · เวท · โจมตีพื้นที่'},
{id:'gunner',icon:'⌖',name:'มือปืน',en:'GUNNER',desc:'ยิงรัวจากระยะไกล อาวุธระดับสูงยิงหลายนัด ทะลุ และระเบิด',tag:'ปืน · ระยะไกล · ต่อเนื่อง'}];
// Classes removed from the prototype map to their closest replacement for saved profiles.
const LEGACY_JOBS={ranger:'gunner'};
export function normalizeJob(job){job=LEGACY_JOBS[job]||job;return CLASSES.some(c=>c.id===job)?job:'novice';}

export const SKILLS=[
{id:'fire',kind:'active',icon:'☀',name:'วงแหวนเพลิง',desc:'ลูกไฟหมุนรอบตัว เผาศัตรูที่เข้าประชิด',tag:'ระยะใกล้ · ต่อเนื่อง'},
{id:'ice',kind:'active',icon:'❄',name:'หอกเหมันต์',desc:'ยิงหอกทะลุฝูง พร้อมแช่แข็งให้เดินช้าลง',tag:'ระยะไกล · ควบคุม'},
{id:'spark',kind:'active',icon:'ϟ',name:'สายฟ้าลูกโซ่',desc:'ฟ้าผ่ากระโดดใส่ศัตรูหลายตัวรอบคุณ',tag:'หลายเป้าหมาย · ระเบิดพลัง'},
{id:'gust',kind:'active',icon:'◎',name:'คลื่นวายุ',desc:'ปล่อยวงลมผลักศัตรู เปิดทางให้หนี',tag:'พื้นที่ · ผลักถอย'},
{id:'area',kind:'passive',icon:'✥',name:'หัวใจยักษ์',desc:'เพิ่มระยะโจมตีและพื้นที่สกิล 20%',tag:'เสริมพลัง · สูตรวงแหวนเพลิง'},
{id:'haste',kind:'passive',icon:'»',name:'จังหวะสายลม',desc:'โจมตีและใช้สกิลถี่ขึ้น 15%',tag:'เสริมพลัง · สูตรหอกเหมันต์'},
// Class skills: offered only after awakening into that class.
{id:'whirl',job:'knight',kind:'active',icon:'🌀',name:'พายุดาบหมุน',desc:'หมุนตัวฟันรอบทิศ ทำดาเมจต่อเนื่องกับทุกตัวที่อยู่ใกล้',tag:'นักดาบ · รอบตัว · ต่อเนื่อง'},
{id:'wave',job:'knight',kind:'active',icon:'☾',name:'คลื่นดาบจันทร์เสี้ยว',desc:'ปล่อยคลื่นดาบทะลุฝูงเป็นรูปพัด เลเวลสูงยิ่งหลายสาย',tag:'นักดาบ · ทะลุ · ระยะกลาง'},
{id:'judgement',job:'knight',kind:'active',icon:'⚚',name:'ดาบพิพากษา',desc:'ดาบแสงตกจากฟ้าใส่ศัตรูหลายตัว ระเบิดรอบจุดตก',tag:'นักดาบ · หลายเป้าหมาย · แรงมาก'},
{id:'meteor',job:'mage',kind:'active',icon:'☄',name:'อุกกาบาต',desc:'เรียกอุกกาบาตตกใส่ฝูงหลังวงเตือนสั้น ๆ ดาเมจสูงเป็นวงกว้าง',tag:'นักเวท · พื้นที่ · ระเบิด'},
{id:'vortex',job:'mage',kind:'active',icon:'◉',name:'หลุมดำอาร์เคน',desc:'เปิดหลุมดำดูดศัตรูเข้ากลางและกัดกร่อนต่อเนื่อง',tag:'นักเวท · ควบคุม · ต่อเนื่อง'},
{id:'nova',job:'mage',kind:'active',icon:'✺',name:'โนวาดวงดาว',desc:'ปล่อยวงแสงขยายรอบตัว ทำดาเมจทุกตัวในวง',tag:'นักเวท · รอบตัว · ทันที'},
{id:'scatter',job:'gunner',kind:'active',icon:'⁂',name:'กระสุนกระจาย',desc:'ยิงลูกปรายเป็นรูปพัดใส่ศัตรูข้างหน้า ยิ่งใกล้ยิ่งโดนหลายนัด',tag:'มือปืน · ระยะใกล้ · หลายนัด'},
{id:'grenade',job:'gunner',kind:'active',icon:'✹',name:'ระเบิดมือ',desc:'ขว้างระเบิดใส่กลุ่มศัตรู ระเบิดเป็นวงกว้าง',tag:'มือปืน · พื้นที่ · ระเบิด'},
{id:'drone',job:'gunner',kind:'active',icon:'⛭',name:'โดรนป้อมปืน',desc:'โดรนลอยตามตัวยิงศัตรูใกล้สุดเอง Lv.3 ได้โดรนตัวที่สอง',tag:'มือปืน · อัตโนมัติ · ต่อเนื่อง'}];
// Endless boosts: never max out, fill the upgrade cards once every skill is capped,
// so long runs keep getting stronger instead of running out of choices.
export const BOOSTS=[
{id:'might',kind:'boost',icon:'✊',name:'พลังไร้ขีดจำกัด',desc:'ดาเมจทุกอย่าง +10% (ซ้อนได้ไม่จำกัด)',tag:'เสริมพลังไม่รู้จบ'},
{id:'vigor',kind:'boost',icon:'♥',name:'หัวใจคริสตัล',desc:'HP สูงสุด +15 และฟื้นเต็มทันที (ซ้อนได้ไม่จำกัด)',tag:'เสริมพลังไม่รู้จบ'}];
// Class skills grow to Lv.5 and get grander each level; shared skills keep their Lv.3 evolutions.
export function maxLevel(skill){return skill.job?5:3;}
export function activeSlots(job){return job==='novice'?2:3;}
export function choices(skills,rng=Math.random,job='novice'){
  const pool=SKILLS.filter(s=>!s.job||s.job===job);
  const held=pool.filter(s=>s.kind==='active'&&skills[s.id]).length;
  const picks=pool.filter(s=>(held>0||s.kind==='active')&&(skills[s.id]||0)<maxLevel(s)&&(s.kind!=='active'||skills[s.id]||held<activeSlots(job)))
    .map(s=>({s,n:rng()})).sort((a,b)=>a.n-b.n).slice(0,3).map(x=>x.s);
  if(held>0)for(const boost of BOOSTS)if(picks.length<3)picks.push(boost);
  return picks;
}
// Hero names: two syllables, re-rollable on the class screen.
const NAME_HEAD=['ไค','ริว','เอล','ซาร์','ลูน','คิระ','มิ','โนวา','เรน','ทิล','อาร์','ซีน','เวล','ฟิน','ไอ','โร'];
const NAME_TAIL=['มอส','เรีย','ดิน','ลอส','นา','ไวน์','ริค','เซล','ธอร์','ลี','กา','รัน','ซ่า','โม'];
export function randomHeroName(rng=Math.random){return NAME_HEAD[Math.floor(rng()*NAME_HEAD.length)]+NAME_TAIL[Math.floor(rng()*NAME_TAIL.length)];}
export function cleanHeroName(name){return String(name||'').replace(/[<>&"'`]/g,'').replace(/\s+/g,' ').trim().slice(0,12);}
export const MAGNET_COOLDOWN=60;
export const GEM_BASE={slime:1,runner:1,archer:2,elite:10,boss:30};
export function evolutions(skills){return {inferno:skills.fire===3&&skills.area>=2,blizzard:skills.ice===3&&skills.haste>=2};}

const SPEED=145,ACCEL=28;
const SKILL_POSE={whirl:'spin',wave:'slash',judgement:'raise',meteor:'raise',vortex:'thrust',nova:'raise',scatter:'recoil',grenade:'throw',drone:'raise',ice:'thrust',spark:'raise',gust:'spin'};
export const STAGE_TIMING=stage=>({elite:stage===1?100:70,boss:stage===1?240:180});

export class Run{
constructor(rng=Math.random,profile=null){
  this.rng=rng;this.job=normalizeJob(profile?.job);this.appearance=profile?.appearance==='b'?'b':'a';
  this.facing=1;this.direction='se';this.moving=false;this.motionDistance=0;this.vel={x:0,y:0};
  this.t=0;this.maxHp=100;this.boosts={might:0,vigor:0};this.p={x:0,y:0,hp:100,inv:0};this.enemies=[];this.gems=[];this.shots=[];this.effects=[];this.events=[];this.cues=[];this.zones=[];this.delayed=[];
  this.skills={};this.level=1;this.xp=0;this.need=5;this.kills=0;this.state='playing';this.spawn=0;this.attack=0;this.swing=0;this.aim=0;this.skillClock=0;this.droneClock=0;this.nextId=0;this.offers=[];
  this.stage=1;this.stageStart=0;this.bossSpawned=false;this.eliteSpawned=false;this.bossesDefeated=0;
  this.weaponTier=0;this.weaponPlus=0;this.armorTier=0;this.guard=0;this.ringBonus=0;this.baseHp=100;this.bag=[];this.equipped={weapon:null,armor:null,helmet:null,ring:null};this.nextItemId=1;this.gold=0;this.goldEarned=0;this.coins=[];this.pose=null;this.loot=[];this.magnetClock=0;this.holdPicks=false;this.pendingPicks=0;this.awaitingClass=false;this.reviveOnDefeat=false;this.retreats=0;this.xpEarned=0;this.name=cleanHeroName(profile?.name)||'TILMO';
  this.firstMoved=false;this.firstKill=false;this.evolved={};
  this.emit('run_start');for(let i=0;i<4;i++)this.addEnemy('slime',130+i*25,i*Math.PI/2);
}
emit(type,data={}){this.events.push({type,t:Math.round(this.t*100)/100,...data});}
// Sound cues for the renderer to play; the model stays silent and testable.
cue(name,arg){if(this.cues.length<48)this.cues.push(arg?{name,arg}:{name});}
weaponPower(){return this.job==='novice'?1:TIERS[this.weaponTier].power*(1+.06*this.weaponPlus);}
power(){return this.weaponPower()*(1+.1*this.boosts.might)*(1+this.ringBonus);}
// Skills scale with half the weapon's growth so the weapon stays the main upgrade.
skillPower(){const weapon=this.weaponPower();return (1+(weapon-1)*.5)*(1+.1*this.boosts.might)*(1+this.ringBonus);}
addEnemy(type,radius=430,angle=this.rng()*Math.PI*2){
  const boss=type==='boss',elite=type==='elite',scale=1+.7*(this.stage-1);
  const hp=boss?1500*(1+.9*(this.stage-1)):(elite?220:type==='runner'?22:type==='archer'?30:24+(this.t-this.stageStart)*.06)*scale;
  const bodyRadius=boss?42:elite?29:16;const point=enemySpawn(this.p,radius,angle,bodyRadius);
  this.enemies.push({id:this.nextId++,type,stage:this.stage,x:point.x,y:point.y,hp,max:hp,r:bodyRadius,speed:(boss?29:type==='runner'?76:elite?31:38)*(1+.05*(this.stage-1)),cd:boss?3:2+this.rng()*2,slow:0,flash:0});
}
choose(id){
  if(this.state!=='upgrade'||!this.offers.some(s=>s.id===id))return false;
  if(id==='might'||id==='vigor'){this.boosts[id]++;if(id==='vigor'){this.baseHp+=15;this.applyGear();this.p.hp=this.maxHp;}this.emit('upgrade_chosen',{id,level:this.boosts[id]});this.state='playing';this.checkLevel();this.openPending();return true;}
  this.skills[id]=(this.skills[id]||0)+1;this.emit('upgrade_chosen',{id,level:this.skills[id]});
  const evo=evolutions(this.skills);for(const key of Object.keys(evo))if(evo[key]&&!this.evolved[key]){this.evolved[key]=true;this.emit('evolution_unlocked',{id:key});}
  this.state='playing';this.skillClock=10;this.checkLevel();this.openPending();return true;
}
awaken(job,appearance,name){
  if(this.state!=='awakening'||!CLASSES.some(c=>c.id===job)||!['a','b'].includes(appearance))return false;
  this.awaitingClass=false;this.job=job;this.appearance=appearance;this.applyGear();this.name=cleanHeroName(name)||this.name;this.cue('equip');this.equipBest();
  this.emit('class_chosen',{job,appearance,name:this.name});this.effects.push({kind:'ascend',x:this.p.x,y:this.p.y,life:1.2,max:1.2});
  // The first pick after awakening shows the new class's own skills.
  const own=SKILLS.filter(s=>s.job===job);this.offers=own;this.state='upgrade';this.emit('upgrade_offered',{options:own.map(s=>s.id)});
  return true;
}
// ---- Gear: four slots (weapon, armour, helmet, ring) filled from the bag.
gearItem(slot){const id=this.equipped[slot];return id?this.bag.find(i=>i.id===id)||null:null;}
// Recomputes stats from what is worn; a bigger max HP also heals by the difference.
applyGear(){
  const w=this.gearItem('weapon'),a=this.gearItem('armor'),h=this.gearItem('helmet'),r=this.gearItem('ring');
  if(w&&w.job!==this.job)this.equipped.weapon=null;
  const weapon=this.gearItem('weapon');this.weaponTier=weapon?weapon.tier:0;this.weaponPlus=weapon?weapon.plus:0;
  this.armorTier=a?a.tier:0;this.guard=a?itemStats(a).guard:0;this.ringBonus=r?itemStats(r).dmg:0;
  const hp=this.baseHp+(a?itemStats(a).hp:0)+(h?itemStats(h).hp:0),gain=hp-this.maxHp;
  this.maxHp=hp;this.p.hp=Math.max(1,Math.min(hp,this.p.hp+Math.max(0,gain)));
}
addItem({kind,tier,job}){
  const item={id:this.nextItemId++,kind,tier,job:job||null,plus:0};
  if(this.bag.length>=BAG_MAX){ // full bag: sell the weakest unworn piece (possibly the new one)
    const worn=new Set(Object.values(this.equipped));let worst=item;for(const i of this.bag)if(!worn.has(i.id)&&i.tier*100+i.plus<worst.tier*100+worst.plus)worst=i;
    this.gold+=sellPrice(worst);this.emit('auto_sold',{name:itemName(worst)});if(worst===item)return null;this.bag=this.bag.filter(i=>i!==worst);
  }
  this.bag.push(item);this.bag.sort((x,y)=>y.tier-x.tier||y.plus-x.plus);return item;
}
equipItem(id){
  const item=this.bag.find(i=>i.id===id);if(!item||!canEquip(item,this.level,this.job))return false;
  this.equipped[item.kind]=id;this.applyGear();this.cue('equip');this.emit('gear_changed',{slot:item.kind,name:itemName(item)});return true;
}
unequip(slot){if(!this.equipped[slot])return false;this.equipped[slot]=null;this.applyGear();this.emit('gear_changed',{slot});return true;}
sellItem(id){
  const item=this.bag.find(i=>i.id===id);if(!item||Object.values(this.equipped).includes(id))return false;
  this.bag=this.bag.filter(i=>i!==item);const price=sellPrice(item);this.gold+=price;this.cue('coin');this.emit('item_sold',{name:itemName(item),price});return price;
}
enhance(slot){
  const item=this.gearItem(slot);if(!item||item.plus>=MAX_PLUS)return false;const cost=enhanceCost(item);if(this.gold<cost)return false;
  this.gold-=cost;item.plus++;this.applyGear();this.cue('forgeOk');this.emit('enhanced',{slot,plus:item.plus,name:itemName(item)});return true;
}
// Wears the best piece the hero's level allows in any slot that it improves.
equipBest(){
  for(const slot of SLOTS){
    const current=this.gearItem(slot),score=i=>i?i.tier*100+i.plus:-1;let best=null;
    for(const item of this.bag)if(item.kind===slot&&canEquip(item,this.level,this.job)&&score(item)>score(best))best=item;
    if(best&&score(best)>score(current)){this.equipped[slot]=best.id;this.applyGear();this.emit(slot==='weapon'?'weapon_up':'armor_up',{tier:best.tier,slot,name:itemName(best)});
      this.cue(slot==='weapon'?'forgeOk':'equip');if(slot==='weapon')this.effects.push({kind:'ascend',x:this.p.x,y:this.p.y,life:1,max:1});}
  }
}
// The best piece in the bag that is still level-locked, for the HUD hint.
lockedUpgrade(){let best=null;for(const item of this.bag){const cur=this.gearItem(item.kind);if(item.tier>(cur?cur.tier:-1)&&(item.kind!=='weapon'||item.job===this.job)&&!canEquip(item,this.level,this.job)&&(!best||item.tier>best.tier))best=item;}return best;}
// Gold and gear carry over to the next run.
stash(){return {gold:this.gold,bag:structuredClone(this.bag),equipped:{...this.equipped},nextItemId:this.nextItemId};}
loadStash(st){if(!st)return;this.gold=st.gold||0;this.bag=structuredClone(st.bag||[]);this.equipped={weapon:null,armor:null,helmet:null,ring:null,...(st.equipped||{})};this.nextItemId=Math.max(st.nextItemId||1,...this.bag.map(i=>i.id+1));this.applyGear();this.p.hp=this.maxHp;}
// Pulls every crystal and drop on the field to the hero; once per minute of play.
magnet(){if(this.state!=='playing'||this.magnetClock>0)return false;this.magnetClock=MAGNET_COOLDOWN;for(const g of this.gems)g.pull=true;for(const g of this.coins)g.pull=true;for(const l of this.loot)l.pull=true;this.cue('portal');this.emit('magnet');this.effects.push({kind:'gust',x:this.p.x,y:this.p.y,r:220,life:.5,max:.5});return true;}
offerUpgrade(){this.offers=choices(this.skills,this.rng,this.job);if(!this.offers.length){this.p.hp=Math.min(this.maxHp,this.p.hp+18);this.emit('upgrade_fallback');return;}this.state='upgrade';this.emit('upgrade_offered',{options:this.offers.map(s=>s.id)});}
checkLevel(){
  if(this.xp<this.need||this.state!=='playing')return;
  this.xp-=this.need;this.level++;this.cue('levelUp');this.need=5+Math.floor(this.level*1.4);
  this.equipBest();
  if(this.level>=10&&this.job==='novice'&&!this.awaitingClass){
    if(this.holdPicks){this.awaitingClass=true;this.emit('class_unlocked');}else{this.state='awakening';this.emit('class_unlocked');return;}
  }else if(this.holdPicks){this.pendingPicks++;this.emit('pick_saved',{pending:this.pendingPicks});}
  else{this.offerUpgrade();return;}
  this.checkLevel();
}
// While the player is away, level-ups are banked instead of picked; this opens the next banked
// choice (the class pick first) once they are back.
openPending(){
  if(this.state!=='playing'||this.holdPicks)return false;
  if(this.awaitingClass&&this.job==='novice'){this.state='awakening';return true;}
  while(this.pendingPicks>0&&this.state==='playing'){this.pendingPicks--;this.offerUpgrade();}
  return this.state!=='playing';
}
// Auto-farming never ends the run: a defeat retreats to the start of the current stage.
retreat(){
  this.retreats++;this.p.hp=this.maxHp;this.p.inv=2;this.enemies=[];this.shots=this.shots.filter(s=>s.friendly);this.zones=[];
  this.stageStart=this.t;this.bossSpawned=false;this.eliteSpawned=false;this.spawn=2;this.emit('retreat',{stage:this.stage});this.cue('portal');
  this.effects.push({kind:'ascend',x:this.p.x,y:this.p.y,life:1.2,max:1.2});
}
// Plain snapshot for saving; the stage restarts on restore and enemies respawn.
serialize(){
  const keep=['job','appearance','name','t','stage','bossesDefeated','level','xp','need','kills','skills','boosts','baseHp','bag','equipped','nextItemId','gold','goldEarned','evolved','welcome','firstMoved','firstKill','magnetClock','pendingPicks','awaitingClass','retreats','xpEarned'];
  const out={v:2,hp:this.p.hp};for(const k of keep)out[k]=structuredClone(this[k]);return out;
}
static restore(snap,rng=Math.random){
  const r=new Run(rng,{job:snap.job,appearance:snap.appearance,name:snap.name});
  for(const [k,v] of Object.entries(snap))if(!['v','hp','maxHp','weaponTier','armorTier'].includes(k)&&k in r)r[k]=structuredClone(v);
  r.job=normalizeJob(r.job);
  // v1 saves: items had no ids and gear was implied by the best tiers.
  if(snap.v===1){r.baseHp=100+15*(r.boosts.vigor||0);r.bag=r.bag.map(i=>({...i,id:r.nextItemId++,plus:0}));r.equipBest();}
  r.applyGear();r.p.hp=Math.max(1,Math.min(r.maxHp,snap.hp||r.maxHp));r.stageStart=r.t;r.spawn=1;r.emit('run_restored',{stage:r.stage,level:r.level});
  return r;
}
// EXP crystals: size follows the monster (slime < archer < elite < boss) and a random roll
// (x1 / x2 / x3). Rarely a gold crystal worth ~10x drops instead; elites often, bosses always add one.
dropGems(e){
  const base=GEM_BASE[e.type]||1,r=this.rng(),mult=r<.12?3:r<.4?2:1;
  this.gems.push({x:e.x,y:e.y,value:base*mult});
  const goldChance=e.type==='boss'?1:e.type==='elite'?.25:.03;
  if(this.rng()<goldChance){const value=Math.max(25,base*10)*(e.type==='boss'?2:1);this.gems.push({x:e.x-10,y:e.y-6,value,gold:true});this.emit('gold_gem',{value});}
}
hit(e,damage,continuous=false){
  if(e.hp<=0)return;e.hp-=damage;if(!continuous)this.cue('hit',{cls:this.job==='mage'?'mage':this.job==='gunner'?'archer':'blade',volume:.55});e.flash=.12;
  if(continuous&&e.damageText?.life>.12){e.damageText.value+=damage;}else{const text={kind:'number',x:e.x,y:e.y-e.r*2-12,life:continuous ? .4 : .6,max:continuous ? .4 : .6,value:damage};this.effects.push(text);if(continuous)e.damageText=text;}
  if(e.hp<=0){
    this.kills++;this.cue(e.type==='boss'?'bossDown':'kill');if(!this.firstKill){this.firstKill=true;this.emit('first_kill');}
    this.dropGems(e);
    const gold=Math.round((GOLD_DROP[e.type]||1)*(1+.5*(this.stage-1)));this.coins.push({x:e.x+8,y:e.y+4,value:gold});
    const drop=rollDrop(e.type,this.stage,this.job,this.rng);if(drop){this.loot.push({...drop,x:e.x,y:e.y,id:this.nextId++});this.emit('loot_drop',{kind:drop.kind,tier:drop.tier});}
    if(e.type==='boss')this.clearStage();
  }
}
// Defeating the guardian opens the next, harder stage instead of ending the run.
clearStage(){
  this.bossesDefeated++;this.emit('stage_clear',{stage:this.stage});this.cue('clear');
  this.stage++;this.stageStart=this.t;this.bossSpawned=false;this.eliteSpawned=false;this.spawn=2;
  this.p.hp=Math.min(this.maxHp,this.p.hp+35);
  this.effects.push({kind:'ascend',x:this.p.x,y:this.p.y,life:1.4,max:1.4});
}
end(reason){if(this.state==='ended')return;this.state='ended';this.cue('death');this.result=reason;this.emit('run_end',{reason,kills:this.kills,level:this.level,stage:this.stage,weaponTier:this.weaponTier,armorTier:this.armorTier,build:{...this.skills}});}
damage(n,source){
  if(this.p.inv>0||this.state!=='playing')return;n*=(1+.25*(this.stage-1))*(1-this.guard);
  this.p.hp=Math.max(0,this.p.hp-n);this.p.inv=.8;this.cue('hurt');this.emit('damage_taken',{source,damage:n});this.effects.push({kind:'hurt',x:this.p.x,y:this.p.y,life:.25,max:.25});
  if(this.p.hp<=0){if(this.reviveOnDefeat)this.retreat();else this.end(source==='boss'?'boss':'defeat');}
}
alive(){return this.enemies.filter(e=>e.hp>0);}
nearest(range,from=this.p){let best=null,bestD=range;for(const e of this.enemies){if(e.hp<=0)continue;const d=Math.hypot(e.x-from.x,e.y-from.y);if(d<bestD){best=e;bestD=d;}}return best;}
within(r,from=this.p){return this.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-from.x,e.y-from.y)<r+e.r*.5);}
closestList(r,count){return this.within(r).sort((a,b)=>Math.hypot(a.x-this.p.x,a.y-this.p.y)-Math.hypot(b.x-this.p.x,b.y-this.p.y)).slice(0,count);}
later(t,fn){this.delayed.push({t,fn});}
blast(x,y,r,damage,lv=1,style='fire'){this.cue(style==='holy'?'smite':'slam',{volume:.7});this.effects.push({kind:'explosion',x,y,r,lv,style,life:.4+.04*lv,max:.4+.04*lv});for(const e of this.within(r,{x,y}))this.hit(e,damage);}
fire(x,y,angle,speed,props){this.shots.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,friendly:true,hit:new Set(),...props});}

move(dt,input){
  const p=this.p,previousX=p.x,previousY=p.y,len=Math.hypot(input.x,input.y),k=1/Math.max(1,len);
  // Velocity eases toward the input instead of snapping, which also filters touch-drag jitter.
  const blend=1-Math.exp(-dt*ACCEL),tx=len>.05?input.x*k*SPEED:0,ty=len>.05?input.y*k*SPEED:0;
  this.vel.x+=(tx-this.vel.x)*blend;this.vel.y+=(ty-this.vel.y)*blend;
  if(len<=.05&&Math.hypot(this.vel.x,this.vel.y)<4){this.vel.x=0;this.vel.y=0;}
  if(len>.05){this.direction=directionFor(input.x,input.y,this.direction);if(input.x)this.facing=Math.sign(input.x);if(!this.firstMoved){this.firstMoved=true;this.emit('first_move');}}
  p.x+=this.vel.x*dt;p.y+=this.vel.y*dt;Object.assign(p,constrainToArena(p,16));
  const traveled=Math.hypot(p.x-previousX,p.y-previousY);this.motionDistance+=traveled;
  // A short coast after release keeps the run cycle; standing still switches to idle.
  this.moving=dt>0&&traveled/dt>18;
}

basicAttack(dt,speed,area){
  this.attack-=dt;if(this.attack>0)return;
  const p=this.p,tier=this.weaponTier,job=this.job,power=this.power();
  if(job==='gunner'){
    const target=this.nearest(300*area);if(!target)return;
    this.attack=(tier>=5?.21:.3)/speed;this.swing=.12;this.cue('shot',{heavy:tier>=4,volume:.6});
    const a=Math.atan2(target.y-(p.y-30),target.x-p.x),count=tier>=3?3:tier>=2?2:1,pierce=tier>=3?2:tier>=1?1:0;this.aim=a;
    for(let i=0;i<count;i++)this.fire(p.x,p.y-30,a+(i-(count-1)/2)*.12,620,{life:.6,physical:true,style:'bullet',tier,pierce,damage:(9+this.level*.8)*power,blast:tier>=4?55:0});
    this.effects.push({kind:'muzzle',x:p.x+Math.cos(a)*30,y:p.y-30+Math.sin(a)*30,a,tier,life:.08,max:.08});return;
  }
  if(job==='mage'){
    const r=150*area*(tier>=1?1.1:1)*(tier>=4?1.15:1),near=this.within(r);if(!near.length)return;
    this.attack=(tier>=5?.56:.75)/speed;this.swing=.2;this.cue('spell',{volume:.6});const dmg=(16+this.level*1.4)*power;
    this.effects.push({kind:'arcane',x:p.x,y:p.y,r,tier,life:.35,max:.35});for(const e of near)this.hit(e,dmg);
    if(tier>=2)this.later(.35,()=>{this.effects.push({kind:'arcane',x:this.p.x,y:this.p.y,r:r*.8,tier,life:.3,max:.3});for(const e of this.within(r*.8))this.hit(e,dmg*.5);});
    if(tier>=3){let from=p;for(const e of this.closestList(320*area,3)){this.effects.push({kind:'lightning',x:from.x,y:from.y,tx:e.x,ty:e.y,life:.25,max:.25});this.hit(e,dmg*.6);from=e;}}
    return;
  }
  const knight=job==='knight',r=(knight?120:110)*area*(knight&&tier>=1?1.1:1);
  const target=this.nearest(knight&&tier>=2?320*area:r);if(!target)return;
  this.attack=(knight?(tier>=5?.45:.6):.65)/speed;this.swing=.2;this.cue(knight&&tier>=2?'slash':'swing');
  const dmg=(18+this.level*1.5)*(knight?1.3:1)*power,a=Math.atan2(target.y-p.y,target.x-p.x);this.aim=a;
  this.effects.push({kind:'slash',x:p.x,y:p.y,r,tier:knight?tier:-1,life:.3,max:.3});for(const e of this.within(r))this.hit(e,dmg);
  if(knight&&tier>=4)this.later(.15,()=>{this.effects.push({kind:'slash',x:this.p.x,y:this.p.y,r,tier,life:.25,max:.25});for(const e of this.within(r))this.hit(e,dmg*.6);});
  if(knight&&tier>=2){const n=tier>=3?3:1,wa=Math.atan2(target.y-(p.y-20),target.x-p.x);for(let i=0;i<n;i++)this.fire(p.x,p.y-20,wa+(i-(n-1)/2)*.28,380,{life:.8,style:'crescent',tier,damage:dmg*.7,radius:24});}
}

castSkills(area){
  const p=this.p,s=this.skills,sp=this.skillPower();
  // The hero strikes a pose for the grandest skill in the volley (class skills first).
  let lead=null;for(const id of Object.keys(s))if(SKILL_POSE[id]&&(!lead||(SKILLS.find(k=>k.id===id).job?10:0)+s[id]>(SKILLS.find(k=>k.id===lead).job?10:0)+s[lead]))lead=id;
  if(lead)this.pose={kind:SKILL_POSE[lead],life:.5,max:.5};
  if(s.ice){const target=this.nearest(9999);if(target){const angle=Math.atan2(target.y-p.y,target.x-p.x),count=this.evolved.blizzard?5:s.ice;for(let i=0;i<count;i++)this.fire(p.x,p.y,angle+(i-(count-1)/2)*.18,340,{life:2,style:'ice',slows:true,damage:(this.evolved.blizzard?42:24)*sp});}}
  if(s.spark){let from=p;for(const e of this.closestList(300*area,2+s.spark)){this.effects.push({kind:'lightning',x:from.x,y:from.y,tx:e.x,ty:e.y,life:.3,max:.3});this.hit(e,(27+s.spark*9)*sp);from=e;}}
  if(s.gust){const r=160*area;this.effects.push({kind:'gust',x:p.x,y:p.y,r,life:.5,max:.5});for(const e of this.within(r)){this.hit(e,(18+s.gust*8)*sp);const a=Math.atan2(e.y-p.y,e.x-p.x);e.x+=Math.cos(a)*65;e.y+=Math.sin(a)*65;}}
  // Class skills grow to Lv.5: every level adds reach/count, and `lv` drives how grand the visual is.
  if(s.whirl){const lv=s.whirl;this.cue('slash');this.zones.push({kind:'whirl',lv,follow:true,x:p.x,y:p.y,r:(115+12*lv)*area,life:1+.1*lv,max:1+.1*lv,dps:(38+20*lv)*sp});}
  if(s.wave){const lv=s.wave,target=this.nearest(420+20*lv);if(target){this.cue('swing');const a=Math.atan2(target.y-(p.y-20),target.x-p.x),n=lv+1;for(let i=0;i<n;i++)this.fire(p.x,p.y-20,a+(i-(n-1)/2)*.26,400+20*lv,{life:.9+.05*lv,style:'crescent',lv,tier:this.weaponTier,damage:(30+12*lv)*sp,radius:24+3*lv});}}
  if(s.judgement){const lv=s.judgement;this.cue('holy');for(const e of this.closestList(340*area,1+lv)){const x=e.x,y=e.y;this.effects.push({kind:'blade',lv,x,y,life:.5,max:.5});this.later(.35,()=>this.blast(x,y,(50+6*lv)*area,(60+25*lv)*sp,lv,'holy'));}}
  if(s.meteor){this.cue('cast');const lv=s.meteor,pool=this.within(380*area);for(let i=0;i<lv&&pool.length;i++){const e=pool[Math.floor(this.rng()*pool.length)],x=e.x,y=e.y,r=(80+8*lv)*area;this.effects.push({kind:'meteor',lv,x,y,r,life:.7,max:.7});this.later(.7,()=>this.blast(x,y,r,(70+30*lv)*sp,lv,'fire'));}}
  if(s.vortex){const lv=s.vortex,e=this.nearest(320+20*lv);if(e){this.cue('spell');}if(e)this.zones.push({kind:'vortex',lv,x:e.x,y:e.y,r:(100+10*lv)*area,life:2.2+.2*lv,max:2.2+.2*lv,dps:(24+12*lv)*sp,pull:90+10*lv});}
  if(s.nova){this.cue('holy');const lv=s.nova,r=(190+20*lv)*area,dmg=(35+15*lv)*sp;this.effects.push({kind:'nova',lv,x:p.x,y:p.y,r,life:.6,max:.6});for(const e of this.within(r))this.hit(e,dmg);
    if(lv>=4)this.later(.3,()=>{this.effects.push({kind:'nova',lv,x:this.p.x,y:this.p.y,r:r*1.15,life:.6,max:.6});for(const e of this.within(r*1.15))this.hit(e,dmg*.6);});}
  if(s.scatter){const lv=s.scatter,e=this.nearest(300+15*lv);if(e){this.cue('shot',{heavy:true});const a=Math.atan2(e.y-(p.y-30),e.x-p.x),n=5+2*lv;for(let i=0;i<n;i++)this.fire(p.x,p.y-30,a+(i/(n-1)-.5)*.75,520,{life:.45+.03*lv,physical:true,style:'pellet',lv,tier:this.weaponTier,pierce:lv>=4?1:0,damage:(12+4*lv)*sp});this.effects.push({kind:'muzzle',lv,x:p.x+Math.cos(a)*30,y:p.y-30+Math.sin(a)*30,a,tier:this.weaponTier,life:.12,max:.12});}}
  if(s.grenade){this.cue('swing',{volume:.6});const lv=s.grenade,r=(75+6*lv)*area,dmg=(45+20*lv)*sp;for(const e of this.closestList(340*area,lv)){const x=e.x,y=e.y;this.effects.push({kind:'lob',lv,x:p.x,y:p.y-30,tx:x,ty:y,life:.55,max:.55});this.later(.55,()=>{this.blast(x,y,r,dmg,lv,'fire');
    // Lv.5 cluster bomb: four bomblets scatter after the main blast.
    if(lv>=5)this.later(.25,()=>{for(let k=0;k<4;k++){const b=k*Math.PI/2+.4;this.blast(x+Math.cos(b)*r*.8,y+Math.sin(b)*r*.6,40,dmg*.35,3,'fire');}});});}}
}

drones(dt){
  const level=this.skills.drone;if(!level)return;
  this.droneClock-=dt;if(this.droneClock>0)return;this.droneClock=.65-.1*level;
  for(const d of this.dronePositions()){const e=this.nearest(320,d);if(!e)continue;const a=Math.atan2(e.y-d.y,e.x-d.x);this.fire(d.x,d.y,a,560+30*level,{life:.6,physical:true,style:'drone',lv:level,tier:this.weaponTier,pierce:level>=5?2:0,damage:(10+5*level)*this.skillPower()});}
}
dronePositions(){const lv=this.skills.drone||0,n=lv>=5?3:lv>=3?2:lv?1:0;return Array.from({length:n},(_,i)=>{const a=this.t*1.6+i*Math.PI*2/n;return {lv,x:this.p.x+Math.cos(a)*55,y:this.p.y-70+Math.sin(a)*18};});}

// Auto mode: kite at the class's comfortable range, step out of telegraphs, sweep up drops.
autoInput(){
  const p=this.p,keep={knight:70,mage:95,gunner:190}[this.job]||75;let x=0,y=0,threat=0;
  for(const e of this.enemies){
    if(e.hp<=0)continue;const w=e.warn;
    if(w&&w.kind==='dash'){const dx=w.x-w.ox,dy=w.y-w.oy,l=dx*dx+dy*dy||1,u=Math.max(0,Math.min(1,((p.x-w.ox)*dx+(p.y-w.oy)*dy)/l)),cx=w.ox+u*dx,cy=w.oy+u*dy,d=Math.hypot(p.x-cx,p.y-cy)||1;if(d<80){x+=(p.x-cx)/d*4;y+=(p.y-cy)/d*4;threat+=4;}}
    else if(w){const r=w.kind==='shot'?45:115,d=Math.hypot(p.x-w.x,p.y-w.y)||1;if(d<r){x+=(p.x-w.x)/d*4;y+=(p.y-w.y)/d*4;threat+=4;}}
    const d=Math.hypot(p.x-e.x,p.y-e.y)||1,danger=e.r+keep*(e.type==='boss'?1.5:1);
    if(d<danger){const f=(danger-d)/danger*2.2;x+=(p.x-e.x)/d*f;y+=(p.y-e.y)/d*f;threat+=f;}
  }
  for(const s of this.shots){if(s.friendly)continue;const d=Math.hypot(p.x-s.x,p.y-s.y)||1;if(d<70){x+=-s.vy/150*1.5;y+=s.vx/150*1.5;}}
  if(threat<1.5){
    let goal=null,best=Infinity;for(const g of [...this.loot,...this.gems,...this.coins]){const d=Math.hypot(p.x-g.x,p.y-g.y);if(d<best&&d<500){best=d;goal=g;}}
    if(!goal){const e=this.nearest(2000);if(e&&Math.hypot(e.x-p.x,e.y-p.y)>keep+e.r+50)goal=e;}
    if(goal){const d=Math.hypot(goal.x-p.x,goal.y-p.y)||1;x+=(goal.x-p.x)/d;y+=(goal.y-p.y)/d;}
  }
  const r=Math.hypot(p.x,p.y);if(r>560){x-=p.x/r*(r-560)/200;y-=p.y/r*(r-560)/200;}
  const len=Math.hypot(x,y);return len<.15?{x:0,y:0}:{x:x/len,y:y/len};
}
// Auto mode's upgrade pick: grow class skills first, then held skills, then endless boosts.
autoChoose(){
  const score=s=>s.kind==='boost'?(s.id==='vigor'&&this.p.hp<this.maxHp*.5?1.5:1):(s.job?4:s.kind==='active'?3:2)+(this.skills[s.id]?1:0);
  let best=null;for(const s of this.offers)if(!best||score(s)>score(best))best=s;return best?.id;
}
update(dt,input={x:0,y:0}){
  if(this.state!=='playing')return;dt=Math.min(.05,Math.max(0,dt));this.t+=dt;const p=this.p;
  this.move(dt,input);p.inv=Math.max(0,p.inv-dt);if(this.pose&&(this.pose.life-=dt)<=0)this.pose=null;this.swing=Math.max(0,this.swing-dt);
  const st=this.t-this.stageStart,timing=STAGE_TIMING(this.stage),bossAlive=this.enemies.some(e=>e.type==='boss'&&e.hp>0);
  this.spawn-=dt;if(this.spawn<=0&&!bossAlive&&!this.bossSpawned){this.spawn=Math.max(.4-.04*(this.stage-1),1.7-st/190-.2*(this.stage-1));if(this.enemies.length<95){this.addEnemy(st>45&&this.rng()<.25?'archer':st>22&&this.rng()<.3?'runner':'slime');}}
  if(st>=timing.elite&&!this.eliteSpawned){this.eliteSpawned=true;this.addEnemy('elite',300);this.emit('elite_start');}
  if(st>=timing.boss&&!this.bossSpawned){this.bossSpawned=true;this.enemies=[];this.shots=this.shots.filter(s=>s.friendly);this.addEnemy('boss',270);this.emit('boss_start',{stage:this.stage});this.cue('roar');}
  // A one-time crystal burst teaches collection without requiring a tutorial dialog.
  if(this.t>=8&&!this.welcome){this.welcome=true;for(let i=0;i<5;i++){const point=constrainToArena({x:p.x+Math.cos(i*1.25)*40,y:p.y+Math.sin(i*1.25)*40},8);this.gems.push({...point,value:1});}this.emit('crystal_burst');}
  const speed=1+(this.skills.haste||0)*.15,area=1+(this.skills.area||0)*.2;
  this.basicAttack(dt,speed,area);
  this.skillClock+=dt*speed;if(this.skillClock>=1.4){this.skillClock=0;this.castSkills(area);}
  this.drones(dt);
  if(this.skills.fire){const count=this.evolved.inferno?6:1+this.skills.fire,sp=this.skillPower();for(let i=0;i<count;i++){const a=this.t*2.4+i*Math.PI*2/count,x=p.x+Math.cos(a)*85*area,y=p.y+Math.sin(a)*85*area;for(const e of this.enemies)if(e.hp>0&&Math.hypot(e.x-x,e.y-y)<e.r+18)this.hit(e,dt*(this.evolved.inferno?110:65)*sp,true);}}
  for(const z of this.zones){z.life-=dt;if(z.follow){z.x=p.x;z.y=p.y;}for(const e of this.within(z.r,z)){this.hit(e,z.dps*dt,true);if(z.pull&&e.type!=='boss'){const d=Math.hypot(z.x-e.x,z.y-e.y)||1,step=Math.min(d,z.pull*dt);e.x+=(z.x-e.x)/d*step;e.y+=(z.y-e.y)/d*step;}}}
  this.zones=this.zones.filter(z=>z.life>0);
  for(const d of this.delayed){d.t-=dt;if(d.t<=0)d.fn();}this.delayed=this.delayed.filter(d=>d.t>0);
  for(const e of this.enemies){if(e.hp<=0)continue;e.flash=Math.max(0,e.flash-dt);e.slow=Math.max(0,e.slow-dt);Object.assign(e,constrainToArena(e,e.r));e.cd-=dt;const d=Math.hypot(p.x-e.x,p.y-e.y),a=Math.atan2(p.y-e.y,p.x-e.x);if(!e.warn&&(e.type!=='archer'||d>240)){e.x+=Math.cos(a)*e.speed*(e.slow>0?.35:1)*dt;e.y+=Math.sin(a)*e.speed*(e.slow>0?.35:1)*dt;}
  Object.assign(e,constrainToArena(e,e.r));
  if(d<e.r+16)this.damage(e.type==='boss'?22:9,e.type);
  if(e.type==='archer'&&e.cd<=0){e.cd=3.3;e.warn={x:p.x,y:p.y,t:.8,kind:'shot'};}
  if((e.type==='boss'||e.type==='elite')&&e.cd<=0){e.cd=e.type==='boss'?Math.max(1.8,3-.3*(this.stage-1)):4;e.warn={x:p.x,y:p.y,t:1.1,kind:e.type==='boss'&&this.rng()<.5?'dash':'slam',ox:e.x,oy:e.y};}
  if(e.warn){e.warn.t-=dt;if(e.warn.t<=0){const w=e.warn;if(w.kind==='shot'){const ang=Math.atan2(w.y-e.y,w.x-e.x);this.shots.push({x:e.x,y:e.y,vx:Math.cos(ang)*150,vy:Math.sin(ang)*150,life:3,friendly:false});}else if(w.kind==='dash'){// The warned segment is also the damage shape.
  const dx=w.x-w.ox,dy=w.y-w.oy,l=dx*dx+dy*dy,u=l?Math.max(0,Math.min(1,((p.x-w.ox)*dx+(p.y-w.oy)*dy)/l)):0;if(Math.hypot(p.x-w.ox-u*dx,p.y-w.oy-u*dy)<48)this.damage(28,e.type);e.x=w.x;e.y=w.y;this.cue('slam');this.effects.push({kind:'gust',x:e.x,y:e.y,r:65,life:.4,max:.4});}else{this.cue('slam');this.effects.push({kind:'slam',x:w.x,y:w.y,r:95,life:.4,max:.4});if(Math.hypot(p.x-w.x,p.y-w.y)<95)this.damage(25,e.type);}e.warn=null;}}
  }
  for(const s of this.shots){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;if(s.friendly){for(const e of this.enemies){if(s.life<=0)break;if(e.hp>0&&!s.hit.has(e.id)&&Math.hypot(s.x-e.x,s.y-e.y)<e.r+(s.radius||10)){s.hit.add(e.id);this.hit(e,s.damage);if(s.slows)e.slow=1.6;if(s.blast)this.blast(s.x,s.y,s.blast,s.damage*.5);if(s.pierce!==undefined&&s.pierce--<=0)s.life=0;}}}else if(Math.hypot(s.x-p.x,s.y-p.y)<22){this.damage(12,'arrow');s.life=0;}}
  this.magnetClock=Math.max(0,this.magnetClock-dt);
  for(const g of this.gems){const d=Math.hypot(p.x-g.x,p.y-g.y);if(g.pull&&d>=120){const step=Math.min(d,900*dt);g.x+=(p.x-g.x)/(d||1)*step;g.y+=(p.y-g.y)/(d||1)*step;}else if(d<120){const step=Math.min(d,Math.max(90,280-d)*dt);g.x+=(p.x-g.x)/(d||1)*step;g.y+=(p.y-g.y)/(d||1)*step;}if(d<20){this.xp+=g.value;this.xpEarned+=g.value;g.collected=true;this.cue('coin',{volume:g.gold?.8:.35});if(g.gold)this.effects.push({kind:'xpText',x:g.x,y:g.y-20,life:.9,max:.9,value:g.value});}}
  for(const l of this.loot){const d=Math.hypot(p.x-l.x,p.y-l.y);if(d<90||l.pull){const step=Math.min(d,(l.pull?900:220)*dt);l.x+=(p.x-l.x)/(d||1)*step;l.y+=(p.y-l.y)/(d||1)*step;}if(d<24){l.collected=true;const {kind,tier,job}=l;this.addItem({kind,tier,job});this.cue('loot',TIERS[tier].id);this.emit('loot_pickup',{kind,tier,name:itemName(l)});this.equipBest();}}
  this.loot=this.loot.filter(l=>!l.collected);
  for(const g of this.coins){const d=Math.hypot(p.x-g.x,p.y-g.y);if(g.pull||d<120){const step=Math.min(d,(g.pull?900:Math.max(90,280-d))*dt);g.x+=(p.x-g.x)/(d||1)*step;g.y+=(p.y-g.y)/(d||1)*step;}if(d<20){this.gold+=g.value;this.goldEarned+=g.value;g.collected=true;}}
  this.coins=this.coins.filter(g=>!g.collected);if(this.coins.length>200)this.coins.splice(0,this.coins.length-200);
  this.gems=this.gems.filter(g=>!g.collected);this.enemies=this.enemies.filter(e=>e.hp>0&&(e.type==='boss'||Math.hypot(e.x-p.x,e.y-p.y)<1300));this.shots=this.shots.filter(s=>s.life>0);for(const f of this.effects)f.life-=dt;this.effects=this.effects.filter(f=>f.life>0).slice(-140);
  if(this.state==='playing')this.checkLevel();
}
}
