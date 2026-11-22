// Shared geometry follows the painted forest clearing; water/trees/ruins stay outside play.
// v0.16: the clearing is ~1.6x wider (2.7x the area) than the original 2200 painted map.
export const ARENA_SIZE = 3600;
export const ARENA_HALF = ARENA_SIZE / 2;
const SOURCE_SIZE = 1254;
const mapPoint = ([x,y]) => ({x:(x-SOURCE_SIZE/2)*ARENA_SIZE/SOURCE_SIZE,y:(y-SOURCE_SIZE/2)*ARENA_SIZE/SOURCE_SIZE});
export const ARENA_POLYGON = [[300,230],[800,230],[1030,310],[1060,650],[1050,940],[900,1030],[420,1090],[250,1000],[185,780],[185,400]].map(mapPoint);
export function constrainToArena(point, radius = 16) {
  const result = { x: point.x, y: point.y };
  for (let pass=0;pass<8;pass++) {
    let moved=false;
    for(let i=0;i<ARENA_POLYGON.length;i++) {
      const a=ARENA_POLYGON[i],b=ARENA_POLYGON[(i+1)%ARENA_POLYGON.length];
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
      const distance=(result.x-a.x)*nx+(result.y-a.y)*ny;
      if(distance<radius){result.x+=nx*(radius-distance);result.y+=ny*(radius-distance);moved=true;}
    }
    if(!moved)break;
  }
  return result;
}
export function isInArena(point, radius=0) {
  return ARENA_POLYGON.every((a,i)=>{
    const b=ARENA_POLYGON[(i+1)%ARENA_POLYGON.length],dx=b.x-a.x,dy=b.y-a.y;
    return ((point.x-a.x)*-dy+(point.y-a.y)*dx)/Math.hypot(dx,dy)>=radius-1e-6;
  });
}
export function enemySpawn(player,radius,angle,bodyRadius) {
  let best=null,bestDistance=-1;
  for(let i=0;i<16;i++){
    const a=angle+i*Math.PI*(3-Math.sqrt(5));
    const point=constrainToArena({x:player.x+Math.cos(a)*radius,y:player.y+Math.sin(a)*radius},bodyRadius);
    const distance=Math.hypot(point.x-player.x,point.y-player.y);
    if(distance>bestDistance){best=point;bestDistance=distance;}
    if(distance>=Math.min(radius*.75,220))return point;
  }
  return best;
}
export function cameraPosition(player,width,height,zoom,offsetY=35){
  const halfWidth=width/(2*zoom),top=(height/2+offsetY)/zoom,bottom=(height/2-offsetY)/zoom;
  const clamp=(n,min,max)=>min>max?(min+max)/2:Math.max(min,Math.min(max,n));
  return {x:clamp(player.x,-ARENA_HALF+halfWidth,ARENA_HALF-halfWidth),y:clamp(player.y,-ARENA_HALF+top,ARENA_HALF-bottom)};
}
