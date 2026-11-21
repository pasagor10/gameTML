import {test} from 'node:test';
import assert from 'node:assert/strict';
import {facebookIosControls,claimJoystickTouch,bindHoldMovement} from '../public/ios-controls.js';
class Target {
  constructor(move){this.handlers={};this.dataset={move};this.classList={toggle(){}};}
  addEventListener(type,fn,options){(this.handlers[type]??=[]).push({fn,options});}
  fire(type,data={}){const e={cancelable:true,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...data};for(const {fn} of this.handlers[type]||[])fn(e);return e;}
  setPointerCapture(){}
}
test('Facebook iPhone controls survive the welcome redirect, without affecting Android or ordinary Safari',()=>{
  const values=new Map(),storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)};
  const iphone={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile [FBAN/FBIOS;FBAV/500]',maxTouchPoints:5};
  assert.equal(facebookIosControls({device:iphone,storage}),true);
  assert.equal(facebookIosControls({device:{...iphone,userAgent:'iPhone Safari/605.1'},storage}),true);
  assert.equal(facebookIosControls({device:{userAgent:'Android FBAN/FB4A'},storage}),false);
  const blank={getItem:()=>null};
  assert.equal(facebookIosControls({device:{userAgent:'iPhone Safari/605.1'},storage:blank}),false);
  assert.equal(facebookIosControls({device:{userAgent:'iPhone Safari/605.1'},referrer:'https://l.facebook.com/l.php',storage:blank}),true);
  assert.equal(facebookIosControls({device:{userAgent:'iPhone Safari/605.1'},referrer:'https://facebook.com.example.org/',storage:blank}),false);
});
test('joystick claims single-finger browser scrolling only while game controls are available',()=>{
  const zone=new Target();let active=true;
  claimJoystickTouch(zone,()=>active);
  assert.equal(zone.handlers.touchstart[0].options.passive,false);
  assert.equal(zone.handlers.touchmove[0].options.capture,true);
  assert.equal(zone.fire('touchstart',{touches:[{identifier:1}]}).prevented,true);
  active=false;assert.equal(zone.fire('touchmove').prevented,false);
});
function pad(){
  const left=new Target('-1'),right=new Target('1'),events=new Target(),doc=new Target();
  const moves=[];let allowed=true;
  bindHoldMovement({root:{querySelectorAll:()=>[left,right]},canMove:()=>allowed,onMove:n=>moves.push(n),onRelease:()=>moves.push(0),events,doc});
  return {left,right,events,doc,moves,block:()=>{allowed=false;}};
}
test('native touches move without dragging, and releasing another finger cannot release the movement owner',()=>{
  const p=pad();const finger={identifier:8};
  const start=p.right.fire('touchstart',{changedTouches:[finger]});assert.equal(start.prevented,true);assert.deepEqual(p.moves,[1]);
  p.right.fire('touchend',{changedTouches:[{identifier:99}]});assert.deepEqual(p.moves,[1]);
  p.right.fire('touchend',{changedTouches:[finger]});assert.deepEqual(p.moves,[1,0]);
  p.block();p.left.fire('touchstart',{changedTouches:[finger]});assert.deepEqual(p.moves,[1,0]);
});
test('cancellation, backgrounding, and modal opening stop held movement immediately',()=>{
  for(const type of ['blur','pagehide','resize']) {
    const p=pad();p.left.fire('touchstart',{changedTouches:[{identifier:1}]});p.events.fire(type);assert.deepEqual(p.moves,[-1,0]);
  }
  const p=pad();p.left.fire('touchstart',{changedTouches:[{identifier:1}]});p.left.fire('touchcancel',{changedTouches:[{identifier:1}]});assert.deepEqual(p.moves,[-1,0]);
  p.right.fire('touchstart',{changedTouches:[{identifier:2}]});p.doc.fire('game:reset-controls');assert.equal(p.moves.at(-1),0);
});
test('mouse and pen releases work on the button even when parents stop propagation',()=>{
  const p=pad();p.left.fire('pointerdown',{pointerId:4,pointerType:'pen'});assert.deepEqual(p.moves,[-1]);
  p.left.fire('pointerup',{pointerId:4,pointerType:'pen'});assert.deepEqual(p.moves,[-1,0]);
  p.right.fire('pointerdown',{pointerId:8,pointerType:'touch'});assert.deepEqual(p.moves,[-1,0],'touch pointer events must not duplicate native touches');
});
