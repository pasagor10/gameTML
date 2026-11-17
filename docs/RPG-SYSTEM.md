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
- **Loot:** the first clear of floor three awards an epic cavern charm, stored
  in the bag. Repeating the boss does not duplicate this unique item.

## Boss equipment drops

Each of the ten playable floors has a class weapon and three or more shared
armor pieces. The first clear guarantees the weapon for the active class. Later
clears select an unowned item from that floor; the floor-three legendary charm
has a 5% roll while other items remain. Once the character owns the complete
floor pool, the boss awards `2 + floor` moon ore instead.

- Floor 1: Nightfang weapon, Nightwing Armor, Echo Charm, Wingstep Boots.
- Floor 2: Stoneheart weapon, Stoneguard Armor, Crystal Charm, Quarry Boots.
- Floor 3: Serpent weapon, Serpent Scale Armor, Venom Charm, Tidewalker Boots,
  and the legendary Moonheart Talisman.
- Floor 4: Flamevine weapons and the Verdant Tomb set.
- Floor 5: Forge weapons and the Underforge set.
- Floor 6: Frost weapons and the Ice Temple set.
- Floor 7: Thunder weapons and the Stormbird set.
- Floor 8: Reflection weapons and the legendary Moon Mirror charm.
- Floor 9: Dragon Gate weapons and the legendary Dragon Seal charm.
- Floor 10: Eclipse Moon weapons and a full legendary Moon Dragon set.

The equipment panel shows the source floor, lore, individual stat changes, and
the total power before and after equipping or removing an item. The world view
shows compact weapon, enhancement, and armor badges beside every player. Loot,
equipment, purchases, materials, and enhancement success/failure have distinct
Web Audio cues and honor the existing sound toggle.

The server validates ownership, item slot, class, required level and town state.
Purchases use the existing atomic request ledger. Equipment and specialization
persist with the character. Legacy weapon/armor purchases migrate automatically
without changing gold, upgrades or inventory. Unequipping or switching a class
specialization clamps current HP/MP and cannot heal by repeatedly switching.

Local scene motion includes warm lantern and forge light, waterfall flow and slow
parallax mist. Architectural ledges remain fixed to collision coordinates. Motion
respects the user's reduced-motion preference.
