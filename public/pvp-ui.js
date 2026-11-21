import { pvpArt } from '/shared/pvp.js';
const clock = (s) => `${Math.floor(Math.max(0,s)/60)}:${String(Math.max(0,s)%60).padStart(2,'0')}`;
export function pvpBanner(mode, button = '') {
  return `<article class="pvp-banner"><picture><source media="(min-width: 768px) and (orientation: landscape)" srcset="${pvpArt(mode,true)}"><img src="${pvpArt(mode)}" alt="PvP ${mode}" loading="lazy"></picture>${button}</article>`;
}
export function openPvpPanel({ state, modal, emit, escape, close }) {
  const p = state.pvp;
  if (!p) return;
  modal('สนามประลอง · PvP', `<div class="pvp-panel">
    <p class="pvp-schedule" data-pvp-schedule></p>
    <p>ทุก 30 นาที เวลา :20 และ :50 · รับสมัคร 5 นาที · แข่งไม่เกิน 3 นาที จบก่อนบอสโลก</p>
    <p class="hint">เข้าคิวในเมือง ไม่เสียพลังงานหรือค่าสมัคร · 3v3 แบ่งทีมอัตโนมัติ · ควบคุมเอง ไม่ใช้ AUTO หรือยา · ล้มแล้วรอจบแมตช์ · ออกจากสนามหรือหลุดการเชื่อมต่อถือว่าสละสิทธิ์ · ไม่มีรางวัลไอเทมในรอบนี้</p>
    ${p.result ? `<p class="pvp-last">ผลล่าสุด ${escape(p.result.mode)} · ${escape(p.result.outcome)} · ${escape(p.result.reason)}</p>` : ''}
    <div class="pvp-choices">${['1v1','3v3'].map(mode => pvpBanner(mode, `<div class="pvp-choice-actions"><span>${mode === '1v1' ? 'ดวลเดี่ยว' : 'ศึกทีม 3 คน'} · ในคิว <b data-pvp-count="${mode}">${p.counts[mode]}</b> คน</span><button class="primary-button" data-pvp-join="${mode}">เข้าคิว ${mode}</button></div>`)).join('')}</div>
    <p data-pvp-queued></p><button id="pvp-cancel" class="ghost-button">ยกเลิกคิว</button>
    ${p.match ? '<button id="pvp-back" class="primary-button">กลับเข้าสนาม</button>' : ''}
  </div>`, 'pvp');
  document.querySelectorAll('[data-pvp-join]').forEach(b => b.onclick = () => emit('pvp:join', { mode: b.dataset.pvpJoin }));
  document.querySelector('#pvp-cancel').onclick = () => emit('pvp:cancel');
  const back = document.querySelector('#pvp-back');
  if (back) back.onclick = close;
  updatePvpUi(state);
}
export function updatePvpUi(state) {
  const p = state?.pvp;
  if (!p) return;
  const panel = document.querySelector('#modal[data-panel="pvp"]');
  if (panel) {
    panel.querySelector('[data-pvp-schedule]').textContent = p.open ? `รับสมัครอยู่ · ปิดใน ${clock(Math.ceil(p.closesAt-p.time))}` : `รอบถัดไปใน ${clock(Math.ceil(p.nextAt-p.time))}`;
    panel.querySelectorAll('[data-pvp-count]').forEach(e => { e.textContent = p.counts[e.dataset.pvpCount]; });
    panel.querySelectorAll('[data-pvp-join]').forEach(e => { e.disabled = !p.open || !!p.queued || !!p.match || state.area !== 'town'; });
    panel.querySelector('[data-pvp-queued]').textContent = p.queued ? `คุณอยู่ในคิว ${p.queued} · อยู่ในเมืองจนปิดรับสมัคร` : 'ยังไม่ได้เข้าคิว';
    panel.querySelector('#pvp-cancel').hidden = !p.queued;
  }
  document.querySelectorAll('[data-panel="pvp"]').forEach(button => {
    button.classList.toggle('has-reward', p.open);
    button.title = p.queued ? `อยู่ในคิว PvP ${p.queued}` : p.open ? 'PvP เปิดรับสมัครอยู่' : 'PvP เปิดรับสมัคร :20 และ :50';
  });
  const hud = document.querySelector('#pvp-hud');
  hud.hidden = !p.match;
  if (!p.match) return;
  const m = p.match;
  hud.querySelector('[data-pvp-title]').textContent = `PvP ${m.mode} · ทีม${m.team ? 'แดง' : 'น้ำเงิน'}`;
  hud.querySelector('[data-pvp-time]').textContent = m.done ? `${m.winner === null ? 'เสมอ' : m.winner === m.team ? 'ชนะ!' : 'แพ้'} · กลับเมืองใน ${m.returnIn} วิ` : m.startsIn ? `เตรียมพร้อม ${m.startsIn} วิ` : `เหลือ ${clock(m.left)}`;
  const roster = hud.querySelector('[data-pvp-roster]');
  const rosterKey = JSON.stringify(m.teams);
  if (roster.dataset.key === rosterKey) return;
  roster.dataset.key = rosterKey;
  roster.replaceChildren(...m.teams.map((team,n) => {
    const col = document.createElement('div'); col.className = n ? 'red' : 'blue';
    for (const hero of team) {
      const row = document.createElement('span');
      row.textContent = `${hero.hp > 0 ? '●' : '✕'} ${hero.name} ${Math.ceil(100*hero.hp/hero.maxHp)}%`;
      col.append(row);
    }
    return col;
  }));
}
export function setPvpLoading(mode) {
  const el = document.querySelector('#area-loading .tml-loading-art');
  if (!el) return;
  const portrait = mode ? pvpArt(mode) : '/assets/loading/tml-adventure.webp';
  const wide = mode ? pvpArt(mode,true) : '/assets/loading/tml-adventure-desktop.webp';
  const source = el.querySelector('source'), img = el.querySelector('img');
  if (source.getAttribute('srcset') !== wide) source.srcset = wide;
  if (img.getAttribute('src') !== portrait) img.src = portrait;
  el.style.setProperty('--tml-loading-image', `url("${matchMedia('(min-width: 768px) and (orientation: landscape)').matches ? wide : portrait}")`);
}
