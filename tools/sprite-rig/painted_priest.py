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
import painted_staff as staff

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


# Outline of each figure's gripping (front) hand, relative to its registered
# wrist point, starting where it leaves the sleeve. The painted hand hangs
# open; it is cut from the sleeve and the staff layer paints a closed fist
# in its place (painted_staff.py), so the staff is really held.
HANDS = {
    ("male", "novice"): [(-18, -26), (-3, -27), (4, -14), (13, -3), (16, 8), (12, 21), (2, 22), (-6, 12), (-12, 0), (-17, -12)],
    ("male", "bishop"): [(-18, -28), (-3, -30), (4, -16), (13, -3), (15, 8), (12, 22), (2, 22), (-6, 12), (-12, 0), (-17, -14)],
    ("male", "templar"): [(-16, -21), (2, -22), (6, -12), (15, 0), (17, 10), (12, 22), (2, 22), (-6, 12), (-12, 0), (-16, -10)],
    ("female", "novice"): [(-18, -31), (-4, -33), (2, -22), (10, -12), (15, -2), (14, 8), (8, 10), (-2, 6), (-8, -2), (-14, -14)],
    ("female", "bishop"): [(-16, -37), (-2, -39), (3, -28), (11, -16), (15, -4), (13, 6), (6, 7), (-3, 2), (-9, -8), (-14, -20)],
    ("female", "templar"): [(-16, -30), (3, -30), (8, -20), (14, -6), (16, 6), (12, 12), (4, 10), (-4, 2), (-10, -8), (-15, -20)],
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
    wrist = joints[5]
    hand = [(wrist[0] + x, wrist[1] + y) for x, y in HANDS[(gender, branch)]]
    for side, (sh, elbow, wrist) in zip(("back", "front"), (joints[:3], joints[3:])):
        parts[f"upper-{side}"] = limb_mask(image, sh, elbow, 28, 26)
        # Extend past the wrist to retain fingers, but not back up the upper
        # arm: rotating that duplicated shoulder patch makes a second elbow.
        # The free (back) hand is cut narrower: a wider cut takes a strip of
        # the robe beside the fingers along with it.
        parts[f"fore-{side}"] = limb_mask(image, elbow, wrist, 29, 15 if side == "back" else 20,
                                          extend=0.46, start_extend=0.04)
        parts[f"hand-{side}"] = limb_mask(image, wrist, (wrist[0], wrist[1] + 25), 12, 10, extend=0.1)
    # Near-black robe edging can still sit right beside the free fingers:
    # nothing that dark belongs to a hand, so drop it below the wrist.
    free, wy = parts["fore-back"], joints[2][1]
    mask = free.getchannel("A")
    alpha, pixels = mask.load(), free.load()
    for y in range(wy - 10, min(free.height, wy + 45)):
        for x in range(free.width):
            if alpha[x, y] and max(pixels[x, y][:3]) < 100:
                alpha[x, y] = 0
    free.putalpha(mask)
    # The staff layer paints the gripping hand; the sleeve keeps only the arm.
    cut = Image.new("L", image.size, 255)
    ImageDraw.Draw(cut).polygon(hand, fill=0, outline=0, width=3)
    fore = parts["fore-front"]
    fore.putalpha(ImageChops.multiply(fore.getchannel("A"), cut))
    for side, x in (("back", cx - 45), ("front", cx + 45)):
        parts[f"boot-{side}"] = polygon_mask(image, [(x - 35, hem + 2), (x + 35, hem + 2),
            (x + 40, ground + 3), (x - 35, ground + 3)])
    return dict(parts=parts, cx=cx, neck=neck, hem=hem, ground=ground, joints=joints,
                palm=palm_centre(image, joints[5]), grip=hand_grip(image, hand))


def hand_grip(image, hand):
    """Where the painted fist goes, in source pixels: the cuff it grows out
    of, the fist centre (a little past the middle of the open hand) and the
    hand's skin colour."""
    cuff = ((hand[0][0] + hand[1][0]) / 2, (hand[0][1] + hand[1][1]) / 2)
    mid = (sum(x for x, _ in hand) / len(hand), sum(y for _, y in hand) / len(hand))
    fist = (cuff[0] + (mid[0] - cuff[0]) * 0.9, cuff[1] + (mid[1] - cuff[1]) * 0.9)
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).polygon(hand, fill=255)
    pixels = [px for px, m in zip(image.getdata(), mask.getdata())
              if m and px[3] > 200 and px[0] > 170 and px[0] > px[1] > px[2]]
    pixels.sort(key=sum)
    lit = pixels[len(pixels) // 3:]  # skip finger-gap shadows
    skin = tuple(round(sum(px[i] for px in lit) / len(lit)) for i in range(3))
    return dict(cuff=cuff, fist=fist, skin=skin)


def palm_centre(image, wrist):
    """Middle of the painted gripping hand: the mean of its skin pixels.

    The registered wrist point sits low on the fingers, so a weapon socketed
    there only grazes the fingertips. Gold trim is excluded by requiring the
    blue channel of a warm skin tone."""
    xs = ys = n = 0
    for y in range(wrist[1] - 30, wrist[1] + 26):
        for x in range(wrist[0] - 26, wrist[0] + 26):
            r, g, b, a = image.getpixel((x, y))
            if a > 200 and r > 150 and r > g + 10 and g > b and b > 0.55 * r:
                xs, ys, n = xs + x, ys + y, n + 1
    if n <= 40:
        return wrist
    # Shaded fingers fail the colour test, pulling the mean toward the back
    # of the hand; meet the low wrist point halfway for the hand's middle.
    return (xs / n * 0.55 + wrist[0] * 0.45, ys / n * 0.55 + wrist[1] * 0.45)


def limb_point_rig(point, a, b, dest_a, dest_b):
    """Rig-space position of a source pixel of a limb piece (paint_limb's map
    before the whole-body transform)."""
    sa = math.atan2(b[1] - a[1], b[0] - a[0])
    da = math.atan2(dest_b[1] - dest_a[1], dest_b[0] - dest_a[0])
    scale = math.dist(dest_a, dest_b) / math.dist(a, b)
    c, s = math.cos(da - sa), math.sin(da - sa)
    vx, vy = (point[0] - a[0]) * scale, (point[1] - a[1]) * scale
    return dest_a[0] + vx * c - vy * s, dest_a[1] + vx * s + vy * c


def limb_point(point, a, b, dest_a, dest_b, p):
    """Where a source pixel of a limb piece lands in the cell."""
    return tx(limb_point_rig(point, a, b, dest_a, dest_b), p)


def palm_rig(art, s):
    """Rig-space centre of the gripping fist for skeleton s."""
    _, elbow, wrist = art["joints"][3:]
    _, dest_elbow, dest_wrist = s["arm_f"]
    return limb_point_rig(art["grip"]["fist"], elbow, wrist, dest_elbow, dest_wrist)


def grip_rig(art, s):
    """The fist to paint with the staff: cuff and fist centre in rig space,
    its size and the hand's skin colour."""
    _, elbow, wrist = art["joints"][3:]
    _, dest_elbow, dest_wrist = s["arm_f"]
    k = math.dist(dest_elbow, dest_wrist) / math.dist(elbow, wrist)
    g = art["grip"]
    return dict(cuff=limb_point_rig(g["cuff"], elbow, wrist, dest_elbow, dest_wrist),
                fist=limb_point_rig(g["fist"], elbow, wrist, dest_elbow, dest_wrist),
                radius=16 * k, skin=g["skin"])


def priest_actions():
    actions = rig.actions("mage")
    # A staff carrier keeps the gripping arm clear of the robe; walk and run
    # get their own gaits rather than the caster rig's deep arm curl.
    actions["walk"] = (rig.cycle(8, walk_pose), [95] * 8, True, None)
    actions["attack"] = (rig.keyframes(ATTACK_KEYS, 6, False), [70, 80, 70, 60, 90, 110], False, 3)
    actions["run"] = (rig.cycle(8, run_pose), [58] * 8, True, None)
    return actions


# A holy strike: wind the staff back over the shoulder with the free hand at
# the chest, raise it high and glowing with the palm out, then step in and
# drive it forward as the free arm sweeps back, and settle.
ATTACK_KEYS = [
    (0.0, rig.pose()),
    (0.22, rig.pose(shF=2.6, elF=0.3, weapon=-0.9, shB=0.7, elB=1.5, lean=-0.12, tilt=-0.06,
                    hipF=0.25, hipB=-0.15, dy=-1.0, glow=0.3)),
    (0.42, rig.pose(shF=2.95, elF=0.1, weapon=-0.2, shB=1.5, elB=0.3, lean=-0.06, tilt=-0.03,
                    hipF=0.2, hipB=-0.1, dy=-3.0, glow=0.8)),
    (0.6, rig.pose(shF=1.45, elF=0.0, weapon=2.6, shB=-0.45, elB=0.5, lean=0.24, tilt=0.05,
                   hipF=0.55, kneeF=0.3, hipB=-0.35, kneeB=0.2, dx=4.0, dy=1.0, glow=1.0)),
    (0.8, rig.pose(shF=1.2, elF=0.05, weapon=2.3, shB=-0.3, elB=0.4, lean=0.16,
                   hipF=0.45, kneeF=0.2, hipB=-0.25, dx=3.0, glow=0.5)),
    (1.0, rig.pose()),
]


def walk_pose(a):
    """A composed, confident stride: chest up and head high, a soft dip as
    each foot lands, robe swaying with the hips. The staff swings forward
    with every step as if planted ahead; the free arm sways opposite it."""
    s, c, lift = math.sin(a), math.cos(a), abs(math.sin(a))
    return rig.pose(
        dy=-lift * 2.2 + 0.6, lean=0.03, tilt=-0.04 + lift * 0.02,
        hipF=0.08 + s * 0.36, hipB=0.08 - s * 0.36,
        kneeF=0.08 + max(0.0, -s) * 0.45, kneeB=0.08 + max(0.0, s) * 0.45,
        shF=0.27 + abs(c) * 0.05, elF=0.03,
        shB=0.1 - s * 0.14, elB=0.1,
        weapon=0.05 + abs(c) * 0.12, wave=math.sin(a * 2) * 1.1)


def run_pose(a):
    """A quick robed trot: short strides that keep both boots under the hem,
    the trailing heel flicked up, a strong bounce and robe sway. The staff arm is
    held out from the robe so the grip stays visible, tilting the staff
    forward; the free arm pumps a little."""
    s, lift = math.sin(a), abs(math.sin(a))
    return rig.pose(
        dy=-lift * 6 + 2, lean=0.18 + lift * 0.03, tilt=-0.03 + lift * 0.04,
        hipF=0.2 + s * 0.36, hipB=0.2 - s * 0.36,
        kneeF=0.12 + max(0.0, -s) * 0.4, kneeB=0.12 + max(0.0, s) * 0.4,
        shF=0.46 + s * 0.03, elF=0.0,
        shB=0.12 - s * 0.15, elB=0.1 + lift * 0.08,
        weapon=0.12, wave=math.sin(a * 2) * 1.6)


def staff_angle(p):
    """Hand-to-tip direction: the shared rig's, stood a little more upright
    since the priest grips a long staff rather than a short wand."""
    return legacy.weapon_angle(p) - 0.28


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


BOOT = 19.0       # boot length in rig px, hem to sole
BOOT_REACH = 10.0  # furthest a sole may step from under its hip
BOOT_TILT = 0.4    # most a boot leans (radians)


def hem_centre(art, s, p):
    """Rig-space middle of the robe hem: the torso is painted from the neck,
    leaning by -lean, exactly as outfit_frame paints it."""
    lean, drop = p["lean"], (art["hem"] - art["neck"]) * SCALE
    return (s["neck"][0] + math.sin(lean) * drop, s["neck"][1] + math.cos(lean) * drop)


def boot_pose(x, step, sole_y):
    """Top and sole of a boot hanging at hem x-position `x`.

    The legs are hidden by the robe, so a boot hung off the knee swings out
    and floats beside the hem. Instead every boot keeps its length, steps
    `step` (clamped to BOOT_REACH) from under the hem, leans at most
    BOOT_TILT and pivots from under the hem, so its top never shows."""
    fx = x + max(-BOOT_REACH, min(BOOT_REACH, step))
    fy = max(sole_y, -14.0)
    tilt = max(-BOOT_TILT, min(BOOT_TILT, math.asin(max(-1.0, min(1.0, (fx - x) * 0.7 / BOOT)))))
    return (fx - BOOT * math.sin(tilt), fy - BOOT * math.cos(tilt)), (fx, fy)


def body_frame(art, s, p, hand_only=False):
    out = Image.new("RGBA", ENCODED)
    for side, arm_key, leg_key, joints in (("back", "arm_b", "leg_b", art["joints"][:3]),
                                           ("front", "arm_f", "leg_f", art["joints"][3:])):
        if not hand_only:
            hip, _, foot = s[leg_key]
            x = art["cx"] + (-45 if side == "back" else 45)
            # Boots hang under the robe's hem, which leans with the torso.
            hem = hem_centre(art, s, p)
            top, sole = boot_pose(hem[0] + hip[0], foot[0] - hip[0], foot[1])
            paint_limb(out, art, f"boot-{side}", (x, art["hem"] + 3), (x, art["ground"]), top, sole, p)
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


BRANCHES = ("novice", "bishop", "templar")


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
        # Staff + painted fist per outfit family, since each family's sleeve
        # ends in a slightly different place ("bishop/staff-2"); the bare look
        # name is the novice one.
        weapons = {f"{branch}/{look}" if branch != "novice" else look: []
                   for branch in BRANCHES for look in legacy.WEAPONS}
        for p in poses:
            s = skeleton(p)
            bodies.append(body_frame(art["novice"], s, p))
            # The weapon sits in the middle of the novice palm (the body
            # clip's sockets are shared by every outfit).
            palm = palm_rig(art["novice"], s)
            x, y = tx(palm, p)
            sockets.append([round(x * RESOLUTION, 2), round(y * RESOLUTION, 2), round(math.degrees(staff_angle(p) + p["rot"]), 2)])
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
            # The worn staff, painted to match the character and held at the
            # palm a little below its middle (painted_staff.py).
            angle = staff_angle(p)
            place = lambda q: tuple(v * RESOLUTION for v in tx(q, p))
            for branch in BRANCHES:
                grip = grip_rig(art[branch], s)
                for look in legacy.WEAPONS:
                    key = f"{branch}/{look}" if branch != "novice" else look
                    weapons[key].append(staff.staff_frame(look, grip["fist"], angle, place, ENCODED, RESOLUTION, grip=grip))
        if not preview_only:
            for frame in bodies + [f for group in (hands, outfits, heads, weapons) for frames in group.values() for f in frames]:
                clean(frame)
            box = crop_box(bodies + [f for group in (hands, outfits, heads, weapons) for frames in group.values() for f in frames])
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
                frame = bodies[0].copy()
                frame.alpha_composite(outfits[look][0])
                branch = source_look(look)
                frame.alpha_composite(weapons["staff-1" if branch == "novice" else f"{branch}/staff-1"][0])
                frame.alpha_composite(heads["hair" if look == "robe-1" else look][0])
                gallery.alpha_composite(frame, (n * ENCODED[0], 0))
                box = frame.getbbox()
                portrait = frame.crop((box[0], max(0, box[1] - 3), box[2], min(ENCODED[1], box[1] + 125 * RESOLUTION)))
                portrait.thumbnail((221, 221), Image.Resampling.LANCZOS)
                portrait.save(base / f"portrait-{look}.webp", "WEBP", quality=94)
            gallery.save(base / "preview.png")
    entry = dict(dir=base.name, height=125, facing=1, portrait="portrait-robe-1.webp", source="painted Lanna source, articulated interchangeable layers",
        actions=legacy.ACTION_FOLDERS, layers=dict(order=["outfit", "weapon", "head"], weaponFront=True, weaponArt="rig",
            looks=dict(outfit=LOOKS, head=HEADS, weapon=list(legacy.WEAPONS)),
            parts={}, hand="hand", hands={look: f"hand/{source_look(look)}" for look in LOOKS},
            weapons={look: f"weapon/{source_look(look)}" for look in LOOKS if source_look(look) != "novice"},
            painted=True))
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
