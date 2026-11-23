# Party HUD and chat

Party members appear below the player's hero card: name, class, level, current HP percentage and a red health bar. A stale member is dimmed. The panel disappears outside a party.

The bottom-left chat button opens World and Party channels. World reaches connected players; Party reaches only the current party, enforced on the relay. Messages are plain text, capped at 200 characters, limited to five burst messages with one token restored every two seconds. The client keeps the latest 60 messages per channel in memory; there is no persistent chat history. Chat focus clears movement keys, and typing cannot trigger gameplay shortcuts. Changing characters leaves the party.

Production relay: `tilmo-social.service`, Node.js at `/opt/tilmo/current/server/party-server.mjs`, listens on loopback 5191. Nginx forwards only `/ws` for tilmo.pikad.online. The service uses DynamicUser, automatic restart and a read-only filesystem. Static assets remain served by nginx. Deployment: `/opt/tilmo/releases/20261123-social`, stamped `social2` through tools/stamp-release.py before activation.

Validation: 78 tests passed, including world delivery, party isolation, clamped payloads, rate limiting, disconnect cleanup and malformed state packets. Two local clients verified party presence/HP and sending/receiving both channels through the UI. Live HTTPS checked gameplay and WebSocket connection with an enabled world-chat input and no console errors.

## Boss helper motion

AI raiders now commit to short repositioning runs rather than following a slowly changing orbit that looked stationary. They stop briefly to attack, keep class-specific ranges, and flee warnings overlapping their current location. Renderer uses the actual travel direction and accumulated walk distance. Combat/ranking rewards are unchanged. Validated all raiders travel and attack over 20 simulated seconds, class ranges and immediate meteor escape; full suite: 80 passing tests. Release `/opt/tilmo/releases/20261123-raider-ai`, stamp `raiderai1`.
