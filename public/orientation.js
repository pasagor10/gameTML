// Phones play in portrait only.
//
// Browsers only allow locking orientation in fullscreen, and only after a
// user gesture (Android Chrome/Samsung; iPhone Safari has neither). So on a
// touch phone the first tap goes fullscreen and locks portrait where it is
// supported; everywhere else the landscape "rotate" card (orientation.css)
// covers the game until the phone is turned upright.

const phone = matchMedia("(pointer: coarse)").matches;

async function lockPortrait() {
  const root = document.documentElement;
  try {
    if (!document.fullscreenElement && root.requestFullscreen)
      await root.requestFullscreen({ navigationUI: "hide" });
    await screen.orientation?.lock?.("portrait");
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
      () => lockPortrait(),
      { once: true, capture: true },
    );
  document
    .querySelector("#rotate-device button")
    ?.addEventListener("click", lockPortrait);
  if (!canLock)
    document.querySelector("#rotate-device button")?.setAttribute("hidden", "");
}
