import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "tml-analytics-"));
process.env.DB_PATH = path.join(dir, "test.sqlite");
const { db } = await import("../server/database.js");
const { track, dashboardStats, dayOf, STEPS } = await import("../server/analytics.js");

const vid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const headers = (n, ua = "Mozilla/5.0") => ({ cookie: `a=1; tml_vid=${vid(n)}`, "user-agent": ua });

test("funnel counts each visitor once per step and skips bots", () => {
  const now = Date.now();
  for (let n = 1; n <= 10; n++) track(headers(n), "visit", null, now - 1000);
  for (let n = 1; n <= 4; n++) track(headers(n), "account", null, now - 900);
  track(headers(1), "account", null, now - 800); // repeat: still once
  for (let n = 1; n <= 2; n++) track(headers(n), "character", null, now - 700);
  track(headers(99, "Googlebot/2.1"), "visit", null, now);
  track({}, "visit"); // no cookie, no account: ignored
  track(headers(3), "not-a-step");
  // Session from before tracking: reached the lobby without a recorded visit.
  track(headers(20), "lobby", null, now - 500);
  // An old visitor outside the 7-day window.
  track(headers(50), "visit", null, now - 40 * 86400000);
  db.prepare("INSERT INTO users VALUES(?,?,?,?)").run("u1", "guest-u1", null, now);
  db.prepare("INSERT INTO characters VALUES(?,?,?,?)").run("c1", "u1", "Hero", JSON.stringify({ class: "mage", level: 12, quest: 2 }));

  const s = dashboardStats({ days: 7, online: 3, now });
  const count = Object.fromEntries(s.funnel.map((f) => [f.id, f.count]));
  assert.deepEqual(s.funnel.map((f) => f.id), STEPS.map((x) => x.id));
  assert.equal(count.visit, 11, "later steps imply the visit");
  assert.equal(count.account, 5);
  assert.equal(count.lobby, 3);
  assert.equal(count.character, 2);
  assert.ok(s.funnel.every((f, k) => !k || f.count <= s.funnel[k - 1].count), "funnel never rises");
  assert.equal(s.totals.visitors, 12);
  assert.equal(s.totals.visitOnly, 7);
  assert.equal(s.totals.visitorsToday, 11);
  assert.equal(s.totals.online, 3);
  assert.equal(s.totals.characters, 1);
  assert.equal(s.daily.length, 14);
  assert.equal(s.daily.at(-1).day, dayOf(now));
  assert.equal(s.daily.at(-1).visitors, 11);
  assert.equal(s.levels.find((l) => l.label === "Lv.10–19").count, 1);
  assert.equal(s.floors[2].count, 1);
  assert.equal(s.classes.find((c) => c.label === "จอมเวท").count, 1);
  assert.equal(dashboardStats({ days: 0, now }).funnel[0].count, 12);
  // Aggregates only: no names or ids leak into the public payload.
  assert.doesNotMatch(JSON.stringify(s), /Hero|guest-u1|0000-4000/);
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
