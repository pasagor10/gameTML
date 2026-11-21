// In-app iOS browsers can reserve horizontal edge gestures for their own UI.
// Remember the Facebook entry page across the welcome -> /play redirect.
export function facebookIosControls({device,referrer='',storage}={}) {
  const ua=device?.userAgent || '';
  const ios=/iPhone|iPad|iPod/i.test(ua) || (device?.platform==='MacIntel' && device?.maxTouchPoints>1);
  if(!ios) return false;
  if(!storage) { try { storage=window.sessionStorage; } catch {} }
  let facebook=/FBAN|FBAV|FBIOS|FB_IAB/i.test(ua);
  try { facebook ||= /(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(new URL(referrer).hostname); } catch {}
  try {
    if(facebook) storage?.setItem('tml-facebook-ios-controls','1');
    facebook ||= storage?.getItem('tml-facebook-ios-controls')==='1';
  } catch {}
  return facebook;
}

export function claimJoystickTouch(zone,enabled) {
  const claim=event=>{ if(enabled() && event.cancelable) event.preventDefault(); };
  for(const type of ['touchstart','touchmove']) zone.addEventListener(type,claim,{passive:false,capture:true});
}

// Native touch listeners run without depending on pointer capture support.
// Track the owning finger so releasing attack/jump cannot stop movement.
export function bindHoldMovement({root,canMove,onMove,onRelease,events=window,doc=document}) {
  const held=new Map();
  const buttons=[...root.querySelectorAll('[data-move]')];
  const block=e=>{if(e.cancelable)e.preventDefault();e.stopPropagation();};
  const sync=()=>{
    buttons.forEach(b=>b.classList.toggle('pressed',[...held.values()].includes(b)));
    const button=[...held.values()].at(-1);
    if(button) onMove(Number(button.dataset.move)); else onRelease();
  };
  const reset=()=>{held.clear();sync();};
  const endPointer=e=>{if(held.delete(`p:${e.pointerId}`)) sync();};
  for(const button of buttons) {
    button.addEventListener('touchstart',e=>{
      if(!canMove()) return;
      block(e);
      for(const touch of e.changedTouches) held.set(`t:${touch.identifier}`,button);
      sync();
    },{passive:false});
    button.addEventListener('touchmove',e=>{if([...e.touches].some(t=>held.has(`t:${t.identifier}`))) block(e);},{passive:false});
    for(const type of ['touchend','touchcancel']) button.addEventListener(type,e=>{
      let changed=false;
      for(const touch of e.changedTouches) changed=held.delete(`t:${touch.identifier}`)||changed;
      if(changed){block(e);sync();}
    },{passive:false});
    button.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch' || !canMove()) return;
      block(e);held.set(`p:${e.pointerId}`,button);
      try {button.setPointerCapture(e.pointerId);} catch {}
      sync();
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type,endPointer);
    button.addEventListener('click',block);
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture']) events.addEventListener(type,endPointer);
  events.addEventListener('blur',reset);
  events.addEventListener('pagehide',reset);
  events.addEventListener('resize',reset);
  doc.addEventListener('game:reset-controls',reset);
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)reset();});
  return reset;
}
