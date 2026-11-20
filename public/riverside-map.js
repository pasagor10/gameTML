import { RIVER_LAYOUT, RIVER_PIECES, RIVER_DOCKS } from '/shared/riverside-layout.js';
import { TOWN_WIDTH, TOWN_STREET_Y } from '/shared/town-layout.js';
import { tileStrip } from '/tile-strip.js';

export function preloadRiverside(scene) {
 for (const name of Object.keys(RIVER_PIECES)) scene.load.image(`river-${name}`,`/assets/river-kit/${name}.webp?v=1`);
 scene.load.image('river-far','/assets/river-kit/far-river.webp?v=1');
}
export function createRiversideMap(scene) {
 const parts=[];
 const far=scene.add.image(-250,-900,'river-far').setOrigin(0).setDisplaySize(TOWN_WIDTH+1250,1900).setScrollFactor(.78,1).setDepth(-34);
 parts.push(far);
 parts.push(tileStrip(scene,-100,TOWN_STREET_Y,TOWN_WIDTH+200,80,'town-street').setOrigin(0).setDepth(-31));
 const edge=scene.add.graphics().setDepth(-29);
 edge.fillStyle(0x64462e).fillRect(0,632,TOWN_WIDTH,20);
 edge.lineStyle(3,0xc49c63,.8).lineBetween(0,633,TOWN_WIDTH,633);
 for(let x=20;x<TOWN_WIDTH;x+=160){
  edge.fillStyle(0x493827).fillRect(x,638,12,100);
  edge.fillStyle(0xae8955).fillRect(x-2,637,16,8);
 }
 parts.push(edge);
 for(const entry of RIVER_LAYOUT){
  const size=RIVER_PIECES[entry.piece];
  parts.push(scene.add.image(entry.x,entry.y,`river-${entry.piece}`).setOrigin(.5,1).setDisplaySize(size.w*(entry.scale||1),size.h*(entry.scale||1)).setFlipX(!!entry.flip).setDepth(entry.depth??-28));
 }
 for(const dock of RIVER_DOCKS)
  parts.push(scene.add.image(dock.x+dock.w/2,600,'river-dock').setOrigin(.5,1).setDisplaySize(dock.w,(600-dock.y)/(1-RIVER_PIECES.dock.surfaceRatio)).setDepth(-7));
 const ripples=scene.add.graphics().setDepth(-30);parts.push(ripples);
 // Existing lantern, flower and barrel props remain individual objects.
 for(const [x,key] of [[550,'prop-px-15'],[1180,'prop-px-19'],[1570,'prop-px-20'],[2120,'prop-px-14'],[3140,'prop-px-19'],[3680,'prop-px-20'],[4430,'prop-px-15']])
  parts.push(scene.add.image(x,600,`town-${key}`).setOrigin(.5,1).setDepth(-26));
 let visible=false;
 return {
  setVisible(value){visible=value;parts.forEach(p=>p.setVisible(value));},
  update(time){
   if(!visible)return;
   ripples.clear().lineStyle(2,0x9ce4cf,.14);
   for(let i=0;i<36;i++){
    const x=(i*173+Math.sin((scene.reducedMotion?0:time*.00035)+i)*24)%TOWN_WIDTH,y=680+(i%6)*65;
    ripples.lineBetween(x,y,x+30+(i%4)*15,y);
   }
  },
 };
}
