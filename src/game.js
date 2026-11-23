import {openTopupPanel} from './topup-panel.js';
import {openGoldPacks} from './gold-packs.js';
import {mergeGoldGrants} from './gold-grants.js';
import {track} from './analytics.js';
import {mountSocial} from './social-ui.js';
import {PartyLink} from './party.js';
import {leaderboard,townRivals} from './rivals.js';
import {applyRestore,redeemRestore,RESTORE_ERRORS} from './restore.js';
import {createCharacterStore,CHARACTER_LIMIT} from './characters.js?v=novice1';
import {paintHeroPortrait,paintLobby} from './lobby-art.js';
import {createFrameMeter} from './perf/meter.js';
import {loadSceneArt,drawForest,drawSlime,sceneStatus} from './scene-art.js';
import {cameraPosition} from './arena.js';
import {cameraZoom} from './sprite-layout.js';
import {loadSprites,spriteStatus,prewarmJob} from './sprites.js';
import {Run,SKILLS,CLASSES,maxLevel,activeSlots,respecCost,SKILL_CD,randomHeroName,cleanHeroName,MAGNET_COOLDOWN,stageInfo,recommendedPower,WORLD_NAMES,WORLDS,STAGES_PER_WORLD,LAST_STAGE,FARM_RETRY,BERSERK_AT,MAGNET_LIMIT_FROM,MAGNET_GRANT} from './model.js';
import {SUPPLIES,BUFFS,ENHANCE_RATE,DROP_FROM,supplyPrice,refreshPrice} from './shop.js';
import {ARMOR,SLOTS,SLOT_NAMES,SLOT_ICONS,MAX_PLUS,itemName,itemStats,statText,canEquip,sellPrice,enhanceCost} from './loot.js';
import {drawItemIcon} from './item-art.js';
import {TIERS,REQ_LEVEL,TIER_PERKS,WEAPON_NAMES,weaponName,drawWeaponIcon,loadWeaponArt} from './weapons.js';
import {drawShot,drawZone,drawDrone,drawSkillEffect} from './skill-fx.js';
import {loadMonsters,drawMonster,skinFor,BOSS_NAMES} from './monsters.js';
import {sfx,music,setSound,setMusic,soundOn,unlockAudio,prepareMusic} from './sound.js';
import {skillArt} from './skill-art.js';
import {applyIcons,setIcon,iconSvg} from './ui-icons.js';
const coin=()=>`<span class="coin-i">${iconSvg('coin')}</span>`;
const ico=name=>`<span class="coin-i">${iconSvg(name)}</span>`;
import {drawHero,drawFire,drawEffect,glow,setArtStyle,artStyle} from './art.js';
import {drawToonMonster,drawToonArena,drawToonPet,themeFor} from './toon.js';
import {RAID_BOSS_NAME,RAID_TIME,raidOpen,raidOpensIn,raidClosesIn,raidWindow,raidGearChance} from './raid.js';
import {PETS,petDef,petStats,petPerks,MAX_PET_LV,PET_PRICE,EGG_RATES,eggPrice} from './pets.js';
// ?art=painted switches back to the generated sprites and painted forest (remembered per device).
{const asked=new URLSearchParams(location.search).get('art');let style=asked;try{if(asked)localStorage.setItem('tilmo-art',asked);else style=localStorage.getItem('tilmo-art');}catch{}setArtStyle(style||'toon');}
// Preserve existing progress when introducing character slots; never wipe legacy saves.
let characterStore;
try{characterStore=createCharacterStore(localStorage);}catch(error){
  const warning=document.createElement('p');warning.className='save-error';warning.textContent='เปิดเซฟตัวละครไม่ได้ กรุณาอนุญาตพื้นที่เก็บข้อมูลแล้วโหลดใหม่ · '+error.message;document.body.append(warning);throw error;
}
let profile=null;try{profile=JSON.parse(characterStore.getItem('tilmo-profile')||'null');}catch{}
const frameMeter=createFrameMeter();
let appearanceDraft='a';
// Camera is locked at 60%; the forest backdrop extends to fill any screen shape.
const cameraScale=.6;
let autoPlay=false;try{autoPlay=localStorage.getItem('tilmo-auto')==='1';}catch{}
let nameDraft='';
const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d',{alpha:false});let w=0,h=0,dpr=1,zoom=1,run=new Run(),started=false,last=0,seen=0,uiState='',keys=new Set(),pointer=null,move={x:0,y:0},toastUntil=0,saved=false,needsRender=true,lastHudAt=-1000;const renderEnemies=[];let history=[];try{history=JSON.parse(characterStore.getItem('tilmo-runs')||'[]');if(!Array.isArray(history))history=[];}catch{}
function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,2);const pixelWidth=Math.round(w*dpr),pixelHeight=Math.round(h*dpr);if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}needsRender=true;zoom=cameraZoom(w,h)*cameraScale;}addEventListener('resize',resize);resize();
function beep(name='click',arg){sfx(name,arg);}
function toast(text){$('toast').innerHTML=String(text).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]).replaceAll('🪙',coin());toastUntil=performance.now()+2400;}
function stageName(){const i=stageInfo(run.stage);return `${run.hard?'ยาก ':''}${i.label}`;}
function objectiveText(){if(run.mode==='raid')return `ศึกบอสโลก • ติด 1–5 ลุ้นของสีรุ้ง • โอกาสได้ของ ${Math.round(raidGearChance(run.raidBoard().length)*100)}% (ครบ 5 คนได้แน่นอน)`;if(run.job==='novice'&&run.level<10&&run.stage===1&&run.t<8)return 'เดินเข้าหาศัตรู • โจมตีอัตโนมัติ';const g=run.enemies.find(e=>e.guardian&&e.hp>0);if(g)return `โค่นผู้พิทักษ์ด่าน ${stageName()} • หลบวงเตือนสีแดง`;
  if(run.mode==='farm')return '';
  return '';}
function weaponHud(){const weapon=run.job==='novice'?'⚔ ดาบฝึกหัด':`${TIERS[run.weaponTier].label} · ${weaponName(run.job,run.weaponTier)}`,locked=run.lockedUpgrade();return `${weapon} | 🛡 ${ARMOR[run.armorTier].name}${locked?` · ${itemName(locked)} รอ Lv.${REQ_LEVEL[locked.tier]}`:''}`;}
function setScreen(name){needsRender=true;document.body.dataset.screen=name;$('overlay').dataset.screen=name;}
function start(){track('start');try{characterStore.removeItem(SAVE_KEY);}catch{}setScreen('playing');run=new Run(Math.random,profile);try{run.loadStash(JSON.parse(characterStore.getItem('tilmo-stash')||'null'));}catch{}mergeGoldGrants(run,characterStore.active,localStorage);seen=0;uiState='';saved=false;started=true;keys.clear();move={x:0,y:0};$('overlay').hidden=true;toast('เดินเข้าหาฝูง • ดาบจัดการให้เอง');beep();maybeOpenGoldPacks();}
const introMarkup=$('overlay').innerHTML;function resume(save){track('start');setScreen('playing');run=Run.restore(save.run);mergeGoldGrants(run,characterStore.active,localStorage);seen=run.events.length;uiState='';saved=false;started=true;keys.clear();move={x:0,y:0};$('overlay').hidden=true;beep();
  const away=save.auto?Math.min(MAX_BACKLOG,(Date.now()-save.at)/1000):0;
  if(save.auto&&autoPlay&&away>=1){run.holdPicks=true;awayFrom={kills:run.kills,level:run.level,stage:run.stage,xp:run.xpEarned,gold:run.goldEarned,t:run.t};addAwayTime(away);toast('กำลังเก็บผลฟาร์มขณะปิดเกม…');}else{toast(`เล่นต่อ · ด่าน ${run.stage} · Lv.${run.level}`);run.openPending();}maybeOpenGoldPacks();}
function escapeText(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function readCharacter(key,id,fallback=null){try{return JSON.parse(characterStore.getItem(key,id))??fallback;}catch{return fallback;}}
function bindIntro(){
 const save=loadSave();$('start').onclick=save?()=>resume(save):start;
 $('start').innerHTML=save?`เล่นต่อ · ด่าน ${save.run.stage} · Lv.${save.run.level} <span>↗</span>`:'เริ่มผจญภัย <span>↗</span>';
 const slots=characterStore.list(),root=$('characterSlots');root.innerHTML=slots.map((slot,i)=>{
 const saved=readCharacter('tilmo-save',slot.id)?.run,p=readCharacter('tilmo-profile',slot.id,{job:'novice',appearance:'a',name:'นักผจญภัย'}),hero=saved||p,job=CLASSES.find(c=>c.id===hero.job);
 return `<button class="hero-slot" data-character="${slot.id}" aria-pressed="${slot.id===characterStore.active}"><canvas width="160" height="160" aria-hidden="true"></canvas><span><small>ตัวละคร ${i+1} · ${job?.name||'ฝึกหัด'}</small><b>${escapeText(hero.name||'นักผจญภัย')}</b><em>${saved?`Lv.${saved.level} · ด่าน ${saved.stage}`:'พร้อมเริ่มที่ Lv.1'}</em></span><i>${slot.id===characterStore.active?'เลือกอยู่':'เลือก'}</i></button>`;
 }).join('');
 root.querySelectorAll('[data-character]').forEach(b=>{const id=b.dataset.character,p=readCharacter('tilmo-save',id)?.run||readCharacter('tilmo-profile',id,{});paintHeroPortrait(b.querySelector('canvas'),p);b.onclick=()=>{try{characterStore.select(id);loadCharacterProfile();bindIntro();}catch{toast('เปลี่ยนตัวละครไม่ได้ · พื้นที่เก็บข้อมูลไม่พร้อม');}};});
 $('createCharacter').disabled=slots.length>=CHARACTER_LIMIT;$('createCharacter').textContent=slots.length>=CHARACTER_LIMIT?'ครบ 6 ตัวละครแล้ว':'+ สร้างตัวละครใหม่';$('createCharacter').onclick=()=>renderCharacterCreation();
 $('selectedHero').textContent=profile?.name||save?.run?.name||'นักผจญภัย';
 if($('lobbyTopup'))$('lobbyTopup').onclick=showTopup; $('preview').onclick=()=>renderAwakening(true);$('armory').onclick=renderArmory;
 paintLobby($('lobbyArt'),save?.run||profile||{});
}
function loadCharacterProfile(){profile=readCharacter('tilmo-profile',characterStore.active);history=readCharacter('tilmo-runs',characterStore.active,[]);appearanceDraft=profile?.appearance||'a';nameDraft='';}
function showCharacterLobby(){
 if(saveRun()===false){toast('บันทึกไม่ได้ · กรุณาเพิ่มพื้นที่ว่างก่อนเปลี่ยนตัวละคร');return;}started=false;party.leave();social.update();keys.clear();clearInput();awaySummary='';backlog=0;backlogTotal=0;awaySince=0;awayFrom=null;extrapolate=0;run=new Run();uiState='';
 loadCharacterProfile();$('overlay').innerHTML=introMarkup;$('overlay').hidden=false;setScreen('intro');bindIntro();
}
function renderCharacterCreation(draft={appearance:'a',name:''}){
 setScreen('characters');const overlay=$('overlay');overlay.innerHTML=`<div class="panel character-create"><div class="eyebrow">A NEW ADVENTURE</div><h2>สร้างผู้กล้าคนใหม่</h2><p>เริ่ม Lv.1 · เงิน อุปกรณ์ สัตว์เลี้ยง และความคืบหน้าแยกจากตัวเดิม</p><label class="name-field">ชื่อตัวละคร<input id="newHeroName" maxlength="12" placeholder="ตั้งชื่อผู้กล้า" value="${escapeText(draft.name)}"></label><div class="appearance-picker"><button data-sex="a" aria-pressed="${draft.appearance==='a'}">ชาย</button><button data-sex="b" aria-pressed="${draft.appearance==='b'}">หญิง</button></div><div class="new-hero-preview"><canvas id="newHeroPreview" width="180" height="180" aria-label="ตัวอย่างตัวละครฝึกหัด"></canvas><p>เริ่มเป็นนักผจญภัยฝึกหัด<br><small>ถึง Lv.10 แล้วเลือกนักดาบ นักเวท หรือมือปืน</small></p></div><p id="createError" role="alert"></p><div class="create-actions"><button id="cancelCharacter" class="secondary">กลับ</button><button id="confirmCharacter" class="primary">สร้างตัวละคร</button></div><small>เก็บได้สูงสุด 6 ตัวละครในเบราว์เซอร์นี้</small></div>`;
 paintHeroPortrait($('newHeroPreview'),{appearance:draft.appearance,job:'novice'});
 overlay.querySelectorAll('[data-sex]').forEach(b=>b.onclick=()=>renderCharacterCreation({...draft,name:$('newHeroName').value,appearance:b.dataset.sex}));
 $('cancelCharacter').onclick=()=>{$('overlay').innerHTML=introMarkup;setScreen('intro');bindIntro();};
 $('confirmCharacter').onclick=()=>{try{const name=cleanHeroName($('newHeroName').value);if(!name){$('createError').textContent='กรุณาตั้งชื่อตัวละครก่อน';$('newHeroName').focus();return;}characterStore.create({appearance:draft.appearance,name});track('character');loadCharacterProfile();$('overlay').innerHTML=introMarkup;setScreen('intro');bindIntro();}catch(error){$('createError').textContent='สร้างไม่สำเร็จ · '+error.message;}};
}
function renderArmory(){setScreen('armory');const overlay=$('overlay');overlay.innerHTML=`<div class="panel armory"><div class="eyebrow">CLASS WEAPON COLLECTION</div><h2>อาวุธประจำอาชีพ</h2><p class="awakening-note">อาวุธและชุดดรอปจากมอนสเตอร์ · Elite ดรอปแน่ · บอสดรอปของดีกว่า · ต้องถึงเลเวลที่กำหนดจึงสวมใส่ได้</p><div class="armory-rows">${CLASSES.map(c=>`<section class="armory-row"><header><b>${c.icon} ${c.name}</b><small>${c.en}</small></header><div class="armory-tiers">${TIERS.map((t,i)=>`<figure class="tier-${t.id}"><canvas width="72" height="72" data-job="${c.id}" data-tier="${i}" aria-label="${WEAPON_NAMES[c.id][i]}"></canvas><figcaption><b>${WEAPON_NAMES[c.id][i]}</b><span style="color:${t.color}">${t.label} · ใส่ได้ Lv.${REQ_LEVEL[i]}</span><small>${TIER_PERKS[c.id][i]}</small></figcaption></figure>`).join('')}</div></section>`).join('')}</div><button id="backIntro" class="primary">กลับ ↗</button></div>`;overlay.querySelectorAll('canvas[data-job]').forEach(cv=>drawWeaponIcon(cv.getContext('2d'),cv.dataset.job,Number(cv.dataset.tier),1.2,72));$('backIntro').onclick=()=>{$('overlay').innerHTML=introMarkup;setScreen('intro');bindIntro();};}
// ---- Bag: gold, four gear slots and the item grid. The game waits while it is open.
let bagFilter='all',bagPick=null,sellMode=false,sellPick=new Set(),useLuck=false,useGuard=true;
function openBag(){if(!started||run.state!=='playing')return;run.state='inventory';uiState='';beep('open');}
function closeBag(){if(run.state!=='inventory')return;run.state='playing';uiState='';bagPick=null;sellMode=false;sellPick.clear();}
function itemIcon(item,size=56){const cv=document.createElement('canvas');cv.width=cv.height=size*2;drawItemIcon(cv.getContext('2d'),item,size*2);return cv;}
// Each stat a piece can give, for the detail card and the ▲▼ comparison with what is worn.
const STAT_ROWS=[['power','พลังอาวุธ',v=>`×${v.toFixed(2)}`],['hp','HP',v=>`+${Math.round(v)}`],['guard','ลดดาเมจ',v=>`${Math.round(v*100)}%`],['dmg','ดาเมจ',v=>`+${Math.round(v*100)}%`]];
function statRows(item,against){const a=itemStats(item),b=against?itemStats(against):null;return STAT_ROWS.filter(([k])=>a[k]!==undefined||b?.[k]!==undefined).map(([k,label,fmt])=>{const v=a[k]||0,d=b?v-(b[k]||0):0,delta=b&&Math.abs(d)>1e-6?`<em class="${d>0?'up':'down'}">${d>0?'▲':'▼'} ${k==='power'?Math.abs(d).toFixed(2):k==='hp'?Math.round(Math.abs(d)):Math.round(Math.abs(d)*100)+'%'}</em>`:'';return `<li><span>${label}</span><b>${fmt(v)}</b>${delta}</li>`;}).join('');}
// Character screen: hero in the middle with the four gear slots around, totals underneath,
// and the bag as an icon grid with a detail card for the picked piece.
function renderBag(){
  const overlay=$('overlay'),worn=new Set(Object.values(run.equipped)),items=run.bag.filter(i=>(bagFilter==='all'||i.kind===bagFilter)&&!worn.has(i.id));
  if(bagPick&&!run.bag.some(i=>i.id===bagPick))bagPick=null;const pick=run.bag.find(i=>i.id===bagPick);
  const slot=k=>{const it=run.gearItem(k);return `<button class="eq-slot eq-${k} ${it?'filled':''}" data-slot="${k}" aria-pressed="${!!it&&it.id===bagPick}" style="${it?`--rar:${TIERS[it.tier].color}`:''}" aria-label="${SLOT_NAMES[k]}${it?` · ${itemName(it)}`:''}">${it?'':`<span class="eq-ghost">${SLOT_ICONS[k]}</span>`}<small>${SLOT_NAMES[k]}${it?.plus?` <b class="eq-plus${it.plus>=7?' hi':''}">+${it.plus}</b>`:''}</small></button>`;};
  const job=CLASSES.find(c=>c.id===run.job);
  const totals=`<ul class="char-stats"><li><span>⚔ พลังโจมตี</span><b>${Math.round(run.power()*100)}</b></li><li><span>♥ HP สูงสุด</span><b>${Math.round(run.maxHp)}</b></li><li><span>⛨ ลดดาเมจ</span><b>${Math.round(run.guard*100)}%</b></li><li><span>◍ ดาเมจเพิ่ม</span><b>+${Math.round(run.ringBonus*100)}%</b></li></ul>`;
  let detail;
  for(const id of [...sellPick])if(!run.bag.some(i=>i.id===id)||worn.has(id))sellPick.delete(id);
  if(sellMode){const chosen=run.bag.filter(i=>sellPick.has(i.id)),total=chosen.reduce((a,i)=>a+sellPrice(i),0),rare=chosen.filter(i=>i.tier>=3).length;
    detail=`<div class="item-card sell-card"><div class="forge-line"><span>เลือกขาย <b>${chosen.length}</b> ชิ้น</span><b class="gold-txt">${coin()} ${total.toLocaleString()}</b></div>${rare?`<small class="warn">⚠ มีของระดับ ${TIERS[3].label} ขึ้นไป ${rare} ชิ้น</small>`:'<small>แตะของในกระเป๋าเพื่อเลือก / ยกเลิก</small>'}<div class="row sell-quick"><button data-pick="junk" title="อาวุธอาชีพอื่นและของที่ไม่ดีกว่าที่ใส่อยู่">เลือกของด้อย</button><button data-pick="page">เลือกทั้งหน้า</button><button data-pick="none">ล้าง</button></div><div class="row"><button class="gold-btn" id="sellMany" ${chosen.length?'':'disabled'}>ขาย ${chosen.length} ชิ้น ${coin()}${total.toLocaleString()}</button><button id="sellDone">เสร็จ</button></div></div>`;}
  else if(!pick)detail=`<div class="item-card empty"><p>แตะช่องอุปกรณ์หรือของในกระเป๋า</p><small>ของที่ใส่อยู่ → ตีบวก / ถอด<br>ของในกระเป๋า → ใส่ / ขาย พร้อมเทียบค่าพลัง</small></div>`;
  else{const isWorn=worn.has(pick.id),cur=run.gearItem(pick.kind),ok=canEquip(pick,run.level,run.job),t=TIERS[pick.tier];
    const why=!ok?(pick.kind==='weapon'&&pick.job!==run.job?'ไม่ใช่อาวุธของอาชีพนี้':`ต้องถึง Lv.${REQ_LEVEL[pick.tier]}`):'';
    let actions;
    if(isWorn){const cost=enhanceCost(pick),maxed=pick.plus>=MAX_PLUS,chance=Math.round(run.enhanceChance(pick.kind,useLuck)*100),risky=!maxed&&pick.plus>=DROP_FROM;
      actions=maxed?`<p class="good">ตีบวกถึงขั้นสูงสุดแล้ว</p><div class="row"><button data-unequip="${pick.kind}">ถอด</button></div>`:`<div class="forge"><div class="forge-line"><span>ตีบวก +${pick.plus} → +${pick.plus+1}</span><b class="${chance<100?'warn':'good'}">${chance}%</b></div>${risky?`<small class="${useGuard&&run.supplies.guard?'good':'warn'}">${useGuard&&run.supplies.guard?`${ico('guard')} หินคุ้มครองกันลดขั้น`:'⚠ ถ้าพลาดจะลดขั้น'}</small>`:''}<label><input type="checkbox" id="useLuck" ${useLuck?'checked':''} ${run.supplies.luck?'':'disabled'}> ${ico('luck')} หินนำโชค +25% (มี ${run.supplies.luck})</label><label><input type="checkbox" id="useGuard" ${useGuard?'checked':''} ${run.supplies.guard?'':'disabled'}> ${ico('guard')} หินคุ้มครอง (มี ${run.supplies.guard})</label></div><div class="row"><button class="gold-btn" data-enhance="${pick.kind}" ${run.gold<cost?'disabled':''}>ตีบวก ${coin()}${cost.toLocaleString()}</button><button data-unequip="${pick.kind}">ถอด</button></div>`;}
    else actions=`${why?`<p class="warn">${why}</p>`:''}<div class="row"><button class="primary-btn" data-equip="${pick.id}" ${ok?'':'disabled'}>${cur?'เปลี่ยนใส่':'ใส่'}</button><button class="gold-btn" data-sell="${pick.id}">ขาย ${coin()}${sellPrice(pick).toLocaleString()}</button></div>`;
    detail=`<div class="item-card" style="--rar:${t.color}"><div class="item-card-head"><span class="item-card-icon" data-icon="${pick.id}"></span><div><b>${itemName(pick)}</b><small>${t.label} · ${SLOT_NAMES[pick.kind]} · Lv.${REQ_LEVEL[pick.tier]}${isWorn?' · <span class="good">ใส่อยู่</span>':''}</small></div></div><ul class="item-stats">${statRows(pick,!isWorn&&cur?cur:null)}</ul>${!isWorn&&cur?`<small class="vs">เทียบกับ ${itemName(cur)}</small>`:''}${actions}</div>`;}
  overlay.innerHTML=`<div class="panel char-panel"><header class="char-head"><h2>ตัวละคร</h2><span class="bag-gold">${coin()} ${run.gold.toLocaleString()}</span><button class="close-x" id="closeBag" aria-label="ปิด">✕</button></header>
  <div class="char-body"><section class="char-left"><div class="char-name"><b>${run.name}</b><small>${job?`${job.icon} ${job.name}`:'นักผจญภัยฝึกหัด'} · Lv.${run.level}</small></div>
  <div class="paperdoll">${slot('helmet')}${slot('weapon')}<canvas class="doll" width="240" height="300" aria-hidden="true"></canvas>${slot('armor')}${slot('ring')}</div>${totals}${potionSetting()}</section>
  <section class="char-right"><div class="bag-tabs">${[['all','ทั้งหมด'],...SLOTS.map(k=>[k,SLOT_NAMES[k]])].map(([k,l])=>`<button data-filter="${k}" aria-pressed="${bagFilter===k}">${l}</button>`).join('')}<small class="bag-count">${run.bag.length}/60</small><button class="sell-toggle" id="sellMode" aria-pressed="${sellMode}">${sellMode?'✓ กำลังเลือกขาย':`${coin()} ขายหลายชิ้น`}</button></div>
  <div class="inv-grid">${items.map(i=>`<button class="inv-cell ${canEquip(i,run.level,run.job)?'':'locked'} ${sellMode&&sellPick.has(i.id)?'picked':''}" data-item="${i.id}" aria-pressed="${sellMode?sellPick.has(i.id):i.id===bagPick}" aria-label="${itemName(i)}">${run.gearItem(i.kind)&&canEquip(i,run.level,run.job)&&i.tier*100+i.plus>run.gearItem(i.kind).tier*100+run.gearItem(i.kind).plus?'<span class="better">▲</span>':''}</button>`).join('')}${Array.from({length:Math.max(0,24-items.length)},()=>'<span class="inv-cell blank"></span>').join('')}</div>
  ${detail}</section></div></div>`;
  bindPotionSetting(overlay);
  const doll=overlay.querySelector('.doll').getContext('2d');doll.translate(120,268);doll.scale(1.65,1.65);drawHero(doll,0,0,{job:run.job,appearance:run.appearance,tier:run.weaponTier,plus:run.weaponPlus,armor:run.armorLook??-1,helmet:run.helmetTier??-1,time:1.2,direction:'se'});
  overlay.querySelectorAll('[data-slot]').forEach(b=>{const it=run.gearItem(b.dataset.slot);if(it)b.prepend(itemIcon(it,40));b.onclick=()=>{bagPick=it?it.id:null;if(!it){bagFilter=b.dataset.slot;}renderBag();};});
  overlay.querySelectorAll('[data-item]').forEach(b=>{b.prepend(itemIcon(run.bag.find(i=>i.id===Number(b.dataset.item)),36));b.onclick=()=>{const id=Number(b.dataset.item);if(sellMode){if(sellPick.has(id))sellPick.delete(id);else sellPick.add(id);}else bagPick=id;renderBag();};});
  $('sellMode').onclick=()=>{sellMode=!sellMode;sellPick.clear();bagPick=null;renderBag();};
  if(sellMode){overlay.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const k=b.dataset.pick;if(k==='none')sellPick.clear();else for(const id of k==='junk'?run.junkIds().filter(id=>items.some(i=>i.id===id)):items.map(i=>i.id))sellPick.add(id);renderBag();});
    $('sellMany').onclick=()=>{const n=sellPick.size,price=run.sellItems([...sellPick]);if(price){flushCues();toast(`ขาย ${n} ชิ้น ได้ 🪙${price.toLocaleString()}`);}sellPick.clear();renderBag();};$('sellDone').onclick=()=>{sellMode=false;sellPick.clear();renderBag();};}
  overlay.querySelectorAll('[data-icon]').forEach(el=>el.append(itemIcon(pick,32)));
  overlay.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{bagFilter=b.dataset.filter;renderBag();});
  overlay.querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>{if(run.equipItem(Number(b.dataset.equip))){flushCues();toast(`ใส่ ${itemName(pick)} แล้ว`);}renderBag();});
  overlay.querySelectorAll('[data-sell]').forEach(b=>b.onclick=()=>{const price=run.sellItem(Number(b.dataset.sell));if(price){flushCues();toast(`ขายได้ 🪙${price}`);bagPick=null;}renderBag();});
  overlay.querySelectorAll('[data-enhance]').forEach(b=>b.onclick=()=>{const slot=b.dataset.enhance,result=run.enhance(slot,{luck:useLuck,guard:useGuard});flushCues();const name=itemName(run.gearItem(slot));if(result==='success')toast(`ตีบวกสำเร็จ! ${name}`);else if(result==='drop')toast(`ตีบวกล้มเหลว… ลดขั้นเป็น ${name}`);else if(result==='fail')toast(`ตีบวกล้มเหลว · ${name} ยังอยู่ขั้นเดิม`);renderBag();});
  if($('useLuck'))$('useLuck').onchange=e=>{useLuck=e.target.checked;renderBag();};if($('useGuard'))$('useGuard').onchange=e=>{useGuard=e.target.checked;renderBag();};
  overlay.querySelectorAll('[data-unequip]').forEach(b=>b.onclick=()=>{run.unequip(b.dataset.unequip);bagPick=null;renderBag();});
  $('closeBag').onclick=closeBag;
}
// ---- Town shop: class gear, potions/buffs and enhancement stones for gold. The field waits while it is open.
let shopTab='gear',lastEggs=null;
// A speckled egg for the hatch card.
function drawEgg(c,S,t){const g=c.createLinearGradient(0,0,S,S);g.addColorStop(0,'#fff4e0');g.addColorStop(1,'#ffc0e8');c.save();c.translate(S/2,S*.56);
  const glow=c.createRadialGradient(0,0,0,0,0,S*.5);glow.addColorStop(0,'#ffe39a88');glow.addColorStop(1,'#ffe39a00');c.fillStyle=glow;c.fillRect(-S/2,-S*.56,S,S);
  c.beginPath();c.ellipse(0,0,S*.26,S*.33,0,0,Math.PI*2);c.fillStyle=g;c.fill();c.lineWidth=S*.03;c.strokeStyle='#1e1a2e';c.stroke();
  for(const [x,y,r,col] of [[-.1,-.12,.05,'#8a5aff'],[.1,.02,.06,'#4fb6ff'],[-.06,.16,.045,'#ff8ae0'],[.12,-.2,.035,'#ffb52e']]){c.beginPath();c.arc(x*S,y*S,r*S,0,7);c.fillStyle=col;c.fill();}
  c.beginPath();c.ellipse(-S*.09,-S*.17,S*.05,S*.08,-.5,0,7);c.fillStyle='#ffffffaa';c.fill();c.restore();}
function openShop(){if(!started||run.state!=='playing')return;run.ensureShop();run.state='shop';uiState='';beep('open');}
function closeShop(){if(run.state!=='shop')return;run.state='playing';uiState='';}
function buffLeft(sec){return sec>0?`${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`:'';}
// Auto-potion threshold slider (character screen).
const potionNote=pct=>pct?`ดื่มเองเมื่อ HP ต่ำกว่า ${pct}% · มียา ${run.supplies.potion} ขวด`:'ปิดอยู่ · ดื่มเองด้วยปุ่มยาหรือกด Q';
function potionSetting(){const pct=Math.round(run.potionAt*100);return `<div class="potion-setting"><span class="ps-ico">${iconSvg('potion')}</span><div class="ps-text"><b>ดื่มยาอัตโนมัติ</b><small id="potionAtNote">${potionNote(pct)}</small></div><input type="range" id="potionAt" min="0" max="90" step="5" value="${pct}" aria-label="ดื่มยาอัตโนมัติเมื่อ HP ต่ำกว่า"><output id="potionAtVal">${pct?pct+'%':'ปิด'}</output></div>`;}
function bindPotionSetting(root){const pa=root.querySelector('#potionAt');if(!pa)return;pa.oninput=()=>{const pct=Math.round(run.setPotionAt(pa.value/100)*100);root.querySelector('#potionAtVal').textContent=pct?pct+'%':'ปิด';root.querySelector('#potionAtNote').textContent=potionNote(pct);saveRun();};}
function renderShop(){
  const overlay=$('overlay'),stock=run.ensureShop(),refresh=refreshPrice(run.stage),free=Math.ceil(run.shopClock/60);
  const card=(icon,title,desc,price,attr,extra='',disabled=false)=>`<article class="shop-card"><div class="shop-icon">${iconSvg(icon)}</div><div class="shop-text"><b>${title}</b><small>${desc}</small>${extra}</div><button class="gold-btn" ${attr} ${disabled||run.gold<price?'disabled':''}>${coin()}${price.toLocaleString()}</button></article>`;
  let body='';
  if(shopTab==='gear'){body=`<div class="shop-grid">${stock.map((o,i)=>{const cur=run.gearItem(o.kind),better=!cur||o.tier>cur.tier,lock=run.level<REQ_LEVEL[o.tier];return `<article class="shop-card ${o.sold?'sold':''}"><div class="shop-icon" data-gear="${i}" style="border-color:${TIERS[o.tier].color}"></div><div class="shop-text"><b style="color:${TIERS[o.tier].color}">${itemName(o)}</b><small>${TIERS[o.tier].label} · ${SLOT_NAMES[o.kind]} · ${statText(o)}</small><small class="${lock?'warn':better?'good':''}">${o.sold?'ขายแล้ว':lock?`ใส่ได้ Lv.${REQ_LEVEL[o.tier]}`:better?'▲ ดีกว่าที่ใส่อยู่':cur?`ที่ใส่อยู่: ${itemName(cur)}`:''}</small></div><button class="gold-btn" data-buy="${i}" ${o.sold||run.gold<o.price||run.bag.length>=60?'disabled':''}>${o.sold?'—':`${coin()}${o.price.toLocaleString()}`}</button></article>`;}).join('')}</div><div class="shop-foot"><small>สินค้าใหม่ฟรีในอีก ${free} นาที (เวลาในสนาม)</small><button class="secondary" id="reroll" ${run.gold<refresh?'disabled':''}>สุ่มสินค้าใหม่ ${coin()}${refresh}</button></div>`;}
  else if(shopTab==='potion'){body=`<div class="shop-grid">${card(SUPPLIES.potion.ico,`${SUPPLIES.potion.name} · มี ${run.supplies.potion}`,SUPPLIES.potion.desc,supplyPrice('potion',run.stage),'data-supply="potion"')}${card(SUPPLIES.potion.ico,`${SUPPLIES.potion.name} 5 ขวด`,'ซื้อทีละ 5 ขวด',supplyPrice('potion',run.stage)*5,'data-supply="potion" data-count="5"')}${Object.entries(BUFFS).map(([id,b])=>card(b.ico,b.name,b.desc,supplyPrice(id,run.stage),`data-supply="${id}"`,run.buffs[id]>0?`<small class="good">ทำงานอยู่ · เหลือ ${buffLeft(run.buffs[id])} (ซื้อเพิ่มต่อเวลา)</small>`:'')).join('')}</div>`;}
  else if(shopTab==='pet'){const cur=run.pet(),egg=eggPrice(run.stage);
    const reveal=lastEggs?`<div class="egg-reveal">${lastEggs.map(o=>`<div class="egg-hit" style="--rar:${TIERS[o.tier].color}"><canvas width="96" height="80" data-petart="${o.id}"></canvas><small>${o.fresh?'<b class="good">ใหม่!</b>':`ซ้ำ +${coin()}${o.refund.toLocaleString()}`}</small></div>`).join('')}</div>`:'';
    body=`${reveal}<div class="pet-grid">${PETS.map(p=>{const own=run.pets.includes(p.id),on=run.petId===p.id&&own;return `<button class="pet-tile ${own?'':'locked'} ${on?'on':''}" data-pet="${p.id}" ${own?'':'disabled'} style="--rar:${TIERS[p.tier].color}"><canvas width="120" height="90" data-petart="${p.id}" ${own?'':'data-shadow="1"'}></canvas><b>${own?p.name:'???'}</b><small>${TIERS[p.tier].label}${own?` · Lv.${run.petLevel(p.id)}`:''}</small>${on?'<em>ออกเก็บอยู่</em>':''}</button>`;}).join('')}</div>
    <p class="shop-note">${cur?`${ico('magnet')} <b>${cur.name}</b> · ${petPerks(cur)} · แตะตัวอื่นเพื่อเปลี่ยน`:'ยังไม่มีสัตว์เลี้ยง · สัตว์เลี้ยงจะวิ่งไปเก็บ EXP และเงินที่อยู่ไกลมาให้'}</p>
    <div class="shop-grid">${run.pets.includes('chick')?'':`<article class="shop-card"><div class="shop-icon"><canvas width="88" height="88" data-petart="chick"></canvas></div><div class="shop-text"><b>${PETS[0].name}</b><small>${TIERS[0].label} · ${petPerks(PETS[0])}</small><small>วิ่งช้า แต่ช่วยเก็บของได้ทันที</small></div><button class="gold-btn" data-buypet ${run.gold<PET_PRICE?'disabled':''}>${coin()}${PET_PRICE.toLocaleString()}</button></article>`}
    <article class="shop-card egg-card"><div class="shop-icon"><canvas width="88" height="88" data-egg></canvas></div><div class="shop-text"><b>ไข่สัตว์เลี้ยงปริศนา</b><small>สุ่มได้ Common ถึง Mythic · ตัวซ้ำได้เงินคืน</small><small class="good">การันตี Legendary ขึ้นไปในอีก ${run.petsLeftToPity()} ไข่</small></div><div class="egg-btns">${run.supplies.egg?`<button class="primary-btn" data-free-n="${Math.min(10,run.supplies.egg)}">ฟักฟรี ×${Math.min(10,run.supplies.egg)} (มี ${run.supplies.egg})</button>`:''}<button class="gold-btn" data-egg-n="1" ${run.gold<egg?'disabled':''}>×1 ${coin()}${egg.toLocaleString()}</button><button class="gold-btn" data-egg-n="10" ${run.gold<egg*10?'disabled':''}>×10 ${coin()}${(egg*10).toLocaleString()}</button></div></article></div>
    <p class="shop-note">อัตรา: ${EGG_RATES.map((r,i)=>`<span style="color:${TIERS[i].color}">${TIERS[i].label} ${+(r*100).toFixed(1)}%</span>`).join(' · ')}</p>`;}
  else{body=`<div class="shop-grid">${['luck','guard'].map(id=>card(SUPPLIES[id].ico,`${SUPPLIES[id].name} · มี ${run.supplies[id]}`,SUPPLIES[id].desc,supplyPrice(id,run.stage),`data-supply="${id}"`)).join('')}</div><p class="shop-note">โอกาสตีบวก: +1 ถึง +3 สำเร็จเสมอ · +4 ${ENHANCE_RATE[3]*100}% · +6 ${ENHANCE_RATE[5]*100}% · +8 ${ENHANCE_RATE[7]*100}% · +10 ${ENHANCE_RATE[9]*100}%<br>ตั้งแต่ +${DROP_FROM} ขึ้นไป ถ้าพลาดจะลดขั้น 1 ขั้น · ตีบวกได้ที่หน้ากระเป๋า</p>`;}
  overlay.innerHTML=`<div class="panel shop-panel"><canvas class="town-banner" width="920" height="150" aria-hidden="true"></canvas><div class="bag-head"><h2>ร้านค้าในเมือง</h2><span class="bag-gold">${coin()} ${run.gold.toLocaleString()}</span><small class="supply-count">${ico('potion')} ${run.supplies.potion} · ${ico('luck')} ${run.supplies.luck} · ${ico('guard')} ${run.supplies.guard}</small></div><div class="bag-tabs">${[['gear','อุปกรณ์'],['potion','ยาและบัฟ'],['stone','หินตีบวก'],['pet','สัตว์เลี้ยง']].map(([k,l])=>`<button data-tab="${k}" aria-pressed="${shopTab===k}">${l}</button>`).join('')}</div>${body}<div class="row shop-actions"><button class="secondary" id="shopBag">ตัวละคร / กระเป๋า</button><button class="primary" id="closeShop">ออกจากเมือง ↗</button></div></div>`;
  drawTownBanner(overlay.querySelector('.town-banner'));
  overlay.querySelectorAll('[data-gear]').forEach(el=>el.append(itemIcon(stock[Number(el.dataset.gear)],44)));
  overlay.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{shopTab=b.dataset.tab;lastEggs=null;renderShop();});
  petArt(overlay);
  overlay.querySelectorAll('canvas[data-egg]').forEach(cv=>drawEgg(cv.getContext('2d'),cv.width,run.t));
  overlay.querySelectorAll('[data-pet]').forEach(b=>b.onclick=()=>{if(run.setPet(b.dataset.pet)){toast(`${petDef(b.dataset.pet).name} ออกไปเก็บของแล้ว`);beep();}renderShop();});
  overlay.querySelectorAll('[data-buypet]').forEach(b=>b.onclick=()=>{if(run.buyPet()){flushCues();toast(`ได้${PETS[0].name}แล้ว! มันจะวิ่งไปเก็บของให้`);}renderShop();});
  overlay.querySelectorAll('[data-free-n]').forEach(b=>b.onclick=()=>{const out=run.hatchEggs(Number(b.dataset.freeN),{free:true});if(out){flushCues();lastEggs=[...out].sort((a,b)=>b.tier-a.tier);const best=lastEggs[0];toast(`ฟักได้ ${petDef(best.id).name} · ${TIERS[best.tier].label}${best.fresh?' ใหม่!':''}`);}renderShop();});
  overlay.querySelectorAll('[data-egg-n]').forEach(b=>b.onclick=()=>{const out=run.hatchEggs(Number(b.dataset.eggN));if(out){flushCues();lastEggs=[...out].sort((a,b)=>b.tier-a.tier);const best=out.reduce((a,o)=>o.tier>a.tier?o:a);toast(`ฟักได้ ${petDef(best.id).name} · ${TIERS[best.tier].label}${best.fresh?' ใหม่!':''}`);}renderShop();});
  overlay.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const item=run.buyGear(Number(b.dataset.buy));flushCues();if(item){run.equipBest();flushCues();toast(`ซื้อ ${itemName(item)} แล้ว${canEquip(item,run.level,run.job)?'':' (เก็บในกระเป๋า)'}`);}renderShop();});
  overlay.querySelectorAll('[data-supply]').forEach(b=>b.onclick=()=>{const id=b.dataset.supply,n=Number(b.dataset.count||1);if(run.buySupply(id,n)){flushCues();toast(`ซื้อ ${(SUPPLIES[id]||BUFFS[id]).name}${n>1?` ×${n}`:''} แล้ว`);}renderShop();});
  if($('reroll'))$('reroll').onclick=()=>{if(run.refreshShop()){flushCues();toast('สุ่มสินค้าใหม่แล้ว');}renderShop();};
  $('shopBag').onclick=()=>{run.state='inventory';uiState='';};$('closeShop').onclick=closeShop;
}
// A little painted street for the shop header: rooftops, a striped awning and lanterns.
function drawTownBanner(cv){const c=cv.getContext('2d'),W=cv.width,H=cv.height,g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#ffcf8a');g.addColorStop(.55,'#ffb0a0');g.addColorStop(1,'#7a5aa8');c.fillStyle=g;c.fillRect(0,0,W,H);
  c.fillStyle='#fff3c8';c.beginPath();c.arc(W*.8,46,26,0,7);c.fill();
  const house=(x,w,h,wall,roof)=>{c.fillStyle=wall;c.fillRect(x,H-h,w,h);c.fillStyle=roof;c.beginPath();c.moveTo(x-10,H-h);c.lineTo(x+w/2,H-h-w*.45);c.lineTo(x+w+10,H-h);c.closePath();c.fill();c.fillStyle='#ffe9a8';for(let i=0;i<Math.floor(w/34);i++)c.fillRect(x+12+i*34,H-h+18,14,16);};
  [[20,90,70,'#e8d2b0','#c0563a'],[130,70,92,'#d8c4e8','#5a4a9a'],[640,80,80,'#cfe6d0','#3f7a5a'],[740,110,64,'#f0dcc0','#b0602a'],[860,70,96,'#e0d0f0','#7a3a6a']].forEach(a=>house(...a));
  // Shop stall in the middle.
  const sx=280,sw=320;c.fillStyle='#8a5a34';c.fillRect(sx,H-70,sw,70);c.fillStyle='#5a3a20';c.fillRect(sx+10,H-32,sw-20,8);
  for(let i=0;i<8;i++){c.fillStyle=i%2?'#fff4e0':'#e8463a';c.beginPath();c.moveTo(sx-14+i*(sw+28)/8,H-96);c.lineTo(sx-14+(i+1)*(sw+28)/8,H-96);c.lineTo(sx-14+(i+1)*(sw+28)/8,H-74);c.arc(sx-14+(i+.5)*(sw+28)/8,H-74,(sw+28)/16,0,Math.PI);c.closePath();c.fill();}
  c.font='bold 22px "Chakra Petch",sans-serif';c.textAlign='center';c.lineWidth=5;c.strokeStyle='#5a2a3a';c.strokeText('TILMO SHOP',sx+sw/2,30);c.fillStyle='#fff3c8';c.fillText('TILMO SHOP',sx+sw/2,30);
  const goods=[['#ff6a8a',0],['#6ad0ff',1],['#ffd56a',2],['#9aff8a',0],['#c48aff',1]];goods.forEach(([col,k],i)=>{const x=sx+40+i*60,y=H-44;c.fillStyle=col;if(k===0){c.beginPath();c.arc(x,y,11,0,7);c.fill();c.fillRect(x-4,y-20,8,10);}else if(k===1){c.beginPath();c.moveTo(x,y-18);c.lineTo(x+11,y);c.lineTo(x,y+10);c.lineTo(x-11,y);c.closePath();c.fill();}else{c.beginPath();c.arc(x,y,12,0,7);c.fill();c.fillStyle='#b8891a';c.beginPath();c.arc(x,y,7,0,7);c.fill();}});
  for(const x of [250,630]){c.strokeStyle='#5a3a20';c.lineWidth=3;c.beginPath();c.moveTo(x,H);c.lineTo(x,H-120);c.stroke();c.fillStyle='#ffb03a';c.beginPath();c.ellipse(x,H-112,9,12,0,0,7);c.fill();c.fillStyle='#ffe9a855';c.beginPath();c.arc(x,H-112,22,0,7);c.fill();}}
function flushCues(){for(const cue of run.cues)sfx(cue.name,cue.arg);run.cues.length=0;}
function pause(){if(run.state==='raidResult'){run.state='playing';uiState='';return;}if(run.state==='inventory'){closeBag();return;}if(run.state==='shop'){closeShop();return;}if(run.state==='skills'||run.state==='map'||run.state==='pets'){closePanel();return;}if(!started||!['playing','paused'].includes(run.state))return;if(run.state==='playing'){run.state='paused';run.emit('pause');}else{run.state='playing';run.emit('resume');}uiState='';}
applyIcons();
function syncAuto(){$('auto').setAttribute('aria-pressed',String(autoPlay));setIcon($('auto').querySelector('.bi'),autoPlay?'hold':'play');}syncAuto();
$('auto').onclick=()=>{autoPlay=!autoPlay;run.reviveOnDefeat=autoPlay;try{localStorage.setItem('tilmo-auto',autoPlay?'1':'0');}catch{}syncAuto();beep();toast(autoPlay?'AUTO เปิด • พับจอได้ ตัวละครเล่นต่อเอง':'AUTO ปิด • ควบคุมเอง');};
function summon(){if(run.summonBoss()){flushCues();toast(`เรียกผู้พิทักษ์ด่าน ${stageName()}!`);}}
$('summonBtn').onclick=summon;
$('bagBtn').onclick=openBag;$('skillBtn').onclick=()=>openPanel('skills');$('mapBtn').onclick=()=>openPanel('map');$('townBtn').onclick=openShop;$('potionBtn').onclick=()=>{if(started&&run.usePotion()){flushCues();toast('ดื่มยาฟื้นพลัง!');}};
$('magnet').onclick=()=>{if(started&&run.magnet())toast('ดูด EXP ทั้งสนาม!');};
// Pet button: a live portrait of the pet that is out, with its level.
let petFaceKey='';
function syncPetBtn(){const pet=run.pet(),key=pet?`${pet.id}:${pet.lv}`:'none';if(key===petFaceKey)return;petFaceKey=key;const cv=$('petBtn').querySelector('canvas'),c=cv.getContext('2d');c.clearRect(0,0,64,64);
  if(pet){c.save();c.translate(30,58);c.scale(1.3,1.3);drawToonPet(c,pet.id,1.1,false,1);c.restore();}else{c.font='34px sans-serif';c.textAlign='center';c.fillText('🥚',32,46);}
  $('petLv').hidden=!pet;$('petLv').textContent=pet?`${pet.lv}`:'';$('petBtn').style.setProperty('--rar',pet?TIERS[pet.tier].color:'#79d6fa');}
$('petBtn').onclick=()=>{if(run.state==='pets')closePanel();else openPanel('pets');};
// Party: friends with the same code see each other in the same world and help hit monsters.
const party=new PartyLink();const social=mountSocial({party,getRun:()=>run,clearInput});let socialClock=0;let partyRefresh=0,partyKey='';
const PARTY_ERR={notfound:'ไม่พบปาร์ตี้นี้ (โค้ดผิดหรือปาร์ตี้ปิดไปแล้ว)',full:'ปาร์ตี้เต็มแล้ว (สูงสุด 4 คน)',badcode:'ใส่โค้ดให้ครบ 6 ตัว',nosocket:'อุปกรณ์นี้ไม่รองรับการเล่นออนไลน์'};
party.onchange=()=>{syncPartyBtn();if(run.state==='party')renderParty();};
party.onjoin=code=>{toast(`เข้าปาร์ตี้ ${code} แล้ว · เพื่อนที่อยู่โลกเดียวกันจะมาช่วยตี`);beep();};
function allyHere(m){return !m.stale&&!run.raid&&!m.s.raid&&m.s.hard===run.hard&&stageInfo(m.s.stage).world===stageInfo(run.stage).world;}
function syncPartyBtn(){const n=party.members.size,here=party.list().filter(allyHere).length;$('partyBtn').classList.toggle('on',!!party.code);$('partyInfo').textContent=party.code?(n?`${n+1} คน · ช่วยอยู่ ${here}`:`โค้ด ${party.code}`):party.status==='connecting'?'กำลังเชื่อม…':'เล่นกับเพื่อน';}
$('topupBtn').onclick=showTopup;
$('goldPacksBtn').onclick=()=>{if(run.state==='goldPacks')closePanel();else if(started&&run.state==='playing'){run.state='goldPacks';uiState='';}};
$('partyBtn').onclick=()=>{if(run.state==='party')closePanel();else openPanel('party');};
// Leaderboard and online list: real players from the server, NPC rivals always marked "NPC".
const ranks={online:null,top:[],at:Date.now()-55000,tab:'rank'};
// The viewer is online too, even before their first presence update reaches the server.
function onlineNow(){if(!ranks.online)return null;const list=[...ranks.online];if(!list.some(p=>p.name===run.name&&p.job===run.job))list.push({name:run.name,job:run.job,level:run.level,stage:run.stage,hard:run.hard});return list;}
async function pollRanking(force=false){if(!force&&Date.now()-ranks.at<60000)return;ranks.at=Date.now();try{const r=await fetch('/api/ranking',{cache:'no-store'});if(!r.ok)throw 0;const d=await r.json();ranks.online=d.online||[];ranks.top=d.top||[];}catch{ranks.online=null;}syncRankBtn();if(run.state==='ranking')renderRanking();}
function myRank(){const me={name:run.name,job:run.job,level:run.level,cleared:run.cleared.normal|0,cp:Math.round(run.combatPower())};return leaderboard(ranks.top,me).find(r=>r.you);}
function syncRankBtn(){if(!started)return;const me=myRank();$('rankInfo').textContent=ranks.online?`ออนไลน์ ${onlineNow().length} คน`:me?`คุณอันดับ ${me.rank}`:'ดูอันดับ';}
$('rankBtn').onclick=()=>{if(run.state==='ranking')closePanel();else{openPanel('ranking');pollRanking(true);}};
function renderRanking(){
  const overlay=$('overlay'),job=id=>CLASSES.find(c=>c.id===id)?.name||'นักผจญภัย',me={name:run.name,job:run.job,level:run.level,cleared:run.cleared.normal|0,cp:Math.round(run.combatPower())};
  const npc='<i class="npc-tag" title="ตัวละครคู่แข่งที่ระบบสร้าง ไม่ใช่ผู้เล่นจริง">NPC</i>',stageOf=n=>n?stageInfo(Math.min(LAST_STAGE,n)).label:'—';
  const rows=leaderboard(ranks.top,me),mine=rows.find(r=>r.you),shown=rows.slice(0,30);if(mine&&!shown.includes(mine))shown.push(mine);
  const rankRow=r=>`<li class="rank-row${r.you?' you':''}${r.npc?' npc':''}"><span class="rk${r.rank<=3?' top'+r.rank:''}">${r.rank<=3?['🥇','🥈','🥉'][r.rank-1]:r.rank}</span><b>${escapeText(r.name)} ${r.npc?npc:''}${r.online?'<i class="on-dot" title="ออนไลน์"></i>':''}</b><small>${job(r.job)} · ผ่านด่าน ${stageOf(r.cleared)} · พลัง ${r.cp.toLocaleString()}</small><em>Lv.${r.level}</em></li>`;
  const live=onlineNow(),town=townRivals();
  const onlineBody=live===null?'<p class="party-note">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง</p>'
    :`<h3 class="rank-h">ผู้เล่นออนไลน์ตอนนี้ · ${live.length} คน</h3><ul class="party-list">${live.length?live.map(p=>`<li class="party-row"><b>${escapeText(p.name)} <span>Lv.${p.level}</span></b><small>${job(p.job)} · ด่าน ${stageInfo(Math.min(LAST_STAGE,p.stage)).label}${p.hard?' (ยาก)':''}</small><em class="ok">ออนไลน์</em></li>`).join(''):'<li class="party-row"><small>ยังไม่มีผู้เล่นคนอื่นออนไลน์ ชวนเพื่อนมาเล่นด้วยกันได้ที่ปุ่มปาร์ตี้</small></li>'}</ul>
     <h3 class="rank-h">นักผจญภัย NPC ในเมือง</h3><ul class="party-list">${town.map(p=>`<li class="party-row npc"><b>${escapeText(p.name)} ${npc} <span>Lv.${p.level}</span></b><small>${job(p.job)} · ผ่านด่าน ${stageOf(p.cleared)}</small><em class="dim">พักในเมือง</em></li>`).join('')}</ul>`;
  overlay.innerHTML=`<div class="panel party-panel rank-panel"><header class="char-head"><h2>🏆 อันดับนักผจญภัย</h2><button class="close-x" id="closeRank" aria-label="ปิด">✕</button></header>
  <div class="rank-tabs"><button data-tab="rank" aria-pressed="${ranks.tab==='rank'}">อันดับ</button><button data-tab="online" aria-pressed="${ranks.tab==='online'}">ออนไลน์${live?` (${live.length})`:''}</button></div>
  ${ranks.tab==='rank'?`<p class="awakening-note">เรียงตามเลเวล แล้วด่านที่ผ่าน · ผู้เล่นที่ออนไลน์ใน 30 วันล่าสุด รวมกับคู่แข่ง ${npc} ที่เก่งขึ้นทุกวัน${mine?` · คุณอยู่อันดับ <b>${mine.rank}</b>`:''}</p><ol class="rank-list">${shown.map(rankRow).join('')}</ol>`:onlineBody}
  <div class="row shop-actions"><button class="primary" id="rankBack">กลับเข้าสนาม ↗</button></div></div>`;
  $('closeRank').onclick=$('rankBack').onclick=closePanel;
  overlay.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ranks.tab=b.dataset.tab;renderRanking();});
}
function renderParty(){
  const overlay=$('overlay'),job=id=>CLASSES.find(c=>c.id===id)?.name||'นักผจญภัย',err=party.error?`<p class="party-err">${PARTY_ERR[party.error]||'เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง'}</p>`:'';
  const status=party.status==='connecting'?'<p class="party-note">กำลังเชื่อมต่อเซิร์ฟเวอร์…</p>':party.status==='offline'&&party.want?'<p class="party-note">หลุดการเชื่อมต่อ · กำลังลองเชื่อมใหม่</p>':'';
  const me=`<li class="party-row you"><b>${escapeText(run.name)} <span>Lv.${run.level}</span></b><small>${job(run.job)} · ด่าน ${stageInfo(run.stage).label}${run.hard?' (ยาก)':''}</small><em>คุณ</em></li>`;
  const row=m=>{const s=m.s,info=stageInfo(s.stage),here=allyHere(m),same=here&&s.stage===run.stage,can=!same&&run.canHelp(s.stage,s.hard);
    const act=m.stale?'<em class="dim">ออฟไลน์</em>':s.raid?'<em class="dim">อยู่บอสโลก</em>':same?'<em class="ok">ด่านเดียวกัน</em>':`<button class="${can?'gold-btn':''}" data-help="${m.id}" ${can?'':'disabled'}>${can?`ไป ${info.label}`:'ยังไปไม่ถึง'}</button>`;
    return `<li class="party-row"><b>${escapeText(s.name)} <span>Lv.${s.lv}</span></b><small>${job(s.job)} · ด่าน ${info.label}${s.hard?' (ยาก)':''} · พลัง ${Math.round(s.cp).toLocaleString()}${here&&!same?' · <i class="ok">โลกเดียวกัน ช่วยตีอยู่</i>':''}</small>${act}</li>`;};
  const body=party.code?`<div class="party-code"><small>โค้ดปาร์ตี้ (ส่งให้เพื่อน)</small><b>${party.code}</b><button class="secondary" id="pCopy">คัดลอก</button></div><ul class="party-list">${me}${party.list().map(row).join('')}</ul>${party.members.size?'':'<p class="party-note">ยังไม่มีเพื่อนในปาร์ตี้ · ส่งโค้ดให้เพื่อนกดเข้าร่วม</p>'}`
    :`<div class="party-join"><button class="primary" id="pCreate">สร้างปาร์ตี้ใหม่</button><div class="party-code-in"><input id="pCode" maxlength="6" placeholder="โค้ด 6 ตัว" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="secondary" id="pJoin">เข้าร่วม</button></div></div>`;
  overlay.innerHTML=`<div class="panel party-panel"><header class="char-head"><h2>ปาร์ตี้</h2><button class="close-x" id="closeParty" aria-label="ปิด">✕</button></header>
  <p class="awakening-note">เล่นด้วยกันได้สูงสุด 4 คน · อยู่โลกเดียวกัน (เช่น 4-1 กับ 4-9) จะเห็นกันในแมพและช่วยตีมอนให้กัน · ผ่านด่านไปแล้วกลับไปช่วยเพื่อนด่านต่ำกว่าได้</p>
  ${err}${status}${body}<div class="row shop-actions">${party.code?'<button class="secondary" id="pLeave">ออกจากปาร์ตี้</button>':''}<button class="primary" id="pBack">กลับเข้าสนาม ↗</button></div></div>`;
  $('closeParty').onclick=$('pBack').onclick=closePanel;
  if($('pCreate')){$('pCreate').onclick=()=>{party.create();beep();};const go=()=>{party.join($('pCode').value);};$('pJoin').onclick=go;$('pCode').onkeydown=e=>{if(e.key==='Enter')go();};$('pCode').oninput=e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');};}
  if($('pLeave'))$('pLeave').onclick=()=>{party.leave();toast('ออกจากปาร์ตี้แล้ว');};
  if($('pCopy'))$('pCopy').onclick=()=>{navigator.clipboard?.writeText(party.code).then(()=>toast('คัดลอกโค้ดแล้ว'),()=>{});};
  overlay.querySelectorAll('[data-help]').forEach(b=>b.onclick=()=>{const m=party.members.get(Number(b.dataset.help));if(m&&run.helpAt(m.s.stage,m.s.hard)){flushCues();run.state='playing';uiState='';toast(`ไปช่วย ${m.s.name} ที่ด่าน ${stageInfo(m.s.stage).label}`);}});
}
party.resume();

function petArt(root){root.querySelectorAll('canvas[data-petart]').forEach(cv=>{const c=cv.getContext('2d'),s=cv.height/50;c.translate(cv.width/2-2*s,cv.height-cv.height*.12);c.scale(s,s);if(cv.dataset.shadow)c.filter='brightness(0) opacity(.55)';drawToonPet(c,cv.dataset.petart,1.1,false,1);});}
// Pet panel: the pet that is out, and every pet with switch / level-up buttons.
function renderPets(){
  const overlay=$('overlay'),cur=run.pet();
  const row=p=>{const own=run.pets.includes(p.id),lv=run.petLevel(p.id),st=petStats(p,lv),on=own&&run.petId===p.id,max=lv>=MAX_PET_LV,cost=run.petUpgradePrice(p.id),next=max?null:petStats(p,lv+1);
    return `<article class="pet-row ${own?'':'locked'} ${on?'on':''}" style="--rar:${TIERS[p.tier].color}"><canvas width="104" height="84" data-petart="${p.id}" ${own?'':'data-shadow="1"'}></canvas>
    <div class="pet-info"><b>${own?p.name:'???'} ${own?`<span class="pet-lv">Lv.${lv}${max?' MAX':''}</span>`:''}</b><small class="rar">${TIERS[p.tier].label}</small><small>${own?petPerks(st):'ยังไม่มี · ฟักได้จากไข่ในร้านค้า'}</small>${own&&!max?`<small class="good">Lv.${lv+1}: โจมตี ${Math.round(next.atk*100)}% · เร็ว ${next.speed} · ระยะ ${next.range}</small>`:''}</div>
    ${own?`<div class="pet-btns"><button class="${on?'':'primary-btn'}" data-use="${p.id}" ${on?'disabled':''}>${on?'ออกอยู่':'ใช้ตัวนี้'}</button><button class="gold-btn" data-up="${p.id}" ${max||run.gold<cost?'disabled':''}>${max?'เต็มแล้ว':`อัพ Lv ${coin()}${cost.toLocaleString()}`}</button></div>`:''}</article>`;};
  overlay.innerHTML=`<div class="panel pet-panel"><header class="char-head"><h2>สัตว์เลี้ยง</h2><span class="bag-gold">${coin()} ${run.gold.toLocaleString()}</span><button class="close-x" id="closePets" aria-label="ปิด">✕</button></header>
  <p class="awakening-note">${cur?`<b>${cur.name}</b> Lv.${cur.lv} กำลังช่วยตีมอนและเก็บของ`:'ยังไม่มีสัตว์เลี้ยง · ซื้อ${PETS[0].name}หรือฟักไข่ได้ที่ร้านค้า'} · สัตว์เลี้ยงจะวิ่งเก็บ EXP/เงินก่อน กัดมอนที่ขวางทาง ว่างแล้วค่อยไล่ล่ามอน</p>
  <div class="pet-list">${PETS.map(row).join('')}</div><div class="row shop-actions"><button class="secondary" id="petShop">${run.supplies.egg?`ฟักไข่ฟรี (มี ${run.supplies.egg} ใบ)`:'ไปฟักไข่ที่ร้านค้า'}</button><button class="primary" id="petBack">กลับเข้าสนาม ↗</button></div></div>`;
  petArt(overlay);
  overlay.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{if(run.setPet(b.dataset.use)){toast(`${petDef(b.dataset.use).name} ออกไปช่วยแล้ว`);beep();}renderPets();});
  overlay.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{if(run.upgradePet(b.dataset.up)){flushCues();toast(`${petDef(b.dataset.up).name} เลเวลอัปเป็น Lv.${run.petLevel(b.dataset.up)}!`);}renderPets();});
  $('closePets').onclick=closePanel;$('petBack').onclick=closePanel;$('petShop').onclick=()=>{shopTab='pet';run.state='shop';uiState='';};
}
// ---- World boss raid: HUD chip with the schedule, live board, result screen.
const short=n=>n>=1e9?`${(n/1e9).toFixed(1)}B`:n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:`${Math.round(n)}`;
const mmss=ms=>{const s=Math.ceil(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
let raidToastWin=-1;
function syncRaid(){
  const now=Date.now(),open=raidOpen(now),btn=$('raidBtn'),inRaid=run.mode==='raid';btn.hidden=inRaid;
  const can=run.canJoinRaid(now),joined=run.raidJoined===raidWindow(now);btn.classList.toggle('open',open&&!joined);btn.disabled=!can;
  if(open&&!joined){if(raidToastWin!==raidWindow(now)){raidToastWin=raidWindow(now);toast(`👹 บอสโลก ${RAID_BOSS_NAME} ปรากฏ! เข้าร่วมตีพร้อมผู้เล่นคนอื่นได้เลย`);beep('portal');}
    $('raidTitle').textContent='บอสโลก · เข้าร่วม!';$('raidTime').textContent=`ปิดใน ${mmss(raidClosesIn(now))}`;}
  else{$('raidTitle').textContent='บอสโลก';$('raidTime').textContent=`${joined&&open?'เข้าแล้ว · ':''}รอบถัดไปใน ${mmss(raidOpensIn(now))}`;}
  const board=$('raidBoard');board.hidden=!inRaid||!run.raid;if(board.hidden)return;
  const list=run.raidBoard(),me=list.findIndex(x=>x.you),rows=list.slice(0,5).map((x,i)=>[x,i]);if(me>=5)rows.push([list[me],me]);
  board.innerHTML=`<b>🏆 อันดับดาเมจ · ${list.length} คน</b>${rows.map(([x,i])=>`<div class="rb-row ${x.you?'me':''}"><span class="rb-rank r${i+1}">${i+1}</span><span class="rb-name">${x.you?`${x.name} (คุณ)`:x.name}</span><span class="rb-dmg">${short(x.dmg)}</span></div>`).join('')}`;
}
$('raidBtn').onclick=()=>{if(run.joinRaid()){flushCues();toast(`เข้าสู่ศึกบอสโลก! ทำดาเมจให้มากที่สุดใน ${RAID_TIME} วิ`);}};
function renderRaidResult(){
  const res=run.lastRaid,overlay=$('overlay');if(!res){run.state='playing';return;}
  const g=res.rewards.gear,top=res.board.slice(0,10),me=res.board.findIndex(x=>x.you);
  overlay.innerHTML=`<div class="panel raid-result"><div class="eyebrow">WORLD BOSS · ${RAID_BOSS_NAME}</div><h2>${res.rank<=5?`🏆 อันดับ ${res.rank}!`:`อันดับ ${res.rank} จาก ${res.total}`}</h2><p class="awakening-note">${res.fell?'คุณล้มระหว่างศึก ดาเมจที่ทำไว้ยังนับ':'ศึกจบแล้ว'} · ดาเมจของคุณ ${short(res.board[me].dmg)}</p>
  <ol class="raid-table">${top.map((x,i)=>`<li class="${x.you?'me':''}"><span class="rb-rank r${i+1}">${i+1}</span><span class="rb-name">${x.name}${x.you?' (คุณ)':''}</span><small>Lv.${x.lv}</small><span class="rb-dmg">${short(x.dmg)}</span></li>`).join('')}${me>=10?`<li class="me"><span class="rb-rank">${me+1}</span><span class="rb-name">${res.board[me].name} (คุณ)</span><small>Lv.${res.board[me].lv}</small><span class="rb-dmg">${short(res.board[me].dmg)}</span></li>`:''}</ol>
  <div class="raid-rewards"><b>รางวัลของคุณ</b><div class="rr-list">${g?`<div class="rr gear" style="--rar:${TIERS[g.tier].color}"><span data-rgear></span><small>${itemName(g)}<br><span style="color:${TIERS[g.tier].color}">${TIERS[g.tier].label}${g.tier===5?' 🌈':''}</span></small></div>`:`<div class="rr miss"><small>${{damage:'ดาเมจน้อยเกินไป ต้องตีบอสต่อเนื่องถึงจะลุ้นของ',luck:`ไม่ได้ของรอบนี้ (ผู้เล่น ${res.total} คน · โอกาส ${Math.round(res.rewards.chance*100)}%)<br>ชวนเพื่อนมาครบ 5 คน ได้ของแน่นอน`}[res.rewards.miss]||'ติดอันดับ 1–5 เพื่อลุ้นชุด/อาวุธสีรุ้ง'}</small></div>`}<div class="rr"><canvas width="88" height="88" data-egg></canvas><small>ไข่สัตว์เลี้ยง ×${res.rewards.eggs}</small></div><div class="rr"><span class="rr-ico">${ico('luck')}</span><small>หินนำโชค ×${res.rewards.stones.luck}</small></div><div class="rr"><span class="rr-ico">${ico('guard')}</span><small>หินคุ้มครอง ×${res.rewards.stones.guard}</small></div></div></div>
  <div class="row shop-actions"><button class="secondary" id="raidHatch">ไปฟักไข่</button><button class="primary" id="raidOk">รับรางวัล ↗</button></div></div>`;
  if(g)overlay.querySelector('[data-rgear]').append(itemIcon(g,56));overlay.querySelectorAll('canvas[data-egg]').forEach(cv=>drawEgg(cv.getContext('2d'),cv.width,run.t));
  $('raidOk').onclick=()=>{run.equipBest();flushCues();run.state='playing';uiState='';};$('raidHatch').onclick=()=>{run.equipBest();shopTab='pet';run.state='shop';uiState='';};
}
function syncMagnet(){const left=Math.ceil(run.magnetClock),limited=run.magnetLimited(),ready=started&&run.state==='playing'&&left<=0&&(!limited||run.magnetCharges>0);$('magnet').disabled=!ready;$('magnet').querySelector('.bl').textContent=left>0?`${left}s`:limited?`ดูด ×${run.magnetCharges}`:'ดูด EXP';$('magnet').classList.toggle('cooling',left>0);}
$('pause').onclick=pause;$('sound').onclick=()=>{const on=!soundOn();setSound(on);setMusic(on);unlockAudio();syncSoundButton();beep();};function syncSoundButton(){setIcon($('sound'),soundOn()?'sound':'mute');$('sound').setAttribute('aria-label',soundOn()?'ปิดเสียง':'เปิดเสียง');}syncSoundButton();
addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(e.repeat)return;if(e.key==='Escape')pause();if(e.key.toLowerCase()==='b'){if(run.state==='inventory')closeBag();else openBag();}if(e.key.toLowerCase()==='t'){if(run.state==='shop')closeShop();else openShop();}if(e.key.toLowerCase()==='q'&&started&&run.usePotion())flushCues();if(e.key.toLowerCase()==='g'&&started){summon();}if(e.key.toLowerCase()==='k'){if(run.state==='skills')closePanel();else openPanel('skills');}if(e.key.toLowerCase()==='p'){if(run.state==='pets')closePanel();else openPanel('pets');}if(e.key.toLowerCase()==='m'){if(run.state==='map')closePanel();else openPanel('map');}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function clearInput(){keys.clear();pointer=null;move={x:0,y:0};$('stick').style.transform='';}
addEventListener('blur',()=>{clearInput();if(started&&run.state==='playing'&&!autoPlay)pause();});
// With AUTO on the hero keeps farming while the tab is hidden and even while the game is closed:
// a slow timer feeds the simulation in fixed steps, time away is replayed when the player is back,
// and level-ups are banked for the player to pick.
let awaySummary='',backlog=0,backlogTotal=0,awaySince=0,awayFrom=null,extrapolate=0;const STEP=.05,MAX_BACKLOG=8*3600,FULL_SIM=20*60;
function goAway(){if(['inventory','shop','skills','map','pets','raidResult'].includes(run.state)){run.state='playing';uiState='';}if(!started||!autoPlay||run.state!=='playing'||awayFrom)return;run.holdPicks=true;awaySince=performance.now();awayFrom={kills:run.kills,level:run.level,stage:run.stage,xp:run.xpEarned,gold:run.goldEarned,t:run.t};}
// Up to 20 minutes away is replayed in full; beyond that, EXP and kills accrue at the rate the
// replay achieved, so even a whole night away resolves in a moment.
function addAwayTime(seconds){const total=Math.min(MAX_BACKLOG,backlog+extrapolate+seconds);backlog=Math.min(FULL_SIM,total);extrapolate=total-backlog;backlogTotal=Math.max(backlogTotal,total);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();saveRun();if(started&&run.state==='playing'&&!autoPlay)pause();else goAway();}else if(awaySince){addAwayTime((performance.now()-awaySince)/1000);awaySince=0;}});
function autoStep(){if(run.state!=='playing')return false;run.reviveOnDefeat=true;if(!run.magnetLimited()&&run.magnetClock<=0&&run.gems.length>=8)run.magnet();run.update(STEP,run.autoInput());return true;}
function drain(budgetMs){const until=performance.now()+budgetMs;while(backlog>=STEP&&performance.now()<until){if(!autoStep()){backlog=0;break;}backlog-=STEP;run.cues.length=0;}}
function finishAway(){if(!awayFrom)return;if(extrapolate>0&&run.t>awayFrom.t+30){const span=run.t-awayFrom.t,xp=Math.round((run.xpEarned-awayFrom.xp)/span*extrapolate),kills=Math.round((run.kills-awayFrom.kills)/span*extrapolate);const gold=Math.round((run.goldEarned-awayFrom.gold)/span*extrapolate);run.xp+=xp;run.xpEarned+=xp;run.kills+=kills;run.gold+=gold;run.goldEarned+=gold;run.checkLevel();}extrapolate=0;const picks=run.skillPoints,away=Math.round(backlogTotal/60);awaySummary=(`ฟาร์มระหว่างไม่อยู่${away?` ${away} นาที`:''}: กำจัด +${run.kills-awayFrom.kills} · Lv.${awayFrom.level}→${run.level} · 🪙+${(run.goldEarned-awayFrom.gold).toLocaleString()}${run.stage!==awayFrom.stage?` · อยู่ด่าน ${stageName()}`:''}${picks?` · แต้มสกิลรอลง ${picks}`:''}`);toast(awaySummary);awayFrom=null;backlogTotal=0;run.holdPicks=false;run.openPending();uiState='';saveRun();}
setInterval(()=>{if(document.hidden&&started&&awaySince){const now=performance.now();addAwayTime((now-awaySince)/1000);awaySince=now;drain(60);}},1000);
// The run is saved every few seconds and when the page hides, so a refresh resumes it.
const SAVE_KEY='tilmo-save';
function saveRun(){if(!started)return;try{mergeGoldGrants(run,characterStore.active,localStorage);characterStore.setItem('tilmo-stash',JSON.stringify(run.stash()));if(run.state==='ended')characterStore.removeItem(SAVE_KEY);else characterStore.setItem(SAVE_KEY,JSON.stringify({at:Date.now(),auto:autoPlay,run:run.serialize()}));return true;}catch{return false;}}
// Restore codes give back level and stage lost to the v0.30.0 save bug (see server/restore.mjs).
async function useRestoreCode(){const input=$('restoreCode'),msg=$('restoreMsg'),code=input.value.trim();if(!code)return;$('restoreGo').disabled=true;msg.textContent='กำลังตรวจโค้ด…';const out=await redeemRestore(code,{name:run.name,job:run.job}).catch(()=>({error:'bad'}));$('restoreGo').disabled=false;if(out.error){msg.textContent=RESTORE_ERRORS[out.error]||RESTORE_ERRORS.bad;return;}const {gained}=applyRestore(run,out);saveRun();msg.textContent=gained?`กู้คืนสำเร็จ! กลับมาเป็น Lv.${run.level} (+${gained} แต้มสกิล) · ผ่านด่านถึง ${stageInfo(Math.max(1,run.cleared.normal)).label}`:`ใช้โค้ดแล้ว · ด่านที่ผ่านอัปเดตเป็น ${stageInfo(Math.max(1,run.cleared.normal)).label}`;toast(msg.textContent);}
function loadSave(){try{const save=JSON.parse(characterStore.getItem(SAVE_KEY)||'null');return [4,5].includes(save?.run?.v)?save:null;}catch{return null;}}
setInterval(saveRun,5000);addEventListener('pagehide',saveRun);
canvas.addEventListener('pointerdown',e=>{if(run.state!=='playing'||!started)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!pointer||e.pointerId!==pointer.id)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y,l=Math.hypot(dx,dy);move={x:dx/Math.max(42,l),y:dy/Math.max(42,l)};$('stick').style.transform=`translate(${move.x*30}px,${move.y*30}px)`;});canvas.addEventListener('pointerup',clearInput);canvas.addEventListener('pointercancel',clearInput);
// ---- Skills and world map panels; the field waits while they are open.
function openPanel(name){if(!started||run.state!=='playing')return;run.state=name;uiState='';beep('open');}
function closePanel(){if(!['skills','map','pets','party','ranking','goldPacks','topup'].includes(run.state))return;run.state='playing';uiState='';}
let skillPick=null;
// Bottom skill bar: one tile per slotted skill with a cooldown sweep, seconds left and a flash on cast.
let skillHudKey='';
// Top HUD extras: HP numbers, combat power, stage quota bar and the hero portrait.
let portraitKey='';
function hudExtras(){
  $('hpText').textContent=`${Math.ceil(run.p.hp).toLocaleString()}/${run.maxHp.toLocaleString()}`;$('hp').closest('.meter').classList.toggle('low',run.p.hp/run.maxHp<.3);
  $('powerVal').textContent=run.combatPower().toLocaleString();
  const g=run.enemies.find(e=>e.guardian&&e.hp>0),mode=run.mode==='raid'?'boss':run.mode==='farm'?'farm':g?'boss':'kill';$('stagePlate').dataset.mode=mode;$('summonBtn').hidden=!run.canSummon();$('summonBtn').lastChild.textContent=mode==='farm'?'ท้าบอสด่านถัดไป':'เรียกบอส';$('stageMode').dataset.mode=mode;
  $('stageMode').textContent=run.mode==='raid'?'บอสโลก':mode==='farm'?'ฟาร์ม':mode==='boss'?'บอส!':run.hard?'ท้า · ยาก':'ท้าด่าน';$('quotaGoal').textContent=mode==='farm'?'⚔️':'👑';
  if(run.mode==='raid'&&run.raid){const board=run.raidBoard(),rank=board.findIndex(x=>x.you)+1;$('quotaFill').style.width=`${Math.max(0,run.raid.t/RAID_TIME*100)}%`;$('quotaText').textContent=`ดาเมจคุณ ${short(run.raid.dmg)} · อันดับ ${rank}/${board.length} · เหลือ ${Math.ceil(Math.max(0,run.raid.t))} วิ`;$('quotaText').classList.toggle('fury',run.raid.t<10);}
  else if(mode==='farm'){$('quotaFill').style.width=`${Math.min(100,run.farmClock/FARM_RETRY*100)}%`;$('quotaText').textContent=run.canChallenge()?(run.autoChallenge?`ท้าด่านใหม่ใน ${Math.max(0,Math.ceil(FARM_RETRY-run.farmClock))} วิ`:'เปิดแผนที่เพื่อท้าด่าน'):'เก็บเลเวลและไอเทม';}
  else if(g){$('quotaFill').style.width=`${g.hp/g.max*100}%`;const fury=g.type==='boss'&&!g.mini?(g.berserk?' · คลั่งเต็มที่!':` · คลั่งใน ${Math.max(0,Math.ceil((g.berserkAt??BERSERK_AT)-(run.t-g.born)))} วิ`):'';$('quotaText').textContent=`${$('bossName').textContent.split(' · ')[0]} · HP ${Math.ceil(g.hp/g.max*100)}%${fury}`;$('quotaText').classList.toggle('fury',!!g.berserk||(g.type==='boss'&&!g.mini&&(g.berserkAt??BERSERK_AT)-(run.t-g.born)<10));}
  else{$('quotaFill').style.width=`${Math.min(100,run.stageKills/run.quota*100)}%`;$('quotaText').textContent=`ล้มศัตรู ${Math.min(run.stageKills,run.quota)} / ${run.quota}`;}
  const key=[run.job,run.appearance,run.weaponTier,run.armorLook,run.helmetTier].join();if(key===portraitKey)return;portraitKey=key;
  const c=$('portraitArt').getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,112,112);c.translate(56,178);c.scale(1.45,1.45);
  drawHero(c,0,0,{job:run.job,appearance:run.appearance,tier:run.weaponTier,plus:run.weaponPlus,armor:run.armorLook??-1,helmet:run.helmetTier??-1,time:1.2,direction:'se'});
}
function skillHud(){
  const box=$('skillSlots'),slots=run.slots.filter(id=>run.skills[id]),key=slots.map(id=>id+run.skills[id]).join()+'|'+activeSlots(run.job,run.level);
  if(key!==skillHudKey){skillHudKey=key;box.replaceChildren();
    for(let i=0;i<activeSlots(run.job,run.level);i++){const id=slots[i],s=id&&SKILLS.find(k=>k.id===id),b=document.createElement('button');b.className='skill-slot';
      if(s){b.dataset.id=id;b.title=s.name;b.setAttribute('aria-label',s.name);b.innerHTML=`${skillArt(s.id,'ic')}<i class="cd"></i><em></em><small>${run.skills[id]}</small>`;}else{b.classList.add('empty');b.textContent='+';b.title='ช่องว่าง · กด K เพื่อใส่สกิล';}
      b.onclick=()=>openPanel('skills');box.append(b);}}
  let lead=null,glow=0;
  for(const b of box.children){const id=b.dataset.id;if(!id)continue;
    const total=SKILL_CD[id]?run.skillCooldown(id):0,left=SKILL_CD[id]?Math.max(0,run.cooldowns[id]??0):0,frac=total?Math.min(1,left/total):0;
    b.querySelector('.cd').style.background=frac>0?`conic-gradient(#04101f99 ${frac*360}deg,transparent 0)`:'none';
    b.querySelector('em').textContent=!SKILL_CD[id]?'∞':left>=.95?Math.ceil(left):'';
    const g=run.castGlow[id]||0;b.classList.toggle('casting',g>0);b.classList.toggle('ready',!!SKILL_CD[id]&&frac===0);b.classList.toggle('always',!SKILL_CD[id]);
    if(g>glow){glow=g;lead=id;}}
  const cast=$('skillCast');if(lead){cast.textContent=`✦ ${SKILLS.find(k=>k.id===lead).name}`;cast.classList.add('on');}else cast.classList.remove('on');
  $('skillHud').hidden=!slots.length&&run.level<2;
}
function renderSkills(){
  const overlay=$('overlay'),own=SKILLS.filter(s=>!s.job||s.job===run.job),max=activeSlots(run.job,run.level),cost=respecCost(run.level);
  const groups=[['สกิลขั้นเทพ · Lv.70 / 75 / 80',own.filter(s=>s.job&&s.kind==='active'&&s.req>=70)],['ทักษะอาชีพ',own.filter(s=>s.job&&s.kind==='active'&&s.req<70)],['ทักษะติดตัวอาชีพ',own.filter(s=>s.job&&s.kind==='passive')],['ทักษะทั่วไป',own.filter(s=>!s.job&&s.kind==='active')],['ทักษะติดตัวทั่วไป',own.filter(s=>!s.job&&s.kind==='passive')]].filter(g=>g[1].length);
  const tile=s=>{const lv=run.skills[s.id]||0,locked=run.level<s.req,slotted=run.slots.includes(s.id);return `<button class="sk-tile ${locked?'locked':''} ${lv?'learnt':''} ${slotted?'slotted':''}" data-sk="${s.id}" aria-pressed="${skillPick===s.id}">${skillArt(s.id)}<b>${s.name}</b><small>${locked?`🔒 Lv.${s.req}`:`Lv.${lv}/${s.max}`}</small>${slotted?'<i class="sk-badge">ใช้อยู่</i>':''}${run.canLearn(s.id)?'<i class="sk-plus">+</i>':''}</button>`;};
  const pick=skillPick&&SKILLS.find(s=>s.id===skillPick);let detail='<div class="item-card empty"><p>แตะสกิลเพื่อดูรายละเอียดและลงแต้ม</p><small>ทุกเลเวลได้ 1 แต้ม • สกิลโจมตีใส่ช่องได้ '+max+' ช่อง • สกิลติดตัวทำงานตลอด</small></div>';
  if(pick){const lv=run.skills[pick.id]||0,slotted=run.slots.includes(pick.id);detail=`<div class="item-card sk-card"><div class="item-card-head">${skillArt(pick.id,'sk-icon big')}<div><b>${pick.name}</b><small>${pick.kind==='active'?'สกิลโจมตี':'สกิลติดตัว'} · Lv.${lv}/${pick.max} · ต้องการ Lv.${pick.req}</small></div></div><p>${pick.desc}</p><small class="vs">${pick.tag}</small><div class="row"><button class="primary-btn" data-learn="${pick.id}" ${run.canLearn(pick.id)?'':'disabled'}>${lv?'อัปเลเวล':'เรียนรู้'} (1 แต้ม)</button>${pick.kind==='active'&&lv?`<button data-slot-toggle="${pick.id}" ${!slotted&&run.slots.length>=max?'disabled':''}>${slotted?'ถอดออกจากช่อง':'ใส่ช่องสกิล'}</button>`:''}</div></div>`;}
  overlay.innerHTML=`<div class="panel char-panel skills-panel"><header class="char-head"><h2>สกิล</h2><span class="sp-badge">แต้มสกิล <b>${run.skillPoints}</b></span><button class="close-x" id="closeSkills" aria-label="ปิด">✕</button></header>
  <div class="slot-bar">${Array.from({length:max},(_,i)=>{const id=run.slots[i],s=id&&SKILLS.find(k=>k.id===id);return `<button class="sk-slot ${s?'filled':''}" ${s?`data-sk="${s.id}"`:''}>${s?`${skillArt(s.id)}<small>${s.name} Lv.${run.skills[s.id]}</small>`:'<small>ช่องว่าง</small>'}</button>`;}).join('')}</div>
  <div class="char-body sk-body"><section class="sk-groups">${groups.map(([t,list])=>`<h3>${t}</h3><div class="sk-grid">${list.map(tile).join('')}</div>`).join('')}</section><section class="char-right">${detail}
  <div class="sk-actions"><button class="secondary" id="autoLearn" ${run.skillPoints?'':'disabled'}>ลงแต้มอัตโนมัติ</button><button class="gold-btn" id="respec" ${run.spentPoints()&&run.gold>=cost?'':'disabled'}>รีสกิล ${coin()}${cost.toLocaleString()}</button></div><small class="vs">รีสกิล: คืนแต้มทั้งหมดเพื่อลงใหม่</small></section></div></div>`;
  overlay.querySelectorAll('[data-sk]').forEach(b=>b.onclick=()=>{skillPick=b.dataset.sk;renderSkills();});
  overlay.querySelectorAll('[data-learn]').forEach(b=>b.onclick=()=>{if(run.learn(b.dataset.learn)){flushCues();}renderSkills();});
  overlay.querySelectorAll('[data-slot-toggle]').forEach(b=>b.onclick=()=>{const id=b.dataset.slotToggle;if(run.slots.includes(id))run.unequipSkill(id);else run.equipSkill(id);renderSkills();});
  $('autoLearn').onclick=()=>{run.autoLearn();flushCues();renderSkills();};
  $('respec').onclick=()=>{if(confirm(`รีสกิลด้วยเงิน ${cost.toLocaleString()} ทอง? แต้มทั้งหมดจะคืนให้ลงใหม่`)&&run.respec()){flushCues();toast('รีสกิลแล้ว • ลงแต้มใหม่ได้เลย');skillPick=null;}renderSkills();};
  $('closeSkills').onclick=closePanel;
}
let mapWorld=null,mapHard=null;
function renderMap(){
  const overlay=$('overlay'),hard=mapHard??run.hard,track=hard?'hard':'normal',top=run.cleared[track],hardOpen=run.cleared.normal>=LAST_STAGE;
  const world=mapWorld??stageInfo(Math.min(LAST_STAGE,top+1)).world,cp=run.combatPower();
  const node=st=>{const i=stageInfo(st),done=st<=top,next=st===top+1,here=st===run.stage&&hard===run.hard,stars=run.stars[(hard?'h':'n')+st]||0,rec=recommendedPower(st,hard);
    return `<button class="st-node ${done?'done':next?'next':'locked'} ${i.guardian!=='elite'?'boss':''} ${here?'here':''}" data-st="${st}" ${done||next?'':'disabled'}><b>${i.label}</b><span class="stars">${done?'★'.repeat(stars)+'☆'.repeat(3-stars):i.guardian==='boss'?'👑':i.guardian==='mini'?'💀':''}</span><small class="${cp>=rec?'good':'warn'}">⚔ ${rec.toLocaleString()}</small></button>`;};
  overlay.innerHTML=`<div class="panel char-panel map-panel"><header class="char-head"><h2>แผนที่โลก</h2><span class="sp-badge">พลังของคุณ <b>${cp.toLocaleString()}</b></span><button class="close-x" id="closeMap" aria-label="ปิด">✕</button></header>
  <div class="bag-tabs"><button data-mode="0" aria-pressed="${!hard}">ปกติ · ${run.cleared.normal}/${LAST_STAGE}</button><button data-mode="1" aria-pressed="${hard}" ${hardOpen?'':'disabled'}>${hardOpen?'':'🔒 '}ยาก · ${run.cleared.hard}/${LAST_STAGE}</button></div>
  <div class="world-tabs">${WORLD_NAMES.map((n,i)=>`<button data-world="${i+1}" aria-pressed="${world===i+1}" class="w${i+1}" ${(i*STAGES_PER_WORLD)<=top?'':'disabled'}><b>โลก ${i+1}</b><small>${n}</small></button>`).join('')}</div>
  <div class="st-grid w${world}">${Array.from({length:STAGES_PER_WORLD},(_,k)=>node((world-1)*STAGES_PER_WORLD+k+1)).join('')}</div>
  <div class="map-foot"><label><input type="checkbox" id="autoCh" ${run.autoChallenge?'checked':''}> ท้าด่านถัดไปอัตโนมัติทุก ${FARM_RETRY/60} นาทีระหว่างฟาร์ม</label><small>แตะด่านที่ผ่านแล้วเพื่อฟาร์ม · แตะด่านถัดไปเพื่อท้า · ⚔ = พลังแนะนำ</small></div></div>`;
  overlay.querySelectorAll('[data-world]').forEach(b=>b.onclick=()=>{mapWorld=Number(b.dataset.world);renderMap();});
  overlay.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mapHard=b.dataset.mode==='1';mapWorld=null;renderMap();});
  overlay.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{const st=Number(b.dataset.st);const ok=st<=top?(run.startChallenge(st,hard)||run.farmAt(st,hard)):run.startChallenge(st,hard);if(ok){flushCues();mapWorld=null;mapHard=null;run.state='playing';uiState='';toast(st<=top?`เล่นด่าน ${stageInfo(st).label} อีกครั้ง`:`ท้าด่าน ${stageInfo(st).label}!`);}});
  $('autoCh').onchange=e=>{run.autoChallenge=e.target.checked;};
  $('closeMap').onclick=closePanel;
}
function ui(){if(!started)return;const hudNow=performance.now();if(run.state===uiState&&hudNow-lastHudAt<100)return;lastHudAt=hudNow;$('time').textContent=`${String(Math.floor(run.t/60)).padStart(2,'0')}:${String(Math.floor(run.t%60)).padStart(2,'0')}`;$('level').textContent=`Lv.${run.level}`;hudExtras();$('heroLabel').textContent=run.name;syncMagnet();syncPetBtn();syncRaid();$('classLabel').textContent=CLASSES.find(c=>c.id===run.job)?.name||'ฝึกหัด';$('hp').style.width=`${run.p.hp/run.maxHp*100}%`;$('kills').textContent=run.kills;$('gold').textContent=run.gold.toLocaleString();$('potionCount').textContent=run.supplies.potion;$('potionBtn').disabled=!run.supplies.potion||run.potionClock>0;$('buffs').innerHTML=[run.buffs.xp>0?`${ico('scroll')} EXP×2 ${buffLeft(run.buffs.xp)}`:'',run.buffs.gold>0?`${ico('clover')} เงิน×2 ${buffLeft(run.buffs.gold)}`:''].filter(Boolean).join(' · ');$('exp').style.width=`${Math.min(100,run.xp/run.need*100)}%`;$('xpText').textContent=`${Math.floor(run.xp/run.need*100)}%`;$('next').textContent=run.skillPoints?`✨ มีแต้มสกิล ${run.skillPoints} แต้ม · กด K เพื่ออัปสกิล`:'';skillHud();$('skillBtn').dataset.points=run.skillPoints||'';$('worldName').textContent=WORLD_NAMES[stageInfo(run.stage).world-1];$('objective').textContent=objectiveText();$('stageLabel').textContent=`ด่าน ${stageName()}`;$('weapon').textContent=weaponHud();const boss=run.enemies.find(e=>e.guardian&&e.hp>0);$('bossbar').hidden=!boss;if(boss){$('bossHp').style.width=`${boss.hp/boss.max*100}%`;$('bossName').textContent=`${boss.raid?RAID_BOSS_NAME:boss.type==='boss'&&!boss.mini?themeFor(boss.stage).bossName:boss.mini?'ผู้พิทักษ์ย่อย':'อัศวินผู้พิทักษ์'} · ด่าน ${stageName()}`;}
while(seen<run.events.length){const ev=run.events[seen++];if(awayFrom)continue;if(ev.type==='magnet_charges'){toast(`ได้ตัวดูดเพิ่ม +${ev.added} ครั้ง (มี ${ev.total}) · ใช้ไม่หมดทบไปด่านต่อไป`);}else if(ev.type==='boss_rage'){toast('บอสเลือดครึ่ง! เรียกองครักษ์ และโจมตีถี่ขึ้น');}else if(ev.type==='boss_berserk'){toast('บอสคลั่งเต็มที่! ดาเมจที่รับ ×2 • ถ้าไม่ไหวให้กลับไปฟาร์มเพิ่มพลัง');}else if(ev.type==='crystal_burst'){toast('คริสตัลปรากฏ! เดินเข้าใกล้เพื่อรับพลัง');beep('loot');}if(ev.type==='evolution_unlocked'){toast('EVOLUTION! พลังเปลี่ยนร่างแล้ว');beep('portal');}if(ev.type==='elite_start')toast('ศัตรูพิเศษปรากฏ!');if(ev.type==='boss_start')toast(ev.kind==='boss'?`บอสโลก ${themeFor(ev.stage).bossName} ปรากฏ! ล้มให้ได้ใน ${BERSERK_AT} วิ ก่อนมันคลั่ง`:ev.kind==='mini'?'บอสย่อยปรากฏ! หลบวงเตือนสีแดง':'ผู้พิทักษ์ด่านปรากฏ!');if(ev.type==='level_up'&&run.job!=='novice')toast(`เลเวล ${ev.level}! ได้แต้มสกิล (กด K)`);if(ev.type==='hard_unlocked')toast(`ผ่านครบ ${LAST_STAGE} ด่าน! ปลดล็อกโหมดยาก`);if(ev.type==='stage_start')toast(`ด่าน ${stageName()} เริ่ม!`);if(ev.type==='weapon_up'){toast(`สวมอาวุธใหม่! ${ev.name} · ${TIERS[ev.tier].label}`);}if(ev.type==='armor_up'){toast(`สวมของใหม่! ${ev.name} · ${TIERS[ev.tier].label}`);}if(ev.type==='loot_pickup'&&!run.events.slice(seen).some(x=>x.type==='weapon_up'||x.type==='armor_up')){toast(`ได้ ${ev.name} · ${TIERS[ev.tier].label}${run.level<REQ_LEVEL[ev.tier]?` (ใส่ได้ Lv.${REQ_LEVEL[ev.tier]})`:''}`);}if(ev.type==='enhanced'||ev.type==='enhance_failed'||ev.type==='item_sold'||ev.type==='gear_changed'||ev.type==='bought'||ev.type==='potion')continue;if(ev.type==='gold_gem'){toast(`✦ คริสตัล EXP ทองคำ! +${ev.value} EXP`);}if(ev.type==='auto_sold'){toast(`กระเป๋าเต็ม • ขาย ${ev.name} อัตโนมัติ`);}if(ev.type==='stage_failed'){toast(`แพ้ด่าน ${stageInfo(ev.stage).label} • กลับไปฟาร์มด่าน ${stageName()} เพื่อเก็บของและเลเวล`);}if(ev.type==='stage_clear'){toast(`ผ่านด่าน ${ev.label}! ${'★'.repeat(ev.stars)}${'☆'.repeat(3-ev.stars)}${ev.first?' • โบนัสผ่านครั้งแรก':''}`);}}
if(run.state===uiState)return;uiState=run.state;const overlay=$('overlay');setScreen(run.state);overlay.hidden=run.state==='playing';if(run.state==='awakening'){clearInput();renderAwakening();return;}if(run.state==='inventory'){clearInput();renderBag();return;}if(run.state==='shop'){clearInput();renderShop();return;}if(run.state==='skills'){clearInput();renderSkills();return;}if(run.state==='map'){clearInput();renderMap();return;}if(run.state==='pets'){clearInput();renderPets();return;}if(run.state==='topup'){clearInput();renderTopupInGame();return;}if(run.state==='goldPacks'){clearInput();openGoldPacks({root:overlay,getRun:()=>run,getCharacter:()=>characterStore.active,save:saveRun,onClose:closePanel,onTopup:showTopup});return;}if(run.state==='party'){clearInput();renderParty();return;}if(run.state==='ranking'){clearInput();renderRanking();return;}if(run.state==='raidResult'){clearInput();renderRaidResult();return;}
if(run.state==='paused'){overlay.innerHTML='<div class="panel"><div class="eyebrow">TAKE A BREATH</div><h2>พักการผจญภัย</h2><p>เวลาในสนามหยุดอยู่</p><button class="primary" id="resume">กลับเข้าสนาม ↗</button><button class="secondary" id="switchCharacter">เลือกตัวละครอื่น</button><details class="restore-box"><summary>มีโค้ดกู้คืนความคืบหน้า?</summary><div class="party-code-in"><input id="restoreCode" maxlength="12" placeholder="โค้ด 10 ตัว" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="secondary" id="restoreGo">ใช้โค้ด</button></div><p class="party-note" id="restoreMsg"></p></details></div>';$('resume').onclick=pause;$('switchCharacter').onclick=showCharacterLobby;$('restoreGo').onclick=useRestoreCode;$('resume').focus();}
if(run.state==='ended'){if(!saved){saved=true;try{characterStore.removeItem(SAVE_KEY);characterStore.setItem('tilmo-stash',JSON.stringify(run.stash()));}catch{}history.push({at:new Date().toISOString(),reason:run.result,kills:run.kills,level:run.level,stage:run.stage,weaponTier:run.weaponTier,job:run.job,events:run.events});history=history.slice(-20);try{characterStore.setItem('tilmo-runs',JSON.stringify(history));}catch{}}const cleared=run.bossesDefeated;overlay.innerHTML=`<div class="panel intro"><div class="eyebrow">${cleared?`${cleared} GUARDIAN${cleared>1?'S':''} DOWN`:'ANOTHER BUILD. ANOTHER CHANCE.'}</div><h2>${cleared?`ไปได้ถึงด่าน ${run.stage}!`:'การผจญภัยยังไม่จบ'}</h2><p>${run.result==='boss'?'ผู้พิทักษ์โจมตีคุณล้ม ลองหลบวงเตือนสีแดง':'ฝูงศัตรูล้อมคุณได้ ลองเก็บระยะและอัปเกรดอาวุธ'}<br>ด่าน ${run.stage} · Lv.${run.level} · กำจัด ${run.kills} ตัว · ${Math.floor(run.t/60)}:${String(Math.floor(run.t%60)).padStart(2,'0')}</p><p style="font-size:12px">${run.job==='novice'?'ดาบฝึกหัด':`${weaponName(run.job,run.weaponTier)} · ${TIERS[run.weaponTier].label}`}<br>${SKILLS.filter(s=>run.skills[s.id]).map(s=>`${s.name} ${run.skills[s.id]}`).join(' · ')||'ยังไม่มีสกิล'}</p><button class="primary" id="again">ลอง Build ใหม่ ↗</button><button class="secondary" id="switchCharacter">เลือกตัวละครอื่น</button><button class="secondary" id="export">ดาวน์โหลดผลทดสอบ</button><small>สถิติ ${history.length} รอบเก็บเฉพาะเครื่องนี้</small></div>`;$('again').onclick=start;$('switchCharacter').onclick=showCharacterLobby;$('again').focus();$('export').onclick=()=>{const blob=new Blob([JSON.stringify(history,null,2)],{type:'application/json'}),a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download='tilmo-playtest.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};}}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function line(x,y,tx,ty,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();}
function poly(points,fill,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
// EXP crystal: size grows with value (log scale); colour steps cyan → green → violet; gold is a large sparkling crystal.
const GEM_COLORS=[['#91f5ed','#e1fff3','#5ca88b55'],['#8cf59a','#eaffe0','#5ca86b55'],['#c79bff','#f3e6ff','#7a5ca855'],['#ffd84a','#fff7c8','#b8891a66']];
function drawGem(g){const k=g.gold?2.1:Math.min(2,1+.3*Math.log2(g.value)),[fill,rim,shade]=GEM_COLORS[g.gold?3:g.value>=8?2:g.value>=2?1:0],t=run.t,bob=Math.sin(t*4+g.x*.05)*2*k,h=9*k,w=6*k,y=g.y-bob;
ellipse(g.x,g.y+5*k,9*k,4*k,shade);
if(g.gold||g.value>=8){ctx.save();ctx.globalAlpha=.35+.2*Math.sin(t*6+g.x);ellipse(g.x,y,w*2.2,h*1.6,g.gold?'#ffe680':'#d9b8ff');ctx.restore();}
poly([[g.x,y-h],[g.x+w,y],[g.x,y+h*.9],[g.x-w,y]],fill,rim);poly([[g.x,y-h],[g.x+w*.45,y-h*.1],[g.x,y+h*.2]],'#ffffff88');
if(g.gold){for(let i=0;i<3;i++){const a=t*3+i*2.1,r=w*2;ctx.save();ctx.globalAlpha=.6+.4*Math.sin(t*8+i);ellipse(g.x+Math.cos(a)*r,y+Math.sin(a)*r*.6,2.2,2.2,'#fffbe0');ctx.restore();}}}
function ground(){if(artStyle==='toon'){drawToonArena(ctx,run.t,run.stage);return;}if(drawForest(ctx,run.t))return;ctx.fillStyle='#779d68';ctx.fillRect(-1100,-1100,2200,2200);for(let y=-1000;y<=1000;y+=64)for(let x=-1000;x<=1000;x+=90){const n=Math.sin(x*12.4+y*7.8)*.5+.5;ellipse(x+n*35,y,40,20,n>.5?'#7da36b':'#739962');if(Math.abs(x+Math.sin(y*.006)*180)<165){poly([[x-41,y],[x,y-20],[x+41,y],[x,y+20]],n>.5?'#a8b58a':'#b3bd94','#98a67c');}else{line(x,y,x+3,y-9,'#a2c77b',2);if(n>.87){ellipse(x,y-10,3,3,'#f9d8a4');ellipse(x+5,y-8,2,2,'#fff1c4');}}}
// A real world boundary, with layered stonework and woodland outside it.
ctx.strokeStyle='#486b56';ctx.lineWidth=18;ctx.strokeRect(-820,-820,1640,1640);
for(let i=0;i<55;i++){const a=i*2.399,x=Math.cos(a)*(590+(i%4)*100),y=Math.sin(a)*(570+(i%3)*110);if(Math.abs(x)<190)continue;ellipse(x,y+22,47,17,'#264d4038');poly([[x-30,y-28],[x+7,y-40],[x+36,y-20],[x+29,y+22],[x-28,y+16]],'#7e9485','#526e63');poly([[x-30,y-28],[x+7,y-40],[x+36,y-20],[x,y-10]],'#a4b5a0');ellipse(x-10,y-26,23,7,'#709661');}
}
function tree(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ellipse(5,10,70,25,'#153f3e35');poly([[-12,4],[-9,-85],[9,-85],[17,4]],'#6e6b48');ellipse(0,-100,67,48,'#315f4f');ellipse(-28,-117,43,33,'#427c57');ellipse(24,-129,50,37,'#55925e');ellipse(6,-146,40,24,'#79a66a');ellipse(-35,-126,22,15,'#74a067');ctx.restore();}
function hero(x,y){drawHero(ctx,x,y,{time:run.t,moving:run.moving,direction:run.direction,distance:run.motionDistance,job:run.job,appearance:run.appearance,inv:run.p.inv,facing:run.facing,attacking:run.swing>0,tier:run.weaponTier,plus:run.weaponPlus,pose:run.pose,armor:run.armorLook??-1,helmet:run.helmetTier??-1});}
const MOD_COLORS={swift:'#7ff0ff',shield:'#ffd25a',burst:'#ff5a4a',giant:'#c48aff'};
function monster(e){if(e.mod||e.guardian&&e.type==='elite'){ctx.save();ctx.globalAlpha=.6+.25*Math.sin(run.t*6+e.id);ctx.strokeStyle=e.guardian?'#ffe08a':MOD_COLORS[e.mod];ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(e.x,e.y+4,e.r*1.25,e.r*.55,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  if(e.mini||e.mod==='giant'){const k=e.mini?.72:1.35;ctx.save();ctx.translate(e.x,e.y);ctx.scale(k,k);ctx.translate(-e.x,-e.y);monsterArt(e);ctx.restore();}else monsterArt(e);
  if(e.guardian&&e.type==='elite'){ctx.save();ctx.translate(e.x,e.y-e.r*2.6);ctx.fillStyle='#ffd25a';ctx.strokeStyle='#5a3a10';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-10,4);ctx.lineTo(-10,-4);ctx.lineTo(-5,0);ctx.lineTo(0,-7);ctx.lineTo(5,0);ctx.lineTo(10,-4);ctx.lineTo(10,4);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}}
function monsterArt(e){if(artStyle==='toon'){drawToonMonster(ctx,e,run.t,run.p);return;}if(drawMonster(ctx,e,run.t,run.p))return;if(drawSlime(ctx,e,run.t,run.p))return;const {x,y}=e;ctx.save();ctx.translate(x,y);const scale=e.type==='boss'?2.7:e.type==='elite'?1.8:1;ctx.scale(scale,scale);const bob=Math.sin(run.t*5+e.id)*2;ellipse(0,12,20,7,'#294b484a');ctx.translate(0,bob);if(e.type==='runner'){poly([[-22,-8],[-35,-20],[-25,4],[-12,5]],'#8c79ac','#4c456f');poly([[22,-8],[35,-20],[25,4],[12,5]],'#8c79ac','#4c456f');ellipse(0,-3,16,14,e.flash?'#fff5db':'#7771a8');poly([[-12,-12],[-14,-24],[-3,-14]],'#7771a8');poly([[12,-12],[14,-24],[3,-14]],'#7771a8');}else if(e.type==='archer'){ellipse(0,0,13,15,e.flash?'#fff5db':'#f1d5b0');ellipse(0,-12,24,13,'#cf6c64');ellipse(-10,-17,5,3,'#ffe4be');ellipse(10,-14,6,4,'#ffe4be');line(15,4,26,-9,'#9a7048',3);}else{ellipse(0,0,20,15,e.flash?'#fff8d6':e.type==='boss'?'#91b7c6':'#b7d97b');ellipse(-6,-8,8,3,'#eff9bc80');line(0,-14,2,-25,'#4f8146',3);ellipse(8,-24,8,4,'#80b95b');}ellipse(-7,-2,2.4,3,'#304a50');ellipse(7,-2,2.4,3,'#304a50');line(-3,6,3,6,'#765e5c',1.5);if(e.type==='boss')poly([[-15,-17],[-18,-31],[-6,-25],[0,-35],[7,-25],[19,-31],[15,-17]],'#ffd584','#886840');ctx.restore();if(e.hp<e.max){ctx.fillStyle='#294b46';ctx.fillRect(x-19,y-e.r-20,38,4);ctx.fillStyle='#f2b38a';ctx.fillRect(x-19,y-e.r-20,38*Math.max(0,e.hp/e.max),4);}}
const lootIcons=new Map();function lootIcon(l){const key=`${l.kind}-${l.tier}-${l.job}`;if(!lootIcons.has(key)){const cv=document.createElement('canvas');cv.width=cv.height=64;drawItemIcon(cv.getContext('2d'),{kind:l.kind,tier:l.tier,job:l.job},64);lootIcons.set(key,cv);}return lootIcons.get(key);}
function drawLoot(l){const t=TIERS[l.tier],bob=Math.sin(run.t*4+l.id)*4;ctx.save();ctx.translate(l.x,l.y);ellipse(0,6,16,6,'#12303060');glow(ctx,0,-16+bob,38,`${t.color}66`);ctx.translate(0,-16+bob);ctx.beginPath();ctx.roundRect(-17,-17,34,34,7);ctx.save();ctx.clip();ctx.drawImage(lootIcon(l),-17,-17,34,34);ctx.restore();ctx.strokeStyle=t.color;ctx.lineWidth=2.5;ctx.stroke();ctx.restore();}
function render(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#325a55';ctx.fillRect(0,0,w,h);ctx.save();ctx.translate(w/2,h/2+35);ctx.scale(zoom,zoom);const camera=cameraPosition(run.p,w,h,zoom);ctx.translate(-camera.x,-camera.y);ground();
for(const e of run.enemies)if(e.warn){const q=e.warn;ctx.globalAlpha=.35+Math.sin(run.t*20)*.13;if(q.kind==='dash'){line(q.ox,q.oy,q.x,q.y,'#ff594f',96);ctx.globalAlpha=1;line(q.ox,q.oy,q.x,q.y,'#ffe2ba',3);}else{const pts=q.kind==='meteor'?q.pts:[q],R=q.kind==='shot'||q.kind==='shot3'?30:q.r||95,col=q.kind==='nova'||q.kind==='summon'?'#b45aff':q.kind==='boom'?'#ff8a2a':'#e45f53',fill=1-Math.max(0,q.t)/1.25;
  for(const m of pts){ctx.globalAlpha=.3+Math.sin(run.t*20)*.12;ellipse(m.x,m.y,R,R,col);ctx.globalAlpha=.55;ellipse(m.x,m.y,R*Math.min(1,fill),R*Math.min(1,fill),col);ctx.globalAlpha=1;ctx.strokeStyle='#fff0bd';ctx.lineWidth=3;ctx.beginPath();ctx.arc(m.x,m.y,R,0,Math.PI*2);ctx.stroke();ctx.font='bold 28px sans-serif';ctx.fillStyle='#fff1bd';ctx.textAlign='center';ctx.fillText(q.kind==='summon'?'☠':'!',m.x,m.y+8);}}ctx.globalAlpha=1;}
for(const g of run.gems)drawGem(g);
for(const g of run.coins){ellipse(g.x,g.y+4,6,2.5,'#5a4a1a40');ellipse(g.x,g.y-2,6,6,'#e8a92a');ellipse(g.x,g.y-2,4.4,4.4,'#ffd56a');ellipse(g.x-1.4,g.y-3.6,1.4,1.2,'#fff6d0');}
for(const l of run.loot)drawLoot(l);
for(const z of run.zones)drawZone(ctx,z,run.t);
renderEnemies.length=0;
const left=camera.x-w/(2*zoom)-170,right=camera.x+w/(2*zoom)+170,top=camera.y-(h/2+35)/zoom-170,bottom=camera.y+(h/2-35)/zoom+170;
for(const enemy of run.enemies)if(enemy.x>=left&&enemy.x<=right&&enemy.y>=top&&enemy.y<=bottom)renderEnemies.push(enemy);
renderEnemies.sort((a,b)=>a.y-b.y);let drawnHero=false;
for(const enemy of renderEnemies){if(!drawnHero&&enemy.y>run.p.y){hero(run.p.x,run.p.y);drawnHero=true;}monster(enemy);}
if(!drawnHero)hero(run.p.x,run.p.y);
{const rb=run.raid&&run.enemies.find(e=>e.raid);if(rb){const list=run.raid.raiders.filter(x=>x.x!==undefined).slice(0,30);list.forEach((x,i)=>{const px=x.x,py=x.y;drawHero(ctx,px,py,{job:x.job,appearance:x.appearance,tier:x.tier,plus:x.plus|0,armor:x.armor,helmet:x.helmet,time:run.t+i*.7,moving:x.moving,attacking:!!x.atk,facing:x.face,direction:x.direction||'se'});ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#10203a';const tag=`${x.name} Lv.${x.lv}`;ctx.strokeText(tag,px,py-120);ctx.fillStyle='#bff0ff';ctx.fillText(tag,px,py-120);});}}
for(const m of party.list()){if(!allyHere(m))continue;const s=m.s,a=m.ally||{},sw=a.swing>0;drawHero(ctx,m.x,m.y,{job:s.job,appearance:s.app,tier:s.tier,plus:s.plus|0,armor:s.armor,helmet:s.helmet,time:run.t+m.id*.9,moving:s.mv,attacking:s.atk||sw,facing:sw?a.face:s.face,direction:s.dir});const label=`${s.name} Lv.${s.lv}`;ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.lineWidth=3.5;ctx.strokeStyle='#0c2a18';ctx.strokeText(label,m.x,m.y-124);ctx.fillStyle='#8dffb0';ctx.fillText(label,m.x,m.y-124);ctx.fillStyle='#0c2a18';ctx.fillRect(m.x-24,m.y-118,48,6);ctx.fillStyle=s.hp>.35?'#5ce07a':'#ff5a5a';ctx.fillRect(m.x-23,m.y-117,46*s.hp,4);}
if(run.petPos&&run.pet()){ctx.save();ctx.translate(run.petPos.x,run.petPos.y);ctx.scale(1.8,1.8);drawToonPet(ctx,run.petId,run.t,run.petPos.moving,run.petPos.face);if(run.petPos.bite>0){const k=run.petPos.bite/.15;ctx.globalAlpha=k;ctx.strokeStyle='#fff6c8';ctx.lineWidth=3;for(const o of [-5,0,5]){ctx.beginPath();ctx.arc(run.petPos.face*22,-14+o,11,-.9,.9);ctx.stroke();}ctx.globalAlpha=1;}ctx.restore();}
for(const d of run.dronePositions())drawDrone(ctx,d,run.t,run.weaponTier);
if(artStyle==='painted'&&!sceneStatus.ground)for(let i=0;i<20;i++){const a=i*2.399;tree(Math.cos(a)*(720+(i%3)*110),Math.sin(a)*(720+(i%3)*110),1+(i%3)*.2);}
if(run.skills.fire){const n=run.evolved.inferno?6:1+run.skills.fire,r=85*(1+(run.skills.area||0)*.2);for(let i=0;i<n;i++){const a=run.t*2.4+i*Math.PI*2/n,x=run.p.x+Math.cos(a)*r,y=run.p.y+Math.sin(a)*r;drawFire(ctx,x,y,a,run.t,run.evolved.inferno);}}
for(const s of run.shots){if(s.friendly&&drawShot(ctx,s,run.t))continue;if(s.friendly){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.atan2(s.vy,s.vx));glow(ctx,0,0,22,'#8feaff50');line(-30,0,2,0,s.physical?'#c2ffd8':'#8eeaff',5);poly([[12,0],[-3,-7],[-9,0],[-3,7]],'#efffff','#8cd8f5');ctx.restore();}else{ellipse(s.x,s.y,7,7,'#ffad7c');line(s.x-s.vx*.08,s.y-s.vy*.08,s.x,s.y,'#ffe1a3',3);}}
for(const f of run.effects){if(f.kind==='number'&&f.value<2)continue;ctx.save();ctx.globalAlpha=Math.min(1,f.life/f.max*2);const progress=1-f.life/f.max;if(f.kind==='xpText'){ctx.font='bold 18px "Chakra Petch",sans-serif';ctx.textAlign='center';ctx.fillStyle='#ffd84a';ctx.strokeStyle='#5a3d08';ctx.lineWidth=3;const label=`+${f.value} EXP`;ctx.strokeText(label,f.x,f.y-progress*40);ctx.fillText(label,f.x,f.y-progress*40);}else if(f.kind==='number'){ctx.font='bold 16px "Chakra Petch",sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff2bc';ctx.strokeStyle='#3b5846';ctx.lineWidth=3;const label=String(Math.round(f.value));ctx.strokeText(label,f.x,f.y-progress*32);ctx.fillText(label,f.x,f.y-progress*32);}else if(!drawSkillEffect(ctx,f,run.t)){drawEffect(ctx,f,run.t);}ctx.restore();}ctx.restore();
}
function frame(now){try{tick(now);}catch(error){console.error('frame error',error);}requestAnimationFrame(frame);}
// Real players at the same world boss, positioned around our boss from their offset to theirs.
function syncRaiders(){const R=run.raid,b=R&&run.enemies.find(e=>e.raid);if(!b)return;const old=new Map(R.raiders.map(x=>[x.id,x]));
  R.raiders=party.raidList(run.raidJoined).map(r=>{const x=old.get(r.id)||{id:r.id},s=r.s,nx=b.x+r.x,ny=b.y+r.y;
    Object.assign(x,{name:s.name,job:s.job,appearance:s.app,lv:s.lv,tier:s.tier,plus:s.plus|0,armor:s.armor,helmet:s.helmet,dmg:s.dmg,moving:s.mv,atk:s.atk,face:s.face,direction:s.dir,x:nx,y:ny});return x;});}
function partyStep(dt){pollRanking();if(party.status==='idle')party.open();if((socialClock-=dt)<=0){socialClock=.25;social.update();}party.tick(dt,()=>run.partyState());syncRaiders();const list=party.list();run.allies=list.filter(allyHere).map(m=>{m.ally||={id:m.id};Object.assign(m.ally,{x:m.x,y:m.y,job:m.s.job,tier:m.s.tier,hit:m.s.hit});m.ally.swing=Math.max(0,(m.ally.swing||0)-dt);return m.ally;});if((partyRefresh-=dt)<=0){partyRefresh=1;syncPartyBtn();const key=party.code+list.map(m=>[m.id,m.s.lv,m.s.stage,m.s.hard,m.s.raid,m.stale,allyHere(m)].join()).join('|')+run.stage;if(run.state==='party'&&party.code&&key!==partyKey){partyKey=key;renderParty();}}}
function tick(now){const cpuBegin=frameMeter?performance.now():0;const activeFrame=started&&run.state==='playing';let drawn=false;const dt=Math.min(.05,(now-last)/1000||0);last=now;if(document.hidden){frameMeter?.reset();return;}if(started){partyStep(dt);const ix=move.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),iy=move.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);const manual=Math.hypot(ix,iy)>.1;if(awayFrom&&!awaySince){drain(14);if(backlog>=STEP)toast(`กำลังเก็บผลฟาร์ม ${Math.round((1-backlog/Math.max(backlogTotal,1))*100)}%`);else finishAway();}else{run.reviveOnDefeat=autoPlay;if(autoPlay&&run.state==='playing'&&run.magnetClock<=0&&run.gems.length>=8)run.magnet();run.update(dt,autoPlay&&!manual?run.autoInput():{x:ix,y:iy});}for(const cue of run.cues)sfx(cue.name,cue.arg);run.cues.length=0;ui();}music(!started?'town':run.state==='ended'?null:run.bossSpawned?'boss':'field');if(now>toastUntil&&$('toast').textContent)$('toast').textContent='';if((started&&run.state==='playing')||needsRender){render();drawn=true;needsRender=false;}frameMeter?.record(now,performance.now()-cpuBegin,activeFrame,drawn);}requestAnimationFrame(frame);

function renderAwakening(preview=false){setScreen('awakening');const overlay=$('overlay');overlay.innerHTML=`<div class="panel awakening"><div class="eyebrow">${preview?'CLASS PREVIEW · UNLOCK AT LEVEL 10':'LEVEL 10 · YOUR STORY BEGINS'}</div><h2>${preview?'เส้นทางที่รอคุณอยู่':'ถึงเวลาเลือกเส้นทาง'}</h2><p class="awakening-note">รูปลักษณ์ไม่มีผลต่อพลัง • บันทึกไว้ในเครื่องนี้</p><div class="appearance-picker"><button data-look="a" aria-pressed="${appearanceDraft==='a'}">รูปลักษณ์ชาย</button><button data-look="b" aria-pressed="${appearanceDraft==='b'}">รูปลักษณ์หญิง</button></div>${preview?'':`<div class="hero-name"><input id="heroNameInput" maxlength="12" placeholder="ชื่อตัวละคร" aria-label="ชื่อตัวละคร" value="${nameDraft}"><button id="rollName" aria-label="สุ่มชื่อ" title="สุ่มชื่อ">🎲</button></div>`}<div class="cards">${CLASSES.map(c=>`<button class="card class-card" data-job="${c.id}"><canvas width="440" height="400" aria-label="ตัวอย่าง ${c.name}"></canvas><b>${c.name}</b><p>${c.desc}</p><small>${c.tag}</small></button>`).join('')}</div><small>${preview?'ตัวอย่างเท่านั้น • เข้าเล่นก่อน แล้วเลือกจริงที่ Lv.10':'เกมหยุดรอคุณอยู่ • เลือกแล้วอัปเกรดสกิลต่อได้ทันที'}</small>${preview?'<button id="backIntro" class="primary">กลับไปเริ่มผจญภัย ↗</button>':''}</div>`;if(!preview){if(!nameDraft){nameDraft=cleanHeroName(profile?.name)||randomHeroName();$('heroNameInput').value=nameDraft;}$('heroNameInput').oninput=e=>{nameDraft=cleanHeroName(e.target.value);};$('rollName').onclick=()=>{nameDraft=randomHeroName();$('heroNameInput').value=nameDraft;beep();};}overlay.querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>{appearanceDraft=b.dataset.look;renderAwakening(preview);});overlay.querySelectorAll('[data-job]').forEach(b=>{const c=b.querySelector('canvas').getContext('2d');c.translate(220,384);c.scale(artStyle==='toon'?2.9:2.3,artStyle==='toon'?2.9:2.3);drawHero(c,0,0,{job:b.dataset.job,appearance:appearanceDraft});b.onclick=()=>{if(!preview&&run.awaken(b.dataset.job,appearanceDraft,nameDraft||randomHeroName())){profile={job:run.job,appearance:run.appearance,name:run.name};prewarmJob(run.job,run.appearance);try{characterStore.setItem('tilmo-profile',JSON.stringify(profile));}catch{}uiState='';toast('ปลุกพลังสำเร็จ! เปิดหน้าสกิล (K) เพื่อลงแต้มสกิลอาชีพ');}};});if(preview){$('backIntro').onclick=()=>{$('overlay').innerHTML=introMarkup;setScreen('intro');bindIntro();};}}

prepareMusic();
loadWeaponArt().then(()=>{needsRender=true;});
if(artStyle==='painted')loadMonsters().then(()=>{needsRender=true;});
// ?debug exposes the live run for browser checks of later stages and weapon tiers.
if(new URLSearchParams(location.search).has('debug'))window.tilmoDebug=()=>run;
(artStyle==='painted'?loadSprites():Promise.resolve()).then(()=>{needsRender=true;if(spriteStatus.ready&&document.querySelector(".awakening"))renderAwakening(!started);});

(artStyle==='painted'?loadSceneArt():Promise.resolve()).then(()=>{needsRender=true;canvas.dataset.arena=sceneStatus.ground?"forest":"fallback";canvas.dataset.slime=sceneStatus.slime?"painted":"fallback";});
bindIntro();
// Opening the game goes straight into play with the last character (a brand-new player starts right away).
// The character lobby stays one tap away in the pause menu, or open it directly with ?lobby.
if(!new URLSearchParams(location.search).has('lobby')){const save=loadSave();if(save)resume(save);else start();}

setInterval(()=>{if(started&&!document.hidden&&run.state==='playing')track('play',30);},30000);

addEventListener('storage',event=>{if(started&&event.key?.startsWith('tilmo-gold-grant:')){mergeGoldGrants(run,characterStore.active,localStorage);saveRun();}});

function maybeOpenGoldPacks(){if(new URLSearchParams(location.search).has('goldPacks')&&run.state==='playing'){window.history.replaceState(null,'',location.pathname);run.state='goldPacks';uiState='';}}

function showTopup(){
 clearInput();if(started){if(!['playing','goldPacks','paused'].includes(run.state))return;run.state='topup';uiState='';}
 else{setScreen('topup');$('overlay').hidden=false;renderTopupInGame();}
}
function renderTopupInGame(){openTopupPanel({root:$('overlay'),onClose:()=>{if(started)closePanel();else{$('overlay').innerHTML=introMarkup;setScreen('intro');bindIntro();}},onGoldPacks:()=>{if(started){run.state='goldPacks';uiState='';}else{$('overlay').innerHTML=introMarkup;setScreen('intro');bindIntro();toast('เลือกตัวละครและเข้าเกมเพื่อซื้อแพ็กทอง');}}});}
