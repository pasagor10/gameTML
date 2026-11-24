import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LOOK, LOOK_KEYS, lookChoices, encodeLook, cleanLook, randomLook, resolveLook} from '../src/hero-look.js';
import {Run} from '../src/model.js';
import {cleanState} from '../server/party.mjs';

const rig = JSON.parse(readFileSync(new URL('../assets/sprites/heroes/cutout-knight/rig.json', import.meta.url)));

test('a look code round-trips through its choices', () => {
  const choices = {hair: 3, hairColour: 9, eyes: 2, eyeColour: 6, mouth: 3, skin: 1, outfit: 1, outfitColour: 7};
  const code = encodeLook(choices);
  assert.equal(code.length, LOOK_KEYS.length);
  assert.deepEqual(lookChoices(code), choices);
});

test('missing or damaged codes fall back to the appearance defaults', () => {
  assert.equal(resolveLook('', 'a').hair, 'tousled');
  assert.equal(resolveLook(undefined, 'b').hair, 'long');
  assert.equal(cleanLook('zz<script>', 'a').length, LOOK_KEYS.length);
  assert.match(cleanLook('zz<script>', 'a'), /^[0-9a-z]+$/);
});

test('random looks only pick real choices', () => {
  for (let i = 0; i < 50; i++) {
    const c = lookChoices(randomLook());
    for (const k of LOOK_KEYS) assert.ok(c[k] >= 0 && c[k] < LOOK[k].length, k);
  }
});

test('every look choice has its pictures in the rig', () => {
  for (const {id} of LOOK.hair) {
    const s = rig.slots.hair[id];
    assert.ok(s && rig.arts[s.front] && rig.arts[s.back], id);
  }
  for (const {id} of LOOK.eyes) assert.ok(rig.slots.eyes[id]?.base && rig.arts[rig.slots.eyes[id].base], id);
  for (const {id} of LOOK.mouth) assert.ok(rig.arts[rig.slots.mouth[id]?.art], id);
  for (const {id} of LOOK.outfit) {
    const o = rig.slots.outfit[id];
    assert.ok(o && rig.slots.headwear[o.headwear], id);
    for (const art of o.torso) assert.ok(rig.arts[art], art);
  }
});

test('a hero keeps its look through saves and party state', () => {
  const look = encodeLook({hair: 3, outfit: 2});
  const run = new Run(Math.random, {job: 'novice', appearance: 'b', look, name: 'มิกิ'});
  assert.equal(run.look, look);
  assert.equal(Run.restore(run.serialize()).look, look);
  assert.equal(cleanState(run.partyState()).look, look);
  assert.equal(cleanState({look: '<b>1</b>'}).look, 'b1b');
});
