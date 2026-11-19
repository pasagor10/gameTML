// Follow the rendered profile height, including effects and larger text.
export function measureHudLayout(screen, profile, joystick) {
  const top = Math.ceil(profile.bottom - screen.top) + 10;
  const limit = joystick.top > profile.bottom ? joystick.top - screen.top - 48 : screen.height - 160;
  return {
    questTop: top,
    questHeight: Math.max(44, Math.floor(limit - top)),
    chatLeft: Math.ceil(profile.right - screen.left) + 10,
  };
}
export function observeHudLayout(screen) {
  const profile = screen.querySelector('.profile-panel');
  const joystick = screen.querySelector('#joystick-zone');
  const quests = screen.querySelector('#quests');
  // Entry animations translate the profile; measure its final layout position.
  const layoutRect = (el) => {
    let top = 0, left = 0;
    for (let node = el; node && node !== screen; node = node.offsetParent) {
      top += node.offsetTop;
      left += node.offsetLeft;
    }
    return { top, left, bottom: top + el.offsetHeight, right: left + el.offsetWidth, height: el.offsetHeight };
  };
  const update = () => {
    if (!screen.getClientRects().length) return;
    const layout = measureHudLayout({ top: 0, left: 0, height: screen.clientHeight }, layoutRect(profile), layoutRect(joystick));
    screen.style.setProperty('--quest-top', `${layout.questTop}px`);
    screen.style.setProperty('--quest-height', `${layout.questHeight}px`);
    screen.style.setProperty('--chat-left', `${layout.chatLeft}px`);
    const questHeight = quests?.getClientRects().length ? quests.offsetHeight : 0;
    screen.style.setProperty('--world-boss-top', `${layout.questTop + questHeight + 8}px`);
  };
  const observer = new ResizeObserver(update);
  for (const el of [screen, profile, joystick, quests].filter(Boolean)) observer.observe(el);
  window.addEventListener('resize', update);
  update();
  return observer;
}
