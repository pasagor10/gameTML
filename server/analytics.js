// Anonymous funnel analytics for the public /dashboard.
// A visitor gets a random `tml_vid` cookie; each funnel step is recorded once
// per visitor (first time only). Only aggregate counts ever leave the server.
import { randomUUID } from "node:crypto";
import { db } from "./database.js";
import { MAX_LEVEL } from "../shared/config.js";

db.exec(`CREATE TABLE IF NOT EXISTS funnel(vid TEXT NOT NULL,step TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(vid,step));
CREATE INDEX IF NOT EXISTS funnel_step_at ON funnel(step,at);
CREATE TABLE IF NOT EXISTS funnel_daily(vid TEXT NOT NULL,day TEXT NOT NULL,step TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(vid,day,step));
CREATE INDEX IF NOT EXISTS funnel_daily_at ON funnel_daily(at);
CREATE TABLE IF NOT EXISTS character_births(character TEXT PRIMARY KEY,at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS visits(vid TEXT NOT NULL,day TEXT NOT NULL,PRIMARY KEY(vid,day));
CREATE TABLE IF NOT EXISTS vid_users(vid TEXT NOT NULL,user_id TEXT NOT NULL,PRIMARY KEY(vid,user_id));
CREATE TABLE IF NOT EXISTS analytics_exclude(user_id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS f1_exits(vid TEXT NOT NULL,stage INTEGER NOT NULL,reason TEXT NOT NULL,at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS f1_exits_at ON f1_exits(at);
CREATE TABLE IF NOT EXISTS origins(vid TEXT PRIMARY KEY,source TEXT NOT NULL,device TEXT NOT NULL,landing TEXT NOT NULL,at INTEGER NOT NULL);`);
// Keys (visitor ids or "u:<user>") of the team's own accounts, left out of
// every number so test heroes do not inflate levels, floors or the funnel.
const EXCLUDED = `SELECT vid FROM vid_users WHERE user_id IN (SELECT user_id FROM analytics_exclude)
  UNION SELECT 'u:'||user_id FROM analytics_exclude`;

export const STEPS = [
  { id: "visit", label: "เข้าหน้าเว็บ" },
  { id: "account", label: "กดเล่น / มีบัญชี" },
  { id: "lobby", label: "ถึงหน้าเลือกตัวละคร" },
  { id: "character", label: "สร้างตัวละคร" },
  { id: "join", label: "เข้าเมือง" },
  { id: "dungeon", label: "เข้าดันเจียนครั้งแรก" },
  { id: "stage2", label: "ชั้น 1 · ถึงด่าน 2" },
  { id: "boss1", label: "ชั้น 1 · ถึงด่านบอส" },
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

export const DASHBOARD_FROM = "2026-11-22";
const dashboardEpoch = Date.parse(DASHBOARD_FROM + "T00:00:00+07:00");
// Preserve the historical funnel and copy only events actually recorded in
// the new measurement period. No historical visitor is assigned a new date.
db.prepare("INSERT OR IGNORE INTO funnel_daily SELECT vid,date(at/1000,'unixepoch','+7 hours'),step,at FROM funnel WHERE at>=?").run(dashboardEpoch);
const insertDailyStep = db.prepare("INSERT OR IGNORE INTO funnel_daily VALUES(?,?,?,?)");
export function trackCharacterCreated(id, at = Date.now()) {
  try { db.prepare("INSERT OR IGNORE INTO character_births VALUES(?,?)").run(id, at); } catch { /* analytics cannot interrupt creation */ }
}
const insertStep = db.prepare("INSERT OR IGNORE INTO funnel VALUES(?,?,?)"),
  insertVisit = db.prepare("INSERT OR IGNORE INTO visits VALUES(?,?)"),
  insertOwner = db.prepare("INSERT OR IGNORE INTO vid_users VALUES(?,?)"),
  insertExit = db.prepare("INSERT INTO f1_exits VALUES(?,?,?,?)");
const keyOf = (headers, userId) => visitorOf(headers) || (userId ? "u:" + userId : null);
// `key` falls back to the account id so older sessions without a cookie count.
export function track(headers, step, userId = null, at = Date.now()) {
  if (!STEP_IDS.has(step) || BOT.test(headers?.["user-agent"] || "")) return;
  const key = keyOf(headers, userId);
  if (!key) return;
  try {
    insertStep.run(key, step, at);
    insertDailyStep.run(key, dayOf(at), step, at);
    insertVisit.run(key, dayOf(at));
    if (userId && !key.startsWith("u:")) insertOwner.run(key, String(userId));
  } catch { /* Analytics must never break gameplay. */ }
}

// A floor-1 run ended before the hero ever cleared floor 1.
export const EXIT_REASONS = { death: "ตาย", leave: "ออกเอง", disconnect: "หลุด/ปิดเกม" };
export function trackFloor1Exit(headers, userId, stage, reason, at = Date.now()) {
  if (!Object.hasOwn(EXIT_REASONS, reason) || BOT.test(headers?.["user-agent"] || "")) return;
  const key = keyOf(headers, userId);
  if (!key) return;
  try { insertExit.run(key, stage, reason, at); } catch { /* never break gameplay */ }
}

// First touch: where a visitor came from and on what, recorded once.
export const SOURCES = {
  facebook: "Facebook",
  line: "LINE",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X / Twitter",
  discord: "Discord",
  google: "ค้นหา (Google ฯลฯ)",
  homescreen: "ไอคอนบนหน้าจอ",
  other: "เว็บอื่น",
  direct: "ไม่มีที่มา",
};
export const DEVICES = { mobile: "มือถือ", tablet: "แท็บเล็ต", desktop: "คอม" };
const HOSTS = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "facebook"],
  [/(^|\.)(line\.me|line-apps\.com|lin\.ee)$/, "line"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, "twitter"],
  [/(^|\.)discord(app)?\.com$/, "discord"],
  [/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.com|search\.brave\.com)$/, "google"],
];
export function originOf(headers = {}, query = {}, ownHost = "") {
  const ua = headers["user-agent"] || "";
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? "tablet" : /Mobi|iPhone|iPod|Android/i.test(ua) ? "mobile" : "desktop";
  const q = (k) => String(query[k] ?? "").toLowerCase().slice(0, 40);
  let source = null;
  // 1. A tagged link: ?utm_source=line, ?source=homescreen.
  const tag = q("utm_source") || q("source");
  if (tag) {
    const known = Object.keys(SOURCES).find((k) => tag === k || (k === "facebook" && /^(fb|ig_fb|meta)$/.test(tag)) || (k === "twitter" && tag === "x"));
    source = known || (/^[a-z0-9_-]{1,24}$/.test(tag) ? "tag:" + tag : null);
  }
  // 2. An in-app browser says where the link was tapped even with no referrer.
  if (!source) {
    if (/FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(ua) || query.fbclid) source = "facebook";
    else if (/\bLine\//.test(ua)) source = "line";
    else if (/Instagram/i.test(ua)) source = "instagram";
    else if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) source = "tiktok";
  }
  // 3. The referring site.
  if (!source) {
    let host = "";
    try { host = new URL(headers.referer || "").hostname.toLowerCase(); } catch { /* none */ }
    if (host && host !== ownHost) source = HOSTS.find(([rx]) => rx.test(host))?.[1] || "other";
  }
  return { source: source || "direct", device };
}
const insertOrigin = db.prepare("INSERT OR IGNORE INTO origins VALUES(?,?,?,?,?)");
export function trackOrigin(req, landing) {
  const vid = visitorOf(req.headers);
  if (!vid || BOT.test(req.headers["user-agent"] || "")) return;
  try {
    const { source, device } = originOf(req.headers, req.query || {}, String(req.hostname || "").toLowerCase());
    insertOrigin.run(vid, source, device, landing, Date.now());
  } catch { /* never break the page */ }
}
const sourceLabel = (id) => SOURCES[id] || (id?.startsWith("tag:") ? "ลิงก์ติดแท็ก: " + id.slice(4) : "ก่อนเริ่มเก็บข้อมูล");

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
      `WITH c AS (SELECT vid FROM funnel WHERE vid NOT IN (${EXCLUDED}) GROUP BY vid HAVING min(at) >= ?)
       SELECT f.vid, f.step FROM funnel f JOIN c USING(vid)`,
    )
    .all(since)) {
    const k = STEP_INDEX[r.step];
    if (k > (furthest.get(r.vid) ?? -1)) furthest.set(r.vid, k);
  }
  const reached = [...furthest.values()];
  // Each cohort visitor by first-touch source and device: how far they got.
  const originRows = new Map(
    db.prepare("SELECT vid, source, device FROM origins").all().map((r) => [r.vid, r]),
  );
  const [PLAY, HERO, TOWN] = ["account", "character", "join"].map((id) => STEP_INDEX[id]);
  const groupBy = (pick, label) => {
    const g = new Map();
    for (const [vid, n] of furthest) {
      const id = pick(originRows.get(vid)) || "unknown",
        row = g.get(id) || { id, label: label(id), visitors: 0, played: 0, hero: 0, town: 0 };
      row.visitors++;
      if (n >= PLAY) row.played++;
      if (n >= HERO) row.hero++;
      if (n >= TOWN) row.town++;
      g.set(id, row);
    }
    // Unknown (visitors from before origins were recorded) always last.
    return [...g.values()].sort((a, b) => (a.id === "unknown") - (b.id === "unknown") || b.visitors - a.visitors);
  };
  const sources = groupBy((o) => o?.source, sourceLabel);
  const devices = groupBy((o) => o?.device, (id) => DEVICES[id] || "ก่อนเริ่มเก็บข้อมูล");
  const funnel = STEPS.map((s, k) => ({ ...s, count: reached.filter((n) => n >= k).length }));
  // All-time visitors who only ever saw the landing page.
  const visitOnly = db
    .prepare(`SELECT count(*) n FROM (SELECT vid FROM funnel WHERE vid NOT IN (${EXCLUDED}) GROUP BY vid HAVING count(*)=1 AND max(step='visit')=1)`)
    .get().n;

  const today = dayOf(now);
  const dayKeys = Array.from({ length: 14 }, (_, k) => dayOf(now - (13 - k) * DAY_MS));
  const perDay = (rows) => Object.fromEntries(rows.map((r) => [r.day, r.n]));
  const visitors = perDay(
    db.prepare(`SELECT day, count(*) n FROM visits WHERE day >= ? AND vid NOT IN (${EXCLUDED}) GROUP BY day`).all(dayKeys[0]),
  );
  const accounts = {},
    characters = {};
  for (const r of db.prepare("SELECT created FROM users WHERE created >= ? AND id NOT IN (SELECT user_id FROM analytics_exclude)").all(now - 15 * DAY_MS)) {
    const d = dayOf(r.created);
    accounts[d] = (accounts[d] || 0) + 1;
  }
  for (const r of db.prepare(`SELECT at FROM funnel WHERE step='character' AND at >= ? AND vid NOT IN (${EXCLUDED})`).all(now - 15 * DAY_MS)) {
    const d = dayOf(r.at);
    characters[d] = (characters[d] || 0) + 1;
  }
  const daily = dayKeys.map((day) => ({
    day,
    visitors: visitors[day] || 0,
    accounts: accounts[day] || 0,
    characters: characters[day] || 0,
  }));

  const chars = db.prepare("SELECT state FROM characters WHERE user_id NOT IN (SELECT user_id FROM analytics_exclude)").all().map((r) => {
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

  // How floor-1 runs ended before a first clear, by stage.
  const exitRows = db
    .prepare(`SELECT stage, reason, count(*) n, count(DISTINCT vid) people FROM f1_exits
      WHERE at >= ? AND vid NOT IN (${EXCLUDED}) GROUP BY stage, reason`)
    .all(since);
  const floor1Exits = [1, 2, 3].map((stage) => {
    const row = { stage, label: stage === 3 ? "ด่านบอส" : `ด่าน ${stage}`, total: 0 };
    for (const r of Object.keys(EXIT_REASONS)) {
      row[r] = exitRows.find((e) => e.stage === stage && e.reason === r)?.n || 0;
      row.total += row[r];
    }
    return row;
  });
  const exitPeople = one(`SELECT count(DISTINCT vid) n FROM f1_exits WHERE at >= ? AND vid NOT IN (${EXCLUDED})`, since).n;

  // Day-1 return: players who first reached town on day D and came back D+1.
  const joins = db
    .prepare(`SELECT f.vid, f.at FROM funnel f WHERE f.step='join' AND f.at >= ? AND f.vid NOT IN (${EXCLUDED})`)
    .all(now - 15 * DAY_MS);
  const cameBack = db.prepare("SELECT 1 FROM visits WHERE vid=? AND day=?");
  const retention = dayKeys.slice(0, -1).map((day) => {
    const next = dayOf(Date.parse(day + "T12:00:00+07:00") + DAY_MS),
      cohort = joins.filter((j) => dayOf(j.at) === day);
    return { day, players: cohort.length, returned: cohort.filter((j) => cameBack.get(j.vid, next)).length };
  });
  const d1 = retention.reduce((a, r) => ({ players: a.players + r.players, returned: a.returned + r.returned }), { players: 0, returned: 0 });

  return {
    generatedAt: now,
    days,
    totals: {
      visitors: one(`SELECT count(DISTINCT vid) n FROM funnel WHERE vid NOT IN (${EXCLUDED})`).n,
      visitorsToday: one(`SELECT count(*) n FROM visits WHERE day=? AND vid NOT IN (${EXCLUDED})`, today).n,
      accounts: one("SELECT count(*) n FROM users WHERE id NOT IN (SELECT user_id FROM analytics_exclude)").n,
      registered: one("SELECT count(*) n FROM users WHERE password IS NOT NULL AND id NOT IN (SELECT user_id FROM analytics_exclude)").n,
      characters: chars.length,
      noCharacter: one("SELECT count(*) n FROM users u WHERE u.id NOT IN (SELECT user_id FROM analytics_exclude) AND NOT EXISTS (SELECT 1 FROM characters c WHERE c.user_id=u.id)").n,
      excludedAccounts: one("SELECT count(*) n FROM analytics_exclude").n,
      visitOnly,
      online,
    },
    funnel,
    sources,
    devices,
    floor1Exits,
    exitPeople,
    retention,
    d1,
    daily,
    levels,
    floors,
    classes,
  };
}

// Public measurement window: Bangkok calendar days, never before the reset
// date. Kept separate from the historical aggregate reader for compatibility.
export function dashboardPeriodStats({ days = 1, online = 0, now = Date.now() } = {}) {
  const today = dayOf(now), midnight = Date.parse(today + 'T00:00:00+07:00');
  const since = Math.max(dashboardEpoch, days > 0 ? midnight - (days-1)*DAY_MS : dashboardEpoch);
  const from = dayOf(since), to = today;
  const rows = (sql,...args) => db.prepare(sql).all(...args);
  const count = (sql,...args) => db.prepare(sql).get(...args).n;
  const activity = rows(`SELECT vid,step,min(at) at FROM funnel_daily WHERE at>=? AND at<=? AND vid NOT IN (${EXCLUDED}) GROUP BY vid,step`,since,now);
  const furthest = new Map();
  for(const r of activity) furthest.set(r.vid,Math.max(furthest.get(r.vid) ?? -1,STEP_INDEX[r.step]));
  const reached = [...furthest.values()];
  const funnel = STEPS.map((s,k)=>({...s,count:reached.filter(n=>n>=k).length}));
  const originRows = new Map(rows('SELECT vid,source,device FROM origins').map(r=>[r.vid,r]));
  const group = (field,label) => {
    const out = new Map();
    for(const [vid,n] of furthest) {
      const id=originRows.get(vid)?.[field] || 'unknown';
      const r=out.get(id) || {id,label:label(id),visitors:0,played:0,hero:0,town:0};
      r.visitors++;r.played+=n>=STEP_INDEX.account;r.hero+=n>=STEP_INDEX.character;r.town+=n>=STEP_INDEX.join;out.set(id,r);
    }
    return [...out.values()].sort((a,b)=>b.visitors-a.visitors);
  };
  const newUsers=rows('SELECT id,created,password IS NOT NULL registered FROM users WHERE created>=? AND created<=? AND id NOT IN (SELECT user_id FROM analytics_exclude)',since,now);
  const births=rows(`SELECT b.at,c.state FROM character_births b JOIN characters c ON c.id=b.character WHERE b.at>=? AND b.at<=? AND c.user_id NOT IN (SELECT user_id FROM analytics_exclude)`,since,now);
  const chars=births.map(r=>{try{return JSON.parse(r.state);}catch{return {};}});
  const dayCount=Math.max(1,Math.min(14,Math.floor((midnight-since)/DAY_MS)+1));
  const dayKeys=Array.from({length:dayCount},(_,k)=>dayOf(midnight-(dayCount-1-k)*DAY_MS));
  const visits=rows(`SELECT day,count(*) n FROM visits WHERE day>=? AND day<=? AND vid NOT IN (${EXCLUDED}) GROUP BY day`,from,to);
  const daily=dayKeys.map(day=>({day,visitors:visits.find(r=>r.day===day)?.n || 0,accounts:newUsers.filter(r=>dayOf(r.created)===day).length,characters:births.filter(r=>dayOf(r.at)===day).length}));
  const joins=rows(`SELECT vid,min(at) at FROM funnel_daily WHERE step='join' AND at>=? AND at<=? AND vid NOT IN (${EXCLUDED}) GROUP BY vid`,dashboardEpoch,now);
  const retention=dayKeys.filter(day=>day<today).map(day=>{
    const next=dayOf(Date.parse(day+'T00:00:00+07:00')+DAY_MS),cohort=joins.filter(r=>dayOf(r.at)===day);
    const back=db.prepare('SELECT 1 FROM visits WHERE vid=? AND day=?');
    return {day,players:cohort.length,returned:cohort.filter(r=>back.get(r.vid,next)).length};
  });
  const d1=retention.reduce((a,r)=>({players:a.players+r.players,returned:a.returned+r.returned}),{players:0,returned:0});
  const exits=rows(`SELECT stage,reason,count(*) n FROM f1_exits WHERE at>=? AND at<=? AND vid NOT IN (${EXCLUDED}) GROUP BY stage,reason`,since,now);
  const floor1Exits=[1,2,3].map(stage=>{
    const r={stage,label:stage===3?'ด่านบอส':`ด่าน ${stage}`,total:0};
    for(const reason of Object.keys(EXIT_REASONS)) {r[reason]=exits.find(e=>e.stage===stage&&e.reason===reason)?.n || 0;r.total+=r[reason];}return r;
  });
  return {generatedAt:now,days,measurementFrom:DASHBOARD_FROM,from,to,
    totals:{visitors:count(`SELECT count(DISTINCT vid) n FROM visits WHERE day>=? AND day<=? AND vid NOT IN (${EXCLUDED})`,from,to),
      visitorsToday:count(`SELECT count(*) n FROM visits WHERE day=? AND vid NOT IN (${EXCLUDED})`,today),
      visitOnly:reached.filter(n=>n===STEP_INDEX.visit).length,accounts:newUsers.length,registered:newUsers.filter(r=>r.registered).length,characters:chars.length,
      noCharacter:count('SELECT count(*) n FROM users u WHERE created>=? AND created<=? AND id NOT IN (SELECT user_id FROM analytics_exclude) AND NOT EXISTS(SELECT 1 FROM characters c WHERE c.user_id=u.id)',since,now),
      excludedAccounts:count('SELECT count(*) n FROM analytics_exclude'),online},
    funnel,sources:group('source',sourceLabel),devices:group('device',id=>DEVICES[id] || 'ไม่ทราบอุปกรณ์'),floor1Exits,
    exitPeople:count(`SELECT count(DISTINCT vid) n FROM f1_exits WHERE at>=? AND at<=? AND vid NOT IN (${EXCLUDED})`,since,now),
    retention,d1,daily,
    levels:LEVEL_BUCKETS.map(([lo,hi])=>({label:lo===hi?`Lv.${lo}`:`Lv.${lo}–${hi}`,count:chars.filter(c=>(c.level||1)>=lo&&(c.level||1)<=hi).length})),
    floors:Array.from({length:Math.max(10,...chars.map(c=>c.quest||0))+1},(_,f)=>({label:f===0?'ยังไม่ผ่าน':`ชั้น ${f}`,count:chars.filter(c=>(c.quest||0)===f).length})),
    classes:Object.entries({swordsman:'นักดาบ',archer:'นักธนู',mage:'จอมเวท',priest:'พระ'}).map(([id,label])=>({label,count:chars.filter(c=>c.class===id).length}))};
}
