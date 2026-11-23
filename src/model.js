import {constrainToArena,enemySpawn} from './arena.js';
import {ARMOR,SLOTS,BAG_MAX,MAX_PLUS,GOLD_DROP,rollDrop,canEquip,itemName,itemStats,sellPrice,enhanceCost} from './loot.js';
import {directionFor} from './sprite-layout.js';
import {TIERS} from './weapons.js';
import {PETS,petDef,petStats,petUpgradeCost,MAX_PET_LV,PET_HIT_CD,PET_PRICE,PITY,eggPrice,dupeRefund,rollEgg} from './pets.js';
import {SUPPLIES,BUFFS,SHOP_REFRESH,ENHANCE_RATE,DROP_FROM,rollStock,supplyPrice,refreshPrice} from './shop.js';

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
{id:'drone',job:'gunner',kind:'active',icon:'⛭',name:'โดรนป้อมปืน',desc:'โดรนลอยตามตัวยิงศัตรูใกล้สุดเอง Lv.3 ได้โดรนตัวที่สอง',tag:'มือปืน · อัตโนมัติ · ต่อเนื่อง'},
// More class skills, unlocked by hero level.
{id:'charge',job:'knight',kind:'active',icon:'➶',name:'พุ่งทะลวง',desc:'พุ่งฟันเป็นแนวตรงทะลุทุกตัวที่ขวางทาง',tag:'นักดาบ · แนวตรง · ทะลุ'},
{id:'quake',job:'knight',kind:'active',icon:'⛰',name:'ปฐพีแยก',desc:'กระแทกพื้นรอบตัว ศัตรูโดนดาเมจและเดินช้าลง',tag:'นักดาบ · รอบตัว · ควบคุม'},
{id:'bladerain',job:'knight',kind:'active',icon:'⚔',name:'ฝนดาบ',desc:'ดาบแสงจำนวนมากตกกระจายรอบตัว',tag:'นักดาบ · พื้นที่กว้าง'},
{id:'ironwill',job:'knight',kind:'passive',icon:'⛨',name:'ใจเหล็ก',desc:'ลดดาเมจที่ได้รับ +4% ต่อเลเวล',tag:'นักดาบ · ติดตัว'},
{id:'bloodlust',job:'knight',kind:'passive',icon:'♨',name:'ดาบกระหายเลือด',desc:'ฟื้น HP 0.4% ต่อเลเวล ทุกครั้งที่ล้มศัตรู',tag:'นักดาบ · ติดตัว'},
{id:'blizzard2',job:'mage',kind:'active',icon:'❅',name:'พายุหิมะ',desc:'เรียกพายุหิมะกลางฝูง กัดกร่อนและแช่แข็งต่อเนื่อง',tag:'นักเวท · พื้นที่ · ควบคุม'},
{id:'thunder',job:'mage',kind:'active',icon:'⚡',name:'สายฟ้าฟาด',desc:'ฟ้าผ่าลงศัตรูหลายตัวพร้อมกัน',tag:'นักเวท · หลายเป้าหมาย'},
{id:'beam',job:'mage',kind:'active',icon:'✦',name:'ลำแสงอาร์เคน',desc:'ยิงลำแสงยาวทะลุทุกตัวในแนว',tag:'นักเวท · แนวตรง · ทะลุ'},
{id:'manaflow',job:'mage',kind:'passive',icon:'♒',name:'กระแสมานา',desc:'ร่ายสกิลถี่ขึ้น 6% ต่อเลเวล',tag:'นักเวท · ติดตัว'},
{id:'arcanemind',job:'mage',kind:'passive',icon:'✧',name:'ปัญญาอาร์เคน',desc:'ดาเมจสกิล +8% ต่อเลเวล',tag:'นักเวท · ติดตัว'},
{id:'rocket',job:'gunner',kind:'active',icon:'➹',name:'จรวดระเบิด',desc:'ยิงจรวดพุ่งไปข้างหน้า ระเบิดเป็นวงเมื่อโดนเป้า',tag:'มือปืน · ระเบิด'},
{id:'mine',job:'gunner',kind:'active',icon:'✲',name:'ทุ่นระเบิด',desc:'วางทุ่นระเบิดรอบตัว ระเบิดเมื่อศัตรูเหยียบ',tag:'มือปืน · กับดัก'},
{id:'barrage',job:'gunner',kind:'active',icon:'☄',name:'ฝนกระสุน',desc:'ยิงกระสุนถล่มพื้นที่เป้าหมายรัว ๆ',tag:'มือปืน · พื้นที่'},
{id:'deadeye',job:'gunner',kind:'passive',icon:'◎',name:'ตาเหยี่ยว',desc:'โอกาสคริติคอล (ดาเมจ ×2) +5% ต่อเลเวล',tag:'มือปืน · ติดตัว'},
{id:'quickdraw',job:'gunner',kind:'passive',icon:'»',name:'มือไว',desc:'โจมตีปกติเร็วขึ้น 8% ต่อเลเวล',tag:'มือปืน · ติดตัว'},
// Shared long-run passives (formerly endless boost cards).
{id:'might',kind:'passive',icon:'✊',name:'พลังไร้ขีดจำกัด',desc:'ดาเมจทุกอย่าง +10% ต่อเลเวล',tag:'ทุกอาชีพ · ติดตัว'},
{id:'vigor',kind:'passive',icon:'♥',name:'หัวใจคริสตัล',desc:'HP สูงสุด +15 ต่อเลเวล',tag:'ทุกอาชีพ · ติดตัว'}];
// Max level and the hero level each skill needs before it can be learnt.
const SKILL_META={fire:[3,1],ice:[3,1],spark:[3,3],gust:[3,5],area:[3,4],haste:[3,6],
  whirl:[5,10],wave:[5,10],judgement:[5,12],charge:[5,15],quake:[5,20],bladerain:[5,30],ironwill:[5,14],bloodlust:[5,25],
  meteor:[5,10],vortex:[5,10],nova:[5,12],blizzard2:[5,15],thunder:[5,20],beam:[5,30],manaflow:[5,14],arcanemind:[5,25],
  scatter:[5,10],grenade:[5,10],drone:[5,12],rocket:[5,15],mine:[5,20],barrage:[5,30],deadeye:[5,14],quickdraw:[5,25],
  might:[20,8],vigor:[20,8]};
for(const s of SKILLS){const [max,req]=SKILL_META[s.id];s.max=max;s.req=req;}
export const BOOSTS=[];
// Each cast skill has its own cooldown (multiples of the 1.4s base). A longer cooldown hits
// proportionally harder per cast, so damage per second stays the same. fire/drone run constantly.
export const SKILL_CD={ice:1,spark:1,gust:1.4,whirl:2,wave:1,judgement:1.8,meteor:2.2,vortex:2.4,nova:1.6,scatter:1,grenade:1.6,
  charge:1.4,quake:1.8,bladerain:2,blizzard2:2.4,thunder:1.6,beam:1.4,rocket:1.2,mine:2.6,barrage:2};
export const BASE_CD=1.4;
export function maxLevel(skill){return skill.max;}
// Equipped active skills cast in combat; passives always apply.
export function activeSlots(job){return job==='novice'?2:4;}
export function respecCost(level){return Math.round(30*level*level/5+50);}
// Hero names: two syllables, re-rollable on the class screen.
const NAME_HEAD=['ไค','ริว','เอล','ซาร์','ลูน','คิระ','มิ','โนวา','เรน','ทิล','อาร์','ซีน','เวล','ฟิน','ไอ','โร'];
const NAME_TAIL=['มอส','เรีย','ดิน','ลอส','นา','ไวน์','ริค','เซล','ธอร์','ลี','กา','รัน','ซ่า','โม'];
export function randomHeroName(rng=Math.random){return NAME_HEAD[Math.floor(rng()*NAME_HEAD.length)]+NAME_TAIL[Math.floor(rng()*NAME_TAIL.length)];}
export function cleanHeroName(name){return String(name||'').replace(/[<>&"'`]/g,'').replace(/\s+/g,' ').trim().slice(0,12);}
export const MAGNET_COOLDOWN=60;
// From stage MAGNET_LIMIT_FROM the magnet runs on charges: reaching that stage gives MAGNET_START,
// every later new stage adds MAGNET_GRANT, unused charges carry over, and uses are MAGNET_GAP seconds apart.
export const MAGNET_LIMIT_FROM=4,MAGNET_START=10,MAGNET_GRANT=1,MAGNET_GAP=3;
// ---- Balance (v0.17). Levels need steadily more EXP; enemies, their hits and their gold grow
// geometrically per stage, so progress eventually walls until gear is bought, found or enhanced.
export function xpNeed(level){return Math.round(4+4*level+.35*level*level);}
// ---- World map (v0.19): 6 worlds × 10 stages. Each stage asks for a kill quota, then a guardian:
// an elite, a mini-boss on stage 5 and the world boss on stage 10. Losing sends the hero back to farm
// the last cleared stage; clearing all 60 opens Hard mode, which continues the difficulty curve.
export const WORLDS=6,STAGES_PER_WORLD=10,LAST_STAGE=60,FARM_RETRY=120;
export const WORLD_NAMES=['ป่าพงไพร','ภูเขาไฟคำราม','ธารน้ำแข็ง','วิหารทองคำ','ดินแดนจันทรา','ถ้ำคริสตัล'];
export const STAGE_HP=1.16,STAGE_HIT=1.075,STAGE_GOLD=1.06;
export function stageInfo(stage){const world=Math.ceil(stage/STAGES_PER_WORLD),sub=(stage-1)%STAGES_PER_WORLD+1;return {world,sub,guardian:sub===10?'boss':sub===5?'mini':'elite',label:`${world}-${sub}`};}
export function stageQuota(stage){return 40+5*stageInfo(stage).sub;}
export function parTime(stage){return 70+10*stageInfo(stage).sub;}
export function effStage(stage,hard){return stage+(hard?LAST_STAGE:0);}
// The combat power a stage expects; compared against Run#combatPower() in the UI.
// Each world has its own monster mix: [type, weight, first sub-stage it appears in].
export const WORLD_ROSTER=[
  [['slime',10,1],['runner',4,2],['brute',3,3],['archer',3,4],['bomber',2,6]],
  [['slime',6,1],['bomber',5,1],['imp',4,2],['runner',3,3],['brute',2,5],['archer',2,6]],
  [['slime',6,1],['brute',5,1],['runner',4,2],['spitter',3,4],['archer',2,6]],
  [['slime',5,1],['spitter',5,1],['brute',3,2],['archer',3,3],['bomber',2,5],['runner',2,6]],
  [['imp',5,1],['runner',5,1],['spitter',3,2],['slime',3,3],['brute',3,5],['bomber',2,6]],
  [['slime',4,1],['brute',4,1],['spitter',4,2],['runner',3,2],['archer',3,3],['bomber',3,4],['imp',3,5]]
];
// A world boss that is not down this many seconds after it appears goes berserk.
export const WORLD_BOSS_HP=7500,BERSERK_AT=45;
export function recommendedPower(stage,hard=false){return Math.round(REC_BASE*REC_GROWTH**(effStage(stage,hard)-1));}
export const REC_BASE=130,REC_GROWTH=1.11;
export const POTION_AT=.35,POTION_HEAL=.5,POTION_COOLDOWN=6;
export const GEM_BASE={slime:1,runner:1,archer:2,elite:10,boss:30,brute:3,bomber:1,imp:1,spitter:2};
export function evolutions(skills){return {inferno:skills.fire===3&&skills.area>=2,blizzard:skills.ice===3&&skills.haste>=2};}

const SPEED=145,ACCEL=28;
const SKILL_POSE={whirl:'spin',wave:'slash',judgement:'raise',meteor:'raise',vortex:'thrust',nova:'raise',scatter:'recoil',grenade:'throw',drone:'raise',ice:'thrust',spark:'raise',gust:'spin',charge:'thrust',quake:'slash',bladerain:'raise',blizzard2:'raise',thunder:'raise',beam:'thrust',rocket:'recoil',mine:'throw',barrage:'recoil'};
const MODS=['swift','shield','burst','giant'];

export class Run{
constructor(rng=Math.random,profile=null){
  this.rng=rng;this.job=normalizeJob(profile?.job);this.appearance=profile?.appearance==='b'?'b':'a';
  this.facing=1;this.direction='se';this.moving=false;this.motionDistance=0;this.vel={x:0,y:0};
  this.t=0;this.maxHp=100;this.p={x:0,y:0,hp:100,inv:0};this.enemies=[];this.gems=[];this.shots=[];this.effects=[];this.events=[];this.cues=[];this.zones=[];this.delayed=[];
  this.skills={};this.level=1;this.xp=0;this.need=xpNeed(1);this.kills=0;this.state='playing';this.spawn=0;this.attack=0;this.swing=0;this.aim=0;this.cooldowns={};this.castGlow={};this.droneClock=0;this.nextId=0;this.slots=[];this.skillPoints=0;
  this.stage=1;this.hard=false;this.cleared={normal:0,hard:0};this.stars={};this.mode='challenge';this.stageKills=0;this.quota=stageQuota(1);this.farmClock=0;this.autoChallenge=true;this.stageFailed=false;this.stageStart=0;this.bossSpawned=false;this.eliteSpawned=false;this.bossesDefeated=0;
  this.potionAt=POTION_AT;this.weaponTier=0;this.weaponPlus=0;this.armorTier=0;this.guard=0;this.ringBonus=0;this.bag=[];this.equipped={weapon:null,armor:null,helmet:null,ring:null};this.nextItemId=1;this.gold=0;this.goldEarned=0;this.coins=[];this.pose=null;this.supplies={potion:0,luck:0,guard:0};this.buffs={xp:0,gold:0};this.potionClock=0;this.shopStock=[];this.shopClock=0;this.loot=[];this.magnetClock=0;this.magnetCharges=0;this.magnetGranted={normal:0,hard:0};this.pets=[];this.petLv={};this.petId=null;this.petPity=0;this.petPos=null;this.holdPicks=false;this.awaitingClass=false;this.reviveOnDefeat=false;this.retreats=0;this.xpEarned=0;this.name=cleanHeroName(profile?.name)||'TILMO';
  this.firstMoved=false;this.firstKill=false;this.evolved={};
  this.emit('run_start');for(let i=0;i<4;i++)this.addEnemy('slime',130+i*25,i*Math.PI/2);
}
emit(type,data={}){this.events.push({type,t:Math.round(this.t*100)/100,...data});}
// Sound cues for the renderer to play; the model stays silent and testable.
cue(name,arg){if(this.cues.length<48)this.cues.push(arg?{name,arg}:{name});}
weaponPower(){return this.job==='novice'?1:TIERS[this.weaponTier].power*(1+.08*this.weaponPlus);}
power(){return this.weaponPower()*(1+.1*(this.skills.might||0))*(1+this.ringBonus);}
// Skills scale with half the weapon's growth so the weapon stays the main upgrade.
skillPower(){const weapon=this.weaponPower();return (1+(weapon-1)*.5)*(1+.1*(this.skills.might||0))*(1+this.ringBonus)*(1+.08*(this.skills.arcanemind||0));}
// One number for the UI: offence (gear, passives, skill levels) times the square root of toughness.
combatPower(){const levels=Object.values(this.skills).reduce((a,b)=>a+b,0),offence=this.power()*(1+.012*this.level)*(1+.03*levels),tough=this.maxHp/(1-this.guard);return Math.round(offence*Math.sqrt(tough)*6);}
eff(){return effStage(this.stage,this.hard);}
addEnemy(type,radius=430,angle=this.rng()*Math.PI*2,{guardian=false,mini=false}={}){
  const boss=type==='boss',elite=type==='elite',eff=this.eff(),scale=STAGE_HP**(eff-1),{world}=stageInfo(this.stage);
  const BASE={runner:22,archer:30,brute:78,bomber:14,imp:9,spitter:34},RAD={brute:22,bomber:14,imp:10,spitter:15},SPD={runner:76,brute:30,bomber:68,imp:96,spitter:34};
  let hp=boss?(mini?550:WORLD_BOSS_HP)*scale:(elite?(guardian?480:220):BASE[type]??24+Math.min(60,this.t-this.stageStart)*.06)*scale;
  let bodyRadius=boss?(mini?34:42):elite?29:RAD[type]||16,speed=(boss?29:elite?31:SPD[type]||38)*Math.min(1.6,1+.01*(eff-1));
  // From world 2 some monsters roll a trait: swift, shielded, bursting on death or giant.
  let mod=null;if(!boss&&!elite&&world+(this.hard?2:0)>=2&&this.rng()<Math.min(.45,.04*(world-1)+(this.hard?.2:0)+.03)){mod=MODS[Math.floor(this.rng()*(world>=3||this.hard?4:3))];if(type==='imp'||type==='bomber')mod=null;else 
    if(mod==='swift')speed*=1.6;if(mod==='giant'){hp*=2.5;bodyRadius*=1.4;}}
  const point=enemySpawn(this.p,radius,angle,bodyRadius);
  this.enemies.push({id:this.nextId++,type,stage:this.stage,x:point.x,y:point.y,hp,max:hp,r:bodyRadius,speed,cd:boss?3:2+this.rng()*2,slow:0,flash:0,guardian:guardian||boss,mini,mod,born:this.t});
}
awaken(job,appearance,name){
  if(this.state!=='awakening'||!CLASSES.some(c=>c.id===job)||!['a','b'].includes(appearance))return false;
  this.awaitingClass=false;this.job=job;this.appearance=appearance;this.applyGear();this.name=cleanHeroName(name)||this.name;this.cue('equip');this.equipBest();
  this.emit('class_chosen',{job,appearance,name:this.name});this.effects.push({kind:'ascend',x:this.p.x,y:this.p.y,life:1.2,max:1.2});
  this.state='playing';return true;
}
// ---- Skills: every level gives a skill point. Points raise skills up to their max (class skills
// need the class and a hero level). Up to 4 learnt actives sit in slots and cast; passives always apply.
skill(id){return SKILLS.find(s=>s.id===id);}
spentPoints(){return Object.values(this.skills).reduce((a,b)=>a+b,0);}
canLearn(id){const s=this.skill(id);return !!s&&this.skillPoints>0&&(!s.job||s.job===this.job)&&this.level>=s.req&&(this.skills[id]||0)<s.max;}
learn(id){
  if(!this.canLearn(id))return false;const s=this.skill(id);this.skills[id]=(this.skills[id]||0)+1;this.skillPoints--;
  if(s.kind==='active'&&!this.slots.includes(id)&&this.slots.length<activeSlots(this.job))this.slots.push(id);
  this.applyGear();this.checkEvolutions();this.cue('equip');this.emit('skill_learned',{id,level:this.skills[id]});return true;
}
checkEvolutions(){const evo=evolutions(this.skills);for(const key of Object.keys(evo))if(evo[key]&&!this.evolved[key]){this.evolved[key]=true;this.emit('evolution_unlocked',{id:key});}}
equipSkill(id){const s=this.skill(id);if(!s||s.kind!=='active'||!this.skills[id]||this.slots.includes(id)||this.slots.length>=activeSlots(this.job))return false;this.slots.push(id);this.emit('slots_changed');return true;}
unequipSkill(id){if(!this.slots.includes(id))return false;this.slots=this.slots.filter(x=>x!==id);this.emit('slots_changed');return true;}
// Re-skill: pay gold to get every point back.
respec(){const cost=respecCost(this.level),spent=this.spentPoints();if(!spent||this.gold<cost)return false;this.gold-=cost;this.skillPoints+=spent;this.skills={};this.slots=[];this.evolved={};this.applyGear();this.cue('portal');this.emit('respec',{cost});return true;}
// Spends every point: class actives first, then shared actives while slots are free, then passives.
autoLearn(){
  const order=s=>(s.kind==='active'?(this.slots.includes(s.id)?100:this.slots.length<activeSlots(this.job)?(s.job?80:50):-1):s.job?40:s.id==='might'?35:s.id==='vigor'?30:20)-s.req*.01+(this.skills[s.id]||0)*.1;
  let n=0;while(this.skillPoints>0&&n++<400){let best=null;for(const s of SKILLS)if(this.canLearn(s.id)&&order(s)>=0&&(!best||order(s)>order(best)))best=s;if(!best)break;this.learn(best.id);}
}
// ---- Stages.
canChallenge(stage=this.cleared[this.hard?'hard':'normal']+1,hard=this.hard){return stage>=1&&stage<=LAST_STAGE&&stage<=this.cleared[hard?'hard':'normal']+1&&(!hard||this.cleared.normal>=LAST_STAGE);}
resetField(){this.enemies=[];this.shots=this.shots.filter(s=>s.friendly);this.zones=[];this.stageStart=this.t;this.bossSpawned=false;this.eliteSpawned=false;this.spawn=1;}
startChallenge(stage=this.cleared[this.hard?'hard':'normal']+1,hard=this.hard){
  if(!this.canChallenge(stage,hard))return false;this.hard=hard;this.stage=stage;this.mode='challenge';this.stageKills=0;this.quota=stageQuota(stage);this.stageFailed=false;this.resetField();
  this.grantMagnet(stage,hard);this.emit('stage_start',{stage,hard});this.cue('portal');return true;
}
// ---- Magnet charges and pets.
magnetLimited(){return this.stage>=MAGNET_LIMIT_FROM;}
grantMagnet(stage,hard){const k=hard?'hard':'normal';if(stage<MAGNET_LIMIT_FROM||stage<=this.magnetGranted[k])return;const add=this.magnetGranted[k]<MAGNET_LIMIT_FROM?MAGNET_START:MAGNET_GRANT;this.magnetGranted[k]=stage;this.magnetCharges+=add;this.emit('magnet_charges',{added:add,total:this.magnetCharges});}
pet(){return this.pets.includes(this.petId)?petStats(petDef(this.petId),this.petLv[this.petId]||1):null;}
petLevel(id){return this.petLv[id]||1;}
petUpgradePrice(id){const d=petDef(id);return d?petUpgradeCost(d,this.petLevel(id),this.stage):Infinity;}
upgradePet(id){if(!this.pets.includes(id)||this.petLevel(id)>=MAX_PET_LV)return false;const cost=this.petUpgradePrice(id);if(this.gold<cost)return false;this.gold-=cost;this.petLv[id]=this.petLevel(id)+1;this.cue('equip');this.emit('pet_level',{id,lv:this.petLv[id]});return true;}
setPet(id){if(id!==null&&!this.pets.includes(id))return false;this.petId=id;this.petPos=null;this.emit('pet_set',{id});return true;}
buyPet(){if(this.pets.includes('chick')||this.gold<PET_PRICE)return false;this.gold-=PET_PRICE;this.pets.push('chick');if(!this.pet())this.setPet('chick');this.cue('coin');this.emit('pet_hatched',{id:'chick',tier:0,fresh:true});return true;}
// Hatches n eggs; new pets join the collection (and the best one is sent out), duplicates refund gold.
hatchEggs(n=1){
  const price=eggPrice(this.stage)*n;if(!(n>=1)||this.gold<price)return null;this.gold-=price;const out=[];
  for(let i=0;i<n;i++){const pet=rollEgg(this.rng,this.petPity);this.petPity=pet.tier>=4?0:this.petPity+1;
    if(this.pets.includes(pet.id)){const refund=dupeRefund(pet.tier,this.stage);this.gold+=refund;out.push({id:pet.id,tier:pet.tier,refund});}
    else{this.pets.push(pet.id);out.push({id:pet.id,tier:pet.tier,fresh:true});if(!this.pet()||pet.tier>this.pet().tier)this.setPet(pet.id);}}
  this.cue('loot',TIERS[Math.max(...out.map(o=>o.tier))].id);this.emit('eggs_hatched',{results:out});return out;
}
petsLeftToPity(){return PITY-this.petPity;}
// The pet runs to the nearest crystal/coin (and drop, from Unique) the hero has not reached yet
// and sends it flying to the hero; with nothing to fetch it trots beside the hero.
petStep(dt){
  const def=this.pet(),p=this.p;if(!def){this.petPos=null;return;}
  if(!this.petPos||Math.hypot(this.petPos.x-p.x,this.petPos.y-p.y)>900)this.petPos={x:p.x-30,y:p.y+12,face:1,moving:false};
  const q=this.petPos;let best=null,bd=Infinity;q.cd=Math.max(0,(q.cd||0)-dt);q.bite=Math.max(0,(q.bite||0)-dt);
  const foe=r=>{let f=null,fd=Infinity;for(const e of this.enemies){if(e.hp<=0)continue;const dh=Math.hypot(e.x-p.x,e.y-p.y);if(dh>r)continue;const d=Math.hypot(e.x-q.x,e.y-q.y);if(d<fd){fd=d;f=e;}}return f;};
  // Defend first when something is at the hero, then fetch, then hunt nearby monsters.
  let target=foe(150);
  if(!target){const look=arr=>{for(const g of arr){if(g.pull||g.collected)continue;const dh=Math.hypot(g.x-p.x,g.y-p.y);if(dh<110||dh>def.range)continue;const d=Math.hypot(g.x-q.x,g.y-q.y);if(d<bd){bd=d;best=g;}}};
    look(this.gems);look(this.coins);if(def.loot)look(this.loot);if(!best)target=foe(def.range*.6);}
  if(target){const d=Math.hypot(target.x-q.x,target.y-q.y);if(d<target.r+16){if(q.cd<=0){q.cd=PET_HIT_CD;q.bite=.15;this.hit(target,(12+this.level)*this.power()*def.atk);}best={x:q.x,y:q.y};q.face=target.x>q.x?1:-1;}else best={x:target.x-(target.x>q.x?1:-1)*(target.r+8),y:target.y};}
  const tx=best?best.x:p.x-34*(this.facing<0?-1:1),ty=best?best.y:p.y+14,d=Math.hypot(tx-q.x,ty-q.y);
  if(d>2){const step=Math.min(d,(best?def.speed:Math.max(def.speed,d*2.5))*dt);q.x+=(tx-q.x)/d*step;q.y+=(ty-q.y)/d*step;if(!target&&Math.abs(tx-q.x)>1)q.face=tx>q.x?1:-1;}
  q.moving=d>4;
  const grab=arr=>{for(const g of arr)if(!g.pull&&Math.hypot(g.x-q.x,g.y-q.y)<def.reach)g.pull=true;};
  grab(this.gems);grab(this.coins);if(def.loot)grab(this.loot);
}
// Picks the next field monster; tougher kinds unlock as the effective stage climbs.
spawnWave(st,info){
  const table=WORLD_ROSTER[(info.world-1)%WORLD_ROSTER.length].map(([k,w,from])=>[k,info.sub>=from||st>40?w:0]);
  let roll=this.rng()*table.reduce((a,[,w])=>a+w,0),type='slime';for(const [k,w] of table){if((roll-=w)<0){type=k;break;}}
  if(type==='imp'){const a=this.rng()*Math.PI*2;for(let i=0;i<4;i++)this.addEnemy('imp',430,a+(i-1.5)*.12);}else this.addEnemy(type);
}
// Boss attacks: slam / dash from the start, then nova rings, meteor rain and minion calls; below half HP the boss enrages.
bossAttack(e,p){
  const mini=e.mini,rage=e.rage,pool=mini?['slam','dash','nova']:['slam','dash','nova','meteor','summon'];
  const kind=pool[Math.floor(this.rng()*pool.length)];e.cd=Math.max(1.6,3-.3*(this.stage-1))*(e.berserk?.45:rage?.65:1)*(kind==='summon'?1.6:1);
  if(kind==='meteor'){const pts=[];for(let i=0;i<(rage?5:3);i++){const a=this.rng()*Math.PI*2,d=i?40+this.rng()*120:0;pts.push(constrainToArena({x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d},10));}e.warn={kind,pts,x:p.x,y:p.y,r:70,t:1.25};}
  else if(kind==='nova'||kind==='summon')e.warn={kind,x:e.x,y:e.y,r:kind==='nova'?80:60,t:.9};
  else e.warn={x:p.x,y:p.y,t:1.1,kind,r:rage?115:95,ox:e.x,oy:e.y};
}
// Summon the stage guardian now instead of waiting for the kill quota. From farm mode this
// starts the next uncleared stage with its guardian straight away.
canSummon(){return this.state==='playing'&&(this.mode==='farm'?this.canChallenge():!this.bossSpawned);}
summonBoss(){
  if(!this.canSummon())return false;
  if(this.mode==='farm')this.startChallenge();
  this.stageKills=Math.max(this.stageKills,this.quota);this.emit('boss_summoned',{stage:this.stage});return true;
}
farmAt(stage,hard=this.hard,floor=1){
  const top=Math.max(1,floor,this.cleared[hard?'hard':'normal']);if(hard&&this.cleared.normal<LAST_STAGE)return false;
  this.hard=hard;this.stage=Math.max(1,Math.min(stage,top));this.mode='farm';this.farmClock=0;this.resetField();this.emit('farm_start',{stage:this.stage,hard});return true;
}
// ---- Gear: four slots (weapon, armour, helmet, ring) filled from the bag.
gearItem(slot){const id=this.equipped[slot];return id?this.bag.find(i=>i.id===id)||null:null;}
// Recomputes stats from what is worn; a bigger max HP also heals by the difference.
applyGear(){
  const w=this.gearItem('weapon'),a=this.gearItem('armor'),h=this.gearItem('helmet'),r=this.gearItem('ring');
  if(w&&w.job!==this.job)this.equipped.weapon=null;
  const weapon=this.gearItem('weapon');this.weaponTier=weapon?weapon.tier:0;this.weaponPlus=weapon?weapon.plus:0;
  this.armorTier=a?a.tier:0;this.helmetTier=h?h.tier:-1;this.armorLook=a?a.tier:-1;this.guard=Math.min(.6,(a?itemStats(a).guard:0)+.04*(this.skills.ironwill||0));this.ringBonus=r?itemStats(r).dmg:0;
  const hp=100+15*(this.skills.vigor||0)+(a?itemStats(a).hp:0)+(h?itemStats(h).hp:0),gain=hp-this.maxHp;
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
// Sells several bag pieces at once (worn pieces are skipped); returns the gold earned.
sellItems(ids){
  const want=new Set(ids),worn=new Set(Object.values(this.equipped)),sold=this.bag.filter(i=>want.has(i.id)&&!worn.has(i.id));if(!sold.length)return 0;
  const total=sold.reduce((a,i)=>a+sellPrice(i),0);this.bag=this.bag.filter(i=>!sold.includes(i));this.gold+=total;this.cue('coin');this.emit('items_sold',{count:sold.length,price:total});return total;
}
// Pieces that can never help this hero: other classes' weapons and anything no better than what is worn.
junkIds(){const worn=new Set(Object.values(this.equipped)),score=i=>i.tier*100+i.plus;
  return this.bag.filter(i=>!worn.has(i.id)&&((i.kind==='weapon'&&this.job!=='novice'&&i.job!==this.job)||(this.gearItem(i.kind)&&score(i)<=score(this.gearItem(i.kind))))).map(i=>i.id);}
// Enhancing costs gold and can fail from +3 up; a luck stone adds 25% and a guard stone keeps a
// +6-or-higher piece from dropping a level on failure. Returns 'success', 'fail', 'drop' or false.
enhanceChance(slot,luck=false){const item=this.gearItem(slot);if(!item||item.plus>=MAX_PLUS)return 0;return Math.min(1,ENHANCE_RATE[item.plus]+(luck&&this.supplies.luck>0?.25:0));}
enhance(slot,{luck=false,guard=false}={}){
  const item=this.gearItem(slot);if(!item||item.plus>=MAX_PLUS)return false;const cost=enhanceCost(item);if(this.gold<cost)return false;
  const chance=this.enhanceChance(slot,luck);this.gold-=cost;if(luck&&this.supplies.luck>0&&ENHANCE_RATE[item.plus]<1)this.supplies.luck--;
  if(this.rng()<chance){item.plus++;this.applyGear();this.cue('forgeOk');this.emit('enhanced',{slot,plus:item.plus,name:itemName(item)});return 'success';}
  const risky=item.plus>=DROP_FROM,saved=risky&&guard&&this.supplies.guard>0;if(saved)this.supplies.guard--;
  if(risky&&!saved){item.plus--;this.applyGear();}
  this.cue('hurt');this.emit('enhance_failed',{slot,plus:item.plus,name:itemName(item),dropped:risky&&!saved});return risky&&!saved?'drop':'fail';
}
// ---- Town shop. Stock is rolled on first visit and refreshed free every 10 minutes of play.
ensureShop(){if(!this.shopStock.length||this.shopClock<=0){this.shopStock=rollStock(this.level,this.job,this.rng);this.shopClock=SHOP_REFRESH;}return this.shopStock;}
refreshShop(){const cost=refreshPrice(this.stage);if(this.gold<cost)return false;this.gold-=cost;this.shopStock=rollStock(this.level,this.job,this.rng);this.shopClock=SHOP_REFRESH;this.cue('coin');return true;}
buyGear(index){
  const offer=this.shopStock[index];if(!offer||offer.sold||this.gold<offer.price||this.bag.length>=BAG_MAX)return false;
  if(offer.kind==='weapon'&&offer.job!==this.job)return false;
  this.gold-=offer.price;offer.sold=true;const item=this.addItem(offer);this.cue('loot',TIERS[offer.tier].id);this.emit('bought',{name:itemName(item)});return item;
}
buySupply(id,count=1){
  if(!(id in SUPPLIES||id in BUFFS)||!(count>=1))return false;const price=supplyPrice(id,this.stage)*count;if(this.gold<price)return false;this.gold-=price;
  if(id in BUFFS)this.buffs[id]+=BUFFS[id].seconds*count;else this.supplies[id]+=count;
  this.cue('coin');this.emit('bought',{id,count});return true;
}
// Auto-drink threshold as a fraction of max HP (0 turns auto-drinking off).
setPotionAt(v){this.potionAt=Math.max(0,Math.min(.9,Math.round(Number(v)*20)/20||0));return this.potionAt;}
usePotion(){if(this.supplies.potion<=0||this.potionClock>0||this.p.hp>=this.maxHp||this.state!=='playing')return false;this.supplies.potion--;this.potionClock=POTION_COOLDOWN;this.p.hp=Math.min(this.maxHp,this.p.hp+this.maxHp*POTION_HEAL);this.cue('equip');this.effects.push({kind:'ascend',x:this.p.x,y:this.p.y,life:.6,max:.6});this.emit('potion',{left:this.supplies.potion});return true;}
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
stash(){return {pets:[...this.pets],petLv:{...this.petLv},petId:this.petId,petPity:this.petPity,gold:this.gold,bag:structuredClone(this.bag),equipped:{...this.equipped},nextItemId:this.nextItemId,supplies:{...this.supplies},potionAt:this.potionAt};}
loadStash(st){if(!st)return;this.gold=st.gold||0;this.bag=structuredClone(st.bag||[]);this.equipped={weapon:null,armor:null,helmet:null,ring:null,...(st.equipped||{})};this.nextItemId=Math.max(st.nextItemId||1,...this.bag.map(i=>i.id+1));this.supplies={potion:0,luck:0,guard:0,...(st.supplies||{})};if(typeof st.potionAt==='number')this.setPotionAt(st.potionAt);if(Array.isArray(st.pets)){this.pets=st.pets.filter(id=>petDef(id));this.petId=st.petId??null;this.petPity=st.petPity||0;this.petLv={...(st.petLv||{})};}this.applyGear();this.p.hp=this.maxHp;}
// Pulls every crystal and drop on the field to the hero; once per minute of play.
magnet(){if(this.state!=='playing'||this.magnetClock>0)return false;if(this.magnetLimited()){if(this.magnetCharges<=0)return false;this.magnetCharges--;this.magnetClock=MAGNET_GAP;}else this.magnetClock=MAGNET_COOLDOWN;for(const g of this.gems)g.pull=true;for(const g of this.coins)g.pull=true;for(const l of this.loot)l.pull=true;this.cue('portal');this.emit('magnet');this.effects.push({kind:'gust',x:this.p.x,y:this.p.y,r:220,life:.5,max:.5});return true;}
checkLevel(){
  if(this.xp<this.need||this.state!=='playing')return;
  this.xp-=this.need;this.level++;this.skillPoints++;this.cue('levelUp');this.need=xpNeed(this.level);this.emit('level_up',{level:this.level});
  this.equipBest();
  if(this.level>=10&&this.job==='novice'&&!this.awaitingClass){
    if(this.holdPicks){this.awaitingClass=true;this.emit('class_unlocked');}else{this.state='awakening';this.emit('class_unlocked');return;}
  }
  this.checkLevel();
}
// While the player is away the class pick is banked; this opens it once they are back.
openPending(){
  if(this.state!=='playing'||this.holdPicks)return false;
  if(this.awaitingClass&&this.job==='novice'){this.state='awakening';return true;}
  return false;
}
// Auto-farming never ends the run: a defeat retreats to the start of the current stage.
// A defeat never ends the game: the hero falls back to farm the stage below.
retreat(){
  this.retreats++;this.p.hp=this.maxHp;this.p.inv=2;const failed=this.stage;
  // A failed challenge drops one stage, never below the world's first stage; falling while
  // farming keeps the same stage so repeated defeats do not slide the hero down.
  const floor=(stageInfo(failed).world-1)*STAGES_PER_WORLD+1;this.farmAt(this.mode==='challenge'?Math.max(floor,failed-1):failed,this.hard,floor);this.stageFailed=true;
  this.emit('retreat',{stage:failed});this.emit('stage_failed',{stage:failed,hard:this.hard});this.cue('portal');
  this.effects.push({kind:'ascend',x:this.p.x,y:this.p.y,life:1.2,max:1.2});
}
// Plain snapshot for saving; the stage restarts on restore and enemies respawn.
serialize(){
  const keep=['job','appearance','name','t','stage','hard','cleared','stars','mode','autoChallenge','bossesDefeated','level','xp','need','kills','skills','slots','skillPoints','bag','equipped','nextItemId','gold','goldEarned','evolved','welcome','firstMoved','firstKill','magnetClock','awaitingClass','retreats','xpEarned','supplies','buffs','shopStock','shopClock','potionAt','magnetCharges','magnetGranted','pets','petLv','petId','petPity'];
  const out={v:4,hp:this.p.hp};for(const k of keep)out[k]=structuredClone(this[k]);return out;
}
static restore(snap,rng=Math.random){
  const r=new Run(rng,{job:snap.job,appearance:snap.appearance,name:snap.name});
  for(const [k,v] of Object.entries(snap))if(!['v','hp','maxHp','weaponTier','armorTier'].includes(k)&&k in r)r[k]=structuredClone(v);
  r.job=normalizeJob(r.job);
  r.applyGear();r.p.hp=Math.max(1,Math.min(r.maxHp,snap.hp||r.maxHp));
  if(r.mode==='farm')r.farmAt(r.stage,r.hard);else if(!r.startChallenge(r.stage,r.hard))r.farmAt(r.stage,r.hard);
  r.emit('run_restored',{stage:r.stage,level:r.level});
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
  if(e.hp<=0)return;if(e.mod==='shield'&&e.hp>e.max*.5)damage*=.5;
  let crit=false;if(!continuous&&this.skills.deadeye&&this.rng()<.05*this.skills.deadeye){damage*=2;crit=true;}
  e.hp-=damage;if(!continuous)this.cue('hit',{cls:this.job==='mage'?'mage':this.job==='gunner'?'archer':'blade',volume:.55});e.flash=.12;
  if(continuous&&e.damageText?.life>.12){e.damageText.value+=damage;}else{const text={kind:'number',x:e.x,y:e.y-e.r*2-12,life:continuous ? .4 : .6,max:continuous ? .4 : .6,value:damage,crit};this.effects.push(text);if(continuous)e.damageText=text;}
  if(e.hp<=0){
    this.kills++;this.cue(e.type==='boss'?'bossDown':'kill');if(!this.firstKill){this.firstKill=true;this.emit('first_kill');}
    this.dropGems(e);
    const gold=Math.round((GOLD_DROP[e.type]||1)*(e.mini?.5:1)*STAGE_GOLD**(this.eff()-1));this.coins.push({x:e.x+8,y:e.y+4,value:gold});
    const drop=rollDrop(e.type,this.lootBase(),this.job,this.rng);if(drop){this.loot.push({...drop,x:e.x,y:e.y,id:this.nextId++});this.emit('loot_drop',{kind:drop.kind,tier:drop.tier});}
    if(this.skills.bloodlust)this.p.hp=Math.min(this.maxHp,this.p.hp+this.maxHp*.004*this.skills.bloodlust);
    if(e.mod==='burst'){this.effects.push({kind:'explosion',x:e.x,y:e.y,r:60,lv:1,style:'fire',life:.4,max:.4});if(Math.hypot(this.p.x-e.x,this.p.y-e.y)<60+16)this.damage(10,'burst');}
    if(this.mode==='challenge'&&!e.guardian)this.stageKills++;
    if(e.guardian&&this.mode==='challenge')this.clearStage();
  }
}
// Defeating the guardian opens the next, harder stage instead of ending the run.
// Gear quality follows the world (and Hard mode adds two tiers' worth).
lootBase(){return Math.min(5,Math.floor((stageInfo(this.stage).world-1)*.8)+(this.hard?2:0));}
clearStage(){
  const stage=this.stage,hard=this.hard,track=hard?'hard':'normal',key=(hard?'h':'n')+stage,time=this.t-this.stageStart,info=stageInfo(stage);
  const stars=1+(time<=parTime(stage)?1:0)+(!this.stageFailed&&this.p.hp>=this.maxHp*.5?1:0);this.stars[key]=Math.max(this.stars[key]||0,stars);
  const first=stage>this.cleared[track];if(first){this.cleared[track]=stage;const bonus=Math.round(40*info.sub*(info.sub===10?3:1)*STAGE_GOLD**(this.eff()-1));this.gold+=bonus;this.goldEarned+=bonus;}
  this.bossesDefeated++;this.emit('stage_clear',{stage,hard,stars,first,label:info.label});this.cue('clear');
  this.p.hp=Math.min(this.maxHp,this.p.hp+this.maxHp*.35);this.effects.push({kind:'ascend',x:this.p.x,y:this.p.y,life:1.4,max:1.4});
  if(stage<LAST_STAGE)this.startChallenge(stage+1,hard);
  else{if(!hard&&first)this.emit('hard_unlocked');this.farmAt(LAST_STAGE,hard);}
}
end(reason){if(this.state==='ended')return;this.state='ended';this.cue('death');this.result=reason;this.emit('run_end',{reason,kills:this.kills,level:this.level,stage:this.stage,weaponTier:this.weaponTier,armorTier:this.armorTier,build:{...this.skills}});}
damage(n,source){
  if(this.p.inv>0||this.state!=='playing')return;n*=STAGE_HIT**(this.eff()-1)*(1-this.guard)*(this.enemies.some(e=>e.berserk&&e.hp>0)?2:1);
  this.p.hp=Math.max(0,this.p.hp-n);this.p.inv=.8;this.cue('hurt');this.emit('damage_taken',{source,damage:n});this.effects.push({kind:'hurt',x:this.p.x,y:this.p.y,life:.25,max:.25});
  if(this.p.hp<=0)this.retreat();
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

castSkills(area,ids=this.slots,mult=1){
  const p=this.p,s={},sp=this.skillPower()*mult;for(const id of ids)if(this.skills[id])s[id]=this.skills[id];
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
  // ---- v0.19 class skills.
  if(s.charge){const lv=s.charge,e=this.nearest(420);if(e){this.cue('slash');this.line(p.x,p.y-18,Math.atan2(e.y-p.y,e.x-p.x),(240+30*lv)*area,40+4*lv,(55+22*lv)*sp,lv,'#bfefff');}}
  if(s.quake){const lv=s.quake,r=(130+15*lv)*area;this.cue('slam');this.effects.push({kind:'explosion',x:p.x,y:p.y,r,lv,style:'earth',life:.5,max:.5});for(const e of this.within(r)){this.hit(e,(40+18*lv)*sp);e.slow=Math.max(e.slow,1.5);}}
  if(s.bladerain){const lv=s.bladerain;this.cue('holy');for(let i=0;i<4+2*lv;i++){const a=this.rng()*Math.PI*2,d=60+this.rng()*240,x=p.x+Math.cos(a)*d,y=p.y+Math.sin(a)*d*.75;this.effects.push({kind:'blade',lv:Math.min(lv,3),x,y,life:.5,max:.5});this.later(.35,()=>this.blast(x,y,45*area,(30+12*lv)*sp,Math.min(lv,3),'holy'));}}
  if(s.blizzard2){const lv=s.blizzard2,e=this.nearest(360);if(e){this.cue('spell');this.zones.push({kind:'blizzard',lv,x:e.x,y:e.y,r:(110+12*lv)*area,life:2.5+.2*lv,max:2.5+.2*lv,dps:(20+10*lv)*sp,slows:true});}}
  if(s.thunder){const lv=s.thunder;this.cue('holy');for(const e of this.closestList(380*area,1+lv)){this.effects.push({kind:'lightning',x:e.x+20,y:e.y-280,tx:e.x,ty:e.y,life:.3,max:.3});this.effects.push({kind:'explosion',x:e.x,y:e.y,r:40,lv:Math.min(lv,3),style:'holy',life:.35,max:.35});this.hit(e,(45+20*lv)*sp);}}
  if(s.beam){const lv=s.beam,e=this.nearest(500);if(e){this.cue('spell');this.line(p.x,p.y-30,Math.atan2(e.y-(p.y-30),e.x-p.x),480*area,30+3*lv,(40+18*lv)*sp,lv,'#d8a8ff');}}
  if(s.rocket){const lv=s.rocket,e=this.nearest(450);if(e){this.cue('shot',{heavy:true});const a=Math.atan2(e.y-(p.y-30),e.x-p.x),n=1+Math.floor(lv/2);for(let i=0;i<n;i++)this.fire(p.x,p.y-30,a+(i-(n-1)/2)*.16,460,{life:1,style:'rocket',lv,tier:this.weaponTier,pierce:0,damage:(50+20*lv)*sp,blast:(60+6*lv)*area});}}
  if(s.mine){const lv=s.mine;this.cue('swing',{volume:.5});for(let i=0;i<lv+1;i++){const a=this.rng()*Math.PI*2,d=60+this.rng()*70;this.zones.push({kind:'mine',lv,x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d*.7,r:16,trigger:(70+6*lv)*area,dmg:(60+25*lv)*sp,life:8,max:8});}}
  if(s.barrage){const lv=s.barrage,e=this.nearest(400);if(e){this.cue('shot',{heavy:true});const x=e.x,y=e.y;for(let k=0;k<5+2*lv;k++)this.later(k*.08,()=>this.blast(x+(this.rng()-.5)*110,y+(this.rng()-.5)*70,40*area,(18+8*lv)*sp,Math.min(lv,3),'fire'));}}
}
// Full cooldown of a cast skill in seconds (before haste), shortened by mana flow.
skillCooldown(id){return BASE_CD*SKILL_CD[id]*(1-.06*(this.skills.manaflow||0));}
// Counts each slotted skill down on its own; a fresh slot starts staggered so skills do not all fire at once.
tickSkills(dt,area){
  for(const id in this.castGlow){this.castGlow[id]-=dt;if(this.castGlow[id]<=0)delete this.castGlow[id];}
  this.slots.forEach((id,i)=>{
    if(!SKILL_CD[id]||!this.skills[id])return;
    if(this.cooldowns[id]===undefined)this.cooldowns[id]=.35*i;
    this.cooldowns[id]-=dt;if(this.cooldowns[id]>0)return;
    this.cooldowns[id]=this.skillCooldown(id);this.castGlow[id]=.45;this.castSkills(area,[id],SKILL_CD[id]);
  });
}
// Straight-line strike (charge, beam): hits everything within `width` of the segment.
line(x,y,a,len,width,damage,lv,color){
  const tx=x+Math.cos(a)*len,ty=y+Math.sin(a)*len;this.effects.push({kind:'dashline',x,y,tx,ty,lv,width,color,life:.35,max:.35});
  for(const e of this.enemies){if(e.hp<=0)continue;const u=Math.max(0,Math.min(1,((e.x-x)*(tx-x)+(e.y-y)*(ty-y))/(len*len)));if(Math.hypot(e.x-(x+(tx-x)*u),e.y-(y+(ty-y)*u))<width+e.r)this.hit(e,damage);}
}

drones(dt){
  const level=this.slots.includes('drone')?this.skills.drone:0;if(!level)return;
  this.droneClock-=dt;if(this.droneClock>0)return;this.droneClock=.65-.1*level;
  for(const d of this.dronePositions()){const e=this.nearest(320,d);if(!e)continue;const a=Math.atan2(e.y-d.y,e.x-d.x);this.fire(d.x,d.y,a,560+30*level,{life:.6,physical:true,style:'drone',lv:level,tier:this.weaponTier,pierce:level>=5?2:0,damage:(10+5*level)*this.skillPower()});}
}
dronePositions(){const lv=this.slots.includes('drone')?this.skills.drone||0:0,n=lv>=5?3:lv>=3?2:lv?1:0;return Array.from({length:n},(_,i)=>{const a=this.t*1.6+i*Math.PI*2/n;return {lv,x:this.p.x+Math.cos(a)*55,y:this.p.y-70+Math.sin(a)*18};});}

// Auto mode: kite at the class's comfortable range, step out of telegraphs, sweep up drops.
autoInput(){
  const p=this.p,keep={knight:70,mage:95,gunner:190}[this.job]||75;let x=0,y=0,threat=0;
  for(const e of this.enemies){
    if(e.hp<=0)continue;const w=e.warn;
    if(w&&w.kind==='dash'){const dx=w.x-w.ox,dy=w.y-w.oy,l=dx*dx+dy*dy||1,u=Math.max(0,Math.min(1,((p.x-w.ox)*dx+(p.y-w.oy)*dy)/l)),cx=w.ox+u*dx,cy=w.oy+u*dy,d=Math.hypot(p.x-cx,p.y-cy)||1;if(d<80){x+=(p.x-cx)/d*4;y+=(p.y-cy)/d*4;threat+=4;}}
    else if(w&&w.kind==='meteor'){for(const q of w.pts){const d=Math.hypot(p.x-q.x,p.y-q.y)||1;if(d<w.r+25){x+=(p.x-q.x)/d*4;y+=(p.y-q.y)/d*4;threat+=4;}}}
    else if(w&&w.kind!=='nova'&&w.kind!=='summon'&&w.kind!=='shot3'){const r=w.kind==='shot'?45:(w.r||95)+20,d=Math.hypot(p.x-w.x,p.y-w.y)||1;if(d<r){x+=(p.x-w.x)/d*4;y+=(p.y-w.y)/d*4;threat+=4;}}
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
update(dt,input={x:0,y:0}){
  if(this.state!=='playing')return;dt=Math.min(.05,Math.max(0,dt));this.t+=dt;const p=this.p;
  this.move(dt,input);p.inv=Math.max(0,p.inv-dt);if(this.pose&&(this.pose.life-=dt)<=0)this.pose=null;this.swing=Math.max(0,this.swing-dt);
  const st=this.t-this.stageStart,info=stageInfo(this.stage),guardianUp=this.bossSpawned&&this.enemies.some(e=>e.guardian&&e.hp>0);
  this.spawn-=dt;if(this.spawn<=0&&!(guardianUp&&info.guardian!=='elite')){this.spawn=Math.max(.3,1.2-.05*info.sub-.05*(info.world-1)-(this.hard?.2:0))*(guardianUp?2:1);if(this.enemies.length<95)this.spawnWave(st,info);}
  if(this.mode==='challenge'){
    if(!this.eliteSpawned&&info.guardian==='elite'&&info.sub>=3&&this.stageKills>=this.quota*.5){this.eliteSpawned=true;this.addEnemy('elite',300);this.emit('elite_start');}
    if(!this.bossSpawned&&this.stageKills>=this.quota){this.bossSpawned=true;
      if(info.guardian==='elite'){this.addEnemy('elite',280,undefined,{guardian:true});this.emit('boss_start',{stage:this.stage,kind:'elite'});}
      else{this.enemies=[];this.shots=this.shots.filter(s=>s.friendly);this.addEnemy('boss',270,undefined,{guardian:true,mini:info.guardian==='mini'});this.emit('boss_start',{stage:this.stage,kind:info.guardian});}
      this.cue('roar');}
  }else{
    this.farmClock+=dt;if(this.farmClock>=90*(1+(this.eliteSpawned?1:0))&&!this.eliteSpawned){this.eliteSpawned=true;this.addEnemy('elite',300);}
    if(this.autoChallenge&&this.farmClock>=FARM_RETRY&&this.canChallenge())this.startChallenge();
  }
  // A one-time crystal burst teaches collection without requiring a tutorial dialog.
  if(this.t>=8&&!this.welcome){this.welcome=true;for(let i=0;i<5;i++){const point=constrainToArena({x:p.x+Math.cos(i*1.25)*40,y:p.y+Math.sin(i*1.25)*40},8);this.gems.push({...point,value:1});}this.emit('crystal_burst');}
  const speed=1+(this.skills.haste||0)*.15,area=1+(this.skills.area||0)*.2;
  this.basicAttack(dt,speed*(1+.08*(this.skills.quickdraw||0)),area);
  this.tickSkills(dt*speed,area);
  this.drones(dt);
  if(this.slots.includes('fire')&&this.skills.fire){const count=this.evolved.inferno?6:1+this.skills.fire,sp=this.skillPower();for(let i=0;i<count;i++){const a=this.t*2.4+i*Math.PI*2/count,x=p.x+Math.cos(a)*85*area,y=p.y+Math.sin(a)*85*area;for(const e of this.enemies)if(e.hp>0&&Math.hypot(e.x-x,e.y-y)<e.r+18)this.hit(e,dt*(this.evolved.inferno?110:65)*sp,true);}}
  for(const z of this.zones){z.life-=dt;if(z.follow){z.x=p.x;z.y=p.y;}if(z.kind==='mine'){if(z.life>0&&this.within(z.trigger,z).length){z.life=0;this.blast(z.x,z.y,z.trigger,z.dmg,z.lv,'fire');}continue;}for(const e of this.within(z.r,z)){this.hit(e,z.dps*dt,true);if(z.slows)e.slow=Math.max(e.slow,.4);if(z.pull&&e.type!=='boss'){const d=Math.hypot(z.x-e.x,z.y-e.y)||1,step=Math.min(d,z.pull*dt);e.x+=(z.x-e.x)/d*step;e.y+=(z.y-e.y)/d*step;}}}
  this.zones=this.zones.filter(z=>z.life>0);
  for(const d of this.delayed){d.t-=dt;if(d.t<=0)d.fn();}this.delayed=this.delayed.filter(d=>d.t>0);
  for(const e of this.enemies){if(e.hp<=0)continue;e.flash=Math.max(0,e.flash-dt);e.slow=Math.max(0,e.slow-dt);Object.assign(e,constrainToArena(e,e.r));e.cd-=dt;const d=Math.hypot(p.x-e.x,p.y-e.y),a=Math.atan2(p.y-e.y,p.x-e.x);if(!e.warn&&((e.type!=='archer'&&e.type!=='spitter')||d>240)){e.x+=Math.cos(a)*e.speed*(e.slow>0?.35:1)*dt;e.y+=Math.sin(a)*e.speed*(e.slow>0?.35:1)*dt;}
  Object.assign(e,constrainToArena(e,e.r));
  if(d<e.r+16&&e.type!=='bomber')this.damage(e.type==='boss'?(e.rage?28:22):e.type==='brute'?14:9,e.type);
  if(e.type==='boss'&&!e.rage&&!e.mini&&e.hp<e.max*.5){e.rage=true;this.cue('roar');this.emit('boss_rage',{stage:this.stage});this.effects.push({kind:'slam',x:e.x,y:e.y,r:140,life:.6,max:.6});for(let i=0;i<2;i++){this.addEnemy('elite',150,i*Math.PI);const g=this.enemies[this.enemies.length-1];g.hp=g.max=g.max*.6;}}
  if(e.type==='boss'&&!e.mini&&!e.berserk&&this.t-(e.born??this.t)>=BERSERK_AT){e.berserk=e.rage=true;e.speed*=1.4;this.cue('roar');this.emit('boss_berserk',{stage:this.stage});this.effects.push({kind:'slam',x:e.x,y:e.y,r:180,life:.7,max:.7});}
  if(e.type==='spitter'&&e.cd<=0){e.cd=3.6;e.warn={x:p.x,y:p.y,t:.9,kind:'shot3'};}
  if(e.type==='brute'&&e.cd<=0&&d<220){e.cd=4.2;e.warn={x:p.x,y:p.y,t:1,kind:'slam',r:70,dmg:18};}
  if(e.type==='bomber'&&!e.warn&&d<62){e.warn={x:e.x,y:e.y,t:.65,kind:'boom',r:72,follow:true};}
  if(e.type==='archer'&&e.cd<=0){e.cd=3.3;e.warn={x:p.x,y:p.y,t:.8,kind:'shot'};}
  if(e.type==='boss'&&e.cd<=0&&!e.warn)this.bossAttack(e,p);
  if(e.type==='elite'&&e.cd<=0){e.cd=4;e.warn={x:p.x,y:p.y,t:1.1,kind:'slam',ox:e.x,oy:e.y};}
  if(e.warn){if(e.warn.follow){e.warn.x=e.x;e.warn.y=e.y;}e.warn.t-=dt;if(e.warn.t<=0){const w=e.warn;
  if(w.kind==='shot3'){const ang=Math.atan2(w.y-e.y,w.x-e.x);for(const k of [-.28,0,.28])this.shots.push({x:e.x,y:e.y,vx:Math.cos(ang+k)*160,vy:Math.sin(ang+k)*160,life:3,friendly:false});e.warn=null;continue;}
  if(w.kind==='boom'){this.cue('slam');this.effects.push({kind:'explosion',x:e.x,y:e.y,r:w.r,lv:2,style:'fire',life:.45,max:.45});if(Math.hypot(p.x-e.x,p.y-e.y)<w.r)this.damage(24,'bomber');e.warn=null;this.hit(e,e.hp+1);continue;}
  if(w.kind==='nova'){this.cue('roar');const n=e.rage?18:12;for(let i=0;i<n;i++){const a=i/n*Math.PI*2+this.t;this.shots.push({x:e.x,y:e.y-20,vx:Math.cos(a)*165,vy:Math.sin(a)*165,life:3.2,friendly:false,boss:true});}this.effects.push({kind:'slam',x:e.x,y:e.y,r:80,life:.4,max:.4});e.warn=null;continue;}
  if(w.kind==='meteor'){this.cue('slam');for(const q of w.pts){this.effects.push({kind:'explosion',x:q.x,y:q.y,r:w.r,lv:3,style:'fire',life:.5,max:.5});}if(w.pts.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<w.r))this.damage(e.rage?30:24,e.type);e.warn=null;continue;}
  if(w.kind==='summon'){this.cue('portal');for(let i=0;i<(e.rage?6:4);i++){this.addEnemy(this.eff()>=11&&i%2?'imp':'runner');const m=this.enemies[this.enemies.length-1],a=i/4*Math.PI*2;Object.assign(m,constrainToArena({x:e.x+Math.cos(a)*70,y:e.y+Math.sin(a)*50},m.r));}this.effects.push({kind:'gust',x:e.x,y:e.y,r:90,life:.5,max:.5});e.warn=null;continue;}
  if(w.kind==='shot'){const ang=Math.atan2(w.y-e.y,w.x-e.x);this.shots.push({x:e.x,y:e.y,vx:Math.cos(ang)*150,vy:Math.sin(ang)*150,life:3,friendly:false});}else if(w.kind==='dash'){// The warned segment is also the damage shape.
  const dx=w.x-w.ox,dy=w.y-w.oy,l=dx*dx+dy*dy,u=l?Math.max(0,Math.min(1,((p.x-w.ox)*dx+(p.y-w.oy)*dy)/l)):0;if(Math.hypot(p.x-w.ox-u*dx,p.y-w.oy-u*dy)<48)this.damage(28,e.type);e.x=w.x;e.y=w.y;this.cue('slam');this.effects.push({kind:'gust',x:e.x,y:e.y,r:65,life:.4,max:.4});}else{const R=w.r||95;this.cue('slam');this.effects.push({kind:'slam',x:w.x,y:w.y,r:R,life:.4,max:.4});if(Math.hypot(p.x-w.x,p.y-w.y)<R)this.damage(w.dmg||(e.rage?32:25),e.type);}e.warn=null;}}
  }
  for(const s of this.shots){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;if(s.friendly){for(const e of this.enemies){if(s.life<=0)break;if(e.hp>0&&!s.hit.has(e.id)&&Math.hypot(s.x-e.x,s.y-e.y)<e.r+(s.radius||10)){s.hit.add(e.id);this.hit(e,s.damage);if(s.slows)e.slow=1.6;if(s.blast)this.blast(s.x,s.y,s.blast,s.damage*.5);if(s.pierce!==undefined&&s.pierce--<=0)s.life=0;}}}else if(Math.hypot(s.x-p.x,s.y-p.y)<22){this.damage(12,'arrow');s.life=0;}}
  this.petStep(dt);this.magnetClock=Math.max(0,this.magnetClock-dt);this.shopClock=Math.max(0,this.shopClock-dt);this.buffs.xp=Math.max(0,this.buffs.xp-dt);this.buffs.gold=Math.max(0,this.buffs.gold-dt);
  this.potionClock=Math.max(0,this.potionClock-dt);if(this.p.hp>0&&this.p.hp<this.maxHp*this.potionAt)this.usePotion();
  for(const g of this.gems){const d=Math.hypot(p.x-g.x,p.y-g.y);if(g.pull&&d>=120){const step=Math.min(d,900*dt);g.x+=(p.x-g.x)/(d||1)*step;g.y+=(p.y-g.y)/(d||1)*step;}else if(d<120){const step=Math.min(d,Math.max(90,280-d)*dt);g.x+=(p.x-g.x)/(d||1)*step;g.y+=(p.y-g.y)/(d||1)*step;}if(d<20){const xp=g.value*(this.buffs.xp>0?2:1);this.xp+=xp;this.xpEarned+=xp;g.collected=true;this.cue('coin',{volume:g.gold?.8:.35});if(g.gold)this.effects.push({kind:'xpText',x:g.x,y:g.y-20,life:.9,max:.9,value:xp});}}
  for(const l of this.loot){const d=Math.hypot(p.x-l.x,p.y-l.y);if(d<90||l.pull){const step=Math.min(d,(l.pull?900:220)*dt);l.x+=(p.x-l.x)/(d||1)*step;l.y+=(p.y-l.y)/(d||1)*step;}if(d<24){l.collected=true;const {kind,tier,job}=l;this.addItem({kind,tier,job});this.cue('loot',TIERS[tier].id);this.emit('loot_pickup',{kind,tier,name:itemName(l)});this.equipBest();}}
  this.loot=this.loot.filter(l=>!l.collected);
  for(const g of this.coins){const d=Math.hypot(p.x-g.x,p.y-g.y);if(g.pull||d<120){const step=Math.min(d,(g.pull?900:Math.max(90,280-d))*dt);g.x+=(p.x-g.x)/(d||1)*step;g.y+=(p.y-g.y)/(d||1)*step;}if(d<20){const gold=Math.round(g.value*(this.buffs.gold>0?2:1)*(1+(this.pet()?.bonus||0)));this.gold+=gold;this.goldEarned+=gold;g.collected=true;}}
  this.coins=this.coins.filter(g=>!g.collected);if(this.coins.length>200)this.coins.splice(0,this.coins.length-200);
  this.gems=this.gems.filter(g=>!g.collected);this.enemies=this.enemies.filter(e=>e.hp>0&&(e.type==='boss'||Math.hypot(e.x-p.x,e.y-p.y)<1300));this.shots=this.shots.filter(s=>s.life>0);for(const f of this.effects)f.life-=dt;this.effects=this.effects.filter(f=>f.life>0).slice(-140);
  if(this.state==='playing')this.checkLevel();
}
}
