import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { io } from "socket.io-client";
import { heroSkins } from "../shared/rpg.js";
import { heroLooks } from "../shared/appearance.js";

test("class changes update owner and observer appearance, keep the weapon, and survive reconnect", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "priest-class-")),
    file = path.join(dir, "test.sqlite"), base = "http://127.0.0.1:5199",
    index = JSON.parse(readFileSync("public/assets/sprites/index.json"));
  const child = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: "5199", HOST: "127.0.0.1", DB_PATH: file, APP_ORIGIN: base },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "", db;
  const sockets = [];
  child.stdout.on("data", d => { logs += d; });
  child.stderr.on("data", d => { logs += d; });
  const command = (s, event, data = {}) => s.timeout(3000).emitWithAck(event, data);
  const snapshot = (s, predicate) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { s.off("world:snapshot", handler); reject(Error("snapshot timeout")); }, 4000);
    const handler = state => {
      if (!predicate(state)) return;
      clearTimeout(timer); s.off("world:snapshot", handler); resolve(state);
    };
    s.on("world:snapshot", handler);
  });
  const post = (url, body, cookie) => fetch(base + "/api/" + url, {
    method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const connect = async cookie => {
    const s = io(base, { extraHeaders: { Cookie: cookie }, transports: ["websocket"], reconnection: false });
    sockets.push(s); await once(s, "connect"); return s;
  };
  try {
    let ready = false;
    for (let n = 0; n < 100; n++) {
      try { if ((await fetch(base + "/api/health")).ok) { ready = true; break; } } catch {}
      await new Promise(r => setTimeout(r, 50));
    }
    assert.ok(ready, logs);
    const auth = await post("auth/guest", {}), cookie = auth.headers.get("set-cookie").split(";")[0];
    const hero = await (await post("characters", { name: "PriestTransition", class: "priest", gender: "female" }, cookie)).json();
    const other = await (await post("characters", { name: "PriestObserver", class: "priest", gender: "male" }, cookie)).json();
    // Only the isolated test database is seeded; no player save is modified.
    db = new Database(file);
    const row = db.prepare("SELECT state FROM characters WHERE id=?").get(hero.id);
    const saved = { ...JSON.parse(row.state), level: 20,
      equipment: { weapon: "dawn_scepter" }, ownedEquipment: ["starter_priest", "dawn_scepter"] };
    db.prepare("UPDATE characters SET state=? WHERE id=?").run(JSON.stringify(saved), hero.id);
    let owner = await connect(cookie), observer = await connect(cookie);
    assert.equal((await command(owner, "player:join", { id: hero.id })).ok, true);
    assert.equal((await command(observer, "player:join", { id: other.id })).ok, true);
    const appearance = (p, expected) => {
      assert.equal(heroSkins(p)[0], expected);
      assert.ok(index.sets[expected]);
      assert.equal(p.equipment.weapon, "dawn_scepter");
      const look = heroLooks(p, index.sets[expected].layers.looks);
      if (p.specialization) assert.equal(look.outfit, `${p.specialization}-${p.advanced ? 3 : 2}`);
    };
    appearance((await snapshot(owner, () => true)).self, "priest-female");
    for (const [event, data, spec, advanced] of [
      ["class:specialize", { id: "bishop" }, "bishop", false],
      ["class:advance", {}, "bishop", true],
      ["class:specialize", { id: "templar" }, "templar", true],
    ]) {
      const ownerUpdate = snapshot(owner, s => s.self.specialization === spec && s.self.advanced === advanced);
      const observerUpdate = snapshot(observer, s => s.players.some(p => p.id === hero.id && p.specialization === spec && p.advanced === advanced));
      assert.equal((await command(owner, event, data)).ok, true);
      const [selfState, otherState] = await Promise.all([ownerUpdate, observerUpdate]);
      const expected = `priest-female-${spec}-${advanced ? 3 : 2}`;
      appearance(selfState.self, expected);
      appearance(otherState.players.find(p => p.id === hero.id), expected);
      assert.equal(otherState.self.specialization, null);
    }
    const account = await (await fetch(base + "/api/me", { headers: { Cookie: cookie } })).json();
    appearance(account.characters.find(p => p.id === hero.id), "priest-female-templar-3");
    owner.disconnect();
    await snapshot(observer, s => !s.players.some(p => p.id === hero.id));
    owner = await connect(cookie);
    assert.equal((await command(owner, "player:join", { id: hero.id })).ok, true);
    appearance((await snapshot(owner, () => true)).self, "priest-female-templar-3");
  } finally {
    sockets.forEach(s => s.disconnect());
    db?.close();
    if (child.exitCode === null) { child.kill(); await once(child, "exit"); }
    rmSync(dir, { recursive: true, force: true });
  }
});
