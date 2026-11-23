# Character lobby

The start screen and home-screen icon use the same code-drawn hero as the game (`toon.js`), replacing the painted marketing illustration. Lobby art is in `src/lobby-art.js`. Optional icon rebuild: install `@napi-rs/canvas` separately and run `node tools/render-brand.mjs` (or set `TILMO_CANVAS_MODULE` to its module entry point).

The roster supports six local characters. All new heroes start as novices and choose knight, mage or gunner at Lv.10. Appearance and name are chosen at creation. Each character has separate save, equipment, gold, pets, profile and history. Existing single-character save keys are copied unchanged to the first slot; originals remain intact and the previous version-wipe is removed. Switching from the pause menu saves before returning to the roster and aborts if storage cannot be written.

Storage index: `tilmo-characters-v1`; per-character keys: `<id>:tilmo-save`, `<id>:tilmo-stash`, `<id>:tilmo-profile`, `<id>:tilmo-runs`. These remain device/browser local. Creating another hero never clears an existing hero. There is no deletion UI.

Validated with 67 passing tests, including legacy migration, reload, separate inventories/history, slot cap and failed writes. Browser checked new character creation, gameplay, pause-to-roster, switching, reload and mobile layout. Live browser verified migration of an existing Lv.4 save into slot 1.

Deployed to `/opt/tilmo/releases/20261123-lobby-characters`; active at https://tilmo.pikad.online/. Entry scripts and CSS use `?v=lobby2` to bypass existing Cloudflare caches, and app icons use `?v=toon2`. Previously installed home-screen icons may update according to the device's own refresh schedule.
