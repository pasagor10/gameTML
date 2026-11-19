import { GEAR } from '/shared/rpg.js';
// A handful of batched geometry strokes, no full-screen shaders or camera motion.
export function updateDivineAura(scene, actor, hero, now) {
  const count = Object.values(hero.equipment || {}).filter(id => GEAR[id]?.rarity === 'divine').length;
  if (!count || hero.hp <= 0 || !actor.image.visible) { actor.divineAura?.setVisible(false); return; }
  const g = actor.divineAura ||= scene.add.graphics().setDepth(actor.image.depth-.01);
  g.setVisible(true).clear().setPosition(actor.image.x,actor.image.y);
  const t = scene.reducedMotion ? 0 : now*.001, pulse = .7 + Math.sin(t*2)*.15;
  for (let n=0;n<3;n++) {
    g.lineStyle(2+n, n%2?0xffd982:0x9affee, (.22-n*.05)*pulse);
    g.strokeEllipse(0,-4,80+n*15+count*4,19+n*4);
  }
  const particles = scene.lite ? 5 : 8+count*3;
  for(let n=0;n<particles;n++) {
    const phase = (n/particles+t*.18)%1, angle=n*2.399+t*.35;
    const x=Math.sin(angle)*(32+count*5), y=-phase*145;
    const alpha=Math.sin(phase*Math.PI)*.8*pulse, r=2+(n%3);
    g.lineStyle(1,n%2?0xffd982:0xaaffed,alpha);
    g.lineBetween(x-r,y,x+r,y);g.lineBetween(x,y-r,x,y+r);
    if(n%3===0){g.fillStyle(0xffffff,alpha*.8);g.fillCircle(x,y,1.5);}
  }
}
