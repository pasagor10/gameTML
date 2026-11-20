import { RIVER_LAYOUT, RIVER_PIECES, RIVER_DOCKS } from '/shared/riverside-layout.js';
import { TOWN_WIDTH, TOWN_STREET_Y } from '/shared/town-layout.js';
import { tileStrip } from '/tile-strip.js';

export function preloadRiverside(scene) {
 for (const name of Object.keys(RIVER_PIECES)) scene.load.image(`river-${name}`,`/assets/river-kit/${name}.webp?v=1`);
 scene.load.image('river-water-v3','/assets/river-kit/water-v3.webp?v=3');
 scene.load.image('river-far','/assets/river-kit/far-nangnon-v2.webp?v=2');
}
export function createRiversideMap(scene) {
 const parts=[];
 const texture=scene.textures.get('river-far'),source=texture.getSourceImage();
 if(!texture.has('sky-cap'))texture.add('sky-cap',0,0,0,source.width,2);
 if(!texture.has('water-cap'))texture.add('water-cap',0,0,source.height-2,source.width,2);
 texture.firstFrame='__BASE';
 const width=TOWN_WIDTH+1250;
 // Frame the stacked ridges above the shops; extend only sky and water outside
 // the painting so tall screens never reveal a hard edge or repeated mountains.
 parts.push(scene.add.image(-250,-1200,'river-far','sky-cap').setOrigin(0).setDisplaySize(width,900).setScrollFactor(.78,1).setDepth(-35));
 parts.push(scene.add.image(-250,900,'river-far','water-cap').setOrigin(0).setDisplaySize(width,700).setScrollFactor(.78,1).setDepth(-35));
 const far=scene.add.image(-250,-300,'river-far','__BASE').setOrigin(0).setDisplaySize(width,1200).setScrollFactor(.78,1).setDepth(-34);
 parts.push(far);
 parts.push(tileStrip(scene,-100,TOWN_STREET_Y,TOWN_WIDTH+200,80,'town-street').setOrigin(0).setDepth(-31));
 const water=tileStrip(scene,0,640,TOWN_WIDTH,1000,'river-water-v3').setOrigin(0).setTileScale(1.5).setTint(0xa4c2bf).setDepth(-32);
 parts.push(water);
 const bank=RIVER_PIECES.stonebank;
 for(let x=-40,i=0;x<TOWN_WIDTH+40;x+=bank.w-22,i++)
  parts.push(scene.add.image(x,632,'river-stonebank').setOrigin(0).setFlipX(i%2===1).setDepth(-29));
 const boatRigs=[];
 for(const entry of RIVER_LAYOUT.filter(p=>p.piece==='boat')){
  const size=RIVER_PIECES.landing;
  parts.push(scene.add.image(entry.x-170,entry.y+5,'river-landing').setOrigin(.5,1).setDisplaySize(size.w,size.h).setDepth(-27));
 }
 for(const x of [170,1160,2060,2820,3660,4490]){
  const size=RIVER_PIECES.reeds;
  parts.push(scene.add.image(x,738,'river-reeds').setOrigin(.5,1).setDisplaySize(size.w,size.h).setDepth(-26));
 }
 for(const entry of RIVER_LAYOUT){
  const size=RIVER_PIECES[entry.piece];
  const image=scene.add.image(entry.x,entry.y,`river-${entry.piece}`).setOrigin(.5,1).setDisplaySize(size.w*(entry.scale||1),size.h*(entry.scale||1)).setFlipX(!!entry.flip).setDepth(entry.depth??-28);
  parts.push(image);
  if(entry.piece==='boat')boatRigs.push({image,entry,width:size.w});
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
   ripples.clear();
   const t=scene.reducedMotion?0:time*.001;
   for(const [i,boat] of boatRigs.entries()){
    const y=boat.entry.y-8;
    ripples.fillStyle(0x082e34,.23).fillEllipse(boat.entry.x,y,boat.width*.88,12);
    ripples.lineStyle(1.4,0xa8ded0,.20).strokeEllipse(boat.entry.x,y+3,boat.width*(1.06+Math.sin(t+i)*.025),18);
    boat.image.setY(boat.entry.y+Math.sin(t*.8+i)*1.2);
   }
  },
 };
}
