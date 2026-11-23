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
