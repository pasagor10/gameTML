// Anonymous funnel analytics for the public /dashboard.
// A visitor gets a random `tml_vid` cookie; each funnel step is recorded once
// per visitor (first time only). Only aggregate counts ever leave the server.
import { randomUUID } from "node:crypto";
import { db } from "./database.js";
import { MAX_LEVEL } from "../shared/config.js";

db.exec(`CREATE TABLE IF NOT EXISTS funnel(vid TEXT NOT NULL,step TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(vid,step));
CREATE INDEX IF NOT EXISTS funnel_step_at ON funnel(step,at);
CREATE TABLE IF NOT EXISTS visits(vid TEXT NOT NULL,day TEXT NOT NULL,PRIMARY KEY(vid,day));`);

export const STEPS = [
  { id: "visit", label: "เข้าหน้าเว็บ" },
  { id: "account", label: "กดเล่น / มีบัญชี" },
  { id: "lobby", label: "ถึงหน้าเลือกตัวละคร" },
  { id: "character", label: "สร้างตัวละคร" },
  { id: "join", label: "เข้าเมือง" },
  { id: "dungeon", label: "เข้าดันเจียนครั้งแรก" },
  { id: "clear1", label: "ผ่านดันเจียนชั้น 1" },
];
const STEP_IDS = new Set(STEPS.map((s) => s.id));
const STEP_INDEX = Object.fromEntries(STEPS.map((s, k) => [s.id, k]));
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|curl|wget|python-requests|headless/i;
const DAY_MS = 86400000,
  TZ_MS = 7 * 3600000; // Asia/Bangkok
export const dayOf = (ms) => new Date(ms + TZ_MS).toISOString().slice(0, 10);

const cookie = (headers, name) =>
  headers?.cookie?.split(";").map((s) => s.trim()).find((s) => s.startsWith(name + "="))?.slice(name.length + 1) || null;
const validVid = (v) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null);
export const visitorOf = (headers) => validVid(cookie(headers, "tml_vid"));

// Page middleware: hand out a visitor cookie and return the id.
export function ensureVisitor(req, res) {
  let vid = visitorOf(req.headers);
  if (!vid) {
    vid = randomUUID();
    res.append(
      "Set-Cookie",
      `tml_vid=${vid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    req.headers.cookie = (req.headers.cookie ? req.headers.cookie + "; " : "") + "tml_vid=" + vid;
  }
  return vid;
}

const insertStep = db.prepare("INSERT OR IGNORE INTO funnel VALUES(?,?,?)"),
  insertVisit = db.prepare("INSERT OR IGNORE INTO visits VALUES(?,?)");
// `key` falls back to the account id so older sessions without a cookie count.
export function track(headers, step, userId = null, at = Date.now()) {
  if (!STEP_IDS.has(step) || BOT.test(headers?.["user-agent"] || "")) return;
  const key = visitorOf(headers) || (userId ? "u:" + userId : null);
  if (!key) return;
  try {
    insertStep.run(key, step, at);
    insertVisit.run(key, dayOf(at));
  } catch { /* Analytics must never break gameplay. */ }
}

const LEVEL_BUCKETS = [[1, 1], [2, 4], [5, 9], [10, 19], [20, 29], [30, 39], [40, 49], [50, MAX_LEVEL]];

export function dashboardStats({ days = 30, online = 0, now = Date.now() } = {}) {
  const since = days > 0 ? now - days * DAY_MS : 0;
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  // Cohort: visitors whose first recorded step falls inside the window. A
  // step counts everyone who got at least that far, so the funnel never rises
  // (sessions from before tracking can skip the early steps).
  const furthest = new Map();
  for (const r of db
    .prepare(
      `WITH c AS (SELECT vid FROM funnel GROUP BY vid HAVING min(at) >= ?)
       SELECT f.vid, f.step FROM funnel f JOIN c USING(vid)`,
    )
    .all(since)) {
    const k = STEP_INDEX[r.step];
    if (k > (furthest.get(r.vid) ?? -1)) furthest.set(r.vid, k);
  }
  const reached = [...furthest.values()];
  const funnel = STEPS.map((s, k) => ({ ...s, count: reached.filter((n) => n >= k).length }));
  // All-time visitors who only ever saw the landing page.
  const visitOnly = db
    .prepare("SELECT count(*) n FROM (SELECT vid FROM funnel GROUP BY vid HAVING count(*)=1 AND max(step='visit')=1)")
    .get().n;

  const today = dayOf(now);
  const dayKeys = Array.from({ length: 14 }, (_, k) => dayOf(now - (13 - k) * DAY_MS));
  const perDay = (rows) => Object.fromEntries(rows.map((r) => [r.day, r.n]));
  const visitors = perDay(
    db.prepare("SELECT day, count(*) n FROM visits WHERE day >= ? GROUP BY day").all(dayKeys[0]),
  );
  const accounts = {},
    characters = {};
  for (const r of db.prepare("SELECT created FROM users WHERE created >= ?").all(now - 15 * DAY_MS)) {
    const d = dayOf(r.created);
    accounts[d] = (accounts[d] || 0) + 1;
  }
  for (const r of db.prepare("SELECT at FROM funnel WHERE step='character' AND at >= ?").all(now - 15 * DAY_MS)) {
    const d = dayOf(r.at);
    characters[d] = (characters[d] || 0) + 1;
  }
  const daily = dayKeys.map((day) => ({
    day,
    visitors: visitors[day] || 0,
    accounts: accounts[day] || 0,
    characters: characters[day] || 0,
  }));

  const chars = db.prepare("SELECT state FROM characters").all().map((r) => {
    try { return JSON.parse(r.state); } catch { return {}; }
  });
  const levels = LEVEL_BUCKETS.map(([lo, hi]) => ({
    label: lo === hi ? `Lv.${lo}` : `Lv.${lo}–${hi}`,
    count: chars.filter((c) => (c.level || 1) >= lo && (c.level || 1) <= hi).length,
  }));
  const maxFloor = Math.max(10, ...chars.map((c) => c.quest || 0));
  const floors = Array.from({ length: maxFloor + 1 }, (_, f) => ({
    label: f === 0 ? "ยังไม่ผ่าน" : `ชั้น ${f}`,
    count: chars.filter((c) => (c.quest || 0) === f).length,
  }));
  const classNames = { swordsman: "นักดาบ", archer: "นักธนู", mage: "จอมเวท", priest: "พระ" };
  const classes = Object.entries(classNames).map(([id, label]) => ({
    label,
    count: chars.filter((c) => c.class === id).length,
  }));

  return {
    generatedAt: now,
    days,
    totals: {
      visitors: one("SELECT count(DISTINCT vid) n FROM funnel").n,
      visitorsToday: one("SELECT count(*) n FROM visits WHERE day=?", today).n,
      accounts: one("SELECT count(*) n FROM users").n,
      registered: one("SELECT count(*) n FROM users WHERE password IS NOT NULL").n,
      characters: chars.length,
      noCharacter: one("SELECT count(*) n FROM users u WHERE NOT EXISTS (SELECT 1 FROM characters c WHERE c.user_id=u.id)").n,
      visitOnly,
      online,
    },
    funnel,
    daily,
    levels,
    floors,
    classes,
  };
}
