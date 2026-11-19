// Keep the visible game page awake; never keep a background tab awake.
// Requests may be refused by power-saving settings, so retry only on a
// fresh interaction or when the page becomes visible again.
export function createScreenAwake({ request, visible, onState = () => {} }) {
  let active = true, pending = false, lock = null;
  async function sync() {
    if (!active || !visible()) {
      const previous = lock;
      lock = null;
      onState('idle');
      try { await previous?.release(); } catch { /* Already released by OS. */ }
      return;
    }
    if (pending || (lock && !lock.released)) return;
    pending = true;
    try {
      const next = await request('screen');
      if (!active || !visible()) {
        await next.release();
        onState('idle');
        return;
      }
      lock = next;
      onState('active');
      next.addEventListener('release', () => {
        if (lock !== next) return;
        lock = null;
        onState('idle');
      }, { once: true });
    } catch {
      onState('unavailable');
    } finally {
      pending = false;
    }
  }
  return { sync, setActive(value) { active = value; return sync(); } };
}

if (typeof document !== 'undefined' && navigator.wakeLock?.request) {
  const awake = createScreenAwake({
    request: (type) => navigator.wakeLock.request(type),
    visible: () => document.visibilityState === 'visible',
    onState: (state) => { document.documentElement.dataset.screenWakeLock = state; },
  });
  document.addEventListener('visibilitychange', awake.sync);
  document.addEventListener('pointerdown', awake.sync, { passive: true });
  window.addEventListener('pagehide', () => { void awake.setActive(false); });
  window.addEventListener('pageshow', () => { void awake.setActive(true); });
  void awake.sync();
}
