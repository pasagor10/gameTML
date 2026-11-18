import { spinSlotMachine } from "./server/slots.js";
import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import argon2 from "argon2";
import path from "node:path";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { db, loadCharacter, persist } from "./server/database.js";
import { CLASSES, maxHp, maxMp } from "./shared/config.js";
import * as world from "./server/world.js";
import { releaseStamp } from "./server/release-stamp.js";
const app = express(),
  server = http.createServer(app),
  origin = process.env.APP_ORIGIN;
app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use(express.json({ limit: "12kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ws: wss: https://cloudflareinsights.com; media-src 'self' blob:",
  );
  if (
    req.method === "POST" &&
    req.headers.origin &&
    req.headers.origin !== (origin || `${req.protocol}://${req.headers.host}`)
  )
    return res.status(403).json({ error: "Origin ไม่ถูกต้อง" });
  next();
});
const sessions = (req) => {
  const token = req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("tml_session="))
    ?.slice(12);
  if (!token) return null;
  return db
    .prepare(
      "SELECT u.id,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
    )
    .get(createHash("sha256").update(token).digest("hex"), Date.now());
};
const rate = new Map();
function limited(key, max = 25, ms = 60000) {
  const n = Date.now(),
    old = rate.get(key) || { count: 0, at: n };
  if (n - old.at > ms) {
    old.at = n;
    old.count = 0;
  }
  rate.set(key, old);
  return ++old.count > max;
}
setInterval(() => {
  for (const [k, v] of rate) if (Date.now() - v.at > 120000) rate.delete(k);
  db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
}, 60000).unref();
function login(res, user) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    createHash("sha256").update(token).digest("hex"),
    user.id,
    Date.now() + 30 * 86400000,
  );
  res.setHeader(
    "Set-Cookie",
    `tml_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}
app.get("/api/health", (req, res) =>
  res.json({ ok: true, version: "0.3.0", online: world.players.size }),
);
app.get("/api/me", (req, res) => {
  const user = sessions(req);
  res.json({
    user: user || null,
    characters: user
      ? db
          .prepare("SELECT id,name,state FROM characters WHERE user_id=?")
          .all(user.id)
          .map((c) => ({ id: c.id, name: c.name, ...JSON.parse(c.state) }))
      : [],
  });
});
app.post("/api/auth/:action", async (req, res) => {
  try {
    if (limited("auth:" + req.ip, 15))
      return res.status(429).json({ error: "ลองใหม่ใน 1 นาที" });
    const { name, password } = req.body;
    const action = req.params.action;
    if (!["register", "login", "guest"].includes(action))
      throw Error("ไม่พบคำสั่ง");
    let user;
    if (action === "guest") {
      const id = randomUUID();
      db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(
        id,
        "guest-" + id,
        null,
        Date.now(),
      );
      user = { id, name: "นักเดินทาง" };
    } else {
      if (
        typeof name !== "string" ||
        name.trim().length < 3 ||
        name.length > 30 ||
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128
      )
        throw Error("ชื่อบัญชี 3–30 ตัวอักษร และรหัสผ่าน 8–128 ตัวอักษร");
      if (action === "register") {
        const hash = await argon2.hash(password, { type: argon2.argon2id });
        user = { id: randomUUID(), name: name.trim() };
        db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(
          user.id,
          user.name,
          hash,
          Date.now(),
        );
      } else {
        const row = db
          .prepare("SELECT * FROM users WHERE name=?")
          .get(name.trim());
        if (!row?.password || !(await argon2.verify(row.password, password)))
          throw Error("ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง");
        user = { id: row.id, name: row.name };
      }
    }
    login(res, user);
    res.json({ user });
  } catch (e) {
    res.status(400).json({
      error: e.code?.startsWith("SQLITE_CONSTRAINT") ? "ชื่อนี้ถูกใช้แล้ว" : e.message,
    });
  }
});
app.post("/api/characters", (req, res) => {
  try {
    const user = sessions(req);
    if (!user) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });
    if (limited("char:" + user.id, 10)) throw Error("สร้างตัวละครถี่เกินไป");
    const { name, class: job, gender } = req.body;
    if (
      !CLASSES[job] ||
      !["male", "female"].includes(gender) ||
      typeof name !== "string" ||
      !/^[\p{L}\p{M}\p{N}_ -]{2,20}$/u.test(name)
    )
      throw Error("ชื่อตัวละครต้องยาว 2–20 ตัวอักษร ใช้ตัวอักษร ตัวเลข เว้นวรรค หรือ _ -");
    if (
      db
        .prepare("SELECT count(*) n FROM characters WHERE user_id=?")
        .get(user.id).n >= 3
    )
      throw Error("สร้างได้สูงสุด 3 ตัวละคร");
    const id = randomUUID(),
      state = {
        class: job,
        gender,
        gold: 120,
        inventory: { hp: 5, mp: 3, ore: 3 },
        upgrade: 0,
        weapon: false,
        armor: false,
        level: 1,
        exp: 0,
        unlocked: 1,
        quest: 0,
      };
    db.prepare("INSERT INTO characters VALUES(?,?,?,?)").run(
      id,
      user.id,
      name,
      JSON.stringify(state),
    );
    res.json({ id, ...state, name });
  } catch (e) {
    res.status(400).json({
      error: e.code?.startsWith("SQLITE_CONSTRAINT")
        ? "ชื่อตัวละครถูกใช้แล้ว"
        : e.message,
    });
  }
});
app.post("/api/characters/:id/delete", (req, res) => {
  const user = sessions(req);
  if (!user) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });
  const character = db.prepare("SELECT id FROM characters WHERE id=? AND user_id=?")
    .get(req.params.id, user.id);
  if (!character) return res.status(404).json({ error: "ไม่พบตัวละคร" });
  if ([...world.players.values()].some((p) => p.id === character.id))
    return res.status(409).json({ error: "กรุณาออกจากเกมก่อนลบตัวละครนี้" });
  db.transaction(() => {
    db.prepare("DELETE FROM shops WHERE owner=?").run(character.id);
    db.prepare("DELETE FROM characters WHERE id=? AND user_id=?").run(character.id, user.id);
  })();
  world.invalidateShops();
  res.json({ ok: true });
});
// Code and data always revalidate (cheap 304s via ETag): modules import each
// other by plain URL, so a stale cached copy of one (e.g. /shared/config.js
// held for hours by the CDN's browser TTL) breaks a release. Art and audio
// revalidate when their browser cache expires.
const revalidate = (res, file) => {
  if (/\.(webp|png|jpg|jpeg|mp3|ogg|woff2)$/.test(file))
    res.setHeader("Cache-Control", "public, max-age=86400");
  if (/\.(js|mjs|json|css|html|webmanifest)$/.test(file)) res.setHeader("Cache-Control", "no-cache");
};
app.use(releaseStamp({ publicDir: path.resolve("public"), sharedDir: path.resolve("shared") }));
app.use("/shared", express.static(path.resolve("shared"), { setHeaders: revalidate }));
app.use(
  express.static(path.resolve("public"), {
    maxAge: process.env.NODE_ENV === "production" ? "5m" : 0,
    setHeaders: revalidate,
  }),
);
const io = new Server(server, {
  maxHttpBufferSize: 16384,
  allowRequest: (req, done) => {
    const o = req.headers.origin;
    done(null, !o || o === (origin || `http://${req.headers.host}`));
  },
});
io.use((socket, next) => {
  const user = sessions(socket.request);
  if (!user) return next(Error("กรุณาเข้าสู่ระบบ"));
  socket.data.user = user;
  next();
});
io.on("connection", (socket) => {
  const execute = (event, handler, max = 20) =>
    socket.on(event, (data = {}, ack = () => {}) => {
      try {
        if (limited(socket.id + event, max, 1000)) throw Error("ส่งคำสั่งถี่เกินไป");
        const p = world.players.get(socket.id);
        if (!p && event !== "player:join") throw Error("เลือกตัวละครก่อน");
        const result = handler(p, data);
        ack({ ok: true, ...result });
      } catch (e) {
        ack({ ok: false, error: e.message });
      }
    });
  execute("player:join", (_, data) => {
    const c = loadCharacter(data.id);
    if (!c || c.userId !== socket.data.user.id) throw Error("ไม่พบตัวละคร");
    if ([...world.players.values()].some((p) => p.id === c.id))
      throw Error("ตัวละครนี้ออนไลน์อยู่แล้ว");
    if (world.players.has(socket.id)) throw Error("เลือกตัวละครแล้ว");
    const p = world.makeRuntime(c, socket);
    world.players.set(socket.id, p);
    return { message: "ยินดีต้อนรับ " + p.name, onlinePlayers: world.onlineRoster(), announcements: world.announcements.slice(-10) };
  });
  execute(
    "player:input",
    (p, d) => {
      if (
        ![-1, 0, 1].includes(d.direction) ||
        !Number.isSafeInteger(d.seq) ||
        d.seq <= p.lastSeq
      )
        return;
      p.lastSeq = d.seq;
      p.lastInput = Date.now() / 1000;
      p.input = d.direction;
      p.running = d.running === true;
      p.jump = !!d.jump;
      if (d.direction || d.jump) p.auto = false;
    },
    35,
  );
  execute("player:attack", (p, d) => world.attack(p, d.skill ?? 0));
  execute("player:auto", (p, d) => {
    if (p.area !== "dungeon" || p.hp <= 0)
      throw Error("Auto เปิดได้เฉพาะในดันเจียน");
    p.auto = !!d.enabled;
  });
  execute("slots:spin", (p, d) => spinSlotMachine(p, d.key), 3);
  execute("player:potion", (p, d) => world.potion(p, d.type));
  execute("player:heal", (p) => {
    world.ensureTown(p);
    p.hp = maxHp(p);
    p.mp = maxMp(p);
    return { message: "พักฟื้นพลังเต็มแล้ว" };
  });
  execute("training:enter", (p) => world.beginTraining(p), 2);
  execute("dungeon:enter", (p, d) => world.beginDungeon(p, d.floor));
  execute("night:enter", (p) => world.beginNightCave(p), 2);
  execute("worldboss:join", (p) => world.joinWorldBoss(p), 2);
  execute("dungeon:next", (p) => world.nextStage(p));
  execute("dungeon:explore", (p, d) => world.useDungeonSign(p, d), 5);
  execute("dungeon:leave", (p) => world.returnTown(p));
  execute("npc:buy", (p, d) => world.buyNpc(p, d.item, d.key), 5);
  execute("equipment:buy", (p, d) => world.buyEquipment(p, d.id, d.key));
  execute("inventory:discard", (p, d) => world.discardItem(p, d.id, d.key), 3);
  execute("equipment:equip", (p, d) => world.equip(p, d.slot, d.id));
  execute("class:specialize", (p, d) => world.specialize(p, d.id));
  execute("class:advance", (p) => world.advanceClass(p), 3);
  execute("costume:wear", (p, d) => world.wearCostume(p, typeof d?.id === "string" ? d.id : null), 3);
  execute("stats:raise", (p, d) => world.raiseStats(p, d.adds), 5);
  execute("stats:auto", (p) => world.autoStats(p), 3);
  execute("stats:reset", (p) => world.resetStats(p), 2);
  execute("quest:claim", (p, d) => world.claimQuest(p, d.index), 5);
  execute("equipment:enhance", (p, d) => world.enhance(p, d.key, d.slot), 3);
  execute("shop:create", (p, d) => world.createShop(p, d), 3);
  execute("shop:buy", (p, d) => world.buyShop(p, d), 5);
  execute("shop:close", (p, d) => world.closeShop(p, d.key), 3);
  execute("shop:list", (p, d) => world.listShopItem(p, d), 5);
  execute("shop:unlist", (p, d) => world.unlistShopItem(p, d), 5);
  execute("party:action", (p, d) => world.partyAction(p, d), 5);
  execute("trade:action", (p, d) => world.tradeAction(p, d), 8);
  execute(
    "chat:send",
    (p, d) => {
      if (
        typeof d.message !== "string" ||
        !d.message.trim() ||
        d.message.length > 160
      )
        throw Error("ข้อความ 1–160 ตัวอักษร");
      const packet = {
        id: randomUUID(),
        name: p.name,
        message: d.message.trim(),
        channel: d.channel === "party" ? "party" : "world",
      };
      if (packet.channel === "party") {
        if (!p.party) throw Error("ยังไม่มีปาร์ตี้");
        for (const m of world.players.values())
          if (m.party === p.party) m.socket.emit("chat:message", packet);
      } else io.emit("chat:message", packet);
    },
    2,
  );
  socket.on("disconnect", () => {
    const p = world.players.get(socket.id);
    if (p) {
      try {
        world.disconnect(p);
      } catch (e) {
        console.error("disconnect:", e.message);
      }
      world.players.delete(socket.id);
    }
  });
});
const backupTimer = setInterval(async () => {
  try {
    const dir = path.resolve(
      path.dirname(process.env.DB_PATH || "data/game.sqlite"),
      "backups",
    );
    mkdirSync(dir, { recursive: true });
    await db.backup(
      path.join(
        dir,
        "scheduled-" +
          new Date().toISOString().replace(/[:.]/g, "-") +
          ".sqlite",
      ),
    );
    const names = readdirSync(dir)
      .filter((n) => n.startsWith("scheduled-") && n.endsWith(".sqlite"))
      .sort();
    for (const name of names.slice(0, -7)) unlinkSync(path.join(dir, name));
  } catch (e) {
    console.error("backup:", e.message);
  }
}, 86400000);
backupTimer.unref();
let announcedId = null;
let rosterHash = "";
let step = 0;
const timer = setInterval(() => {
  try {
    world.tick(0.05);
    const notices = world.announcements;
    if (notices.length && notices.at(-1).id !== announcedId) {
      const index = notices.findIndex(a => a.id === announcedId);
      for (const notice of notices.slice(index + 1)) io.emit("announcement", notice);
      announcedId = notices.at(-1).id;
    }
    const roster = world.onlineRoster(), nextRosterHash = JSON.stringify(roster);
    if (nextRosterHash !== rosterHash) {
      rosterHash = nextRosterHash;
      io.emit("online:roster", roster);
    }
    if (++step % 1 === 0)
      for (const p of world.players.values())
        p.socket.emit("world:snapshot", world.snapshot(p));
    if (step % 200 === 0)
      for (const p of world.players.values()) world.savePlayer(p);
  } catch (e) {
    console.error("tick:", e.message);
  }
}, 50);
const port = Number(process.env.PORT) || 5173;
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`Tham Luang demo http://localhost:${port}`),
);
function shutdown() {
  clearInterval(timer);
  clearInterval(backupTimer);
  for (const p of world.players.values()) world.savePlayer(p);
  io.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
