const JOBS={novice:'ฝึกหัด',knight:'นักดาบ',mage:'นักเวท',gunner:'มือปืน'};
const SYMBOL={novice:'⚔',knight:'⚔',mage:'✦',gunner:'⌖'};
export function mountSocial({party,getRun,clearInput}){
 const hud=document.createElement('aside');hud.id='partyHud';hud.setAttribute('aria-label','สถานะเพื่อนในปาร์ตี้');document.querySelector('.hero-card').after(hud);
 const chat=document.createElement('section');chat.id='gameChat';chat.setAttribute('aria-label','แชตผู้เล่น');
 chat.innerHTML='<button id="chatToggle" type="button" aria-expanded="false">แชต <span id="chatBadge" hidden>●</span></button><div id="chatPanel" hidden><header><button data-channel="world" aria-pressed="true">โลก</button><button data-channel="party" aria-pressed="false">ปาร์ตี้</button><button id="chatClose" aria-label="ย่อแชต">−</button></header><ol id="chatMessages" aria-label="ข้อความแชต"></ol><p id="chatStatus" role="status"></p><form id="chatForm"><input id="chatText" maxlength="200" autocomplete="off" placeholder="คุยกับผู้เล่นทั้งโลก…" aria-label="ข้อความแชต"><button type="submit">ส่ง</button></form></div>';
 document.body.append(chat);const $=id=>document.getElementById(id);let channel='world',expanded=false,unread=0,rendered='';
 function drawChat(){
  const stamp=JSON.stringify([channel,party.status,party.code,party.chatError,party.messages[channel]]);if(stamp===rendered)return;rendered=stamp;
  const list=$('chatMessages'),oldScroll=$('chatMessages').scrollTop,nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<35;list.replaceChildren();
  for(const message of party.messages[channel]){const li=document.createElement('li'),name=document.createElement('b'),text=document.createElement('span');name.textContent=`${message.name} · Lv.${message.lv} `;text.textContent=message.text;li.append(name,text);list.append(li);}
  list.scrollTop=nearBottom?list.scrollHeight:oldScroll;
  const ready=party.status==='online'&&(channel!=='party'||!!party.code);
  $('chatStatus').textContent=party.chatError||(!ready?(channel==='party'&&!party.code?'เข้าปาร์ตี้ก่อนเพื่อคุยกับเพื่อน':party.status==='connecting'?'กำลังเชื่อมต่อแชต…':'แชตหลุดการเชื่อมต่อ · กำลังลองใหม่'):'');
  $('chatText').disabled=!ready;$('chatForm').querySelector('button').disabled=!ready;
  $('chatText').placeholder=channel==='party'?'คุยเฉพาะคนในปาร์ตี้…':'คุยกับผู้เล่นทั้งโลก…';
  chat.querySelectorAll('[data-channel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.channel===channel)));
 }
 function expand(value){expanded=value;$('chatPanel').hidden=!value;$('chatToggle').setAttribute('aria-expanded',String(value));if(value){rendered='';unread=0;$('chatBadge').hidden=true;clearInput();drawChat();}}
 $('chatToggle').onclick=()=>expand(!expanded);$('chatClose').onclick=()=>expand(false);
 chat.querySelectorAll('[data-channel]').forEach(b=>b.onclick=()=>{channel=b.dataset.channel;party.chatError='';drawChat();});
 for(const event of ['keydown','keyup','pointerdown','pointerup'])chat.addEventListener(event,e=>{e.stopPropagation();if(event==='keydown'&&e.key==='Escape'){$('chatText').blur();expand(false);}});
 $('chatText').onfocus=clearInput;
 $('chatForm').onsubmit=e=>{e.preventDefault();if(party.chat(channel,$('chatText').value))$('chatText').value='';else{$('chatStatus').textContent='ยังส่งไม่ได้ ตรวจการเชื่อมต่อหรือปาร์ตี้';}};
 party.onchat=message=>{if(!expanded||message?.channel!==channel){unread++;$('chatBadge').hidden=false;}if(expanded)drawChat();};
 let lastHud='';
 return {update(){
  const members=party.list(),key=JSON.stringify([party.code,party.status,members.map(m=>[m.id,m.s.name,m.s.job,m.s.lv,m.s.hp,m.stale])]);
  hud.hidden=!party.code;if(key!==lastHud){lastHud=key;hud.replaceChildren();for(const member of members){
   const s=member.s,row=document.createElement('div');row.className='party-mini'+(member.stale?' stale':'');
   const icon=document.createElement('span');icon.className='party-job';icon.textContent=SYMBOL[s.job]||'⚔';
   const body=document.createElement('div'),name=document.createElement('b'),meta=document.createElement('small'),bar=document.createElement('div'),fill=document.createElement('i'),hp=document.createElement('em');
   name.textContent=s.name;meta.textContent=`${JOBS[s.job]||'ฝึกหัด'} · Lv.${s.lv}${member.stale?' · รอเชื่อมต่อ':''}`;
   const percent=Math.round(Math.min(1,Math.max(0,s.hp??1))*100);bar.className='party-hp';fill.style.width=percent+'%';bar.setAttribute('role','meter');bar.setAttribute('aria-label','เลือด '+s.name);bar.setAttribute('aria-valuenow',String(percent));bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.append(fill);hp.textContent=member.stale?'…':percent+'%';body.append(name,meta,bar);row.append(icon,body,hp);hud.append(row);
  }}if(expanded)drawChat();
 }};
}
