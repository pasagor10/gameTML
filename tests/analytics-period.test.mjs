import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'tml-analytics-period-'));
process.env.DB_PATH=path.join(dir,'test.sqlite');
const {db}=await import('../server/database.js');
const {track,trackFloor1Exit,trackCharacterCreated,dashboardPeriodStats,dashboardStats}=await import('../server/analytics.js');
const now=Date.parse('2026-11-22T12:00:00+07:00'),old=now-86400000;
const headers=n=>({cookie:`tml_vid=00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,'user-agent':'Mozilla/5.0'});
function account(id,at,level) {
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,id,null,at);
  db.prepare('INSERT INTO characters VALUES(?,?,?,?)').run('c-'+id,id,id,JSON.stringify({class:'mage',level,quest:level===60?40:0}));
  trackCharacterCreated('c-'+id,at);
}
test('the new dashboard hides all older aggregate data while retaining it in storage',()=>{
  account('old',old,60);account('new',now-1000,1);
  track(headers(1),'visit','old',old);track(headers(1),'join','old',old+1);
  track(headers(3),'visit',null,old);
  trackFloor1Exit(headers(1),'old',2,'death',old);
  track(headers(1),'visit','old',now-800);track(headers(1),'join','old',now-700);
  for(const step of ['visit','account','character','join']) track(headers(2),step,'new',now-500);
  trackFloor1Exit(headers(2),'new',1,'death',now-400);
  const before=db.prepare('SELECT count(*) n FROM funnel').get().n;
  for(const days of [1,7,30,0]) {
    const s=dashboardPeriodStats({days,now});
    assert.equal(s.measurementFrom,'2026-11-22');assert.equal(s.from,'2026-11-22');
    assert.equal(s.totals.visitors,2);assert.equal(s.totals.accounts,1);assert.equal(s.totals.characters,1);
    assert.equal(s.levels.find(r=>r.label==='Lv.50–60').count,0);
    assert.equal(s.funnel.find(r=>r.id==='join').count,2,'returning visitors are measured again in this period');
    assert.equal(s.exitPeople,1);assert.equal(s.floor1Exits[1].death,0);
    assert.deepEqual(s.daily.map(r=>r.day),['2026-11-22']);assert.deepEqual(s.retention,[]);
  }
  assert.equal(db.prepare('SELECT count(*) n FROM funnel').get().n,before);
  assert.equal(db.prepare('SELECT count(*) n FROM characters').get().n,2);
  assert.equal(dashboardStats({days:0,now}).totals.characters,2,'historical data remains available internally');
});
test('one day means the current Bangkok calendar day, not a rolling 24 hours',()=>{
  const next=Date.parse('2026-11-23T00:01:00+07:00');
  track(headers(1),'visit','old',next-1000);
  const s=dashboardPeriodStats({days:1,now:next});
  assert.equal(s.from,'2026-11-23');assert.equal(s.totals.visitors,1);
  assert.equal(s.totals.accounts,0);assert.equal(s.totals.characters,0);
  assert.deepEqual(s.daily.map(r=>r.day),['2026-11-23']);
  const all=dashboardPeriodStats({days:0,now:next});
  assert.deepEqual(all.daily.map(r=>r.day),['2026-11-22','2026-11-23']);
  assert.equal(all.totals.visitors,2);assert.equal(all.d1.players,2);assert.equal(all.d1.returned,1);
});
test.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
