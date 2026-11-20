// Leave the team's own accounts out of /dashboard numbers.
//   node tools/analytics-exclude.mjs list
//   node tools/analytics-exclude.mjs candidates        # high-level heroes, to spot test accounts
//   node tools/analytics-exclude.mjs add <hero or account name>...
//   node tools/analytics-exclude.mjs remove <hero or account name>...
// Uses DB_PATH like the server. Safe while the server runs (SQLite WAL).
import { db } from "../server/database.js";
import "../server/analytics.js"; // creates the analytics tables

const [command = "list", ...names] = process.argv.slice(2);
const userOf = (name) =>
  db.prepare("SELECT id, name FROM users WHERE name=?").get(name) ||
  db.prepare("SELECT u.id, u.name FROM characters c JOIN users u ON u.id=c.user_id WHERE c.name=?").get(name);
const heroes = (userId) =>
  db.prepare("SELECT name, state FROM characters WHERE user_id=?").all(userId)
    .map((c) => { const s = JSON.parse(c.state); return `${c.name} Lv.${s.level || 1} ชั้น ${s.quest || 0}`; })
    .join(", ");

if (command === "add" || command === "remove") {
  for (const name of names) {
    const u = userOf(name);
    if (!u) { console.log(`ไม่พบ: ${name}`); process.exitCode = 1; continue; }
    if (command === "add") db.prepare("INSERT OR IGNORE INTO analytics_exclude VALUES(?)").run(u.id);
    else db.prepare("DELETE FROM analytics_exclude WHERE user_id=?").run(u.id);
    console.log(`${command === "add" ? "ตัดออก" : "นับกลับ"}: บัญชี ${u.name} (${heroes(u.id) || "ไม่มีตัวละคร"})`);
  }
} else if (command === "candidates") {
  const rows = db.prepare("SELECT c.user_id, u.name account, u.password IS NOT NULL registered, c.name, c.state FROM characters c JOIN users u ON u.id=c.user_id").all()
    .map((r) => ({ ...r, s: JSON.parse(r.state) }))
    .filter((r) => (r.s.level || 1) >= 30 || (r.s.quest || 0) >= 10)
    .sort((a, b) => (b.s.level || 1) - (a.s.level || 1));
  const excluded = new Set(db.prepare("SELECT user_id FROM analytics_exclude").all().map((r) => r.user_id));
  for (const r of rows)
    console.log(`${excluded.has(r.user_id) ? "[ตัดแล้ว] " : ""}${r.name} · Lv.${r.s.level} · ชั้น ${r.s.quest || 0} · บัญชี ${r.account}${r.registered ? "" : " (ผู้มาเยือน)"}`);
} else {
  const rows = db.prepare("SELECT u.id, u.name FROM analytics_exclude e JOIN users u ON u.id=e.user_id").all();
  console.log(rows.length ? rows.map((u) => `${u.name}: ${heroes(u.id) || "ไม่มีตัวละคร"}`).join("\n") : "ยังไม่ได้ตัดบัญชีใดออก");
}
