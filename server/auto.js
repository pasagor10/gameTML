// Auto-battle brain: lock onto one monster, close to a good fighting distance,
// only swing when something is really in reach, pick skills by the situation,
// and step or hop out of telegraphed attacks. Pure decisions; the world applies them.
import { ACTIONS } from "../shared/motion.js";
import { skillOf } from "../shared/skills.js";
import { climbStep } from "../shared/dungeons.js";

const GROUND = 600,
  REACH_Y = 120, // attacks connect within 130 px vertically; keep a margin
  SWITCH_MARGIN = 260, // a new target must be this much "cheaper" to steal the lock
  STUCK_AFTER = 4; // seconds without getting closer before giving up a target

const flying = (e) => e.type === "bat" || e.type === "batking";

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

// Anything about to land where we stand? Crystal eruptions and boss slams
// only hurt on the ground, so hop if it lands soon, otherwise walk clear.
function threat(p, i, t) {
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

export function autoBrain(p, i, t, { range, mpMax, platforms }) {
  const enemies = i.enemies.filter((e) => e.hp > 0);
  const plan = { input: 0, jump: false, skill: null, direction: p.direction };
  if (!enemies.length) {
    p.autoTarget = null;
    return plan;
  }

  // 1. Dodge first: nothing else matters if a slam is about to land on us.
  const danger = threat(p, i, t);
  if (danger) {
    if (danger.eta < 0.45) plan.jump = true;
    else plan.input = Math.sign(p.x - danger.zone.x) || -p.direction || 1;
  }

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
  if (!danger) {
    if (!sameLevel && target.y < p.y && !flying(target)) {
      if (p.grounded || p.climbX === undefined)
        p.climbX = climbStep(p, target, platforms);
      plan.input = Math.sign(p.climbX.x - p.x);
      plan.jump = p.grounded && p.climbX.jump;
    } else if (!sameLevel && target.y > p.y) {
      plan.input = dir; // walk off the ledge toward it
    } else {
      const ideal = ranged ? range * 0.7 : range * 0.6,
        gap = Math.abs(dx);
      if (gap > ideal) plan.input = dir;
      else if (ranged && gap < 90 && p.x > 120 && p.x < 2280) plan.input = -dir;
    }
  }

  // 4. Attack only when something is really in reach, with the right tool.
  const mp = p.mp,
    ready = (s) =>
      t - (p.cooldowns[s] || 0) >= ACTIONS[s].cooldown && mp >= ACTIONS[s].mp,
    count = (s) => hitsFor(p, enemies, s, range, dir).length,
    hitsTarget = (s) =>
      hitsFor(p, [target], s, range, dir).length > 0 ||
      (s === 3 && count(3) > 0),
    big = target.boss || target.elite,
    reserve = mpMax * 0.25; // keep enough for a big skill when it matters
  // Party buff first when a fight is on and nobody has it.
  const buff = skillOf(p.class, 4).buff;
  if (ready(4) && (p.buffs?.[buff]?.until || 0) <= t && (big ? hitsTarget(3) : count(3) >= 2) && mp - ACTIONS[4].mp >= reserve * 0.5)
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
