import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BOSSES } from '../shared/bosses.js';
import { FLOORS } from '../shared/config.js';
import { STATUSES } from '../shared/skills.js';

process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'tml-bosses-')), 'test.sqlite');
const { db, loadCharacter } = await import('../server/database.js');
const world = await import('../server/world.js');
const index = JSON.parse(readFileSync(new URL('../public/assets/sprites/index.json', import.meta.url)));

function enter(floor, suffix = '') {
  const id = `original-boss-${floor}${suffix}`;
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id, id, null, Date.now());
  db.prepare('INSERT INTO characters VALUES(?,?,?,?)').run(id, id, id, JSON.stringify({
    class: 'swordsman', gender: 'male', level: 40, unlocked: floor, quest: floor - 1,
    gold: 0, inventory: { hp: 5, mp: 5, ore: 0 },
  }));
  const p = world.makeRuntime(loadCharacter(id), { emit() {} });
  world.players.set(id, p);
  world.beginDungeon(p, floor);
  const i = world.instances.get(p.instance);
  for (let stage = 1; stage < 3; stage++) { i.clear = true; world.nextStage(p); }
  i.nextHazardAt = Infinity;
  const boss = i.enemies.find(e => e.boss);
  i.enemies = [boss];
  Object.assign(boss, { x: p.x + 120, y: 600, attackAt: 0, spawnAt: 0 });
  return { p, i, boss };
}

test('all new floors use five original boss families with complete sprite assets', () => {
  assert.equal(Object.keys(BOSSES).length, 5);
  assert.equal(new Set(FLOORS.slice(15).map(f => f.bossType)).size, 5);
  assert.equal(new Set(FLOORS.slice(15).map(f => f.boss)).size, 25);
  assert.ok(FLOORS.slice(15).every(f => BOSSES[f.bossType]));
  for (const [id, profile] of Object.entries(BOSSES)) {
    assert.ok(STATUSES[profile.status.type]);
    const spec = index.monsters[id];
    assert.equal(spec.height, profile.height);
    assert.ok(existsSync(new URL(`../public/assets/sprites/${spec.dir}/portrait.webp`, import.meta.url)));
    for (const state of ['idle', 'move', 'attack', 'hit', 'death', 'spawn']) {
      const dir = new URL(`../public/assets/sprites/${spec.dir}/${state}/`, import.meta.url);
      const clip = JSON.parse(readFileSync(new URL('animation.json', dir)));
      assert.equal(clip.frameCount, 4);
      assert.equal(clip.durationsMs.length, 4);
      assert.ok(clip.bodyHeightPx > 0);
      assert.ok(clip.sourceAnchor[1] <= clip.sourceSize[1]);
      for (const page of clip.fallback.pages) assert.ok(existsSync(new URL(page.file, dir)));
      if (state === 'attack') assert.equal(clip.events[0].frame, 2);
      if (['death', 'spawn'].includes(state)) assert.equal(clip.loop, false);
    }
  }
});

test('each original boss warns before its elemental attack and applies the matching status', () => {
  for (const floor of [16, 21, 26, 31, 36]) {
    const { p, i, boss } = enter(floor);
    const profile = BOSSES[boss.type];
    const t = Date.now() / 1000 + 1000;
    const hp = p.hp;
    world.tick(0.05, t);
    assert.equal(boss.action.kind, 'slam');
    assert.equal(boss.action.radius, profile.radius);
    assert.ok(Math.abs(boss.action.impactAt - t - profile.windup) < 0.00001);
    assert.equal(p.hp, hp, 'windup gives the player time to dodge');
    world.tick(0.05, boss.action.impactAt + 0.01);
    assert.ok(p.hp < hp);
    assert.ok(p.status?.[profile.status.type], `${boss.type} applies ${profile.status.type}`);
    assert.ok(i.events.some(e => e.kind === 'eruption'));
    world.returnTown(p);
  }
});

test('jumping over each elemental ground attack avoids damage and exposes the boss', () => {
  for (const floor of [16, 21, 26, 31, 36]) {
    const { p, boss } = enter(floor, '-dodge');
    const t = Date.now() / 1000 + 1000;
    world.tick(0.05, t);
    const hp = p.hp;
    p.y = 470; p.vy = 0; p.grounded = false;
    world.tick(0.01, boss.action.impactAt + 0.01);
    assert.equal(p.hp, hp);
    assert.ok(boss.exposedUntil > boss.action.endsAt);
    world.returnTown(p);
  }
});
