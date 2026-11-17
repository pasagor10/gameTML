# MOONFALL — เสียงเรียกแห่งนางนอน

A playable, single-player fantasy action RPG demo. Node.js 22+, no npm dependencies.

```sh
npm start
```

Open http://localhost:5173. Run `npm run check` for JavaScript syntax validation.

## Demo
- Three adult heroines: knight, mage, ranger, with different range, speed and HP.
- Three-part Thai story prologue, skippable.
- Moonlight camp with potion vendor, guaranteed weapon upgrades and healing crystal.
- Three dungeon floors, enemies, final boss, victory reward, replay and defeat recovery.
- Manual combat, area skill, healing potions, auto combat, synthesized optional audio, touch controls.
- Local browser save for selected class progress, gold, potions and upgrades. Switching to a different class starts a new save.

Controls: WASD/arrows move, Space attack, Q skill (6-second cooldown), R potion, E interact. Buttons work on touchscreens. Audio starts muted and can be enabled on the selection screen.

This is a prototype: no multiplayer, server database, trading or 100-floor content. Gameplay uses code-drawn top-down figures; selection artwork is a separate illustration, not an animation sprite sheet. Fonts load from Google Fonts and fall back gracefully offline.

Artwork generation brief: adult Korean fantasy heroines (knight, mage, archer), tasteful curvaceous silhouettes and opaque armor, moonlit limestone sanctuary, subtle Thai motifs, navy/teal/gold, no text. Generated with built-in imagegen. See `public/assets/`.
