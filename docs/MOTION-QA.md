# Motion and combat slice — v0.3

First production slice: female swordsman + slime + one private practice arena, also integrated into existing town/dungeon play. Phaser 3, authentication and the character-creation API are retained.

## Delivered

- Actual 32-frame female knight atlas: idle, walk, run, jump, slash, skill, hit, death; reverse death for revive.
- Actual 24-frame slime atlas: idle, hop, attack, hit, melt, respawn.
- Renderer selects frames from server-confirmed grounded/vertical velocity, action timeline, hit/death/revive times. Remote players use the same replicated states.
- Movement acceleration/deceleration, stronger jump, short coyote window and jump buffer; one-way platform collision remains server-owned. Shift runs on keyboard; touch movement runs and supports simultaneous jump/attack.
- Normal attacks alternate three swing effects. Sword Q wave, W impact and E ground eruption have different silhouettes. Skill MP/cooldown buttons and casting feedback reflect server state.
- Attacks reserve MP/cooldown at windup, resolve targets/range at impact, then recover. Multiple skills cannot all land on the same server tick. An enemy hit interrupts a pending player attack.
- Enemies wind up with a visible danger ellipse, then check distance/height at impact. A jump or retreat can dodge. Slime has actual hit and death frames; other monsters retain procedural reactions pending authored sheets.
- Footstep/landing dust, hit sparks, confirmed-hit sounds, skill camera shake (disabled under reduced-motion), death/return-to-town recovery.
- Practice button under minimap: no rewards, no dungeon unlock changes, unlimited HP/MP potions while practicing, automatic slime respawn. Other players remain in their own map/instance.

## Verification

`npm run check` and the 10 engine/network tests pass, covering delayed impact, recovery, dungeon rewards, dodgeable telegraphs, death, no practice rewards, pose timing, auth, ownership, trades/shop concurrency, persistence and snapshot action metadata.

Browser QA on isolated port 5182 / separate preview database: female swordsman creation, entering practice, walking, jumping, damage, death, revive, healing and sustained Auto. No error entries were observed in browser logs. Screenshots: `screenshots/motion-death.jpg`, `motion-idle.jpg`, `motion-combat.jpg`.

## Limits

This is the first animation slice, not complete animation coverage for every hero/monster. Male swordsman, archer/mage variants, NPCs, bosses and remaining monsters still need their own sheets. The generated 4-frame state cycles need artist cleanup for exact silhouette/weapon continuity; automatic grid registration is not a substitute for authored in-betweens. All three sword skills currently share the same charge-pose row, with different timings/effects. No multi-player load-capacity claim is added.

## Art provenance and briefs

Built-in imagegen created project-bound assets at `public/assets/animations/knight-female.png` and `slime.png`; existing hero atlas was used only as knight identity reference.

Knight brief: silver-haired female adult chibi knight in red/ivory/gold armor, side-facing right, consistent full-body identity and sword; 4 columns × 8 rows containing idle/walk/run/jump/attack/skill/hit/death; fixed feet registration, transparent background, no labels/grid/ground.

Slime brief: pink jelly chibi slime with consistent eyes/body, 4 columns × 6 rows for idle/hop/attack/hit/death/respawn; transparent background, fixed registration and no labels/grid/ground. Source sizes are preserved and grid frames registered at runtime.

Production verification: HTTPS/WSS smoke passed against game.pikad.online v0.3: existing service health, authenticated female-knight creation/join, private slime instance, replicated windup/impact/recovery, unlimited MP potion without inventory reduction, and unchanged gold/progression. The public browser reached selection and loaded an existing character; its final arena inspection was interrupted by browser-control timeouts, so visual evidence above comes from the isolated local browser run.
