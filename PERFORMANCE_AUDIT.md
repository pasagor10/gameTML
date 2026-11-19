# TML ONLINE — Mobile Performance Audit

Target: Redmi Pad 2 (4 GB RAM, Android Chrome). Symptom: very low FPS (9 FPS
measured in town on v0.49.3) and Chrome closing the tab mid-game.

Engine: Phaser 3.90.0 (WebGL), unchanged. Gameplay unchanged. No periodic
reloads.

Legend: **[measured]** = measured in this session; **[estimate]** =
calculated from file sizes or code, not measured on a device.

## 1. Causes found

| # | Problem | Where | Impact |
|---|---------|-------|--------|
| 1 | Phaser 3.90 `TileSprite` keeps its own canvas the size of the sprite **plus** a power-of-two copy of the source image, and uploads both to the GPU. The town used 14 of them (sky, clouds, peaks, ridges, mist, forest, village, street 5228×600, cave layer 2400×850, fog ×2, foreground ×2, seam 2400×34). | `public/parallax.js` | Largest single cost. **[estimate]** ~110 MB GPU and as much RAM. |
| 2 | Four far-background images loaded but never drawn (`town-far-sky/-mountains/-hills/-treeline`). | `public/game.js` preload | **[estimate]** ~21 MB GPU, plus the download. |
| 3 | Generated sky texture 2048×1800 for a plain gradient. | `public/landscape-art.js` | **[measured]** 14.1 MB texture. |
| 4 | The lobby hero stage is a **second Phaser game / WebGL context** that stayed alive (only asleep) during play, with its textures. | `public/selection-scene.js`, `public/game.js` | **[measured]** 2 WebGL canvases in game. |
| 5 | Loaded sprite sets (monsters, hero sets, gear looks, weapon pictures) were **never released**. Memory grows with every new floor, monster type and costume seen. | `public/sprite-sets.js` | Grows over long sessions. Not reproduced in the short test below (floors 1–3 reuse the same monsters). |
| 6 | Blur shader on the foreground, run every frame (fixed in v0.49.4). | `public/parallax.js` | **[measured]** 18 → 0 offscreen passes per frame. |
| 7 | Weapon/boss glow shaders (offscreen passes per sprite), 4 extra outline copies per character, full-screen fog/rays/vignette/grade layers. | `sprite-sets.js`, `creature-fx.js`, `town-npcs.js`, `parallax.js` | GPU fill cost on weak GPUs. |
| 8 | Each damage number created 1–5 new `Text` objects (each one is a canvas plus a GPU texture), destroyed a second later. | `public/combat-fx.js` | Allocation churn in combat. |
| 9 | Canvas rendered at full CSS resolution with no frame cap. | `public/game.js` | Full fill cost at 60 FPS target. |

Checked, no problem found:
- No duplicate game loops: one `Phaser.Game` in play, after fix #4.
- No duplicate sockets: the old socket is disconnected before a new one is created.
- `setInterval` count is fixed (3 in `game.js` plus the overlay's own).
- The character-panel preview destroys its RenderTexture.
- No world→DOM projection, so the render-scale change is safe.
- There are no dynamic shadows; shadows are static ellipses.

## 2. Changes

**Asset management**
- `public/tile-strip.js` (new): a repeating strip made of plain Images sharing one texture. It replaces every background TileSprite. The seam is now one stretched image.
- The sky is generated at 512×450 and shown at 4× tile scale.
- The unused far images are removed from preload.
- Sprite registry reference tracking (`sprite-sets.js`):
  - Each set records the textures and manifests it owns. Shared ones are reference-counted.
  - `sweep()` releases sets that no display object has shown for 60 s, or anything unused when over budget. A set is never released within 5 s of being built.
  - Townsfolk are kept.
  - Released sets load again on demand, from the HTTP cache.
- Texture budget per preset: Low 96 MB, Medium 192 MB, High 320 MB. The sweep runs every 15 s (`game.js` `sweepTextures`).
- Loading concurrency is 3 on Low and 6 otherwise. Duplicate loads were already prevented by the registry's request map.
- The lobby stage is destroyed when entering the game and remounted on return. Its WebGL context is explicitly lost to free GPU memory.
- Damage-number text is pooled (up to 40 reused `Text` objects).

**Graphics presets** (`public/graphics-quality.js`, Settings → คุณภาพกราฟิก)

| | Low | Medium | High |
|---|---|---|---|
| FPS cap | 30 | none | none |
| Render resolution | 75 % | 100 % | 100 % |
| Fog / light rays / vignette / grade / haze | off | on | on |
| Ambient particles | off | 50 % | 100 % |
| Combat particles | 35 % | 50 % | 100 % |
| Glow shaders | off | off | on |
| Character outline | off | on | on |
| Off-screen monster animation | skipped | skipped | normal |
| World text resolution | 1.5× | 2× | 3× |

**Auto** (the default):
- Devices reporting 4 GB of RAM or less start on Low.
- Devices with 6 GB or less, 4 cores or fewer, or a touch screen start on Medium.
- Everything else starts on High.
- In play, if FPS stays under 25 for 5 s, the preset drops one level. This is judged only after 10 s in game, so loading doesn't trigger it.

**Monitor and diagnostics** (`public/perf-overlay.js`)
- The overlay (Settings → แสดงตัววัดประสิทธิภาพ, or tap the lobby build number) shows:
  - FPS, frame time and ping
  - JS heap (Chrome)
  - estimated texture MB and texture count
  - visible/total display objects
  - draw calls per frame, particles
  - tweens, clock timers, page intervals
  - the current preset
- Crash breadcrumbs: a memory sample every 10 s, plus errors, rejections, quality changes and context loss, are kept in `localStorage` (`tml-perf-log`, last 60 entries).
- If the previous visit ended without `pagehide` (for example, the tab was killed), the overlay shows that visit's last texture and heap numbers.
- WebGL context lost: the player sees a message, the event is logged, and on restore the game switches Auto to Low and frees unused textures.

## 3. Results

Measured in the desktop app's built-in browser (Chromium, 1024×768 viewport, 8 GB Mac) with a WebGL hook counting live GPU textures. The same hook was used for both builds. Textures that the lobby stage uploads before the hook is installed are not counted in either build.

| Town, just after entering | Before (v0.50.0) | After (v0.51.0) |
|---|---|---|
| GPU texture memory **[measured]** | 267 MB | 130 MB |
| Live GL textures **[measured]** | 240 | 202 |
| WebGL canvases during play **[measured]** | 2 | 1 |
| JS heap **[measured]** | 81 MB | 56 MB |
| Offscreen passes per frame **[measured]** | 18 (v0.49.3) | 0 |
| Draw calls per frame, town **[measured]** | 44 (v0.49.3) | 18 (Low) – 23 |

**Stress loop.** Each round: open the bag, enter a dungeon (floors 1–3, auto battle, about 7 s), leave to town.

- After (new build): 21 rounds were measured before the browser pane closed.
  - GPU textures stayed at 131–133 MB every round.
  - Engine textures went 144 → 128 → 146–159 → 146 as the sweep released unused sets.
  - JS heap moved between 47 and 77 MB, with no upward trend.
- Before (old build): 6+ rounds at 265–270 MB GPU, heap 83–99 MB.

**Not measured**
- A real Redmi Pad 2 run.
- A 60-minute session.
- Equipment changes during the loop.
- FPS on the tablet with this build (only 9 FPS before the fixes).

The desktop browser's frame rate is throttled, so FPS numbers from it are not meaningful.

## 4. Still to do

1. **Device check.** Run v0.51.0 on the Redmi Pad 2 for 60 minutes with the overlay on, and note FPS, tex MB and heap MB. If the tab still dies, the overlay shows the last sample on the next visit.
2. Placeholder sheets (`heroes`, `monsters`, `knight-motion`, 6 MB each **[measured]**) only cover the moment before a painted set loads. They could be released once all on-screen sets are ready.
3. The `cave` painting (6 MB) and the generated cavern, peaks and ridges layers (≈ 19 MB **[measured]**) could be generated at half size on Low.
4. Lobby images (threshold, sanctuary-lake, resting-heroes; about 6 MB each decoded **[estimate]**) stay decoded behind the game screen.
5. Item art for the bag/shop UI is DOM `<img>` (≈ 16 MB decoded if all are shown **[estimate]**).
6. The Adventure game stays alive while back in the lobby, which keeps re-entry fast. Destroying it would save memory at the cost of a slower return.
7. Off-screen culling covers monsters only. Heroes keep many attached objects (layers, rim, effect rows) that would need hiding as a group.
