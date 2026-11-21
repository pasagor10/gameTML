import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const publicRoot = new URL("../public/", import.meta.url);
test("TML ONLINE manifest has installable icons, stable identity and launch scope", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("manifest.webmanifest", publicRoot)),
  );
  assert.equal(manifest.name, "TML ONLINE");
  assert.equal(manifest.short_name, "TML ONLINE");
  assert.equal(manifest.id, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.start_url.startsWith("/"));
  assert.equal(manifest.orientation, "portrait");
  for (const size of [192, 512])
    assert.ok(
      manifest.icons.some(
        (i) => i.sizes === `${size}x${size}` && i.purpose === "any",
      ),
    );
  assert.ok(manifest.icons.some((i) => i.purpose === "maskable"));
  for (const icon of manifest.icons) {
    const bytes = await readFile(new URL(icon.src.slice(1), publicRoot));
    const [w, h] = icon.sizes.split("x").map(Number);
    assert.equal(bytes.readUInt32BE(16), w);
    assert.equal(bytes.readUInt32BE(20), h);
  }
  const html = await readFile(new URL("index.html", publicRoot), "utf8");
  assert.match(html, /apple-mobile-web-app-title" content="TML ONLINE/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /install-app/);
});
test("service worker keeps live game and account traffic out of its cache", async () => {
  const listeners = {};
  let saved = [],
    deleted = [],
    network = 0,
    responded;
  const offline = { offline: true };
  const context = {
    URL,
    self: {
      location: { origin: "https://game.test" },
      addEventListener: (type, fn) => (listeners[type] = fn),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => ({
        addAll: async (urls) => {
          saved = urls;
        },
      }),
      keys: async () => ["tml-install-v0", "unrelated-app-cache"],
      delete: async (key) => deleted.push(key),
      match: async (url) => {
        assert.equal(url, "/offline.html");
        return offline;
      },
    },
    fetch: async () => {
      network++;
      throw Error("offline");
    },
  };
  vm.runInNewContext(
    await readFile(new URL("sw.js", publicRoot), "utf8"),
    context,
  );
  let work;
  listeners.install({ waitUntil: (p) => (work = p) });
  await work;
  assert.deepEqual(Array.from(saved), [
    "/offline.html",
    "/assets/app/icon-portal-192.png",
    "/assets/app/icon-portal-512.png",
  ]);
  listeners.activate({ waitUntil: (p) => (work = p) });
  await work;
  assert.deepEqual(deleted, ["tml-install-v0"]);
  for (const url of [
    "/api/me",
    "/socket.io/?EIO=4",
    "/game.js",
    "/assets/sprites/index.json",
  ]) {
    listeners.fetch({
      request: { url: "https://game.test" + url, method: "GET", mode: "cors" },
      respondWith: () => assert.fail("must bypass game/API requests"),
    });
  }
  listeners.fetch({
    request: { url: "https://game.test/", method: "GET", mode: "navigate" },
    respondWith: (p) => (responded = p),
  });
  assert.equal(await responded, offline);
  assert.equal(network, 1);
});

test("install button prompts on supported browsers, explains iOS and hides after installation", async () => {
  const script = await readFile(new URL("install.js", publicRoot), "utf8");
  function setup(ios = false) {
    const windowEvents = {};
    const buttons = {};
    const element = (id) =>
      (buttons[id] ??= {
        hidden: false,
        disabled: false,
        textContent: "",
        open: false,
        events: {},
        addEventListener(type, fn) {
          this.events[type] = fn;
        },
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
      });
    const context = {
      document: { querySelector: element },
      navigator: {
        userAgent: ios ? "iPhone" : "Chrome",
        platform: ios ? "iPhone" : "Linux",
        maxTouchPoints: ios ? 1 : 0,
      },
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      window: {
        addEventListener: (type, fn) => (windowEvents[type] = fn),
        isSecureContext: false,
      },
      console,
    };
    vm.runInNewContext(script, context);
    return {
      windowEvents,
      button: buttons["#install-app"],
      dialog: buttons["#install-help"],
      steps: element("#install-steps"),
    };
  }
  const desktop = setup();
  assert.equal(desktop.button.hidden, false);
  let prevented = false,
    prompted = false;
  desktop.windowEvents.beforeinstallprompt({
    preventDefault() {
      prevented = true;
    },
    async prompt() {
      prompted = true;
    },
    userChoice: Promise.resolve({ outcome: "dismissed" }),
  });
  await desktop.button.events.click();
  assert.ok(prevented);
  assert.ok(prompted);
  assert.equal(desktop.button.disabled, false);
  desktop.windowEvents.appinstalled();
  assert.equal(desktop.button.hidden, true);
  const ios = setup(true);
  await ios.button.events.click();
  assert.equal(ios.dialog.open, true);
  assert.match(ios.steps.textContent, /Safari/);
  assert.match(ios.steps.textContent, /Add to Home Screen/);
  let stopped = false;
  ios.dialog.events.keydown({
    stopPropagation() {
      stopped = true;
    },
  });
  assert.ok(stopped);
});
