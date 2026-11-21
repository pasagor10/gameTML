// Present in the initial HTML, before application modules and hero assets load.
const splash = document.querySelector('#boot-loading');
const started = performance.now();
let dismissed = false;
function dismiss() {
  if (dismissed || !splash) return;
  dismissed = true;
  setTimeout(() => {
    splash.classList.add('leaving');
    setTimeout(() => { splash.hidden = true; }, 350);
  }, Math.max(0, 800 - (performance.now() - started)));
}
if (document.readyState === 'complete') dismiss();
else addEventListener('load', dismiss, { once: true });
// A stalled third-party font or asset must never trap the player behind art.
setTimeout(dismiss, 12000);
addEventListener('pageshow', (event) => { if (event.persisted) dismiss(); });
