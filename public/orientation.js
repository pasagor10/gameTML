// Phones play in landscape only.
//
// Browsers only allow locking orientation in fullscreen, and only after a
// user gesture (Android Chrome/Samsung; iPhone Safari has neither). So on a
// touch phone the first tap goes fullscreen and locks landscape where it is
// supported; everywhere else the portrait "rotate" card (orientation.css)
// covers the game until the phone is turned.

const phone = matchMedia("(pointer: coarse)").matches;

async function lockLandscape() {
  const root = document.documentElement;
  try {
    if (!document.fullscreenElement && root.requestFullscreen)
      await root.requestFullscreen({ navigationUI: "hide" });
    await screen.orientation?.lock?.("landscape");
  } catch {
    // Not supported (iOS) or refused: the rotate card handles it.
  }
}

if (phone) {
  const canLock =
    document.fullscreenEnabled && typeof screen.orientation?.lock === "function";
  if (canLock)
    addEventListener(
      "pointerup",
      () => lockLandscape(),
      { once: true, capture: true },
    );
  document
    .querySelector("#rotate-device button")
    ?.addEventListener("click", lockLandscape);
  if (!canLock)
    document.querySelector("#rotate-device button")?.setAttribute("hidden", "");
}
