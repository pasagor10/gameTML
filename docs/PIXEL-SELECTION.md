# Pixel-art selection pass

Selection has explicit loading, roster and create modes. Saved accounts start
in roster mode; creation controls appear only after choosing สร้างผู้กล้าใหม่.
Empty accounts start in creation mode. Arrow keys switch saved heroes in roster
mode and classes in creation mode. Creation has a back action when heroes exist.
Saves are preserved.

Assets generated using the built-in imagegen tool:
- public/assets/selection/pixel-sanctuary-v1.png (1536 × 1024).
- public/assets/selection/pixel-heroes-v1.png (transparent 1536 × 1024).
The hero sheet has three class columns and male/female rows.

selection-scene.js renders to a 160 × 160 Canvas 2D surface with smoothing disabled.
CSS scales the canvas by an integer with nearest-neighbor rendering. The pixel
stylesheet is scoped to selection. Adventure retains its existing art for a
separate pass. Preview movement uses procedural pixel effects.

## Background prompt

Asset: pixel-art game character-selection background, landscape 1536x1024. Real carefully hand-placed 16-bit pixel art at a coherent logical 384x256 pixel grid scaled exactly 4x with hard square pixels and nearest-neighbor edges, limited 40-color palette. An ancient northern Thai Lanna sanctuary inside a blue crystal cavern, distant stepped waterfalls, turquoise still water, weathered carved stone gates left and right, hanging vines and cyan crystals. Center lower half has an empty circular stone summoning platform with subtle gold pixel runes, horizontal floor around it. Clear centered space for a full-body hero to be rendered separately. Layered distance, dark navy corners suitable for overlaying game panels, luminous teal center, warm gold shrine accents. Beautiful premium indie RPG pixel environment. No characters, no letters, no UI, no blurred lighting, no gradients, no painterly textures, no anti-aliased edges, no pseudo-pixel mosaic photo. Everything including water, mist and highlights made of intentional square pixel clusters.

## Hero sheet prompt

Create a production pixel-art character sprite sheet on genuine transparent background. Canvas EXACTLY 1536x1024, THREE equal columns and TWO equal rows, six 512x512 cells. Exactly ONE complete full-body character centered within each cell, feet on the same baseline about 440px down each cell. All bodies from helmet/hair top to soles occupy about 360px of each cell. No platform, no shadows, no extra objects between cells, no labels, no border, no UI, no partial or duplicate characters.
Style: premium 16-bit SNES fantasy RPG battle sprites, handcrafted visible hard-edged square pixel clusters, limited colors, 4x4 image pixels per logical pixel, NO antialiasing or blur, NOT smooth chibi illustrations. All six share identical pixel scale, proportions, bold 1 logical pixel navy outline, about 80-90 logical pixels tall. 3/4 front-right standing ready pose, clearly readable costume silhouettes.
Top row cell 1: male swordsman, short dark brown hair, burgundy cape, steel and antique gold armor, single sword angled downward.
Top row cell 2: male archer, dark hair, forest green hooded leather tunic, ochre scarf, wooden bow at side and quiver.
Top row cell 3: male mage, silver hair, violet wizard hat, plum and gold robes, wooden staff with cyan crystal.
Bottom row cell 1: female swordsman, pale silver long ponytail, burgundy cape, steel and antique gold armor, single sword angled downward.
Bottom row cell 2: female archer, brown long ponytail, forest green hooded leather tunic, ochre scarf, wooden bow and quiver.
Bottom row cell 3: female mage, pale lavender long hair, violet wizard hat, plum and gold robes, staff with cyan crystal.
All weapons fit inside the cell. Preserve transparent space around each character. Pixel art must look purpose-drawn, crisp and consistent with a 16-bit pixel-art cavern environment.

