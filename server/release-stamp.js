// Release-stamped scripts and styles.
//
// Browser modules import each other by plain URL ("/shared/config.js",
// "./rpg.js"), and the CDN in front of the game gives .js/.css a fixed browser
// cache TTL whatever the origin says. A browser could then run a new game.js
// against an hours-old shared module and crash. So every page, script and
// stylesheet is served with its import / src / href URLs stamped with this
// server's release id (?r=…), giving each release fresh URLs no stale cache
// can answer. Pages themselves are no-cache, which the CDN honours.
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

export const RELEASE = process.env.RELEASE || Date.now().toString(36);

const stamp = (url, query = "") => `${url}${query ? `${query}&` : "?"}r=${RELEASE}`;
// import … from "x", import "x", import("x"), export … from "x"
const JS_IMPORT = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])((?:\.{1,2})?\/[^"'\s?]+?\.m?js)(\?[^"']*)?\2/g;
const HTML_ASSET = /\b(src|href)="(\/[^"?]+?\.(?:m?js|css))(\?[^"]*)?"/g;
const CSS_IMPORT = /@import\s+(url\()?(["'])(\/[^"'?]+?\.css)(\?[^"']*)?\2/g;

export function rewrite(text, type) {
  if (type === "js") return text.replace(JS_IMPORT, (_, lead, q, url, query) => `${lead}${q}${stamp(url, query)}${q}`);
  if (type === "html") return text.replace(HTML_ASSET, (_, attr, url, query) => `${attr}="${stamp(url, query)}"`);
  if (type === "css") return text.replace(CSS_IMPORT, (_, u, q, url, query) => `@import ${u || ""}${q}${stamp(url, query)}${q}`);
  return text;
}

const TYPES = {
  ".js": ["js", "text/javascript; charset=utf-8"],
  ".mjs": ["js", "text/javascript; charset=utf-8"],
  ".html": ["html", "text/html; charset=utf-8"],
  ".css": ["css", "text/css; charset=utf-8"],
};

// Express middleware for the public folder and /shared.
export function releaseStamp({ publicDir, sharedDir }) {
  const cache = new Map(); // file → { mtime, body, etag }
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.path);
    } catch {
      return next();
    }
    if (urlPath === "/") urlPath = "/index.html";
    const ext = path.extname(urlPath),
      kind = TYPES[ext];
    if (!kind) return next();
    const shared = urlPath.startsWith("/shared/"),
      root = shared ? sharedDir : publicDir,
      file = path.resolve(root, "." + (shared ? urlPath.slice("/shared".length) : urlPath));
    if (!file.startsWith(root + path.sep)) return next();
    let stat;
    try {
      stat = statSync(file);
    } catch {
      return next();
    }
    if (!stat.isFile()) return next();
    let entry = cache.get(file);
    if (!entry || entry.mtime !== stat.mtimeMs) {
      const body = rewrite(readFileSync(file, "utf8"), kind[0]);
      entry = {
        mtime: stat.mtimeMs,
        body,
        etag: `"${createHash("sha1").update(body).digest("base64url").slice(0, 20)}"`,
      };
      cache.set(file, entry);
    }
    res.setHeader("Content-Type", kind[1]);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("ETag", entry.etag);
    if (req.headers["if-none-match"] === entry.etag) return res.status(304).end();
    if (req.method === "HEAD") return res.end();
    res.send(entry.body);
  };
}
