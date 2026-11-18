"""Build articulated Lanna priests from the versioned painted source sheet.

Run python3 tools/sprite-rig/painted_priest.py. The source is cut into head,
robe, sleeve, hand and boot pieces, then attached to the existing action rig.
Weapons remain separate: animation manifests carry the moving hand socket.
This exporter never changes player data or any other class's artwork.
"""
from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageChops

import hero_rig as rig
import layered_rig as legacy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1] / "public/assets/sprites"
SOURCE = HERE / "source/priest/lanna-priest-sheet-v1.png"
CELL, ANCHOR = (300, 240), (150, 222)
RESOLUTION = 2
ENCODED = tuple(v * RESOLUTION for v in CELL)
SCALE = 0.29
LOOKS = ["robe-1", "robe-2", "robe-3", "robe-4", "bishop-2", "bishop-3", "templar-2", "templar-3"]
HEADS = ["hair", "circlet", "hood", "mitre", "bishop-2", "bishop-3", "templar-2", "templar-3"]
CONFIG = {
    ("male", "novice"): (0, 0, 317, 137, 420, 494, (270, 164), (242, 230), (214, 291), (368, 164), (390, 230), (413, 291)),
    ("male", "bishop"): (1, 0, 256, 139, 420, 494, (208, 163), (178, 230), (154, 291), (303, 164), (328, 236), (352, 291)),
    ("male", "templar"): (2, 0, 194, 136, 420, 494, (146, 166), (118, 232), (94, 291), (240, 165), (271, 233), (297, 291)),
    ("female", "novice"): (0, 1, 320, 142, 426, 497, (275, 173), (246, 239), (228, 299), (367, 174), (391, 240), (411, 299)),
    ("female", "bishop"): (1, 1, 256, 151, 426, 496, (211, 179), (180, 243), (159, 304), (303, 180), (331, 247), (353, 304)),
    ("female", "templar"): (2, 1, 201, 145, 426, 497, (157, 172), (128, 238), (111, 299), (247, 171), (276, 239), (300, 299)),
}


def polygon_mask(image, points):
    mask = Image.new("L", image.size)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    out = image.copy()
    out.putalpha(ImageChops.multiply(out.getchannel("A"), mask))
    return out


def limb_mask(image, a, b, width_a, width_b, extend=0.12, start_extend=None):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    nx, ny = -dy / length, dx / length
    start_extend = extend if start_extend is None else start_extend
    aa = (a[0] - dx * start_extend, a[1] - dy * start_extend)
    bb = (b[0] + dx * extend, b[1] + dy * extend)
    return polygon_mask(image, [(aa[0] + nx * width_a, aa[1] + ny * width_a),
                                (bb[0] + nx * width_b, bb[1] + ny * width_b),
                                (bb[0] - nx * width_b, bb[1] - ny * width_b),
                                (aa[0] - nx * width_a, aa[1] - ny * width_a)])


def extract(sheet, gender, branch):
    col, row, cx, neck, hem, ground, *joints = CONFIG[(gender, branch)]
    image = sheet.crop((col * 512, row * 512, (col + 1) * 512, row * 512 + 500))
    # Generated transparency contains near-zero alpha outside the silhouettes.
    image.putalpha(image.getchannel("A").point(lambda v: 0 if v < 16 else min(255, round(v * 255 / 252))))
    head = polygon_mask(image, [(0, 0), (512, 0), (512, neck + 1), (0, neck + 1)])
    # The robe's central silhouette excludes both sleeves and hands.
    torso = polygon_mask(image, [(cx - 33, neck), (cx + 35, neck),
        (cx + 59, neck + 45), (cx + 43, neck + 90),
        (cx + 50, neck + 125), (cx + 89, hem - 8), (cx + 66, hem + 7),
        (cx - 71, hem + 7), (cx - 96, hem - 9),
        (cx - 48, neck + 125), (cx - 43, neck + 90), (cx - 60, neck + 45)])
    parts = {"head": head, "torso": torso}
    for side, (sh, elbow, wrist) in zip(("back", "front"), (joints[:3], joints[3:])):
        parts[f"upper-{side}"] = limb_mask(image, sh, elbow, 28, 26)
        # Extend past the wrist to retain fingers, but not back up the upper
        # arm: rotating that duplicated shoulder patch makes a second elbow.
        parts[f"fore-{side}"] = limb_mask(image, elbow, wrist, 29, 20, extend=0.46, start_extend=0.04)
        parts[f"hand-{side}"] = limb_mask(image, wrist, (wrist[0], wrist[1] + 25), 12, 10, extend=0.1)
    for side, x in (("back", cx - 45), ("front", cx + 45)):
        parts[f"boot-{side}"] = polygon_mask(image, [(x - 35, hem + 2), (x + 35, hem + 2),
            (x + 40, ground + 3), (x - 35, ground + 3)])
    return dict(parts=parts, cx=cx, neck=neck, hem=hem, ground=ground, joints=joints)


def priest_actions():
    actions = rig.actions("mage")
    # A staff carrier keeps the gripping arm steady. The free arm makes a
    # short relaxed swing, rather than the caster rig's deep running curl.
    for p in actions["walk"][0]:
        phase = -p["shF"] / 0.45
        p.update(shF=0.12 - phase * 0.06, elF=0.34,
                 shB=phase * 0.12, elB=0.12)
    actions["run"] = (rig.cycle(8, run_pose), [58] * 8, True, None)
    return actions


def run_pose(a):
    """A quick robed trot: short strides that keep both boots under the hem,
    the trailing heel flicked up, a strong bounce and robe sway. The staff arm is
    held out from the robe so the grip stays visible, tilting the staff
    forward; the free arm pumps a little."""
    s, lift = math.sin(a), abs(math.sin(a))
    return rig.pose(
        dy=-lift * 6 + 2, lean=0.18 + lift * 0.03, tilt=-0.03 + lift * 0.04,
        hipF=0.16 + s * 0.42, hipB=0.16 - s * 0.42,
        kneeF=0.15 + max(0.0, -s) * 0.6, kneeB=0.15 + max(0.0, s) * 0.6,
        shF=0.3 + s * 0.03, elF=0.02,
        shB=0.12 - s * 0.15, elB=0.1 + lift * 0.08,
        weapon=0.12, wave=math.sin(a * 2) * 1.6)


def skeleton(p):
    lean = p["lean"]
    hip = (0, -40)
    top = (math.sin(lean) * 59, -40 - math.cos(lean) * 59)
    def arm(offset, sh, el):
        a = (top[0] + offset, top[1] + 8)
        b = rig.limb_end(a, sh, 21)
        return a, b, rig.limb_end(b, sh + el, 20)
    def leg(offset, angle, knee):
        a = (offset, -40)
        b = rig.limb_end(a, angle, 19)
        return a, b, rig.limb_end(b, angle - knee, 19)
    return dict(top=top, neck=(top[0], top[1] - 2),
        # Elbows bend inward from opposite sides of the torso. Reusing the
        # front elbow sign lets the back palm overtake it during locomotion.
        arm_f=arm(13, p["shF"], p["elF"]), arm_b=arm(-13, p["shB"], -p["elB"]),
        leg_f=leg(9, p["hipF"], p["kneeF"]), leg_b=leg(-9, p["hipB"], p["kneeB"]))


def tx(point, p):
    c, s = math.cos(p["rot"]), math.sin(p["rot"])
    x, y = point
    return (ANCHOR[0] + x * c - y * s + p["dx"], ANCHOR[1] + x * s + y * c + p["dy"])


def paint(target, source, origin, dest, scale, angle, p):
    # Inverse affine sampling keeps the moving part anchored without cropping.
    rotation = angle + p["rot"]
    c, s = math.cos(rotation), math.sin(rotation)
    dx, dy = tx(dest, p)
    dx, dy, scale = dx * RESOLUTION, dy * RESOLUTION, scale * RESOLUTION
    a, b, d, e = c / scale, s / scale, -s / scale, c / scale
    coeff = (a, b, origin[0] - a * dx - b * dy,
             d, e, origin[1] - d * dx - e * dy)
    target.alpha_composite(source.transform(ENCODED, Image.Transform.AFFINE, coeff, Image.Resampling.BICUBIC))


def paint_limb(target, art, name, a, b, dest_a, dest_b, p):
    sa = math.atan2(b[1] - a[1], b[0] - a[0])
    da = math.atan2(dest_b[1] - dest_a[1], dest_b[0] - dest_a[0])
    scale = math.dist(dest_a, dest_b) / math.dist(a, b)
    paint(target, art["parts"][name], a, dest_a, scale, da - sa, p)


def body_frame(art, s, p, hand_only=False):
    out = Image.new("RGBA", ENCODED)
    for side, arm_key, leg_key, joints in (("back", "arm_b", "leg_b", art["joints"][:3]),
                                           ("front", "arm_f", "leg_f", art["joints"][3:])):
        if not hand_only:
            knee, foot = s[leg_key][1:]
            x = art["cx"] + (-45 if side == "back" else 45)
            paint_limb(out, art, f"boot-{side}", (x, art["hem"] + 3), (x, art["ground"]), knee, foot, p)
        # Compatibility grip overlay, using precisely the sleeve's affine map.
        # Painted far-arm sets skip this overlay at runtime: that palm is
        # already in the sleeve below the robe, not above the near/free arm.
        if hand_only and side == "front":
            _, elbow, wrist = joints
            _, dest_elbow, dest_wrist = s[arm_key]
            paint_limb(out, art, f"hand-{side}", elbow, wrist, dest_elbow, dest_wrist, p)
    return out


def outfit_frame(art, s, p, advanced=False, branch="novice"):
    out = Image.new("RGBA", ENCODED)
    if advanced:
        # A second silk train gives the advanced silhouette greater breadth.
        paint(out, art["parts"]["torso"], (art["cx"], art["neck"]),
              (s["neck"][0] - 3 - p["wave"] * 2, s["neck"][1] + 6), SCALE * 1.1, -p["lean"] - 0.05, p)
    # The staff-carrying arm is the FAR arm. The free arm is the NEAR arm.
    # These paint roles stay the same when the complete sprite is mirrored.
    for side, arm_key, joints in (("front", "arm_f", art["joints"][3:]), ("back", "arm_b", art["joints"][:3])):
        if side == "back":
            paint(out, art["parts"]["torso"], (art["cx"], art["neck"]), s["neck"], SCALE, -p["lean"], p)
        a, b, c = joints
        da, db, dc = s[arm_key]
        paint_limb(out, art, f"upper-{side}", a, b, da, db, p)
        paint_limb(out, art, f"fore-{side}", b, c, db, dc, p)
    return out


def head_frame(art, s, p, advanced=False):
    out = Image.new("RGBA", ENCODED)
    if advanced:
        # Restrained aureole sits behind the painted crown, never over the face.
        draw = ImageDraw.Draw(out)
        cx, cy = tx((s["neck"][0], s["neck"][1] - 22), p)
        cx, cy = cx * RESOLUTION, cy * RESOLUTION
        draw.ellipse((cx - 23 * RESOLUTION, cy - 27 * RESOLUTION, cx + 23 * RESOLUTION, cy + 20 * RESOLUTION), outline=(247, 210, 125, 175), width=RESOLUTION)
        for i in range(9):
            angle = math.pi + i * math.pi / 8
            a = (cx + math.cos(angle) * 26 * RESOLUTION, cy + math.sin(angle) * 29 * RESOLUTION)
            b = (cx + math.cos(angle) * 29 * RESOLUTION, cy + math.sin(angle) * 33 * RESOLUTION)
            draw.line((a, b), fill=(255, 224, 153, 195), width=RESOLUTION)
    paint(out, art["parts"]["head"], (art["cx"], art["neck"]), s["neck"], SCALE, -p["lean"] + p["tilt"], p)
    return out


def clean(frame):
    # Bicubic resampling leaves faint alpha haze around every piece; it costs
    # bytes and widens the crop without being visible.
    frame.putalpha(frame.getchannel("A").point(lambda v: 0 if v < 6 else v))
    return frame


def crop_box(frames):
    """One box for every layer of an action, so all layers share a cell."""
    box = [ENCODED[0], ENCODED[1], 0, 0]
    for frame in frames:
        bb = frame.getchannel("A").getbbox()
        if bb:
            box = [min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3])]
    pad = 4 * RESOLUTION
    # Even sizes keep the logical (half-size) cell whole.
    x0, y0 = max(0, box[0] - pad) // 2 * 2, max(0, box[1] - pad) // 2 * 2
    x1, y1 = min(ENCODED[0], box[2] + pad), min(ENCODED[1], box[3] + pad)
    return (x0, y0, x0 + (x1 - x0 + 1) // 2 * 2, y0 + (y1 - y0 + 1) // 2 * 2)


def write_clip(folder, action, frames, durations, loop, hit_frame, sockets=None, box=(0, 0) + ENCODED):
    folder.mkdir(parents=True, exist_ok=True)
    cell = (box[2] - box[0], box[3] - box[1])
    cols = min(8, len(frames))
    atlas = Image.new("RGBA", (cell[0] * cols, cell[1] * math.ceil(len(frames) / cols)))
    for i, frame in enumerate(frames):
        atlas.alpha_composite(frame.crop(box), ((i % cols) * cell[0], (i // cols) * cell[1]))
    page = f"{action}-atlas-00.webp"
    atlas.save(folder / page, "WEBP", quality=86, alpha_quality=80, method=6)
    anchor = [ANCHOR[0] * RESOLUTION - box[0], ANCHOR[1] * RESOLUTION - box[1]]
    clip = dict(schemaVersion="3.0", name=action, artSource="painted Lanna priest / articulated rig",
        sourceSize=[cell[0] / RESOLUTION, cell[1] / RESOLUTION], sourceAnchor=[v / RESOLUTION for v in anchor],
        encodedAnchor=anchor, bodyHeightPx=145,
        frameCount=len(frames), durationsMs=durations, durationSeconds=sum(durations) / 1000,
        loop=loop, sampling="linear", events=[] if hit_frame is None else [dict(name="hit", frame=hit_frame, atMs=sum(durations[:hit_frame]))],
        fallback=dict(type="png-atlas", cellSize=list(cell), pages=[dict(file=page, firstFrame=0, frameCount=len(frames), columns=cols)]))
    if sockets:
        clip["sockets"] = dict(hand=[[round(x - box[0], 2), round(y - box[1], 2), d] for x, y, d in sockets])
    (folder / "animation.json").write_text(json.dumps(clip, indent=2) + "\n")


def source_look(look):
    return "bishop" if look.startswith("bishop") or look in ("hood", "mitre") else "templar" if look.startswith("templar") else "novice"


def export(gender, sheet, preview_only=False, arms_only=False, selected_actions=None):
    art = {branch: extract(sheet, gender, branch) for branch in ("novice", "bishop", "templar")}
    base = ROOT / f"priest-{gender}-painted"
    base.mkdir(parents=True, exist_ok=True)
    actions = priest_actions()
    for action, (poses, durations, loop, hit_frame) in actions.items():
        if selected_actions and action not in selected_actions:
            continue
        if preview_only and action != "idle":
            continue
        bodies, sockets = [], []
        hands = {look: [] for look in LOOKS}
        outfits, heads = {look: [] for look in LOOKS}, {look: [] for look in HEADS}
        weapons = {look: [] for look in legacy.WEAPONS}
        for p in poses:
            s = skeleton(p)
            bodies.append(body_frame(art["novice"], s, p))
            x, y = tx(s["arm_f"][2], p)
            sockets.append([round(x * RESOLUTION, 2), round(y * RESOLUTION, 2), round(math.degrees(legacy.weapon_angle(p) + p["rot"]), 2)])
            outfit_cache, hand_cache = {}, {}
            for look in LOOKS:
                branch = source_look(look)
                advanced = look.endswith("-3") and "robe" not in look
                key = (branch, advanced)
                if key not in outfit_cache:
                    outfit_cache[key] = outfit_frame(art[branch], s, p, advanced, branch)
                if branch not in hand_cache:
                    hand_cache[branch] = body_frame(art[branch], s, p, hand_only=True)
                outfits[look].append(outfit_cache[key])
                hands[look].append(hand_cache[branch])
            for look in HEADS:
                heads[look].append(head_frame(art[source_look(look)], s, p, look.endswith("-3")))
            # Backwards-compatible weapon fallback while an equipped icon loads.
            rig.CELL, rig.ANCHOR = CELL, ANCHOR
            for look in weapons:
                cv = rig.Canvas(p["rot"], p["dx"], p["dy"])
                for _, _, fn in legacy.weapon_pieces(look, gender, p, s):
                    fn(cv)
                weapons[look].append(cv.im.resize(ENCODED, Image.Resampling.LANCZOS))
        if not preview_only:
            for frame in bodies + [f for group in (hands, outfits, heads, weapons) for frames in group.values() for f in frames]:
                clean(frame)
            # The weapon fallback is left out of the box: it only shows while
            # the equipped item's own picture loads.
            box = crop_box(bodies + [f for group in (hands, outfits, heads) for frames in group.values() for f in frames])
            clip = dict(durations=durations, loop=loop, hit_frame=hit_frame, box=box)
            write_clip(base / "body" / action, action, bodies, sockets=sockets, **clip)
            write_clip(base / "hand" / action, action, hands["robe-1"], **clip)
            for branch, look in (("novice", "robe-1"), ("bishop", "bishop-2"), ("templar", "templar-2")):
                write_clip(base / "hand" / branch / action, action, hands[look], **clip)
            # Every layer must share the new crop box, so all of them are rewritten.
            slots = (("outfit", outfits), ("head", heads), ("weapon", weapons))
            for slot, looks in slots:
                for look, frames in looks.items():
                    write_clip(base / slot / look / action, action, frames, **clip)
        if action == "idle":
            gallery = Image.new("RGBA", (ENCODED[0] * 5, ENCODED[1]), (0, 0, 0, 0))
            for n, look in enumerate(("robe-1", "bishop-2", "bishop-3", "templar-2", "templar-3")):
                frame = weapons["staff-1"][0].copy()
                frame.alpha_composite(bodies[0])
                frame.alpha_composite(outfits[look][0])
                frame.alpha_composite(heads["hair" if look == "robe-1" else look][0])
                gallery.alpha_composite(frame, (n * ENCODED[0], 0))
                box = frame.getbbox()
                portrait = frame.crop((box[0], max(0, box[1] - 3), box[2], min(ENCODED[1], box[1] + 125 * RESOLUTION)))
                portrait.thumbnail((221, 221), Image.Resampling.LANCZOS)
                portrait.save(base / f"portrait-{look}.webp", "WEBP", quality=94)
            gallery.save(base / "preview.png")
    entry = dict(dir=base.name, height=125, facing=1, portrait="portrait-robe-1.webp", source="painted Lanna source, articulated interchangeable layers",
        actions=legacy.ACTION_FOLDERS, layers=dict(order=["weapon", "outfit", "head"], weaponBehind=True,
            looks=dict(outfit=LOOKS, head=HEADS, weapon=list(legacy.WEAPONS)),
            parts={}, hand="hand", hands={look: f"hand/{source_look(look)}" for look in LOOKS}, painted=True))
    return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--arms-only", action="store_true", help="rebuild body, sleeves and hand clips; preserve head and weapon atlases")
    parser.add_argument("--actions", nargs="+", help="rebuild only the named existing action clips")
    args = parser.parse_args()
    sheet = Image.open(SOURCE).convert("RGBA")
    index_path = ROOT / "index.json"
    index = json.loads(index_path.read_text())
    for gender in ("male", "female"):
        entry = export(gender, sheet, args.preview, args.arms_only, args.actions)
        index["sets"][f"priest-{gender}"] = entry
        for branch in ("bishop", "templar"):
            for tier in (2, 3):
                index["sets"][f"priest-{gender}-{branch}-{tier}"] = dict(entry, portrait=f"portrait-{branch}-{tier}.webp")
        print("built", gender, flush=True)
    if not args.preview:
        index["version"] = str(time.time_ns())
        index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
