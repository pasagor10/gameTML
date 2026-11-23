// Redeeming a one-time restore code (see server/restore.mjs): the hero gets back the level
// and highest cleared stage they lost, plus a skill point for every level returned.
import {xpNeed,MAX_LEVEL,LAST_STAGE} from './model.js';

export function applyRestore(run, {level = 0, cleared = 0} = {}) {
  const target = Math.min(MAX_LEVEL, level | 0), gained = Math.max(0, target - run.level);
  if (gained) {run.level = target;run.skillPoints += gained;run.xp = 0;run.need = xpNeed(target);}
  const stage = Math.min(LAST_STAGE, cleared | 0), stages = Math.max(0, stage - (run.cleared.normal | 0));
  if (stages) run.cleared.normal = stage;
  if (run.level >= 10 && run.job === 'novice' && !run.awaitingClass) {run.awaitingClass = true;run.emit('class_unlocked');}
  run.emit('progress_restored', {level: run.level, gained, cleared: run.cleared.normal});
  return {gained, stages};
}

export async function redeemRestore(code, who, fetcher = fetch) {
  const r = await fetcher('/api/restore', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code, ...who})});
  const data = await r.json().catch(() => ({error: 'bad'}));
  return r.ok ? data : {error: data.error || (r.status === 429 ? 'rate' : 'bad')};
}

export const RESTORE_ERRORS = {notfound: 'ไม่พบโค้ดนี้ ตรวจตัวอักษรอีกครั้ง', used: 'โค้ดนี้ถูกใช้ไปแล้ว', rate: 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่', bad: 'เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง'};
