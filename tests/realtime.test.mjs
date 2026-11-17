import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { once } from "node:events";
import path from "node:path";
import { io } from "socket.io-client";
const dir = mkdtempSync(path.join(tmpdir(), "tml-network-")),
  port = 5197,
  base = `http://127.0.0.1:${port}`;
let child,
  logs = "",
  sockets = [];
async function launch() {
  child = spawn(process.execPath, ["server.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: path.join(dir, "test.sqlite"),
      APP_ORIGIN: base,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (x) => (logs += x));
  child.stderr.on("data", (x) => (logs += x));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error(logs);
}
async function stop() {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await once(child, "exit");
  }
}
async function account(name) {
  const res = await fetch(base + "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password: "DemoTestPassword42" }),
  });
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie").split(";")[0];
  const ch = await fetch(base + "/api/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name, class: "swordsman", gender: "female" }),
  });
  const c = await ch.json();
  assert.ok(c.id);
  const s = io(base, {
    extraHeaders: { Cookie: cookie },
    transports: ["websocket"],
  });
  sockets.push(s);
  await once(s, "connect");
  const r = await command(s, "player:join", { id: c.id });
  assert.equal(r.ok, true);
  return { s, c, cookie };
}
const command = (s, e, d = {}) =>
  new Promise((resolve, reject) => {
    s.timeout(4000).emit(e, d, (err, res) =>
      err ? reject(err) : resolve(res),
    );
  });
const snap = (s) => new Promise((resolve) => s.once("world:snapshot", resolve));
test("real HTTP + Socket.IO: auth, ownership, visibility, chat, concurrent last-stock purchase and durable save", async () => {
  try {
    await launch();
    const a = await account("NetSeller"),
      b = await account("NetBuyer"),
      c = await account("NetBuyerTwo");
    let state = await snap(a.s);
    assert.equal(state.online, 3);
    assert.equal((await command(a.s, "player:join", { id: b.c.id })).ok, false);
    assert.equal(state.players.length, 2);
    const chat = once(b.s, "chat:message");
    assert.equal(
      (
        await command(a.s, "chat:send", {
          message: "hello <script>",
          channel: "world",
        })
      ).ok,
      true,
    );
    assert.equal((await chat)[0].message, "hello <script>");
    const create = await command(a.s, "shop:create", {
      name: "Atomic Shop",
      item: "ore",
      qty: 1,
      price: 20,
      key: "shop-network-1",
    });
    assert.equal(create.ok, true);
    const results = await Promise.all([
      command(b.s, "shop:buy", { id: create.id, key: "buy-network-1" }),
      command(c.s, "shop:buy", { id: create.id, key: "buy-network-2" }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    const winner = results[0].ok ? b : c;
    state = await snap(winner.s);
    assert.equal(state.self.gold, 100);
    const dup = await command(winner.s, "shop:buy", {
      id: create.id,
      key: results[0].ok ? "buy-network-1" : "buy-network-2",
    });
    assert.equal(dup.ok, true);
    assert.equal((await snap(winner.s)).self.gold, 100);
    await command(a.s, "player:input", {
      seq: 1,
      direction: 1,
      gold: 999999,
      x: 999999,
    });
    state = await snap(a.s);
    assert.ok(state.self.x < 1000);
    assert.equal(state.self.gold, 140);
    assert.equal((await command(winner.s, "training:enter")).ok, true);
    assert.equal(
      (await command(winner.s, "player:attack", { skill: 0 })).ok,
      true,
    );
    const cast = await snap(winner.s);
    assert.equal(cast.dungeon.training, true);
    assert.ok(cast.self.action.impactAt > cast.self.action.startedAt);
    assert.ok(cast.self.action.endsAt > cast.self.action.impactAt);
    assert.equal(
      (await snap(a.s)).players.some((p) => p.id === winner.c.id),
      false,
      "private training must not leak into town",
    );
    const rejected = await fetch(base + "/api/characters", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(rejected.status, 403);
    sockets.forEach((s) => s.disconnect());
    await new Promise((r) => setTimeout(r, 100));
    await stop();
    await launch();
    const me = await fetch(base + "/api/me", {
      headers: { Cookie: winner.cookie },
    }).then((r) => r.json());
    assert.equal(me.characters[0].gold, 100);
    assert.equal(me.characters[0].inventory.ore, 4);
    assert.ok(!logs.includes("tick:"));
  } finally {
    sockets.forEach((s) => s.disconnect());
    if (child) await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
