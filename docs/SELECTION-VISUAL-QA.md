# Character sanctuary visual pass

Scope: selection-screen presentation only. Phaser 3 remains the game engine. Authentication, character-creation API payloads, database and combat server are unchanged.

## Changes

- Full-body selected hero on a luminous pedestal in the Tham Luang cave sanctuary.
- Existing six-character atlas reused; no new assets or external image dependencies.
- Dedicated Phaser selection scene: gentle idle sway/breathing, motes, aura and selection burst. This is presentation motion on idle artwork, not a new frame-by-frame animation set.
- Scene sleeps when the document, selection screen or prologue hides it; wakes on return. Reduced-motion preference disables idle motion and selection bursts. Static art remains as a visual fallback.
- Compact class selectors retain all three professions, male/female choices and pressed states. HP/MP/ATK/DEF values are read from the same shared class definitions used by the game.
- Name input, existing-character buttons, login/registration and start-game flow preserved.

## Verification

- `npm run check`: includes new `public/selection-scene.js`.
- Existing 7 engine/network tests pass, including auth/ownership, shop concurrency and save durability.
- Browser QA against https://game.pikad.online: mobile portrait and desktop layouts, full-body art, gender and class changes, displayed mage stats (HP115/MP150/ATK31/DEF4), name retention when switching selections.
- Created a test mage through the existing UI, advanced through prologue, entered town with HP115/MP150, then returned to selection with saved character present and preview restored.
- Browser console inspection showed no error entries during the reviewed flow.
- Screenshots: `screenshots/selection-rpg-mobile.jpg`, `screenshots/selection-rpg-desktop.jpg`.

The visual changes are static frontend assets served by the existing game service; no service restart or database migration is needed.
