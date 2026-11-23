# TILMO deployment

Deployed 2026-11-23 to the TML VPS, root@157.85.96.64.

- Public hostname: https://tilmo.pikad.online/
- Static release: /opt/tilmo/releases/20261123024500
- Active symlink: /opt/tilmo/current
- Nginx: /etc/nginx/sites-available/tilmo
- No Node service or database required; game progress is browser localStorage.
- TML service and configuration remain independent.

Validation: npm run check and all 57 tests passed; origin index, src/game.js and style.css return HTTP 200. nginx -t passes; tml-game remains active.

Public HTTPS now returns 200. Certificate issued for tilmo.pikad.online with automatic renewal. Nginx serves both HTTP and HTTPS to support the current Cloudflare origin mode. Manifest uses application/manifest+json; service worker and live files use no-cache/no-store headers. PWA support follows TML: standalone launch, Apple touch icon, maskable icon, manual iOS guidance and navigation-only offline fallback. Game assets and saves are never cached by the service worker. All 60 tests pass. Browser verified the logo and install guidance on the live domain; physical iOS/Android installation remains a device check.

Future releases: upload index.html, style.css, sprite-lab.html, manifest.webmanifest, sw.js, offline.html, src/ and assets/ to a new timestamped release directory, then update /opt/tilmo/current. Preserve old releases for rollback. Do not upload .git, output/ or references/.

## Party relay (v0.27+)

Party play needs a small Node process (no npm dependencies) that relays presence over WebSocket. Game saves still stay in the browser.

1. Upload `server/` next to the static release, e.g. `/opt/tilmo/current/server/`.
2. systemd unit `/etc/systemd/system/tilmo-party.service`:

   ```ini
   [Unit]
   Description=TILMO party relay
   After=network.target

   [Service]
   ExecStart=/usr/bin/node /opt/tilmo/current/server/party-server.mjs
   Environment=PARTY_PORT=5191
   Restart=always
   User=www-data

   [Install]
   WantedBy=multi-user.target
   ```

   Then `systemctl daemon-reload && systemctl enable --now tilmo-party`.
3. In `/etc/nginx/sites-available/tilmo`, inside both server blocks:

   ```nginx
   location /ws {
     proxy_pass http://127.0.0.1:5191;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
     proxy_read_timeout 120s;
   }
   ```

   Then `nginx -t && systemctl reload nginx`. Cloudflare passes WebSockets through by default.
4. Check: `curl http://127.0.0.1:5191` returns `tilmo party ok`; in the game, Party → create shows a 6-character code.

Without the relay the game still runs; the party panel only shows that it cannot connect.
