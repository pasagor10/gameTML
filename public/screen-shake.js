// Accessibility preference is local to this browser/device and defaults off.
const KEY = 'tml-screen-shake';
export function createShakeSettings(storage) {
  let enabled = false;
  try { enabled = storage?.getItem(KEY) === 'on'; } catch { /* Private mode. */ }
  return {
    get: () => enabled,
    set(value) {
      enabled = !!value;
      try { storage?.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* Keep session setting. */ }
      return enabled;
    },
  };
}
let storage;
try { storage = globalThis.localStorage; } catch { /* Blocked storage. */ }
const settings = createShakeSettings(storage);
export const screenShakeEnabled = () => settings.get();
export function setScreenShakeEnabled(enabled) {
  const value = settings.set(enabled);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tml:screen-shake-change', { detail: value }));
  return value;
}
export function shakeCamera(camera, duration, intensity) {
  if (!screenShakeEnabled() || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  camera.shake(duration, intensity);
}
