const history = [];
let popup, openHistory;
export function bindAnnouncements(onHistory) {
  openHistory = onHistory;
  popup = document.createElement('aside'); popup.id = 'announcement-popup'; popup.hidden = true;
  document.querySelector('#game-screen').append(popup);
}
export function receiveAnnouncement(notice, show = true) {
  if (!notice?.id || history.some(a => a.id === notice.id)) return;
  history.push(notice); if (history.length > 40) history.shift();
  if (!show || !popup) return;
  popup.replaceChildren();
  const text = document.createElement('span'); text.textContent = '📣 ' + notice.message;
  const close = document.createElement('button'); close.textContent = '×'; close.setAttribute('aria-label','ปิดประกาศ'); close.onclick = () => popup.hidden = true;
  const more = document.createElement('button'); more.textContent = 'ดูประกาศ'; more.onclick = () => { popup.hidden = true; openHistory(); };
  popup.append(text, more, close); popup.hidden = false;
  const id = notice.id; popup.dataset.id = id;
  setTimeout(() => { if (popup.dataset.id === id) popup.hidden = true; }, 15000);
}
export const announcementHistory = () => [...history].reverse();
