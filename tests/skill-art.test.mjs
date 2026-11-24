import test from 'node:test';
import assert from 'node:assert/strict';
import {SKILLS} from '../src/model.js';
import {SKILL_SHEETS,skillArt} from '../src/skill-art.js';

test('every skill has a cell in exactly one v2 sheet, 11 per 4x3 sheet', () => {
  const all=Object.values(SKILL_SHEETS).flat();
  assert.equal(new Set(all).size,all.length);
  assert.deepEqual([...all].sort(),SKILLS.map(s=>s.id).sort());
  for(const ids of Object.values(SKILL_SHEETS))assert.ok(ids.length<=12);
});

test('every skill renders some icon, even without artwork', () => {
  for(const s of SKILLS)assert.match(skillArt(s.id),/<span class="sk-icon/);
});

test('every skill has a cartoon SVG icon on a themed background', async () => {
  const {skillIconSvg,SKILL_ICON_GROUPS}=await import('../src/skill-icons.js');
  for(const s of SKILLS){const svg=skillIconSvg(s.id);assert.match(svg,/^<svg viewBox="0 0 64 64"/,s.id);assert.doesNotMatch(svg,/undefined|NaN/,s.id);assert.match(skillArt(s.id),/skill-svg/);}
  const drawn=Object.values(SKILL_ICON_GROUPS).flat();assert.equal(new Set(drawn).size,drawn.length);
});
