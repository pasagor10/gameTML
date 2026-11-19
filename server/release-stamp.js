// Content-stamped scripts and styles.
//
// Browser modules import each other by plain URL ("/shared/config.js",
// "./rpg.js"), and the CDN in front of the game gives .js/.css a fixed browser
// cache TTL whatever the origin says. A browser could then run a new game.js
// against an hours-old shared module and crash. So every page, script and
// stylesheet is served with its import / src / href URLs stamped (?r=…) with
// a hash of the target file's served body. That body carries its own
// imports' stamps, so a change anywhere below a module changes its stamp too.
//
// Restarting the server without code changes keeps every URL, so players'
// caches stay warm; a deploy refreshes only the files that changed and the
// modules that import them. Pages themselves are no-cache, which the CDN
// honours.
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const withStamp = (url, query, hash) => `${url}${query ? `${query}&` : "?"}r=${hash}`;
// import … from "x", import "x", import("x"), export … from "x"
const JS_IMPORT = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])((?:\.{1,2})?\/[^"'\s?]+?\.m?js)(\?[^"']*)?\2/g;
const HTML_ASSET = /\b(src|href)="(\/[^"?]+?\.(?:m?js|css))(\?[^"]*)?"/g;
const CSS_IMPORT = /@import\s+(url\()?(["'])(\/[^"'?]+?\.css)(\?[^"']*)?\2/g;

// stampOf(url) gives the stamp for a referenced URL as written in the file.
export function rewrite(text, type, stampOf) {
  if (type === "js")
    return text.replace(JS_IMPORT, (_, lead, q, url, query) => `${lead}${q}${withStamp(url, query, stampOf(url))}${q}`);
  if (type === "html")
    return text.replace(HTML_ASSET, (_, attr, url, query) => `${attr}="${withStamp(url, query, stampOf(url))}"`);
  if (type === "css")
    return text.replace(CSS_IMPORT, (_, u, q, url, query) => `@import ${u || ""}${q}${withStamp(url, query, stampOf(url))}${q}`);
  return text;
}

const TYPES = {
  ".js": ["js", "text/javascript; charset=utf-8"],
  ".mjs": ["js", "text/javascript; charset=utf-8"],
  ".html": ["html", "text/html; charset=utf-8"],
  ".css": ["css", "text/css; charset=utf-8"],
};
const hashOf = (text) => createHash("sha1").update(text).digest("hex").slice(0, 10);
// Served bodies are rebuilt at most this often; within it a page load's
// ~100 requests share one pass over the module graph.
const FRESH_MS = 1000;

// Express middleware for the public folder and /shared. Also exposes
// release(): the stamp of /game.js, which changes whenever any game code does.
export function releaseStamp({ publicDir, sharedDir }) {
  const files = new Map(); // file → { mtime, raw }
  let built = new Map(), // urlPath → { body, hash } | null
    builtAt = 0;
  const locate = (urlPath) => {
    const shared = urlPath.startsWith("/shared/"),
      root = shared ? sharedDir : publicDir,
      file = path.resolve(root, "." + (shared ? urlPath.slice("/shared".length) : urlPath));
    return file.startsWith(root + path.sep) ? file : null;
  };
  const read = (file) => {
    let stat;
    try {
      stat = statSync(file);
    } catch {
      return null;
    }
    if (!stat.isFile()) return null;
    let entry = files.get(file);
    if (!entry || entry.mtime !== stat.mtimeMs) {
      entry = { mtime: stat.mtimeMs, raw: readFileSync(file, "utf8") };
      files.set(file, entry);
    }
    return entry.raw;
  };
  // Served body and stamp of one URL path, stamping its references first.
  const build = (urlPath, visiting = new Set()) => {
    if (Date.now() - builtAt > FRESH_MS) {
      built = new Map();
      builtAt = Date.now();
    }
    if (built.has(urlPath)) return built.get(urlPath);
    const kind = TYPES[path.extname(urlPath)],
      file = kind && locate(urlPath),
      raw = file && read(file);
    if (raw == null) return null;
    visiting.add(urlPath);
    const body = rewrite(raw, kind[0], (url) => {
      const target = new URL(url, "http://stamp" + urlPath).pathname;
      // A module that (even in a comment) names one still being built: its
      // raw text is the best stamp available without looping.
      if (visiting.has(target)) {
        const targetFile = locate(target);
        return hashOf((targetFile && read(targetFile)) || target);
      }
      return build(target, visiting)?.hash ?? "0";
    });
    visiting.delete(urlPath);
    const entry = { body, hash: hashOf(body) };
    built.set(urlPath, entry);
    return entry;
  };
  const middleware = (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.path);
    } catch {
      return next();
    }
    if (urlPath === "/") urlPath = "/index.html";
    const kind = TYPES[path.extname(urlPath)];
    if (!kind || !locate(urlPath)) return next();
    const entry = build(urlPath);
    if (!entry) return next();
    const etag = `"${entry.hash}"`;
    res.setHeader("Content-Type", kind[1]);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    if (req.method === "HEAD") return res.end();
    res.send(entry.body);
  };
  middleware.release = () => build("/game.js")?.hash ?? "";
  return middleware;
}
