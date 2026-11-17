import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
const file = process.env.DB_PATH || "data/game.sqlite";
mkdirSync(dirname(file), { recursive: true });
export const db = new Database(file);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT UNIQUE,password TEXT,created INTEGER);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER);
CREATE TABLE IF NOT EXISTS characters(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),name TEXT UNIQUE,state TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS shops(id TEXT PRIMARY KEY,owner TEXT UNIQUE REFERENCES characters(id),name TEXT,item TEXT,qty INTEGER CHECK(qty>=0),price INTEGER CHECK(price>0),x INTEGER);
CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,actor TEXT,action TEXT,data TEXT,created INTEGER);
CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,actor TEXT,action TEXT,result TEXT,created INTEGER);`);
export function loadCharacter(id) {
  const row = db.prepare("SELECT * FROM characters WHERE id=?").get(id);
  return row
    ? {
        ...JSON.parse(row.state),
        id: row.id,
        userId: row.user_id,
        name: row.name,
      }
    : null;
}
export function persist(p) {
  const id = p.id;
  const state = Object.fromEntries(
    [
      "class",
      "gender",
      "gold",
      "inventory",
      "upgrade",
      "armor",
      "weapon",
      "level",
      "exp",
      "unlocked",
      "quest",
    ].map((k) => [k, p[k]]),
  );
  db.prepare("UPDATE characters SET state=? WHERE id=?").run(
    JSON.stringify(state),
    id,
  );
}
export function log(actor, action, data) {
  db.prepare("INSERT INTO ledger VALUES(?,?,?,?,?)").run(
    randomUUID(),
    actor,
    action,
    JSON.stringify(data),
    Date.now(),
  );
}
export function atomic(actor, action, key, fn) {
  if (typeof key !== "string" || key.length < 8 || key.length > 100)
    throw Error("รหัสคำขอไม่ถูกต้อง");
  return db.transaction(() => {
    const old = db.prepare("SELECT * FROM requests WHERE id=?").get(key);
    if (old) {
      if (old.actor !== actor || old.action !== action)
        throw Error("คำขอไม่ตรงกัน");
      return JSON.parse(old.result);
    }
    const result = fn();
    db.prepare("INSERT INTO requests VALUES(?,?,?,?,?)").run(
      key,
      actor,
      action,
      JSON.stringify(result),
      Date.now(),
    );
    log(actor, action, result);
    return result;
  })();
}
