const $ = (s) => document.querySelector(s);
let mode = new URLSearchParams(location.search).get('account') === 'register' ? 'register' : 'login';
let user = null, busy = false;
async function api(path, data) {
  const response = await fetch('/api/' + path, {
    method: data === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง');
  return result;
}
function setMode(next) {
  if (busy) return;
  mode = next;
  for (const button of document.querySelectorAll('[data-mode]')) {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  }
  $('#confirm-field').hidden = mode !== 'register';
  $('#account-confirm').required = mode === 'register';
  $('#account-password').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  $('#auth-submit').innerHTML = (mode === 'register' ? 'สมัครสมาชิกและไปเลือกผู้กล้า' : 'เข้าสู่ระบบและไปเลือกผู้กล้า') + ' <span>↗</span>';
  $('#auth-hint').textContent = mode === 'register' ? 'จำชื่อบัญชีและรหัสผ่านนี้ไว้ เพื่อเล่นต่อบนเครื่องอื่น' : 'ใช้บัญชีเดิมเพื่อกลับไปหาผู้กล้าของคุณ';
  $('#auth-error').textContent = '';
}
function showAccount(account) {
  user = account;
  $('#account-loading').hidden = true;
  const member = !!user?.registered;
  $('#member').hidden = !member; $('#auth').hidden = member;
  $('#guest-entry').hidden = member;
  $('#guest-play').innerHTML = (user ? 'เล่นต่อด้วยตัวละครผู้มาเยือนเดิม' : 'เล่นแบบผู้มาเยือน') + ' <span>→</span>';
  $('#guest-hint').textContent = user ? 'ใช้ตัวละครเดิมที่เคยสร้างในเบราว์เซอร์นี้ แล้วผูกบัญชีได้ในเกม' : 'ลองเล่นก่อนได้ แล้วผูกบัญชีจากในเกมเพื่อเล่นต่อบนเครื่องอื่น';
  $('#guest-note').hidden = !user || member;
  if (member) $('#member-name').textContent = user.name;
  for (const label of document.querySelectorAll('[data-play-label]'))
    label.textContent = member ? 'เข้าเกม' : user ? 'เล่นต่อ · ตัวละครเดิม' : 'เล่นเลย · ไม่ต้องสมัคร';
  if (user && !member) setMode('register');
}
for (const button of document.querySelectorAll('[data-mode]')) button.onclick = () => setMode(button.dataset.mode);
$('#show-password').onclick = () => {
  const shown = $('#account-password').type === 'password';
  $('#account-password').type = shown ? 'text' : 'password';
  $('#show-password').textContent = shown ? 'ซ่อน' : 'แสดง';
  $('#show-password').setAttribute('aria-pressed', String(shown));
  $('#show-password').setAttribute('aria-label', shown ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
};
$('#auth-form').onsubmit = async (event) => {
  event.preventDefault();
  if (busy) return;
  $('#auth-error').textContent = '';
  if (mode === 'register' && $('#account-password').value !== $('#account-confirm').value) {
    $('#auth-error').textContent = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'; $('#account-confirm').focus(); return;
  }
  busy = true; $('#auth-submit').disabled = true;
  for (const button of document.querySelectorAll('[data-mode]')) button.disabled = true;
  try {
    await api('auth/' + mode, { name: $('#account-name').value.trim(), password: $('#account-password').value });
    location.assign('/play');
  } catch (error) {
    $('#auth-error').textContent = error.message;
  } finally {
    busy = false; $('#auth-submit').disabled = false;
    for (const button of document.querySelectorAll('[data-mode]')) button.disabled = false;
  }
};
$('#logout').onclick = async () => {
  $('#logout').disabled = true;
  try { await api('auth/logout', {}); showAccount(null); }
  catch (error) { $('#auth-error').textContent = error.message; }
  finally { $('#logout').disabled = false; }
};
// One click into the game: members and returning guests go straight in,
// new visitors get a guest account first. No form, no scrolling.
async function playNow(button, errorBox) {
  if (busy) return;
  busy = true; button.disabled = true; errorBox.textContent = '';
  try {
    if (!user) { const result = await api('auth/guest', {}); user = result.user; }
    location.assign('/play');
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    busy = false; button.disabled = false;
  }
}
$('#guest-play').onclick = () => playNow($('#guest-play'), $('#guest-error'));
for (const button of document.querySelectorAll('[data-play-now]'))
  button.onclick = () => {
    const box = document.querySelector('[data-play-error]');
    if (!button.closest('.hero')) box.scrollIntoView({ block: 'center' });
    playNow(button, box);
  };
setMode(mode);
// Straight into the game: a plain visit to the front page (no #account link,
// no ?account / ?home) goes to /play, making a guest account for a new
// visitor first. Crawlers and automated browsers stay on the page.
const params = new URLSearchParams(location.search);
const autoEnter = !location.hash && !params.has('account') && !params.has('home') &&
  !navigator.webdriver && !/bot|crawl|spider|slurp|preview|facebookexternalhit|lighthouse|headless/i.test(navigator.userAgent);
const entering = (on) => document.documentElement.classList.toggle('entering', on);
entering(autoEnter);
api('me').then(async ({ user }) => {
  if (autoEnter) {
    try {
      if (!user) await api('auth/guest', {});
      // ?auto: a returning player goes on into the game (game.js).
      location.replace('/play?auto=1');
      return;
    } catch { entering(false); }
  }
  showAccount(user);
}).catch(() => {
  entering(false);
  showAccount(null); $('#auth-error').textContent = 'ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองเข้าสู่ระบบอีกครั้ง';
});
