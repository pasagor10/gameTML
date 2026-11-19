# ตำนาน 3 อัศวิน — Tham Luang Dungeon

Playable 2D side-scrolling multiplayer RPG demo v0.3. Public URL: https://game.pikad.online

## Run locally

Node.js 22+ (native better-sqlite3 and Argon2 dependencies).

```sh
npm ci
npm start
```

Open http://localhost:5173. `PORT`, `HOST`, `DB_PATH` and `APP_ORIGIN` are configurable. Set `NODE_ENV=production` and `APP_ORIGIN=https://game.pikad.online` behind HTTPS. Do not run two game processes against the same database: world simulation is in memory and assumes a single writer process.

```sh
npm run check
npm test
npm run backup
```

## Play

Choose one of 6 heroes (male/female × swordsman/archer/mage), name the character, or resume an existing character. Guest play uses a persistent HttpOnly browser cookie. Register a normal account **before creating a hero** for access from another device. Guest-to-account migration is not implemented; switching accounts switches characters. Up to 3 characters per account.

- A/D or arrows: walk. Shift: run. Space: jump. F: interact.
- J: normal attack. Q/W/E: skills. R: HP potion. T or Auto button: auto battle.
- I: inventory. L: quests (daily quests, monster book, journey). Touch controls and action buttons work on mobile.
- Daily quests: 3 per character per day (reset at midnight Thailand time), rolled from unlocked floors. Claim each reward, then a bonus chest (+1 dungeon energy, or ore when energy is full). Practice kills never count. Definitions in `shared/quests.js`.
- Monster book: lifetime kills per regular monster type; 50/200/1000 kills give 1–3 stars, each a permanent stat bonus for that character. Bosses are not counted.
- Town includes quest elder/healing, potion seller, equipment seller and blacksmith.
- Use the **สนามฝึก** button below the minimap for a private slime practice arena. Female swordsman uses the first full 32-frame motion sheet; slime uses 24 frames. Practice grants no gold/EXP/progression, potions are unlimited and slime respawns. Return to town to revive.
- Attacks now have server-controlled windup/impact/recovery; moving away or jumping out of an enemy telegraph can avoid damage. Hit reactions interrupt a pending player attack. Three consecutive normal strikes alternate swing effects.
- 10 dungeon floors × 3 stages, with six regular monster types and three current boss visual rigs reused across ten named bosses. Unlock later floors by beating the previous floor's boss.
- Deep cave (ห้วงลึก): floors 11–40 unlock after the floor-10 boss. Each has its own lineup of named monster variants with traits (swift, armored, drain, giant, frenzy, regen; `shared/dungeons.js`), drops the floor-10 gear pool and more ore. Recommended Lv.32–40 (the current level cap). Floors 16–40 cover five regions: frost, fire, cursed forest, storm, and the lunar abyss; each floor has three stages, a named boss, and its own trait lineup.
- Original bosses on floors 16–40: Frost Revenant (16–20, slow), Ember Colossus (21–25, burn), Thorn Queen (26–30, poison), Storm Roc (31–35, stun), Moon Emperor (36–40, bleed). Each has 24 authored frames across six states, a timed ground warning, and a jump-dodge opening. Profiles: `shared/bosses.js`; source sheets and built-in ImageGen prompts: `tools/sprite-rig/source/bosses/`; rebuild with `python3 tools/sprite-rig/import_bosses.py`.
- Day and night: the town runs a 60-minute sky cycle (34 min day, dusk, 18 min night, dawn; `shared/night.js`). At night a mysterious cave (ถ้ำลึกลับ) opens at the town's left edge: no energy, one giant boss (HP ×3.5, +25% damage) that rotates nightly and scales to the party's best hero. The first clear each night pays gold, ore, EXP and a 50% boss-gear roll; repeats pay a small purse. Set `SKY_OFFSET=<seconds>` to shift the server clock when testing.
- Skills and statuses: each class has Q/W/E attack skills that strike 2–5 times (every strike rolls its own crit and shows as a stacked damage number) and an S party buff (rage +30% damage, focus +30% crit, barrier −40% damage taken). Skills can burn, poison (stacks ×3), bleed, freeze, stun, slow or weaken monsters; bosses shake off freeze and stun three times faster. Some monsters poison, bleed or slow heroes, and boss slams stun. Kits live in `shared/skills.js`.
- World boss: every half hour (on :00 and :30) a world boss rises for 10 minutes in one shared arena that every hero online can join from the town banner (`shared/world-boss.js`). It starts at 200k HP, gains 80k for each extra hero, hits 1.5× a floor-10 boss and calls guards at 75/50/25% HP. A live damage ranking shows in the arena. Everyone who hit it is paid by share and place (top 1 gets a guaranteed unowned floor-10 boss item), even if they already went home. If time runs out it escapes. Set `WORLD_BOSS_OFFSET=<seconds>` to shift its schedule when testing.
- Each dungeon floor costs 1 energy per character. Energy refills by 1 every 30 minutes up to 5, including while offline. The practice arena is free.
- Auto combat runs on the server while connected, uses skills/potions, advances stages and returns to town after a floor.
- Party: create/join through menu, max 3. Non-leaders mark ready; leader selects a floor unlocked by everyone.
- Market: stock held in database escrow; offline shops continue selling. One shop per account, 5 physical slots in town.
- Trade: request/accept, edit offers, both confirm, both perform final confirmation. Changes invalidate all confirmations. Requests expire after 3 minutes and cancel on disconnect.
- World and party chat. No offline auto farming or payments.

## Architecture

Phaser 3 renderer + HTML UI; Express + Socket.IO; SQLite WAL + foreign keys; Argon2id passwords. Server owns movement physics, combat, HP/MP, loot, EXP, gold and progression. Inputs carry sequence numbers, never authoritative coordinates or damage. Economy updates are synchronous SQLite transactions; request IDs make shop purchases and enhancements idempotent. Shop stock and trade ownership are rechecked at commit. Sessions expire after 30 days; cookie is Secure in production, HttpOnly and SameSite=Strict. Mutations enforce same-origin and basic rate limits.

Shared definitions live in `shared/config.js`; schema automatically migrates/initializes on startup in `server/database.js`. New character seed: 120 gold, 5 HP potions, 3 MP potions and 3 ore. Saves live in ignored `data/game.sqlite`, never Git. Rewards are saved after kills; periodic and graceful shutdown saves also run. Instances close when their last member leaves. Reconnect returns to town with durable progression, not to the previous instance.

## Current scope and limits

This is the playable v0.2 foundation, **not every feature of the supplied full GDD/TDD**. Images are new game art based on the requested style. Female swordsman has a new 32-frame sheet (idle/walk/run/jump/attack/skill/hit/death, reverse death for revive), and slime has 24 frames (idle/move/attack/hit/death/spawn). The other five heroes and other monsters still use idle illustration art with code-driven effects; their full animation sheets remain pending. NPCs temporarily reuse hero art. Town and cave use single painted background layers; true multi-layer parallax and Tiled maps/ladders are pending. Three skills share class-based effect types; individual skill tuning remains preliminary.

Equipment uses four slots (weapon, armor, charm and boots), shows power changes before equipping, and includes class-specific boss loot for all ten floors. Items are currently unique templates per character rather than independently rolled tradable instances. Each slot can be enhanced independently to +10, and its bonus applies when gear is equipped in that slot. Trading and player shops support HP/MP potions and ore. World/party chat are supported; private messages, reports/mutes, multiple channels, guilds and advanced quest rewards remain pending. Parties use public join + readiness rather than invitations. No 20–30-player load capacity claim: tests exercise three real Socket.IO clients and competing purchases, not a sustained load test.

Original requirements: `docs/GDD.md`, `docs/TDD.md`. Supplied ZIP is preserved under `public/assets/placeholders/`, whose manifest explicitly states placeholder art. Generated artwork and prompts: `docs/ASSETS.md`. Deployment, backup and restore: `docs/DEPLOYMENT.md`.
