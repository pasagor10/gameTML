import {constrainToArena,enemySpawn} from './arena.js';
import {directionFor} from './sprite-layout.js';
import {TIERS,FORGE_POINTS,tierForForge} from './weapons.js';

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
export function evolutions(skills){return {inferno:skills.fire===3&&skills.area>=2,blizzard:skills.ice===3&&skills.haste>=2};}

const SPEED=145,ACCEL=28;
export const STAGE_TIMING=stage=>({elite:stage===1?100:70,boss:stage===1?240:180});

export class Run{
constructor(rng=Math.random,profile=null){
  this.rng=rng;this.job=normalizeJob(profile?.job);this.appearance=profile?.appearance==='b'?'b':'a';
  this.facing=1;this.direction='se';this.moving=false;this.motionDistance=0;this.vel={x:0,y:0};
  this.t=0;this.maxHp=100;this.boosts={might:0,vigor:0};this.p={x:0,y:0,hp:100,inv:0};this.enemies=[];this.gems=[];this.shots=[];this.effects=[];this.events=[];this.zones=[];this.delayed=[];
  this.skills={};this.level=1;this.xp=0;this.need=5;this.kills=0;this.state='playing';this.spawn=0;this.attack=0;this.swing=0;this.aim=0;this.skillClock=0;this.droneClock=0;this.nextId=0;this.offers=[];
  this.stage=1;this.stageStart=0;this.bossSpawned=false;this.eliteSpawned=false;this.bossesDefeated=0;
  this.forge=0;this.weaponTier=0;
  this.firstMoved=false;this.firstKill=false;this.evolved={};
  this.emit('run_start');for(let i=0;i<4;i++)this.addEnemy('slime',130+i*25,i*Math.PI/2);
}
emit(type,data={}){this.events.push({type,t:Math.round(this.t*100)/100,...data});}
power(){return (this.job==='novice'?1:TIERS[this.weaponTier].power)*(1+.1*this.boosts.might);}
// Skills scale with half the weapon's growth so the weapon stays the main upgrade.
skillPower(){const weapon=this.job==='novice'?1:TIERS[this.weaponTier].power;return (1+(weapon-1)*.5)*(1+.1*this.boosts.might);}
addEnemy(type,radius=430,angle=this.rng()*Math.PI*2){
  const boss=type==='boss',elite=type==='elite',scale=1+.7*(this.stage-1);
  const hp=boss?1500*(1+.9*(this.stage-1)):(elite?220:type==='runner'?22:type==='archer'?30:24+(this.t-this.stageStart)*.06)*scale;
  const bodyRadius=boss?42:elite?29:16;const point=enemySpawn(this.p,radius,angle,bodyRadius);
  this.enemies.push({id:this.nextId++,type,x:point.x,y:point.y,hp,max:hp,r:bodyRadius,speed:(boss?29:type==='runner'?76:elite?31:38)*(1+.05*(this.stage-1)),cd:boss?3:2+this.rng()*2,slow:0,flash:0});
}
choose(id){
  if(this.state!=='upgrade'||!this.offers.some(s=>s.id===id))return false;
  if(id==='might'||id==='vigor'){this.boosts[id]++;if(id==='vigor'){this.maxHp+=15;this.p.hp=this.maxHp;}this.emit('upgrade_chosen',{id,level:this.boosts[id]});this.state='playing';this.checkLevel();return true;}
  this.skills[id]=(this.skills[id]||0)+1;this.emit('upgrade_chosen',{id,level:this.skills[id]});
  const evo=evolutions(this.skills);for(const key of Object.keys(evo))if(evo[key]&&!this.evolved[key]){this.evolved[key]=true;this.emit('evolution_unlocked',{id:key});}
  this.state='playing';this.skillClock=10;this.checkLevel();return true;
}
awaken(job,appearance){
  if(this.state!=='awakening'||!CLASSES.some(c=>c.id===job)||!['a','b'].includes(appearance))return false;
  this.job=job;this.appearance=appearance;this.weaponTier=tierForForge(this.forge);
  this.emit('class_chosen',{job,appearance});this.effects.push({kind:'ascend',x:this.p.x,y:this.p.y,life:1.2,max:1.2});
  // The first pick after awakening shows the new class's own skills.
  const own=SKILLS.filter(s=>s.job===job);this.offers=own;this.state='upgrade';this.emit('upgrade_offered',{options:own.map(s=>s.id)});
  return true;
}
addForge(points,source){
  const before=this.weaponTier;this.forge+=points;this.weaponTier=tierForForge(this.forge);
  if(this.weaponTier>before&&this.job!=='novice'){this.emit('weapon_up',{tier:this.weaponTier,source});this.effects.push({kind:'ascend',x:this.p.x,y:this.p.y,life:1,max:1});}
}
offerUpgrade(){this.offers=choices(this.skills,this.rng,this.job);if(!this.offers.length){this.p.hp=Math.min(this.maxHp,this.p.hp+18);this.emit('upgrade_fallback');return;}this.state='upgrade';this.emit('upgrade_offered',{options:this.offers.map(s=>s.id)});}
checkLevel(){
  if(this.xp<this.need||this.state!=='playing')return;
  this.xp-=this.need;this.level++;this.need=5+Math.floor(this.level*1.4);
  if(this.level>10)this.addForge(FORGE_POINTS.level,'level');
  if(this.level>=10&&this.job==='novice'){this.state='awakening';this.emit('class_unlocked');return;}
  this.offerUpgrade();
}
hit(e,damage,continuous=false){
  if(e.hp<=0)return;e.hp-=damage;e.flash=.12;
  if(continuous&&e.damageText?.life>.12){e.damageText.value+=damage;}else{const text={kind:'number',x:e.x,y:e.y-e.r*2-12,life:continuous ? .4 : .6,max:continuous ? .4 : .6,value:damage};this.effects.push(text);if(continuous)e.damageText=text;}
  if(e.hp<=0){
    this.kills++;if(!this.firstKill){this.firstKill=true;this.emit('first_kill');}
    this.gems.push({x:e.x,y:e.y,value:e.type==='boss'?30:e.type==='elite'?12:1});
    if(e.type==='elite')this.addForge(FORGE_POINTS.elite,'elite');
    if(e.type==='boss')this.clearStage();
  }
}
// Defeating the guardian opens the next, harder stage instead of ending the run.
clearStage(){
  this.bossesDefeated++;this.emit('stage_clear',{stage:this.stage});
  this.stage++;this.stageStart=this.t;this.bossSpawned=false;this.eliteSpawned=false;this.spawn=2;
  this.p.hp=Math.min(this.maxHp,this.p.hp+35);this.addForge(FORGE_POINTS.boss,'boss');
  this.effects.push({kind:'ascend',x:this.p.x,y:this.p.y,life:1.4,max:1.4});
}
end(reason){if(this.state==='ended')return;this.state='ended';this.result=reason;this.emit('run_end',{reason,kills:this.kills,level:this.level,stage:this.stage,weaponTier:this.weaponTier,build:{...this.skills}});}
damage(n,source){
  if(this.p.inv>0||this.state!=='playing')return;n*=1+.25*(this.stage-1);
  this.p.hp=Math.max(0,this.p.hp-n);this.p.inv=.8;this.emit('damage_taken',{source,damage:n});this.effects.push({kind:'hurt',x:this.p.x,y:this.p.y,life:.25,max:.25});
  if(this.p.hp<=0)this.end(source==='boss'?'boss':'defeat');
}
alive(){return this.enemies.filter(e=>e.hp>0);}
nearest(range,from=this.p){let best=null,bestD=range;for(const e of this.enemies){if(e.hp<=0)continue;const d=Math.hypot(e.x-from.x,e.y-from.y);if(d<bestD){best=e;bestD=d;}}return best;}
within(r,from=this.p){return this.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-from.x,e.y-from.y)<r+e.r*.5);}
closestList(r,count){return this.within(r).sort((a,b)=>Math.hypot(a.x-this.p.x,a.y-this.p.y)-Math.hypot(b.x-this.p.x,b.y-this.p.y)).slice(0,count);}
later(t,fn){this.delayed.push({t,fn});}
blast(x,y,r,damage,lv=1,style='fire'){this.effects.push({kind:'explosion',x,y,r,lv,style,life:.4+.04*lv,max:.4+.04*lv});for(const e of this.within(r,{x,y}))this.hit(e,damage);}
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
    this.attack=(tier>=5?.21:.3)/speed;this.swing=.12;
    const a=Math.atan2(target.y-p.y,target.x-p.x),count=tier>=3?3:tier>=2?2:1,pierce=tier>=3?2:tier>=1?1:0;this.aim=a;
    for(let i=0;i<count;i++)this.fire(p.x,p.y-30,a+(i-(count-1)/2)*.12,620,{life:.6,physical:true,style:'bullet',tier,pierce,damage:(9+this.level*.8)*power,blast:tier>=4?55:0});
    this.effects.push({kind:'muzzle',x:p.x+Math.cos(a)*30,y:p.y-30+Math.sin(a)*30,a,tier,life:.08,max:.08});return;
  }
  if(job==='mage'){
    const r=150*area*(tier>=1?1.1:1)*(tier>=4?1.15:1),near=this.within(r);if(!near.length)return;
    this.attack=(tier>=5?.56:.75)/speed;this.swing=.2;const dmg=(16+this.level*1.4)*power;
    this.effects.push({kind:'arcane',x:p.x,y:p.y,r,tier,life:.35,max:.35});for(const e of near)this.hit(e,dmg);
    if(tier>=2)this.later(.35,()=>{this.effects.push({kind:'arcane',x:this.p.x,y:this.p.y,r:r*.8,tier,life:.3,max:.3});for(const e of this.within(r*.8))this.hit(e,dmg*.5);});
    if(tier>=3){let from=p;for(const e of this.closestList(320*area,3)){this.effects.push({kind:'lightning',x:from.x,y:from.y,tx:e.x,ty:e.y,life:.25,max:.25});this.hit(e,dmg*.6);from=e;}}
    return;
  }
  const knight=job==='knight',r=(knight?120:110)*area*(knight&&tier>=1?1.1:1);
  const target=this.nearest(knight&&tier>=2?320*area:r);if(!target)return;
  this.attack=(knight?(tier>=5?.45:.6):.65)/speed;this.swing=.2;
  const dmg=(18+this.level*1.5)*(knight?1.3:1)*power,a=Math.atan2(target.y-p.y,target.x-p.x);this.aim=a;
  this.effects.push({kind:'slash',x:p.x,y:p.y,r,tier:knight?tier:-1,life:.3,max:.3});for(const e of this.within(r))this.hit(e,dmg);
  if(knight&&tier>=4)this.later(.15,()=>{this.effects.push({kind:'slash',x:this.p.x,y:this.p.y,r,tier,life:.25,max:.25});for(const e of this.within(r))this.hit(e,dmg*.6);});
  if(knight&&tier>=2){const n=tier>=3?3:1;for(let i=0;i<n;i++)this.fire(p.x,p.y-20,a+(i-(n-1)/2)*.28,380,{life:.8,style:'crescent',tier,damage:dmg*.7,radius:24});}
}

castSkills(area){
  const p=this.p,s=this.skills,sp=this.skillPower();
  if(s.ice){const target=this.nearest(9999);if(target){const angle=Math.atan2(target.y-p.y,target.x-p.x),count=this.evolved.blizzard?5:s.ice;for(let i=0;i<count;i++)this.fire(p.x,p.y,angle+(i-(count-1)/2)*.18,340,{life:2,style:'ice',slows:true,damage:(this.evolved.blizzard?42:24)*sp});}}
  if(s.spark){let from=p;for(const e of this.closestList(300*area,2+s.spark)){this.effects.push({kind:'lightning',x:from.x,y:from.y,tx:e.x,ty:e.y,life:.3,max:.3});this.hit(e,(27+s.spark*9)*sp);from=e;}}
  if(s.gust){const r=160*area;this.effects.push({kind:'gust',x:p.x,y:p.y,r,life:.5,max:.5});for(const e of this.within(r)){this.hit(e,(18+s.gust*8)*sp);const a=Math.atan2(e.y-p.y,e.x-p.x);e.x+=Math.cos(a)*65;e.y+=Math.sin(a)*65;}}
  // Class skills grow to Lv.5: every level adds reach/count, and `lv` drives how grand the visual is.
  if(s.whirl){const lv=s.whirl;this.zones.push({kind:'whirl',lv,follow:true,x:p.x,y:p.y,r:(115+12*lv)*area,life:1+.1*lv,max:1+.1*lv,dps:(38+20*lv)*sp});}
  if(s.wave){const lv=s.wave,target=this.nearest(420+20*lv);if(target){const a=Math.atan2(target.y-p.y,target.x-p.x),n=lv+1;for(let i=0;i<n;i++)this.fire(p.x,p.y-20,a+(i-(n-1)/2)*.26,400+20*lv,{life:.9+.05*lv,style:'crescent',lv,tier:this.weaponTier,damage:(30+12*lv)*sp,radius:24+3*lv});}}
  if(s.judgement){const lv=s.judgement;for(const e of this.closestList(340*area,1+lv)){const x=e.x,y=e.y;this.effects.push({kind:'blade',lv,x,y,life:.5,max:.5});this.later(.35,()=>this.blast(x,y,(50+6*lv)*area,(60+25*lv)*sp,lv,'holy'));}}
  if(s.meteor){const lv=s.meteor,pool=this.within(380*area);for(let i=0;i<lv&&pool.length;i++){const e=pool[Math.floor(this.rng()*pool.length)],x=e.x,y=e.y,r=(80+8*lv)*area;this.effects.push({kind:'meteor',lv,x,y,r,life:.7,max:.7});this.later(.7,()=>this.blast(x,y,r,(70+30*lv)*sp,lv,'fire'));}}
  if(s.vortex){const lv=s.vortex,e=this.nearest(320+20*lv);if(e)this.zones.push({kind:'vortex',lv,x:e.x,y:e.y,r:(100+10*lv)*area,life:2.2+.2*lv,max:2.2+.2*lv,dps:(24+12*lv)*sp,pull:90+10*lv});}
  if(s.nova){const lv=s.nova,r=(190+20*lv)*area,dmg=(35+15*lv)*sp;this.effects.push({kind:'nova',lv,x:p.x,y:p.y,r,life:.6,max:.6});for(const e of this.within(r))this.hit(e,dmg);
    if(lv>=4)this.later(.3,()=>{this.effects.push({kind:'nova',lv,x:this.p.x,y:this.p.y,r:r*1.15,life:.6,max:.6});for(const e of this.within(r*1.15))this.hit(e,dmg*.6);});}
  if(s.scatter){const lv=s.scatter,e=this.nearest(300+15*lv);if(e){const a=Math.atan2(e.y-p.y,e.x-p.x),n=5+2*lv;for(let i=0;i<n;i++)this.fire(p.x,p.y-30,a+(i/(n-1)-.5)*.75,520,{life:.45+.03*lv,physical:true,style:'pellet',lv,tier:this.weaponTier,pierce:lv>=4?1:0,damage:(12+4*lv)*sp});this.effects.push({kind:'muzzle',lv,x:p.x+Math.cos(a)*30,y:p.y-30+Math.sin(a)*30,a,tier:this.weaponTier,life:.12,max:.12});}}
  if(s.grenade){const lv=s.grenade,r=(75+6*lv)*area,dmg=(45+20*lv)*sp;for(const e of this.closestList(340*area,lv)){const x=e.x,y=e.y;this.effects.push({kind:'lob',lv,x:p.x,y:p.y-30,tx:x,ty:y,life:.55,max:.55});this.later(.55,()=>{this.blast(x,y,r,dmg,lv,'fire');
    // Lv.5 cluster bomb: four bomblets scatter after the main blast.
    if(lv>=5)this.later(.25,()=>{for(let k=0;k<4;k++){const b=k*Math.PI/2+.4;this.blast(x+Math.cos(b)*r*.8,y+Math.sin(b)*r*.6,40,dmg*.35,3,'fire');}});});}}
}

drones(dt){
  const level=this.skills.drone;if(!level)return;
  this.droneClock-=dt;if(this.droneClock>0)return;this.droneClock=.65-.1*level;
  for(const d of this.dronePositions()){const e=this.nearest(320,d);if(!e)continue;const a=Math.atan2(e.y-d.y,e.x-d.x);this.fire(d.x,d.y,a,560+30*level,{life:.6,physical:true,style:'drone',lv:level,tier:this.weaponTier,pierce:level>=5?2:0,damage:(10+5*level)*this.skillPower()});}
}
dronePositions(){const lv=this.skills.drone||0,n=lv>=5?3:lv>=3?2:lv?1:0;return Array.from({length:n},(_,i)=>{const a=this.t*1.6+i*Math.PI*2/n;return {lv,x:this.p.x+Math.cos(a)*55,y:this.p.y-70+Math.sin(a)*18};});}

update(dt,input={x:0,y:0}){
  if(this.state!=='playing')return;dt=Math.min(.05,Math.max(0,dt));this.t+=dt;const p=this.p;
  this.move(dt,input);p.inv=Math.max(0,p.inv-dt);this.swing=Math.max(0,this.swing-dt);
  const st=this.t-this.stageStart,timing=STAGE_TIMING(this.stage),bossAlive=this.enemies.some(e=>e.type==='boss'&&e.hp>0);
  this.spawn-=dt;if(this.spawn<=0&&!bossAlive&&!this.bossSpawned){this.spawn=Math.max(.4-.04*(this.stage-1),1.7-st/190-.2*(this.stage-1));if(this.enemies.length<95){this.addEnemy(st>45&&this.rng()<.25?'archer':st>22&&this.rng()<.3?'runner':'slime');}}
  if(st>=timing.elite&&!this.eliteSpawned){this.eliteSpawned=true;this.addEnemy('elite',300);this.emit('elite_start');}
  if(st>=timing.boss&&!this.bossSpawned){this.bossSpawned=true;this.enemies=[];this.shots=this.shots.filter(s=>s.friendly);this.addEnemy('boss',270);this.emit('boss_start',{stage:this.stage});}
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
  const dx=w.x-w.ox,dy=w.y-w.oy,l=dx*dx+dy*dy,u=l?Math.max(0,Math.min(1,((p.x-w.ox)*dx+(p.y-w.oy)*dy)/l)):0;if(Math.hypot(p.x-w.ox-u*dx,p.y-w.oy-u*dy)<48)this.damage(28,e.type);e.x=w.x;e.y=w.y;this.effects.push({kind:'gust',x:e.x,y:e.y,r:65,life:.4,max:.4});}else{this.effects.push({kind:'slam',x:w.x,y:w.y,r:95,life:.4,max:.4});if(Math.hypot(p.x-w.x,p.y-w.y)<95)this.damage(25,e.type);}e.warn=null;}}
  }
  for(const s of this.shots){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;if(s.friendly){for(const e of this.enemies){if(s.life<=0)break;if(e.hp>0&&!s.hit.has(e.id)&&Math.hypot(s.x-e.x,s.y-e.y)<e.r+(s.radius||10)){s.hit.add(e.id);this.hit(e,s.damage);if(s.slows)e.slow=1.6;if(s.blast)this.blast(s.x,s.y,s.blast,s.damage*.5);if(s.pierce!==undefined&&s.pierce--<=0)s.life=0;}}}else if(Math.hypot(s.x-p.x,s.y-p.y)<22){this.damage(12,'arrow');s.life=0;}}
  for(const g of this.gems){const d=Math.hypot(p.x-g.x,p.y-g.y);if(d<120){const step=Math.min(d,Math.max(90,280-d)*dt);g.x+=(p.x-g.x)/(d||1)*step;g.y+=(p.y-g.y)/(d||1)*step;}if(d<20){this.xp+=g.value;g.collected=true;}}
  this.gems=this.gems.filter(g=>!g.collected);this.enemies=this.enemies.filter(e=>e.hp>0&&(e.type==='boss'||Math.hypot(e.x-p.x,e.y-p.y)<1300));this.shots=this.shots.filter(s=>s.life>0);for(const f of this.effects)f.life-=dt;this.effects=this.effects.filter(f=>f.life>0).slice(-140);
  if(this.state==='playing')this.checkLevel();
}
}
