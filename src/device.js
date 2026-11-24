// Phone-game device behaviour: the page never zooms, and the screen stays awake while a run is being played.

// --- No zoom -------------------------------------------------------------
// iOS Safari ignores user-scalable=no, so pinch and double-tap are also blocked here.
const stop = (e) => { if (e.cancelable) e.preventDefault(); };
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, stop, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) stop(e); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  // A second tap within 300ms would zoom; inputs keep normal behaviour so text can still be selected.
  if (now - lastTouchEnd < 300 && !e.target.closest?.('input,textarea,select,[contenteditable]')) stop(e);
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('dblclick', stop, { passive: false });
// Desktop: ctrl/cmd + wheel (trackpad pinch) and ctrl/cmd + plus/minus/0.
addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) stop(e); }, { passive: false });
addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)) stop(e); });

// --- Keep screen awake while playing -------------------------------------
let lock = null;
let pending = false;
const playing = () => document.body?.dataset.screen === 'playing' && document.visibilityState === 'visible';
async function syncWakeLock() {
  if (!('wakeLock' in navigator)) return;
  if (playing()) {
    if (lock || pending) return;
    pending = true;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
      if (!playing()) { lock.release().catch(() => {}); lock = null; }
    } catch { /* denied or not allowed yet (needs a user gesture on some browsers); retried on the next tap */ }
    pending = false;
  } else if (lock) {
    const l = lock; lock = null;
    l.release().catch(() => {});
  }
}
new MutationObserver(syncWakeLock).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
document.addEventListener('visibilitychange', syncWakeLock);
// The browser drops the lock when the tab is hidden; a tap after returning re-acquires it if needed.
document.addEventListener('pointerdown', syncWakeLock, { passive: true });
syncWakeLock();
