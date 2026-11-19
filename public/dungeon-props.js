// Finished exploration props, with per-player collection feedback.
export function createDungeonProps(scene) {
  const props = new Map();
  let previousArea;
  const destroy = (p) => { scene.tweens.killTweensOf(p.image); scene.tweens.killTweensOf(p.ring); p.image.destroy(); p.ring.destroy(); };
  return (area, signs) => {
    const changed = area !== previousArea;
    previousArea = area;
    const visible = new Set(signs.filter(s => !s.collected).map(s => s.id));
    for (const [id,p] of props) if (changed || !visible.has(id)) {
      props.delete(id);
      if (changed) destroy(p);
      else {
        scene.tweens.killTweensOf(p.image);
        scene.fx?.ring(p.image.x,p.ring.y,0x9fffea,1.4,420);
        scene.tweens.add({targets:p.image,y:p.image.y-28,alpha:0,duration:260,onComplete:()=>destroy(p)});
      }
    }
    for (const s of signs) {
      if (s.collected || props.has(s.id)) continue;
      const chest = s.id === 'supplies';
      const ring = scene.add.ellipse(s.x,s.y-3,chest?80:64,18,0x60e6d2,.18)
        .setStrokeStyle(1,0xabffe9,.6).setDepth(8);
      const image = scene.add.image(s.x,s.y-(chest?2:12),chest?'explore-chest':'explore-rune')
        .setOrigin(.5,1).setDisplaySize(chest?96:74,chest?96:74).setDepth(9);
      if (!scene.reducedMotion) {
        scene.tweens.add({targets:ring,alpha:.55,duration:1200,yoyo:true,repeat:-1});
        if (!chest) scene.tweens.add({targets:image,y:image.y-9,duration:1600,yoyo:true,repeat:-1,ease:'Sine.inOut'});
      }
      props.set(s.id,{image,ring});
    }
  };
}
