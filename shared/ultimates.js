// The server accepts a bounded camera rectangle, never client damage/targets.
export const ULTIMATES = {
  swordsman: { name:'ฟันจันทราถล่มฟ้า', detail:'คลื่นดาบจันทราโจมตีศัตรูทั่วจอ', hits:4, power:1.2, color:'#f3bd69', row:0 },
  archer: { name:'ฝนศรทะลวงนภา', detail:'ฝนศรสายลมโจมตีศัตรูทั่วจอ', hits:6, power:.8, color:'#9de2a9', row:1 },
  mage: { name:'พายุดาราถล่มพิภพ', detail:'พายุดาราโจมตีศัตรูทั่วจอ', hits:4, power:1.2, color:'#9acbff', row:2 },
  priest: { name:'บัวสวรรค์พิพากษา', detail:'แสงบัวสวรรค์โจมตีศัตรูทั่วจอ', hits:4, power:1.2, color:'#f5e4a5', row:3 },
};
export function ultimateArea(player, view) {
  const number = (v, fallback) => Number.isFinite(v) ? v : fallback;
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const width = clamp(number(view?.width,760),360,2400);
  const height = clamp(number(view?.height,1200),360,2400);
  // At an arena edge the player may stand near the viewport edge, but the
  // claimed camera must still contain the caster. No remote targeting.
  return {
    x:clamp(number(view?.x,player.x-width/2),player.x-width,player.x),
    y:clamp(number(view?.y,player.y-height*.65),player.y-height,player.y),
    width,height,
  };
}
export const inUltimateArea = (enemy, area) =>
  enemy.x >= area.x && enemy.x <= area.x+area.width &&
  enemy.y >= area.y && enemy.y-80 <= area.y+area.height;
