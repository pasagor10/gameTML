let send;
const escape = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function bindPartyUi(action) {
  send = action;
  const screen = document.querySelector('#game-screen');
  screen.insertAdjacentHTML('beforeend', '<aside id="party-health" hidden aria-label="สมาชิกปาร์ตี้"></aside><aside id="party-invite" hidden aria-live="polite"></aside>');
}
export function updatePartyUi(state) {
  const health = document.querySelector('#party-health');
  const members = (state.party?.members || []).filter(m => m.id !== state.self.id);
  health.hidden = !members.length;
  health.innerHTML = members.map(m => `<div><strong>${escape(m.name || 'เพื่อน')}</strong><span>${Math.ceil(m.hp)} / ${m.maxHp}</span><meter min="0" max="${m.maxHp}" value="${Math.max(0,m.hp)}" aria-label="เลือด ${escape(m.name)}"></meter></div>`).join('');
  const host = document.querySelector('#party-invite'), invite = state.partyInvite;
  host.hidden = !invite;
  if (!invite) { host.dataset.id = ''; return; }
  if (host.dataset.id === invite.id) return;
  host.dataset.id = invite.id;
  host.innerHTML = `<strong>${escape(invite.name)} ชวนเข้าปาร์ตี้</strong><small>คำเชิญมีอายุ 30 วินาที</small><div><button data-reply="accept">รับคำเชิญ</button><button data-reply="decline">ปฏิเสธ</button></div>`;
  host.querySelectorAll('button').forEach(b => b.onclick = async () => {
    host.querySelectorAll('button').forEach(button => button.disabled = true);
    await send({ action: b.dataset.reply, inviteId: invite.id });
    host.querySelectorAll('button').forEach(button => button.disabled = false);
  });
}
