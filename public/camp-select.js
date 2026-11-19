// Selection artwork is independent of the in-game sprite and equipment system.
const art = '/assets/selection-camp/';
const jobs = ['archer', 'swordsman', 'mage', 'priest'];
export function renderCampSelection({ job, saved, characters, classes, gender, onSelect }) {
  const landing = document.querySelector('#landing');
  let camp = document.querySelector('.camp-scene');
  if (!camp) {
    landing.classList.add('camp-select');
    camp = document.createElement('div');
    camp.className = 'camp-scene';
    camp.innerHTML = `<div class="camp-mountains"></div><div class="camp-village"></div><div class="camp-ground"></div><img class="camp-logo" src="${art}logo.webp" alt="TML Online"><h1 class="camp-title">เลือกตัวละคร</h1><div class="camp-fire" aria-hidden="true"></div><div class="camp-party" role="group" aria-label="เลือกตัวละครรอบกองไฟ">${jobs.map(key => `<button type="button" class="camp-character camp-${key}" data-camp-job="${key}"><img alt=""><span></span></button>`).join('')}</div><div class="camp-summary" aria-live="polite"><div class="camp-portrait"><img alt=""></div><div class="camp-copy"><h2></h2><div><span class="camp-class"></span><b class="camp-level"></b></div></div></div>`;
    landing.prepend(camp);
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'camp-back';
    back.setAttribute('aria-label', 'กลับไปเลือกตัวละคร');
    back.onclick = () => document.querySelector('#creation-back').click();
    landing.append(back);
  }
  const creating = landing.dataset.lobbyMode === 'create';
  let genders = document.querySelector('.camp-genders');
  if (!genders) {
    genders = document.createElement('div');
    genders.className = 'camp-genders';
    genders.setAttribute('role', 'group');
    genders.setAttribute('aria-label', 'เลือกเพศตัวละคร');
    genders.innerHTML = '<button type="button" data-camp-gender="male">ชาย</button><button type="button" data-camp-gender="female">หญิง</button>';
    document.querySelector('.lobby-roster').append(genders);
  }
  genders.hidden = !creating;
  genders.style.display = creating ? '' : 'none';
  genders.querySelectorAll('button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.campGender === gender));
    button.onclick = () => document.querySelector(`[data-gender="${button.dataset.campGender}"]`).click();
  });
  document.querySelector('.camp-back').hidden = !creating || !characters.length;
  camp.querySelector('.camp-title').textContent = creating ? 'สร้างตัวละคร' : 'เลือกตัวละคร';
  camp.querySelectorAll('[data-camp-job]').forEach(button => {
    const key = button.dataset.campJob;
    const active = key === job;
    const character = characters.find(c => c.class === key);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', `${character?.name || classes[key].name} · ${classes[key].name}`);
    button.querySelector('img').src = `${art}${key}-${active ? 'stand' : 'sit'}.webp`;
    button.querySelector('span').textContent = character?.name || classes[key].name;
    button.onclick = () => onSelect(key, creating ? null : character);
  });
  camp.querySelector('.camp-copy h2').textContent = saved?.name || classes[job].name;
  camp.querySelector('.camp-class').textContent = `${classes[job].icon} ${classes[job].name}`;
  camp.querySelector('.camp-level').textContent = `Lv.${saved?.level || 1}`;
  const portrait = camp.querySelector('.camp-portrait img');
  portrait.src = `${art}${job}-stand.webp`;
  portrait.alt = saved?.name || classes[job].name;
  document.querySelector('#start-label').textContent = saved ? 'เข้าเกม' : 'สร้างผู้กล้า';
}
