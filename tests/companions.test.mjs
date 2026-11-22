import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'tml-companions-')), 'test.sqlite');
const { db } = await import('../server/database.js');
const world = await import('../server/world.js');
const t = Date.now() / 1000;
const hero = world.makeRuntime({ id: 'human', userId: 'human', name: 'Human', class: 'swordsman', gender: 'male',
  level: 3, exp: 0, gold: 0, inventory: { hp: 5, mp: 5 }, upgrade: 0, weapon: false, armor: false, unlocked: 1, quest: 0,
}, { emit() {}, request: { headers: {} } });
world.players.set('socket', hero);

test('companions move, fight, accept parties and stay out of real-player counts and storage', () => {
  world.startCompanionBots(0, t);
  assert.equal(world.companionBots.size, 0);
  world.startCompanionBots(4, t);
  world.startCompanionBots(4, t);
  assert.equal(world.companionBots.size, 4);
  assert.equal(world.players.size, 1);
  const bots = [...world.companionBots.values()];
  assert.equal(new Set(bots.map(b => b.class)).size, 4);
  assert.ok(bots.every(b => b.name.includes('บอท')));
  const before = bots.map(b => b.x);
  for (let n = 0; n < 20; n++) world.tick(.05, t + n * .05);
  assert.ok(bots.some((b, n) => Math.abs(b.x - before[n]) > 1));
  assert.equal(world.snapshot(hero).online, 1);
  assert.equal(world.snapshot(hero).botsOnline, 4);
  assert.equal(world.snapshot(hero).players.filter(p => p.isCompanionBot).length, 4);
  assert.equal(world.onlineRoster().filter(p => p.bot).length, 4);
  assert.throws(() => world.tradeAction(hero, { action: 'request', target: bots[0].id }), /บอท/);
  for (const bot of bots.slice(0, 2)) {
    world.partyAction(hero, { action: 'invite', target: bot.id });
    assert.equal(bot.party, hero.party);
    assert.ok(world.parties.get(hero.party).ready.has(bot.id));
  }
  world.beginDungeon(hero, 1);
  assert.ok(bots.slice(0, 2).every(b => b.instance === hero.instance && b.auto));
  const arena = world.instances.get(hero.instance);
  // Place an enemy within reach and let the existing combat engine apply attacks.
  for (const e of arena.enemies) { e.x = 470; e.y = 600; }
  arena.stageAt = t - 10;
  let attacked = false;
  for (let n = 0; n < 100; n++) {
    world.tick(.05, t + 2 + n * .05);
    attacked ||= bots.slice(0, 2).some(b => !!b.action || b.attackAt > 0);
  }
  assert.ok(attacked, 'party bots actually use the combat engine');
  world.returnTown(hero);
  world.tick(.05, t + 8);
  assert.ok(bots.slice(0, 2).every(b => b.area === 'town'));
  world.disconnect(hero);
  world.players.delete('socket');
  world.tick(.05, t + 9);
  assert.ok(bots.every(b => !b.party));
  assert.equal(world.parties.size, 0);
  for (const bot of bots) bot.botTripAt = t;
  world.tick(.05, t + 10);
  assert.equal(bots.filter(b => b.area === 'dungeon').length, 2);
  assert.equal(bots.filter(b => b.area === 'town').length, 2);
  for (const bot of bots) world.savePlayer(bot);
  assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM characters').get().n, 0);
  assert.equal(db.prepare("SELECT count(*) n FROM funnel WHERE vid <> 'u:human'").get().n, 0);
  for (const bot of bots) { bot.botTripAt = Infinity; bot.botReturnAt = t; }
  world.tick(.05, t + 11);
  assert.ok(bots.every(b => b.area === 'town'));
  assert.ok([...world.instances.values()].every(i => !i.members.some(id => world.companionBots.has(id))));
});
