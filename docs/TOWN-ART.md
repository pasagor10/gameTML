# Terraced town background

Asset: `public/assets/town-terraces-v2.png` (1536 × 1024).

Created with the built-in image generation tool from `public/assets/town.png`.
The original painting is retained. Town architecture scrolls with the collision
world so painted balcony edges do not drift away from the player's feet.
`WORLD.platforms` maps the painted ledges into the 2400-wide world, using
`x = pixelX / 1536 * 2400`, `y = pixelY / 1024 * 1000 - 180`.
The short ledge below the pavilion connects the upper levels within jump range.

## Generation prompt

Use case: precise-object-edit. Asset: painted background for an actual 2D side-scrolling fantasy game.
Input image is the edit target and style reference. Recompose this village into a coherent MULTILEVEL village of terraced shops, walkable balconies and hilltop pavilion, all painted with the SAME beautiful detailed anime fantasy brushwork, warm orange tiled roofs, northern Thai / Lanna timber architecture, jade foliage, distant limestone mountains, azure sky. Keep potion stall on left, blacksmith shop around center-right, luminous cave portal far right. No characters, no text, no UI, no interface.
Output landscape 1536x1024. CRITICAL playable geometry: a continuous flat stone main street at y=799 pixels spans full width. Above street, build beautiful INTEGRATED architectural balcony ledges with EXACTLY HORIZONTAL visible walkable top edges at these pixel positions:
level 1 y=666: x=224..448, x=506..717, x=774..992, x=1050..1254.
level 2 y=532: x=371..634 and x=691..960.
level 3 y=399: x=890..1120, with a graceful roofed viewing pavilion above it.
These are actual walkable surfaces in a platform game, retain clear air space above each, gaps between ledges and space to jump. Integrate ledges into actual terraces/shop balconies and stone retaining walls so the entire environment is believable architecture, not scaffold platforms pasted over an unrelated village image. Low back railings, carved brackets, lanterns, vines, flowers, warm detailed woodgrain; railings stay behind player paths. Use front-on orthographic playable surfaces with only subtle depth; no tilted/sloping floor tops, no receding perspective on walkable edges. Foliage and stone occupy below the main street. Far background has pale misty mountains and distant buildings with atmospheric depth, no foreground roofs intersecting the playable balcony lanes. Sharp rich hand-painted foreground surfaces, softer quieter distant scenery.

## Town kit (modular pieces)

The town is no longer drawn from the painting above. The painting is now used
only for the street tile (`tools/town-kit/cut_town.py`). Everything else is
separate art painted on magenta, kept in `tools/town-kit/source/`:

```bash
python3 tools/town-kit/kit_art.py
python3 tools/town-kit/far_layers.py
```

`kit_art.py` cuts the background out of these sources and writes the results
to `public/assets/town-kit/`:

- Building pieces: `stall`, `shop`, `smithy`, `stairs`, `tower`, `tree`,
  `cavegate`. Each piece is trimmed and scaled to the old town's proportions;
  the scale for each one is set in `PIECES`.
- Props: every prop on the `props-*` sheets is cut out on its own as
  `prop-<sheet>-<n>`.
- Animated props: the three 4-frame loops (`anim-banner`, `anim-lantern`,
  `anim-brazier`).

`shared/town-layout.js` is shared by the server and the client. It holds:

- `TOWN_PIECES`: the size of each piece and its walkable ledges, as
  `[left, right, height above the piece's bottom]`, measured from the art.
  Stairs that face the camera only expose their landings, because a front
  view can't be walked up.
- `TOWN_LAYOUT`: where each piece stands. The town is `TOWN_WIDTH` wide, so
  its length comes from the layout. Dungeons keep `WORLD.width`.
- `TOWN_PROPS`: the props.
  - A prop with `step` adds a ledge you can climb onto, such as stacked
    barrels.
  - `hang` hangs the prop from `y`.
  - `front` draws it in front of the heroes.
- `TOWN_SPOTS`: where the NPCs stand, plus the portal, the furnace glow and
  the chimney smoke.

`townPlatforms()` works out a terrace tier for each ledge:

- Tier 1 is reachable from the street.
- Tier n is reachable from a ledge of tier n - 1 directly below it.
- A ledge that can't be reached this way is left out.

`tests/game.test.mjs` checks that every ledge can be reached with a real jump.
One jump rises about 168 px, so keep each step at 150 px or less.

To add a piece, put the art in `source/`, add it to `PIECES` in `kit_art.py`,
then measure its ledges and place it in the layout.

## Far layers (parallax)

The town has five painted strips behind it: sky, clouds, mountains, hills and
treeline. Each strip is painted on flat magenta (`#FF00FF`). The sources are in
`tools/town-kit/source/`.

```bash
python3 tools/town-kit/far_layers.py
```

The script removes the magenta and the pink halo the image generator leaves
around edges, makes each strip wrap seamlessly, and writes
`town-kit/far-*.webp`. The kit pieces have no sky of their own, so these strips show through
behind the buildings.

The `FAR` table in `public/parallax.js` sets each layer's height (`top`) and
scroll speed (`fx`/`fy`). Lower values mean the layer is further away; the
clouds also drift slowly on their own.
