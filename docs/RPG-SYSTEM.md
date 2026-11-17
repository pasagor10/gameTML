# Player systems

- **I — Equipment:** weapon, armor, charm and boots. Inspect a bag item to compare
  its bonuses against the current item, then equip or remove it in town. Rare and
  epic items have distinct borders. Shops sell gear into the bag; purchasing does
  not automatically replace the current item.
- **C — Class:** swordsman, archer and mage each have two specializations, unlocked
  at level 3. Switching is free in town. Bonuses affect authoritative damage,
  defense, maximum HP/MP, movement speed and attack range as indicated.
- **Q/W/E:** class-specific skill names, MP costs, cooldown feedback and tooltips.
  The class panel explains each attack. Selection previews use the same authored
  sprite sets and animation player as the adventure scene.
- **V — Walkable surfaces:** emphasizes only actual collision edges. A projected
  landing marker follows the player's horizontal position while jumping. Roofs
  and unmarked scenery remain decorative.
- **Loot:** the first completed boss awards an epic cavern charm, stored in the
  bag. Repeating a boss does not duplicate this unique item.

The server validates ownership, item slot, class, required level and town state.
Purchases use the existing atomic request ledger. Equipment and specialization
persist with the character. Legacy weapon/armor purchases migrate automatically
without changing gold, upgrades or inventory. Unequipping or switching a class
specialization clamps current HP/MP and cannot heal by repeatedly switching.

Local scene motion includes warm lantern and forge light, waterfall flow and slow
parallax mist. Architectural ledges remain fixed to collision coordinates. Motion
respects the user's reduced-motion preference.
