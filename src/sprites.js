import { animationFrame, sourceRect, FOOT_ANCHOR, HERO_SCALE } from './sprite-layout.js';
import { drawWeapon } from './weapons.js';
const sheets = new Map();
let ready = false;
let metadata = null;
export const spriteStatus = { ready: false, error: null };
function image(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try{if(img.decode)await img.decode();resolve(typeof createImageBitmap==='function'?await createImageBitmap(img):img);}catch{resolve(img);}
    };
    img.onerror = () => reject(new Error(`โหลดภาพไม่ได้: ${url}`));
    img.src = url;
  });
}
export function animationColumns(appearance, moving) {
  return metadata?.characters[appearance === 'b' ? 'female' : 'male']?.[moving?'run':'idle']?.columns || (moving?8:4);
}
export async function loadSprites() {
  try {
    const [loaded, manifest] = await Promise.all([Promise.all(['male', 'female'].flatMap(sex => ['idle', 'run'].map(async state => {
      const img = await image(`/assets/sprites/heroes/${sex}/${state}.png?revision=run-v4`);
      return [`${sex}-${state}`, img];
    }))), fetch('/assets/sprites/heroes/manifest.json', {cache:'no-store'}).then(response => {if(!response.ok)throw new Error('โหลดข้อมูลเฟรมไม่ได้');return response.json();})]);
    metadata = manifest;
    loaded.forEach(([key, value]) => sheets.set(key, value));
    ready = spriteStatus.ready = true;
  } catch (error) {
    spriteStatus.error = error.message;
    console.warn('Hero sprite fallback:', error.message);
  }
}
export function drawSpriteHero(c, x, y, options = {}) {
  if (!ready) return false;
  const { time = 0, moving = false, appearance = 'a', direction = 'se', inv = 0, job = 'novice', attacking = false, distance, frameIndex, tier = 0 } = options;
  const state = moving ? 'run' : 'idle';
  const sheet = metadata.characters[appearance === 'b' ? 'female' : 'male'][state];
  const columns = sheet.columns;
  const frame = Number.isInteger(frameIndex) ? Math.max(0,Math.min(columns-1,frameIndex)) : animationFrame(time, moving, columns, distance, sheet.timing?.[direction]);
  const rect = sourceRect(direction, frame, columns);
  const img = sheets.get(`${appearance === 'b' ? 'female' : 'male'}-${state}`);
  const scale = HERO_SCALE;
  const socket = metadata?.characters[appearance === 'b' ? 'female' : 'male']?.[state]?.frames[`${direction}-${frame}`]?.hand;
  const back = ['n','ne','nw'].includes(direction);
  const equipment = () => drawEquipment(c,direction,job,time,attacking,socket,tier);
  c.save();c.translate(x, y);
  // HD artwork keeps subpixel positions: integer snapping steps visibly at wide zoom.
  c.imageSmoothingEnabled = true;c.imageSmoothingQuality = 'high';
  c.fillStyle = '#123c4250';c.beginPath();c.ellipse(0, 3, 21, 8, 0, 0, Math.PI * 2);c.fill();
  if (inv > 0 && Math.floor(inv * 15) % 2) c.globalAlpha = .45;
  if(back)equipment();
  c.drawImage(img, rect.x, rect.y, rect.width, rect.height,
    -FOOT_ANCHOR.x * scale, -FOOT_ANCHOR.y * scale, 256 * scale, 256 * scale);
  // Equipment is a separate layer. The source character sheet always stays unarmed.
  if(!back)equipment();
  c.restore();return true;
}
function drawEquipment(c, direction, job, time, attacking, socket, tier) {
  // Provisional socket; the sheet manifest exposes per-frame sockets for later authored equipment.
  const back = ['n','ne','nw'].includes(direction), left = ['sw','w','nw'].includes(direction);
  const x = socket ? (socket.x-FOOT_ANCHOR.x)*HERO_SCALE : left?-17:17;
  const y = socket ? (socket.y-FOOT_ANCHOR.y)*HERO_SCALE : -38;
  c.save();c.translate(x, y);
  c.scale(left ? -1 : 1, 1);
  if (job === 'gunner') c.rotate(attacking ? -.18 : .05);
  else c.rotate(attacking ? (job === 'mage' ? -.25 : -1.1) : (job === 'mage' ? .08 : .35));
  if (back) c.globalAlpha *= .8;
  drawWeapon(c, job, tier, time, {attacking});
  c.restore();
}
