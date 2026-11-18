import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { heroSkins } from '../shared/rpg.js';
const root = new URL('../public/assets/sprites/', import.meta.url);
test('archer branches resolve supplied costumes for both genders and advancement tiers', async () => {
  const index = JSON.parse(await readFile(new URL('index.json', root)));
  for (const gender of ['male', 'female']) {
    for (const specialization of ['ranger', 'scout']) {
      for (const advanced of [false, true]) {
        const key = heroSkins({class:'archer',gender,specialization,advanced})[0];
        const set = index.sets[key];
        assert.ok(set, key);
        assert.equal(set.height, 112);
        await access(new URL(`${set.dir}/portrait.webp`, root));
        for (const action of ['idle','walk','run','jump','attack','skill','hit','death']) {
          const folder = set.actions[action];
          assert.ok(folder, `${key}: ${action}`);
          const clip = JSON.parse(await readFile(new URL(`${set.dir}/${folder}/animation.json`,root)));
          assert.equal(clip.frameCount,4);
          assert.equal(clip.durationsMs.length,4);
          assert.equal(clip.durationsMs.reduce((a,b)=>a+b,0),Math.round(clip.durationSeconds*1000));
          assert.ok(clip.bodyHeightPx > 0);
          if (action === 'attack' || action === 'skill') {
            assert.equal(clip.events[0].frame,2);
            assert.equal(clip.events[0].atMs,clip.durationsMs[0]+clip.durationsMs[1]);
          }
          await access(new URL(`${set.dir}/${folder}/${clip.fallback.pages[0].file}`,root));
        }
      }
    }
  }
});
