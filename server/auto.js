import { flyingMonster } from "../shared/extra-monsters.js";
// Auto-battle brain: lock onto one monster, close to a good fighting distance,
// only swing when something is really in reach, pick skills by the situation,
// and step or hop out of telegraphed attacks. Pure decisions; the world applies them.
import { ACTIONS } from "../shared/motion.js";
import { skillOf } from "../shared/skills.js";
import { climbStep } from "../shared/dungeons.js";
import { strikesAt, flooding, underwater, WATER_Y } from "../shared/boss-mechanics.js";

const GROUND = 600,
  REACH_Y = 120, // attacks connect within 130 px vertically; keep a margin
  SWITCH_MARGIN = 260, // a new target must be this much "cheaper" to steal the lock
  STUCK_AFTER = 4; // seconds without getting closer before giving up a target

const flying = (e) => flyingMonster(e.type);

// How much effort a target is: distance, with height costing extra, minus
// bonuses for monsters already fighting us or nearly dead.
function cost(p, e) {
  return (
    Math.abs(e.x - p.x) +
    Math.abs(e.y - p.y) * (flying(e) ? 0.6 : 2.5) -
    (e.aggro ? 90 : 0) -
    (1 - e.hp / e.maxHp) * 140
  );
}

// Monsters a skill would hit right now if we faced `dir`.
export function hitsFor(p, enemies, skill, range, dir) {
  const reach = range + ACTIONS[skill].rangeBonus;
  return enemies.filter(
    (e) =>
      Math.abs(e.x - p.x) <= reach &&
      Math.abs(e.y - p.y) <= REACH_Y &&
      ((e.x - p.x) * dir >= -30 || skill === 3),
  );
}

// Flyers and jumping monsters are not exactly on a platform's foot height.
// Route to a nearby surface from which the attack can reach their altitude.
function combatClimb(actor, target, platforms) {
  if (target.y >= actor.y || platforms.some(p => Math.abs(target.y-p.y)<8 && target.x>=p.x && target.x<=p.x+p.w))
    return climbStep(actor, target, platforms);
  const options = platforms.filter(p => p.y < actor.y-65 && Math.abs(p.y-target.y) <= REACH_Y-8);
  const gap = p => Math.max(p.x-target.x, target.x-p.x-p.w, 0);
  const score = p => gap(p)*3 + Math.abs(p.y-target.y);
  const ledge = options.reduce((best,p) => !best || score(p)<score(best) ? p : best, null);
  if (!ledge) return climbStep(actor, target, platforms);
  return climbStep(actor, { x:Math.max(ledge.x+8, Math.min(ledge.x+ledge.w-8,target.x)), y:ledge.y }, platforms);
}
function followClimb(p, plan) {
  const step = p.climbX;
  const dx = step.x-p.x, vx = p.vx || 0;
  const stop = Math.sign(vx)===Math.sign(dx) ? vx*vx/1800 + Math.abs(vx)*.05 : 0;
  plan.input = Math.abs(dx)>Math.max(2,stop) ? Math.sign(dx) : 0;
  plan.jump = p.grounded && step.jump;
}

// Anything about to land where we stand? Crystal eruptions and boss slams
// only hurt on the ground, so hop if it lands soon, otherwise walk clear.
function threat(p, i, t) {
  // Boss mechanics: rocks and bolts hit at any height, spikes on the floor.
  const hits = strikesAt(i.mech, p.x, p.y, t);
  if (hits.length) {
    const s = hits.reduce((a, b) => (a.impactAt <= b.impactAt ? a : b));
    return i.mech.kind === "spikes"
      ? { zone: s, eta: s.impactAt - t, goal: s.x }
      : { zone: s, eta: s.impactAt - t, away: true };
  }
  const grounded = Math.abs(p.y - GROUND) < 65;
  if (!grounded) return null;
  const zones = [
    ...(i.hazards || []).filter((h) => !h.resolved),
    ...i.enemies
      .filter((e) => e.action?.kind === "slam" && !e.action.resolved)
      .map((e) => e.action),
  ];
  for (const z of zones)
    if (t < z.impactAt && Math.abs(p.x - z.x) < z.radius + 25)
      return { zone: z, eta: z.impactAt - t };
  return null;
}

export function autoBrain(p, i, t, { range, mpMax, platforms, aspd = 1 }) {
  const enemies = i.enemies.filter((e) => e.hp > 0);
  const plan = { input: 0, jump: false, skill: null, direction: p.direction };

  // 1. Dodge first: nothing else matters if a slam is about to land on us.
  //    A flood beats everything: get up onto a ledge and stay there.
  let danger = null;
  if (flooding(i.mech, t)) {
    danger = { flood: true };
    if (!p.grounded || underwater(p.y)) {
      const safe = platforms.filter((q) => q.y < WATER_Y - 5),
        near = (q) => Math.abs(Math.max(q.x, Math.min(q.x + q.w, p.x)) - p.x);
      if (safe.length) {
        const ledge = safe.reduce((a, b) => (near(b) < near(a) ? b : a)),
          climb = p.grounded || !p.autoFloodStep
            ? climbStep(p, { x: ledge.x + ledge.w / 2, y: ledge.y }, platforms)
            : p.autoFloodStep;
        p.autoFloodStep = climb;
        plan.input = Math.abs(climb.x - p.x) > 8 ? Math.sign(climb.x - p.x) : 0;
        plan.jump = p.grounded && climb.jump;
      }
    }
    const strike = threat(p, i, t);
    if (strike?.away && !underwater(p.y)) plan.input = Math.sign(p.x - strike.zone.x) || 1;
  } else { p.autoFloodStep = null; danger = threat(p, i, t); }
  if (danger && !danger.flood) {
    if (danger.goal !== undefined) plan.input = Math.sign(danger.goal - p.x) || 1;
    else if (danger.away) {
      const out = Math.sign(p.x - danger.zone.x) || -p.direction || 1;
      plan.input = p.x < 140 ? 1 : p.x > 2260 ? -1 : out;
    } else if (danger.eta < 0.45) plan.jump = true;
    else plan.input = Math.sign(p.x - danger.zone.x) || -p.direction || 1;
  }

  // Escape without starting another cast (casts slow movement by 64%).
  plan.evade = !!danger && (!danger.flood || !p.grounded || underwater(p.y));
  if (plan.evade) return plan;
  if (!enemies.length) { p.autoTarget = null; return plan; }

  // 2. Keep the locked target unless it died, we are stuck on it, or a much
  //    better one shows up (stops flip-flopping between two monsters).
  let target = enemies.find((e) => e.id === p.autoTarget);
  const best = enemies.reduce((a, b) => (cost(p, b) < cost(p, a) ? b : a));
  if (target) {
    const d = Math.abs(target.x - p.x) + Math.abs(target.y - p.y);
    if (d < (p.autoBestDist ?? Infinity) - 20) {
      p.autoBestDist = d;
      p.autoProgressAt = t;
    }
    if (
      t - (p.autoProgressAt ?? t) > STUCK_AFTER ||
      cost(p, best) < cost(p, target) - SWITCH_MARGIN
    )
      target = null;
  }
  if (!target) {
    target = best;
    if (p.autoTarget !== best.id) { p.climbX = undefined; p.autoClimbing = false; }
    p.autoTarget = best.id;
    p.autoBestDist = Infinity;
    p.autoProgressAt = t;
  }

  const dx = target.x - p.x,
    dir = Math.sign(dx) || p.direction || 1,
    sameLevel = Math.abs(target.y - p.y) <= REACH_Y,
    ranged = range > 200;
  plan.direction = dir;

  // 3. Position: ranged heroes keep their distance (and back off when crowded),
  //    melee closes in. Different height: climb the stairs or drop down.
  let navigating = false;
  if (!danger) {
    if (!p.grounded && p.autoClimbing && p.climbX) {
      // Keep the landing point through the whole jump, even when the enemy
      // enters attack height mid-air. Casting here can abort the landing.
      followClimb(p, plan);
      navigating = true;
    } else if (!sameLevel || (target.y < p.y - 65 && Math.abs(dx) > range)) {
      p.climbX = combatClimb(p, target, platforms);
      p.autoClimbing = true;
      followClimb(p, plan);
      navigating = true;
    } else {
      p.autoClimbing = false;
      p.climbX = undefined;
      const ideal = ranged ? range * 0.7 : range * 0.6,
        gap = Math.abs(dx);
      if (gap > ideal) plan.input = dir;
      else if (ranged && gap < 90 && p.x > 120 && p.x < 2280) plan.input = -dir;
    }
  }

  if (navigating && (plan.jump || !p.grounded)) return plan;

  // 4. Attack only when something is really in reach, with the right tool.
  const mp = p.mp,
    ready = (s) =>
      t - (p.cooldowns[s] || 0) >= ACTIONS[s].cooldown / (s ? 1 : aspd) && mp >= ACTIONS[s].mp,
    count = (s) => hitsFor(p, enemies, s, range, dir).length,
    hitsTarget = (s) =>
      hitsFor(p, [target], s, range, dir).length > 0 ||
      (s === 3 && count(3) > 0),
    big = target.boss || target.elite,
    reserve = mpMax * 0.25; // keep enough for a big skill when it matters
  // The ultimate hits the whole map: spend it on a boss/elite or a crowd.
  const buff = skillOf(p.class, 4).buff;
  if (!danger && ready(5) && (enemies.length >= 3 || enemies.some(e => e.boss || e.elite)))
    plan.skill = 5;
  else if (ready(4) && (p.buffs?.[buff]?.until || 0) <= t && (big ? hitsTarget(3) : count(3) >= 2) && mp - ACTIONS[4].mp >= reserve * 0.5)
    plan.skill = 4;
  else if (ready(3) && hitsTarget(3) && (count(3) >= 3 || big)) plan.skill = 3;
  else if (ready(2) && hitsTarget(2) && (count(2) >= 2 || big)) plan.skill = 2;
  else if (
    ready(1) &&
    hitsTarget(1) &&
    (big || !hitsTarget(0) || target.hp > target.maxHp * 0.5) &&
    mp - ACTIONS[1].mp >= reserve
  )
    plan.skill = 1;
  else if (hitsTarget(0)) plan.skill = 0;
  // Close enough to swing: stop walking unless dodging or backing off.
  if (plan.skill !== null && !danger && plan.input === dir) plan.input = 0;
  return plan;
}
