import { randomUUID } from 'node:crypto';
import { PVP, PVP_MODES, pvpSchedule } from '../shared/pvp.js';

export function createPvpSystem({ players, instances, enter, returnTown, maxHp, eligible, notify = () => {} }) {
  const queue = new Map(), results = new Map(), played = new Map();
  let processed = -Infinity;
  function join(p, mode, t) {
    if (!Object.hasOwn(PVP_MODES, mode)) throw Error('เลือกโหมด 1v1 หรือ 3v3');
    eligible(p);
    const s = pvpSchedule(t);
    if (!s.open || s.cycle <= processed) throw Error('PvP รับสมัครที่นาที :20 และ :50 รอบละ 5 นาที');
    if (played.get(p.id) === s.cycle) throw Error('เข้าร่วม PvP รอบนี้แล้ว รอรอบถัดไป');
    if (queue.has(p.id)) throw Error('อยู่ในคิวแล้ว ยกเลิกคิวก่อนเปลี่ยนโหมด');
    queue.set(p.id, { mode, cycle: s.cycle });
    results.delete(p.id);
    return { message: `เข้าคิว PvP ${mode} แล้ว · อยู่ในเมืองรอจับคู่` };
  }
  function cancel(p) { queue.delete(p.id); return { message: 'ออกจากคิว PvP แล้ว' }; }
  function start(members, mode, cycle, t) {
    const size = PVP_MODES[mode];
    // Alternate stronger/weaker heroes across teams, then reverse each pair.
    const sorted = [...members].sort((a,b) => b.level - a.level);
    const teams = [[], []];
    sorted.forEach((p, n) => teams[Math.floor(n / 2) % 2 ? 1 - n % 2 : n % 2].push(p.id));
    const i = { id: randomUUID(), floor: 1, stage: 1, stageAt: t,
      startedAt: t, members: members.map(p => p.id), enemies: [], events: [], signs: [], hazards: [],
      clear: false, completed: false, pvp: { mode, size, cycle, teams, startsAt: t + PVP.countdown,
        endsAt: Math.min(t + PVP.countdown + PVP.match, (cycle + 1) * PVP.every + PVP.offset - PVP.result - 1), done: false, winner: null, reason: '', returnAt: 0 } };
    instances.set(i.id, i);
    for (const p of members) {
      played.set(p.id, cycle); queue.delete(p.id); results.delete(p.id);
      enter(p, i);
      const team = teams.findIndex(ids => ids.includes(p.id));
      p.x = team ? 1750 + teams[team].indexOf(p.id) * 95 : 650 - teams[team].indexOf(p.id) * 95;
      p.direction = team ? -1 : 1;
      p.cooldowns = {}; p.buffs = {}; p.status = {}; p.lightningUntil = 0;
      p.pvpTeam = team;
      notify(p, `PvP ${mode} · ทีม${team ? 'แดง' : 'น้ำเงิน'} · เริ่มใน ${PVP.countdown} วินาที`);
    }
    return i;
  }
  function finish(i, winner, reason, t) {
    if (i.pvp.done) return;
    Object.assign(i.pvp, { done: true, winner, reason, returnAt: t + PVP.result });
    for (const id of i.members) {
      const p = players.get(id);
      if (p?.instance === i.id) {
        p.auto = false; p.input = 0; p.pending = null; p.action = null;
        notify(p, `PvP ${i.pvp.mode} · ${winner === null ? "เสมอ" : team(p,i) === winner ? "ชนะ!" : "แพ้"} · ${reason}`);
      }
    }
  }
  function current(p) { const i = instances.get(p.instance); return i?.pvp ? i : null; }
  function canFight(p, t) { const i = current(p); return !i || (!i.pvp.done && t >= i.pvp.startsAt && t < i.pvp.endsAt); }
  function team(p, i = current(p)) { return i?.pvp.teams.findIndex(ids => ids.includes(p.id)) ?? -1; }
  function allies(p, i) { return (i.pvp.teams[team(p,i)] || []).map(id => players.get(id)).filter(m => m?.hp > 0 && m.instance === i.id); }
  function leave(p, t) {
    queue.delete(p.id);
    const i = current(p);
    if (!i) return;
    if (i.pvp.done) {
      results.set(p.id, { mode: i.pvp.mode, outcome: i.pvp.winner === null ? 'เสมอ' : team(p,i) === i.pvp.winner ? 'ชนะ' : 'แพ้', reason: i.pvp.reason, at: t });
    } else {
      p.hp = 0;
      results.set(p.id, { mode: i.pvp.mode, outcome: 'แพ้ · ออกจากสนาม', reason: 'สละสิทธิ์', at: t });
    }
    p.pvpTeam = null; p.buffs = {}; p.status = {};
  }
  function update(t) {
    const s = pvpSchedule(t);
    for (const [id, q] of queue) {
      const p = players.get(id);
      try { if (!p || q.cycle !== s.cycle) throw Error(); eligible(p); }
      catch { queue.delete(id); if (p) notify(p, 'ยกเลิกคิว PvP · ต้องอยู่ในเมืองและไม่ติดการแลกเปลี่ยน'); }
    }
    if (t >= s.closesAt && processed < s.cycle) {
      processed = s.cycle;
      for (const [mode, size] of Object.entries(PVP_MODES)) {
        const candidates = [...queue].filter(([,q]) => q.mode === mode).map(([id]) => players.get(id)).filter(Boolean);
        while (candidates.length >= size * 2 && t + PVP.countdown < s.nextAt - PVP.result - 1) start(candidates.splice(0, size * 2), mode, s.cycle, t);
        for (const p of candidates) { queue.delete(p.id); notify(p, `PvP ${mode} ผู้เล่นไม่ครบ · ยกเลิกคิวรอบนี้ ไม่มีค่าใช้จ่าย`); }
      }
    }
    for (const i of [...instances.values()]) {
      if (!i.pvp) continue;
      const a = i.pvp;
      const living = a.teams.map(ids => ids.map(id => players.get(id)).filter(p => p?.hp > 0 && p.instance === i.id));
      if (!a.done && (!living[0].length || !living[1].length)) finish(i, living[0].length ? 0 : living[1].length ? 1 : null, 'กำจัดฝ่ายตรงข้ามครบทีม', t);
      if (!a.done && t >= a.endsAt) {
        const scores = living.map(ms => ms.reduce((n,p) => n + p.hp / maxHp(p), 0));
        finish(i, Math.abs(scores[0] - scores[1]) < .001 ? null : scores[0] > scores[1] ? 0 : 1, 'หมดเวลา · ตัดสินจากสัดส่วน HP รวม', t);
      }
      if (a.done && t >= a.returnAt) {
        for (const id of [...i.members]) {
          const p = players.get(id);
          if (!p || p.instance !== i.id) continue;
          results.set(id, { mode: a.mode, outcome: a.winner === null ? 'เสมอ' : team(p,i) === a.winner ? 'ชนะ' : 'แพ้', reason: a.reason, at: t });
          leave(p,t); returnTown(p);
        }
        instances.delete(i.id);
      }
    }
    for (const [id, cycle] of played) if (cycle < s.cycle - 1) played.delete(id);
    for (const [id, r] of results) if (t - r.at > 3600) results.delete(id);
  }
  function view(p, t) {
    const s = pvpSchedule(t), i = current(p), a = i?.pvp;
    return { ...s, time: t, queued: queue.get(p.id)?.mode || null,
      counts: Object.fromEntries(Object.keys(PVP_MODES).map(mode => [mode, [...queue.values()].filter(q => q.mode === mode).length])),
      result: results.get(p.id) || null,
      match: a ? { mode: a.mode, team: team(p,i), done: a.done, winner: a.winner, reason: a.reason,
        startsIn: Math.max(0, Math.ceil(a.startsAt - t)), left: Math.max(0, Math.ceil(a.endsAt - t)),
        returnIn: a.done ? Math.max(0, Math.ceil(a.returnAt - t)) : null,
        teams: a.teams.map(ids => ids.map(id => { const m = players.get(id); return { id, name: m?.name || 'ออกจากสนาม', hp: m?.instance === i.id ? m.hp : 0, maxHp: m ? maxHp(m) : 1 }; })) } : null };
  }
  return { join, cancel, update, leave, view, canFight, allies, team, current };
}
