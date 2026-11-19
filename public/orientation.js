// Phones play in portrait only.
//
// The game never takes over the screen by itself. Turned sideways, the
// landscape "rotate" card (orientation.css) covers the game until the phone
// is upright; where the browser can lock orientation (Android Chrome/Samsung,
// only in fullscreen and after a tap), the card's button offers to go
// fullscreen and lock portrait. iPhone Safari can do neither, so the button
// hides there.

const phone = matchMedia("(pointer: coarse)").matches;

async function lockPortrait() {
  const root = document.documentElement;
  try {
    if (!document.fullscreenElement && root.requestFullscreen)
      await root.requestFullscreen({ navigationUI: "hide" });
    await screen.orientation?.lock?.("portrait");
  } catch {
    // Not supported or refused: the rotate card stays.
  }
}

if (phone) {
  const canLock =
    document.fullscreenEnabled && typeof screen.orientation?.lock === "function";
  const button = document.querySelector("#rotate-device button");
  if (canLock) button?.addEventListener("click", lockPortrait);
  else button?.setAttribute("hidden", "");
}
