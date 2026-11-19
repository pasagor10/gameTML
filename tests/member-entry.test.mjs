import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
const dir = mkdtempSync(path.join(tmpdir(), 'tml-member-entry-'));
const base = 'http://127.0.0.1:5198';
let child;
const post = (route, data, cookie = '') => fetch(base + route, { method:'POST', headers:{ 'Content-Type':'application/json', Cookie:cookie }, body:JSON.stringify(data) });
const cookieOf = r => r.headers.get('set-cookie').split(';')[0];
before(async () => {
  child = spawn(process.execPath, ['server.js'], { env:{...process.env, PORT:'5198', HOST:'127.0.0.1', DB_PATH:path.join(dir,'test.sqlite'), APP_ORIGIN:base}, stdio:'ignore' });
  for(let i=0;i<100;i++) {
    try { if((await fetch(base+'/api/health')).ok) return; } catch {}
    await new Promise(r=>setTimeout(r,50));
  }
  throw Error('Test server did not start');
});
after(async()=>{ if(child?.exitCode===null){child.kill();await once(child,'exit');}rmSync(dir,{recursive:true,force:true}); });
test('central entrance requires membership and a registered account opens the game', async()=>{
  const home=await (await fetch(base+'/')).text();
  assert.match(home,/welcome.js/); assert.doesNotMatch(home,/vendor\/phaser/);
  const blocked=await fetch(base+'/play',{redirect:'manual'});
  assert.equal(blocked.status,302); assert.match(blocked.headers.get('location'),/account=login/);
  assert.equal((await post('/api/auth/guest',{})).status,403);
  const reg=await post('/api/auth/register',{name:'entry-member',password:'EntryPassword42'});
  assert.equal(reg.status,200); const cookie=cookieOf(reg);
  const play=await fetch(base+'/play',{headers:{Cookie:cookie}});
  assert.match(await play.text(),/vendor\/phaser/);
  const chars=await post('/api/characters',{name:'EntryHero',class:'archer',gender:'female'},cookie);
  assert.equal(chars.status,200);
  const login=await post('/api/auth/login',{name:'entry-member',password:'EntryPassword42'});
  assert.equal(login.status,200);
  const otherCookie=cookieOf(login);
  const me=await (await fetch(base+'/api/me',{headers:{Cookie:otherCookie}})).json();
  assert.equal(me.characters.length,1);assert.equal(me.characters[0].name,'EntryHero');
  assert.equal((await post('/api/auth/logout',{},otherCookie)).status,200);
  assert.equal((await fetch(base+'/play',{headers:{Cookie:otherCookie},redirect:'manual'})).status,302);
  assert.equal((await post('/api/auth/login',{name:'entry-member',password:'WrongPassword42'})).status,400);
});
test('registering an existing guest preserves their id, characters and progress',async()=>{
  const db=new Database(path.join(dir,'test.sqlite'));
  const token='guest-migration-test-token';const cookie='tml_session='+token;
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('legacy-guest','guest-legacy',null,Date.now());
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),'legacy-guest',Date.now()+60000);
  db.prepare('INSERT INTO characters VALUES(?,?,?,?)').run('legacy-hero','legacy-guest','LegacyHero',JSON.stringify({class:'mage',gender:'female',level:22,gold:12345,inventory:{costume_5:2}}));
  const register=await post('/api/auth/register',{name:'migrated-member',password:'MigrationPassword42'},cookie);
  assert.equal(register.status,200);assert.equal((await register.json()).user.id,'legacy-guest');
  const login=await post('/api/auth/login',{name:'migrated-member',password:'MigrationPassword42'});
  const me=await (await fetch(base+'/api/me',{headers:{Cookie:cookieOf(login)}})).json();
  assert.equal(me.characters[0].id,'legacy-hero');assert.equal(me.characters[0].level,22);
  assert.equal(me.characters[0].gold,12345);assert.equal(me.characters[0].inventory.costume_5,2);
  assert.equal(db.prepare('SELECT count(*) n FROM users WHERE id=?').get('legacy-guest').n,1);
  db.close();
});
