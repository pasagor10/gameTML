# Normal 4-10 balance

The regular world-4 final guardian had approximately 2.45 million HP, a 45-second berserk timer and exponentially scaled hits. A representative solo Lv.59 mage with Epic +8 weapon, Legendary +7 armor, Mythic +6 helmet, Unique +5 ring and 24 potions failed all five seeded AUTO encounters in the baseline sample.

Only the full guardian at stage 40 in normal non-raid play is adjusted: HP multiplier .45 (~1.10 million), boss damage multiplier .70 (including nova projectiles), berserk starts at 90s, berserk damage multiplier 1.4 instead of 2, attack interval ×1.2, telegraph duration ×1.15. The HUD reads the individual guardian's berserk deadline. Earlier/later worlds, minis, hard mode and world raids retain their prior profile.

The same mage benchmark won four of five seeded AUTO encounters in ~67–71s after adjustment. One still failed, so this is not a guarantee for every build. The benchmark has 566 max HP and approximately 927 displayed attack versus the user's screenshot's 596 HP / 1554 attack; skill choices differ. Normal melee enemies retain their original damage outside the guardian's berserk multiplier.

Validation: 91 tests pass, including a full solo clear, boss/projectile versus mob damage, and unchanged earlier/hard/mini/raid profiles. Live release: `/opt/tilmo/releases/20261123-boss410-balance`, stamp `boss410v1`. Static release only: existing saves and paid wallets are untouched. Players must refresh and summon a new guardian to use the new profile.
