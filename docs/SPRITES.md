# Animated sprite sets (Agent Sprite Forge)

The game can play animated hero sprite sets exported by
[Agent Sprite Forge](https://github.com/0x0funky/agent-sprite-forge)
(`animation.json` 2.0/3.0 with the PNG atlas fallback). Heroes without a set
keep the static portrait from `heroes.png` plus the procedural motion in
`public/creature-fx.js`.

## Where files go

```
public/assets/sprites/
  index.json                 list of sets (empty until art is added)
  archer-male/
    idle/   animation.json, idle-atlas-00.png, …
    walk/   …
    run/    …
    jump/   …
    attack/ …
    hurt/   …
```

Copy each action's export folder as-is. Only `animation.json` and the
`*-atlas-NN.png` pages are read; WebM/MP4 files can be left out.

Register the set in `index.json`. The key is `<class>-<gender>` (`archer-male`,
`archer-female`, `mage-female`, …):

```json
{
  "sets": {
    "archer-male": {
      "dir": "archer-male",
      "height": 118,
      "facing": 1,
      "actions": {
        "idle": "idle",
        "walk": "walk",
        "run": "run",
        "jump": "jump",
        "attack": "attack",
        "skill": "attack",
        "hit": "hurt",
        "death": "hurt"
      }
    }
  }
}
```

- `height`: on-screen body height in world px (static heroes are ~118).
- `facing`: `1` if the art faces right, `-1` if it faces left.
- `actions`: game state → folder. A missing state falls back to `idle`
  (`run` falls back to a faster `walk`).

Loading is on demand: only `index.json` loads with the game. A hero's set is
fetched when that hero first appears, a monster's when that monster first
spawns. Until it arrives the old static art plays with procedural motion.

Runtime rules (from the forge's runtime guide):

- The frame root comes from `sourceAnchor` (or `encodedAnchor`) and sits on the
  server's ground position.
- Attack/skill clips are time-warped so the clip's `hit` event (or `impactMs`)
  lands exactly on the server's `impactAt`.
- Durations come from `durationsMs`; one-shot clips hold their last frame.

## Painted sheets (current heroes)

Heroes come from two kinds of supplied sheets in `tools/sprite-rig/source/heroes/`
(6 columns, flat navy backdrop):

- `idle-attack.webp`: idle and attack rows for all six heroes.
- `<hero>-move.webp`: walk, run, hurt and death rows for one hero.

`tools/sprite-rig/slice_sheet.py` keys out the backdrop (edge flood fill,
enclosed gaps, soft matte), crops each cell with a margin so art that spills
past the grid line survives while neighbouring frames are dropped, roots each
action by its own rule (feet for idle/attack/walk/hurt/death, drawn x for
walk/run/death so stride and the backward fall survive, median feet line for
run flight frames), and merges the actions into `index.json`:

```bash
D=tools/sprite-rig/source/heroes
python3 tools/sprite-rig/slice_sheet.py $D/idle-attack.webp --cols 6 \
  --rows archer-male:idle archer-male:attack archer-female:idle archer-female:attack \
         mage-male:idle mage-male:attack mage-female:idle mage-female:attack \
         swordsman-male:idle swordsman-male:attack swordsman-female:idle swordsman-female:attack
python3 tools/sprite-rig/slice_sheet.py "$D/archer-male-move.webp" --cols 6 \
  --rows "archer-male:walk" "archer-male:run" "archer-male:hurt" "archer-male:death"
```

(In zsh, quote `"$h:walk"`-style arguments as `"${h}:walk"`; `$h:w…` is a modifier.)
Jump still uses the idle frame with procedural stretch. A set can also be a
single still (`"still": true`).

## Painted monster sheets

Eight monsters (bat, boar, mushroom, wolf, goblin, Bat King, Stone Guardian,
Cave Serpent) use the supplied 4 × 6 sheets in `tools/sprite-rig/source/monsters/`
(rows: idle, move, attack, hit, death, spawn). `slice_monsters.py` keys out the
baked white/checkerboard backdrop, turns pale auras, smoke and sparkles that
touch the backdrop into real translucency (glow matte; off for the wolf, whose
grey fur has no outline), puts ground monsters' feet back on one baseline,
scales frames to about 1.4x their on-screen height, and saves WebP atlases
under `monsters/<type>/` plus a `"monsters"` group in `index.json`:

```bash
python3 tools/sprite-rig/slice_monsters.py          # all sheets
python3 tools/sprite-rig/slice_monsters.py golem    # one
```

In game, each state plays its clip (the attack's strike frame lands on the
server impact), the death clip plays once before the sprite fades, and
`creature-fx.js` only adds hover for flyers, a light hit squash, shadows,
the wind-up "!" and the boss aura. The slime keeps its original atlas.

## Our own code-drawn sets (no API key)

`tools/sprite-rig/hero_rig.py` draws chibi heroes from a 2D skeleton (hips,
knees, shoulders, elbows, head) with keyframed poses, renders at 4x for
anti-aliasing and writes the same `animation.json` 3.0 + atlas layout. Only
Python 3 and Pillow are needed.

```bash
python3 tools/sprite-rig/hero_rig.py                 # every class and gender
python3 tools/sprite-rig/hero_rig.py archer-male --sheet /tmp/archer.png
```

Actions: idle, walk, run, jump (picked by vertical speed), attack, skill
(the release/impact frame carries the `hit` event), hurt and death. Looks
(colours, weapon, hat, armour, hair) live in `LOOKS`/`HAIR`; poses in
`actions()`.

`index.json` registers archer, mage and male swordsman sets. The female
swordsman keeps the painted `knight-female.png` animation; her code-drawn set
is generated too and can be switched on with
`--register archer-male archer-female mage-male mage-female swordsman-male swordsman-female`.

## Brief: Agent Sprite Forge archer (optional, painted look)

Install the skill in your own terminal (it runs third-party Python locally):

```bash
claude plugin marketplace add 0x0funky/agent-sprite-forge --sparse .claude-plugin skills
```

Then install the plugin and its `requirements.txt` per the forge README, and
set one generator: an API key (OpenAI, Gemini, xAI, BytePlus or fal.ai) or a
signed-in Codex/Grok CLI. Start a new Claude Code session so the skill loads.

Master still prompt (match the existing `heroes.png` style):

> Use generate2dsprite to make a master still of a male archer for a 2D
> side-scrolling fantasy RPG. Polished chibi Korean-fantasy style, about 2.5
> heads tall, full body, facing right, neutral standing pose with a recurve bow
> held low in the left hand and a quiver on the back. Forest green and teal
> leather armor with gold trim and small Thai-inspired ornaments, short cape.
> Clean outline, soft cel shading, transparent background, no text.

After approving the master, make clips: `idle` (loop), `walk` (loop), `run`
(loop), `jump` (one-shot), `attack` (draw and release, one-shot, mark the
release frame as the `hit` event), `hurt` (one-shot). HD finish, linear
sampling. Repeat with "female archer" for `archer-female`.
