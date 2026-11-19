import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bossMechanics, MECHANICS, WATER_Y, inSpikeBand, spikeGapCenter } from '../shared/boss-mechanics.js';
import { dungeonPlatforms } from '../shared/dungeons.js';
import { maxHp } from '../shared/config.js';

process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'tml-mech-')), 'test.sqlite');
const { db, loadCharacter } = await import('../server/database.js');
const world = await import('../server/world.js');
const { autoBrain } = await import('../server/auto.js');

let made = 0;
// A Lv.40 hero standing in floor `floor`'s boss stage, boss parked far away.
function bossStage(floor) {
  const id = `mech-${floor}-${made++}`;
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id, id, null, Date.now());
  db.prepare('INSERT INTO characters VALUES(?,?,?,?)').run(id, id, id, JSON.stringify({
    class: 'swordsman', gender: 'male', level: 40, unlocked: floor, quest: floor - 1,
    gold: 0, inventory: { hp: 0, mp: 0, ore: 0 },
  }));
  const p = world.makeRuntime(loadCharacter(id), { emit() {} });
  world.players.set(id, p);
  world.beginDungeon(p, floor);
  const i = world.instances.get(p.instance);
  for (let stage = 1; stage < 3; stage++) { i.clear = true; world.nextStage(p); }
  const boss = i.enemies.find(e => e.boss);
  i.enemies = [boss];
  Object.assign(boss, { x: 2300, y: 600, hp: 1e9, maxHp: 1e9, attackAt: Infinity });
  Object.assign(p, { x: 300, y: 600, vy: 0, grounded: true });
  const t = Date.now() / 1000;
  i.stageAt = t - 100;
  i.mechAt = t;
  return { p, i, boss, t };
}
const run = (t0, seconds) => {
  for (let k = 1; k <= seconds * 20; k++) world.tick(0.05, t0 + k * 0.05);
};

test('every floor boss has mechanics, floors 1-15 each a different mix', () => {
  const keys = (f) => bossMechanics(f).join('+');
  assert.equal(new Set(Array.from({ length: 15 }, (_, k) => keys(k + 1))).size, 15);
  for (let f = 1; f <= 40; f++) {
    assert.ok(bossMechanics(f).length >= (f > 15 ? 2 : 1));
    assert.ok(bossMechanics(f).every(k => MECHANICS[k]));
    if (f > 1) assert.notEqual(keys(f), keys(f - 1));
  }
});

test('flood kills a hero left on the floor', () => {
  const { p, i, t } = bossStage(3);
  assert.deepEqual(bossMechanics(3), ['flood']);
  run(t, 9);
  assert.equal(i.mech?.kind ?? 'flood', 'flood');
  assert.equal(p.hp, 0);
});

test('flood spares a hero standing on a ledge', () => {
  const { p, t } = bossStage(3);
  const ledge = dungeonPlatforms(3, 3).find(q => !q.step && q.y < WATER_Y - 20);
  Object.assign(p, { x: ledge.x + ledge.w / 2, y: ledge.y, vy: 0, grounded: true });
  run(t, 9);
  assert.ok(p.hp > 0);
  assert.ok(p.y < WATER_Y);
});

test('auto play climbs out of the flood and lives', () => {
  const { p, t } = bossStage(3);
  p.auto = true;
  run(t, 9);
  assert.ok(p.hp > 0, 'auto hero drowned');
});

test('a falling rock hurts only the hero under it', () => {
  const { p, i, t } = bossStage(1);
  assert.deepEqual(bossMechanics(1), ['rocks']);
  world.tick(0.05, t + 0.05);
  assert.equal(i.mech.kind, 'rocks');
  i.mech.strikes = [{ x: p.x, radius: 58, impactAt: t + 1, done: false }];
  const full = maxHp(p);
  p.hp = full;
  run(t + 0.05, 1.5);
  const lost = full - p.hp;
  assert.ok(lost > full * 0.3 && lost < full * 0.5, `rock took ${lost} of ${full}`);

  const b = bossStage(1);
  world.tick(0.05, b.t + 0.05);
  b.i.mech.strikes = [{ x: b.p.x + 400, radius: 58, impactAt: b.t + 1, done: false }];
  b.p.hp = maxHp(b.p);
  run(b.t + 0.05, 1.5);
  assert.equal(b.p.hp, maxHp(b.p));
});

test('spike stripes leave safe gaps to stand in', () => {
  const m = { phase: 40 };
  for (const x of [100, 500, 1300, 2200]) {
    const gap = spikeGapCenter(m, x);
    assert.equal(inSpikeBand(m, gap), false);
    assert.ok(Math.abs(gap - x) <= 270);
  }
});

test('auto heads for a ledge when the flood warning starts, then holds still', () => {
  const { p, i, t } = bossStage(3);
  const platforms = dungeonPlatforms(3, 3);
  i.mech = { kind: 'flood', startedAt: t, riseAt: t + 3.5, endsAt: t + 8 };
  const plan = autoBrain(p, i, t, { range: 100, mpMax: 100, platforms });
  assert.ok(plan.input !== 0 || plan.jump);
  const ledge = platforms.find(q => !q.step && q.y < WATER_Y - 20);
  Object.assign(p, { x: ledge.x + ledge.w / 2, y: ledge.y, grounded: true });
  assert.equal(autoBrain(p, i, t, { range: 100, mpMax: 100, platforms }).input, 0);
});

test('the world boss is tankier and softer than before', async () => {
  const { WORLD_BOSS } = await import('../shared/world-boss.js');
  assert.ok(WORLD_BOSS.hp >= 2000000);
  assert.ok(WORLD_BOSS.damage <= 1);
});

test('every boss-stage step and ledge stands above the flood', () => {
  for (let f = 1; f <= 40; f++)
    for (const q of dungeonPlatforms(f, 3)) assert.ok(q.y < WATER_Y, `floor ${f} surface at ${q.y}`);
});

test('auto cancels a cast and escapes a flood from multiple arena positions', () => {
  for (const x of [300, 800, 1300, 1800, 2200]) {
    const { p, i, t } = bossStage(3);
    p.x = x;
    p.auto = true;
    p.action = { skill: 5, direction: 1, endsAt: t + 2 };
    p.pending = { skill: 5, impactAt: t + 1.25 };
    i.mech = { id: `flood-${x}`, kind: 'flood', startedAt: t, riseAt: t + 3.5, endsAt: t + 10, tickAt: 0 };
    run(t, 7);
    assert.ok(p.hp > 0, `drowned from x=${x}`);
    assert.ok(p.y <= WATER_Y, `did not reach safety from x=${x}: y=${p.y}`);
    p.auto = false;
  }
});
