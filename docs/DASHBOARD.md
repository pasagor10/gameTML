# TILMO dashboard and legacy redirect

Live dashboard: https://tilmo.pikad.online/dashboard. Public aggregate-only statistics, matching the previous game's public dashboard access. No player names, chat messages, IP addresses or raw visitor identifiers are exposed by the API.

- GET /api/dashboard?days=7 (also 30 or 90): live online browsers, active parties, class/level/stage distribution and daily visitor/start/character/playtime aggregates.
- POST /api/analytics: browser telemetry for visit, start/resume, character creation and visible gameplay heartbeats. Browser identifiers are hashed before persistence. Requests are size/rate limited and cross-origin requests are rejected.
- Daily buckets use Asia/Bangkok (UTC+7), retain 90 days and deduplicate browser visitors over the selected range. Historical statistics begin at this release; existing characters and previous playtime are not backfilled. Browser telemetry and playtime are approximate, not server-authoritative game results.
- Persistence: /var/lib/tilmo/metrics.json, atomic writes every ten seconds and on normal shutdown. tilmo-social.service owns this directory through StateDirectory=tilmo and METRICS_PATH. Back up this file separately; deploying static releases does not replace it.
- Static release: /opt/tilmo/releases/20261123-dashboard, stamped dashboard2. Nginx serves /dashboard and proxies only the two metrics API endpoints to the loopback relay on 5191.

Legacy game: game.pikad.online/* now redirects temporarily (302) to https://tilmo.pikad.online/; /dashboard redirects to the new dashboard. ACME paths remain intact. tml-game.service is stopped and disabled. Database and app files remain in /opt/tml; pre-stop online backup was verified at /opt/tml/data/backups/game-2026-11-23T03-43-51-343Z.sqlite (53 characters). The nginx pre-redirect config is retained as /etc/nginx/sites-available/tml-game.before-tilmo-redirect-*.

Validation: 82 tests passed, including Bangkok day boundaries, persistence, unique visitor counts and privacy of aggregate responses. Live browser verified redirect, gameplay, telemetry increments, online presence, 7/30-day controls and mobile layout with no console errors. Verified metrics file persisted and legacy service remains inactive/disabled.
