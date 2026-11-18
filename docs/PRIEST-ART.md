# Painted priest artwork

The priest uses painted source art on the existing articulated sprite rig.
Both genders have five distinct forms: novice, bishop, advanced bishop,
templar and advanced templar. Heads, sleeves, robes, hands and boots are
separate moving pieces. Weapons are not baked into these pieces.

## Rebuild

```sh
python3 tools/sprite-rig/painted_priest.py
node --test tests/appearance.test.mjs tests/priest-appearance.test.mjs tests/costumes.test.mjs
```

Requires Pillow. The versioned transparent source sheet is
`tools/sprite-rig/source/priest/lanna-priest-sheet-v1.png`. It was generated
for this project; the original procedural priest assets remain in their old
folders. The new exporter writes only the `priest-*-painted` folders and
priest entries in `public/assets/sprites/index.json`, then bumps its cache
version. `--preview` writes previews without changing the index or atlases.

Source registration and cut masks live in `CONFIG`, `extract()` and
`limb_mask()`. Pose articulation is in `skeleton()`. Adjust the source
registration before changing the shared rig or any other class.

## Runtime contract

- `heroSkins()` resolves specialization and advancement to sprite entries.
  All priest entries share their gender's base body and action timings.
- `heroLooks()` chooses the bishop/templar head and outfit, independently of
  armour rarity. Explicit supported costume overrides still take priority.
- Painted outfits take a soft wash of the armour picture's main colour
  (blended halfway to white, then multiplied); painted heads keep their own
  colours. The held weapon picture glows in its own palette `gem` colour.
- `gearDress()` resolves the equipped weapon to its actual inventory image.
  `playLayers()` positions it on the current frame's hand socket. Painted
  priests set `weaponBehind`: the staff is below the robe, and the gripping
  arm is painted below the robe. The free arm is painted above the robe.
  These depth roles do not swap when facing left. Switching weapons does
  not require new art.
- `layers.hands` selects the palm overlay belonging to each outfit. Its
  affine transform is identical to the front sleeve, including during a
  walk/run swing. The base body contains boots only; it must not draw a
  second, independently rotated pair of hands beneath the outfit.
  These compatibility overlays are skipped for `weaponBehind` sets so that
  a far gripping hand is never repeated on top of the free/near arm.
- Each action is cropped to one box shared by every layer of that action
  (`crop_box()`), with `encodedAnchor` and sockets shifted to match, and saved
  as WebP q86/method 6. This keeps a priest download near 1 MB instead of
  about 6 MB. Rebuilding any action rewrites all of its layers.
- Atlas cells are encoded at 2x resolution; source sizes and root anchors
  remain logical pixels. Socket x/y values are **encoded atlas pixels**;
  socket angles remain degrees. This is also tested when facing left.
- Class portraits and the world/select/inventory appearances all use the
  same registered sprite entries. Refresh the game to load the new index.

`preview.png` under each new sprite folder shows all five forms. The local
review page in `output/priest-review/index.html` uses the real Phaser
renderer and supports both genders, every action, facing and weapon changes.

Hand registration regression checks: `python3 tests/priest_rig_test.py`.
The rear elbow uses the opposite bend sign from the front elbow. During
every walk/run frame, palms must remain on their own side of the torso;
matching sleeve/palm transforms alone does not enforce this gait constraint.
Use `--arms-only` to rebuild articulated sleeves and hand clips without
re-encoding unchanged head and weapon layers.
`walk_pose()` gives walk an upright, confident stride with the staff swinging
forward each step, and
`run_pose()` a quick robed trot (58 ms frames, short strides so boots stay
under the hem, heel flick, bounce, staff arm held clear of the robe);
the generic caster's deep elbow curl must not be reused for locomotion.
After editing gait poses, rebuild with `--actions walk run` so body sockets,
sleeves, hands and weapon fallback clips all receive the same new motion.
