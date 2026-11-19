import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { rewrite, releaseStamp } from "../server/release-stamp.js";

const S = "abc123";
const stampOf = () => S;

test("module imports get a stamp, keeping their own version", () => {
  const js = `import { a } from "/shared/config.js";
import { b } from "/sound.js?v=7";
import "./side.js";
export { c } from "../x.js";
const m = await import("/lazy.js");
fetch("/assets/sprites/index.json");`;
  const out = rewrite(js, "js", stampOf);
  assert.ok(out.includes(`"/shared/config.js?r=${S}"`));
  assert.ok(out.includes(`"/sound.js?v=7&r=${S}"`));
  assert.ok(out.includes(`"./side.js?r=${S}"`));
  assert.ok(out.includes(`"../x.js?r=${S}"`));
  assert.ok(out.includes(`import("/lazy.js?r=${S}")`));
  assert.ok(out.includes(`fetch("/assets/sprites/index.json")`), "data fetches untouched");
});

test("pages stamp their scripts and stylesheets only", () => {
  const html = `<link rel="stylesheet" href="/lobby.css?v=3" /><script type="module" src="/game.js?v=1"></script><link rel="icon" href="/assets/app/icon-32.png" /><link rel="manifest" href="/manifest.webmanifest" />`;
  const out = rewrite(html, "html", stampOf);
  assert.ok(out.includes(`href="/lobby.css?v=3&r=${S}"`));
  assert.ok(out.includes(`src="/game.js?v=1&r=${S}"`));
  assert.ok(out.includes(`href="/assets/app/icon-32.png"`));
  assert.ok(out.includes(`href="/manifest.webmanifest"`));
});

// A tiny site: index.html → game.js → /shared/util.js, plus a separate page.css.
function site() {
  const root = mkdtempSync(path.join(tmpdir(), "stamp-")),
    publicDir = path.join(root, "public"),
    sharedDir = path.join(root, "shared");
  mkdirSync(publicDir);
  mkdirSync(sharedDir);
  const write = (file, text) => {
    writeFileSync(file, text);
    // A distinct mtime per write, as a real edit would have.
    const t = new Date(Date.now() + Math.random() * 1e6);
    utimesSync(file, t, t);
  };
  write(path.join(publicDir, "index.html"), `<link rel="stylesheet" href="/page.css"><script type="module" src="/game.js?v=1"></script>`);
  write(path.join(publicDir, "page.css"), `body{color:red}`);
  write(path.join(publicDir, "game.js"), `import { u } from "/shared/util.js";\n// import x from "/game.js" (a comment naming itself)\nu();`);
  write(path.join(sharedDir, "util.js"), `export const u = () => 1;`);
  return { root, publicDir, sharedDir, write };
}
// Serve one URL through the middleware; resolves to { status, body, headers }.
function get(middleware, url) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader: (k, v) => (headers[k.toLowerCase()] = v),
      status(code) { this.statusCode = code; return this; },
      end() { resolve({ status: this.statusCode, body: "", headers }); },
      send(body) { resolve({ status: this.statusCode, body, headers }); },
    };
    middleware({ method: "GET", path: url, headers: {} }, res, () => resolve({ status: 404 }));
  });
}
const stampIn = (body, url) => body.match(new RegExp(url.replace(/[.?/]/g, "\\$&") + "[^\"]*r=([\\w-]+)"))?.[1];

test("stamps come from content: a restart keeps them, an edit changes only what it reaches", async () => {
  const s = site();
  try {
    const first = releaseStamp(s),
      page = (await get(first, "/")).body,
      game = stampIn(page, "/game.js"),
      css = stampIn(page, "/page.css");
    assert.ok(game && css);
    assert.equal(first.release(), game, "release() is the stamp the page gives game.js");

    // A restart with no code change: identical URLs, so caches stay warm.
    const restarted = releaseStamp(s);
    assert.equal((await get(restarted, "/")).body, page);

    // Editing a module deep in the graph re-stamps it and its importers…
    s.write(path.join(s.sharedDir, "util.js"), `export const u = () => 2;`);
    const after = releaseStamp(s),
      page2 = (await get(after, "/")).body;
    assert.notEqual(stampIn(page2, "/game.js"), game);
    assert.notEqual(after.release(), game);
    const game2 = (await get(after, "/game.js")).body;
    assert.ok(game2.includes(`"/shared/util.js?r=`));
    // …but leaves unrelated files alone.
    assert.equal(stampIn(page2, "/page.css"), css);

    // Bodies carry a matching ETag for cheap revalidation.
    const served = await get(after, "/game.js");
    assert.ok(served.headers.etag && served.headers["cache-control"] === "no-cache");
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});
