import { test } from "node:test";
import assert from "node:assert/strict";
import { rewrite, RELEASE } from "../server/release-stamp.js";

test("module imports get the release stamp, keeping their own version", () => {
  const js = `import { a } from "/shared/config.js";
import { b } from "/sound.js?v=7";
import "./side.js";
export { c } from "../x.js";
const m = await import("/lazy.js");
fetch("/assets/sprites/index.json");`;
  const out = rewrite(js, "js");
  assert.match(out, new RegExp(`"/shared/config.js\\?r=${RELEASE}"`));
  assert.match(out, new RegExp(`"/sound.js\\?v=7&r=${RELEASE}"`));
  assert.match(out, new RegExp(`"./side.js\\?r=${RELEASE}"`));
  assert.match(out, new RegExp(`"../x.js\\?r=${RELEASE}"`));
  assert.match(out, new RegExp(`import\\("/lazy.js\\?r=${RELEASE}"\\)`));
  assert.ok(out.includes(`fetch("/assets/sprites/index.json")`), "data fetches untouched");
});

test("pages stamp their scripts and stylesheets only", () => {
  const html = `<link rel="stylesheet" href="/lobby.css?v=3" /><script type="module" src="/game.js?v=1"></script><link rel="icon" href="/assets/app/icon-32.png" /><link rel="manifest" href="/manifest.webmanifest" />`;
  const out = rewrite(html, "html");
  assert.ok(out.includes(`href="/lobby.css?v=3&r=${RELEASE}"`));
  assert.ok(out.includes(`src="/game.js?v=1&r=${RELEASE}"`));
  assert.ok(out.includes(`href="/assets/app/icon-32.png"`));
  assert.ok(out.includes(`href="/manifest.webmanifest"`));
});
