# Deployment: game.pikad.online

The hostname is served from this Mac through the existing Cloudflare Tunnel. Restaurant routes remain independent.

- Origin: `127.0.0.1:5180` (not directly exposed to the LAN).
- LaunchAgent: `~/Library/LaunchAgents/com.thamluang.game.plist`, template in `deploy/`.
- Environment: production, APP_ORIGIN `https://game.pikad.online`.
- Tunnel ingress config: `~/.cloudflared/config.yml`; game route added before fallback 404. Existing routes preserved with timestamped config backup.
- Tunnel process is managed by existing `com.prb.cloudflared` LaunchAgent.
- Health: `https://game.pikad.online/api/health`.
- Logs: `~/Library/Logs/thamluang-game.log` and `thamluang-game-error.log`.

This hosting depends on the Mac staying awake, connected to the internet and logged into the user session. LaunchAgent restarts the game if the process exits. A permanently running VPS is a future hosting migration, not part of this local tunnel setup.

## Update

Run `npm ci`, `npm run check`, `npm test`, and `npm run backup`, then:

```sh
launchctl kickstart -k gui/$(id -u)/com.thamluang.game
curl https://game.pikad.online/api/health
```

Restart interrupts active dungeon instances and sends players back to town after reconnect; durable character state is retained. Do not deploy while a trade is pending. The repository contains no session tokens, database, password hashes or Cloudflare credentials.

## Backup

```sh
npm run backup
```

Uses SQLite online backup API (WAL-safe), writes a timestamped snapshot under `data/backups/`. The running server also backs up every 24 hours and keeps the latest 7 scheduled snapshots. These are local copies; no off-device backup has been configured.

## Restore

Stop the game first. Preserve the current database and its WAL/SHM files in a separate recovery folder. Restore a chosen snapshot as `data/game.sqlite`; remove the old WAL/SHM from the active location only after preserving them. Start the game and verify `/api/health`, login and character data. Never copy only an active SQLite main file while ignoring its WAL; use the provided backup API.

Restore validation is covered by opening an online backup copy and checking its character data in the test suite. Full production restore is intentionally not performed against live player saves.
