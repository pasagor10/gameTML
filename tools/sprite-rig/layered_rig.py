"""Layered (paper-doll) hero sets: a bare body plus swappable gear layers.

Every layer is rendered on the same skeleton, cell size and feet anchor, so
the game can stack them and they move together frame for frame:

    <set>/body/<action>/           bare body: legs, torso, arms, face
    <set>/outfit/<look>/<action>/  robe / armour over the torso and arms
    <set>/head/<look>/<action>/    hair, hood or headwear
    <set>/weapon/<look>/<action>/  weapon in the front hand

Outfit and head looks are split into tint parts, each its own atlas:

    fixed  hair, outlines and glows, shown as drawn
    main   the cloth, drawn light grey: the game tints it with the
           armour picture's main colour (public/assets/items/palette.json)
    trim   edging, sash, mantle and circlet: tinted with its trim colour
    gem    jewels and glow cores: tinted with its gem colour

The body's animation.json also carries a "hand" socket per frame ([x, y,
weapon angle in degrees] in cell px) so the game can put the weapon's own
item picture in the hand, and hand/<action>/ holds the front hand alone to
draw over the grip.

The game stacks them body < outfit < head < weapon. Where a part of a lower
layer must show in front of a higher one (the front hand over the weapon
grip, the front arm over the hair) the higher layer is cut away there, so the
stack still reads correctly with any combination of looks.

Hand-painted art can replace any layer later: keep the cell size, anchor and
frame counts in each animation.json and drop the atlas in the same folder.

    python3 tools/sprite-rig/layered_rig.py               # priest male + female
    python3 tools/sprite-rig/layered_rig.py --sheet /tmp/priest.png
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hero_rig as rig  # noqa: E402
from hero_rig import (  # noqa: E402
    ANCHOR, CELL, FORE, HEAD_R, NECK, OUTLINE, SHIN, SKIN, SKIN_SHADE, SS, THIGH, TORSO, UPPER,
    Canvas, limb_end, rgba, shade,
)

# A wider cell than the base rig: the staff reaches well past the body.
rig.CELL, rig.ANCHOR = (300, 220), (150, 208)
CELL, ANCHOR = rig.CELL, rig.ANCHOR
ROOT = rig.ROOT
LAYERS = ["body", "outfit", "head", "weapon"]
ACTION_FOLDERS = {"idle": "idle", "walk": "walk", "run": "run", "jump": "jump", "attack": "attack",
                  "skill": "skill", "hit": "hurt", "death": "death"}

HAIR = {"male": (74, 52, 38), "female": (238, 214, 150)}
PANTS, BOOTS = (92, 78, 66), (70, 52, 40)
UNDER = (224, 214, 196)  # plain undershirt on the bare body
# Tint-part marker colours: shade() keeps each family recognisable, so the
# split can find them again: grey → main, (r,0,r) → trim, (0,g,g) → gem.
G, M, C = (236, 236, 236), (236, 0, 236), (0, 236, 236)
PARTS = ["fixed", "main", "trim", "gem"]

# Gear looks, worst to best. Tier 1 is what a hero wears with no armour.
OUTFITS = {
    "robe-1": dict(robe=(236, 228, 210), trim=(150, 112, 70), sash=(150, 112, 70), sleeve=0.5, skirt=0.62),
    "robe-2": dict(robe=(240, 240, 236), trim=(86, 140, 214), sash=(86, 140, 214), sleeve=0.7, skirt=0.72,
                   mantle=(70, 112, 190)),
    "robe-3": dict(robe=(250, 246, 232), trim=(226, 178, 64), sash=(196, 60, 60), sleeve=0.85, skirt=0.8,
                   mantle=(232, 190, 80), cape=(178, 40, 52)),
    "robe-4": dict(robe=(255, 252, 240), trim=(255, 206, 84), sash=(255, 206, 84), sleeve=0.95, skirt=0.86,
                   mantle=(255, 214, 110), cape=(250, 244, 226), pauldron=True, glow=True),
}
# The same looks with cloth, trim and gems in marker colours for tinting.
MARKED_OUTFITS = {k: dict(v, robe=G, trim=M, sash=M, mantle=M if v.get("mantle") else None,
                         cape=(184, 184, 184) if v.get("cape") else None, gem=C)
                  for k, v in OUTFITS.items()}
HEADS = {
    "hair": dict(),
    "circlet": dict(circlet=(226, 182, 74), gem=(110, 190, 255)),
    "hood": dict(hood=(240, 236, 226), hood_trim=(226, 178, 64)),
    "mitre": dict(mitre=(255, 250, 238), mitre_trim=(255, 200, 80), halo=True),
}
MARKED_HEADS = {
    "hair": dict(),
    "circlet": dict(circlet=M, gem=C),
    "hood": dict(hood=G, hood_trim=M),
    "mitre": dict(mitre=G, mitre_trim=M, halo=True),
}
WEAPONS = {
    "staff-1": dict(kind="cross", shaft=(126, 88, 52), metal=(196, 170, 120), length=70),
    "staff-2": dict(kind="mace", shaft=(186, 192, 204), metal=(214, 222, 236), gem=(110, 190, 255), length=66),
    "staff-3": dict(kind="sun", shaft=(196, 150, 60), metal=(255, 206, 84), gem=(255, 120, 90), length=78),
    "staff-4": dict(kind="wings", shaft=(250, 244, 226), metal=(255, 214, 110), gem=(140, 230, 255), length=84,
                    glow=True),
}


# --------------------------------------------------------------------------- skeleton


def skeleton(gender, p):
    lean, tilt = p["lean"], p["tilt"]
    hip = (0.0, -(THIGH + SHIN) - 2)
    top = (hip[0] + math.sin(lean) * TORSO, hip[1] - math.cos(lean) * TORSO)
    neck = (top[0] + math.sin(lean) * NECK, top[1] - math.cos(lean) * NECK)
    head = (neck[0] + 4 + math.sin(lean + tilt) * HEAD_R * 0.9, neck[1] - math.cos(lean + tilt) * HEAD_R * 0.92)
    sh_f, sh_b = (top[0] + 4, top[1] + 4), (top[0] - 3, top[1] + 3)

    def arm(sh, ang, el):
        e = limb_end(sh, ang, UPPER)
        return sh, e, limb_end(e, ang + el, FORE)

    def leg(ang, knee, front):
        h = (hip[0] + (2 if front else -2), hip[1])
        k = limb_end(h, ang, THIGH)
        return h, k, limb_end(k, ang - knee, SHIN)

    def tpt(x, y):  # torso-local: x right, y up from the hip
        return (hip[0] + x * math.cos(lean) + y * math.sin(lean), hip[1] + x * math.sin(lean) - y * math.cos(lean))

    return dict(
        hip=hip, top=top, head=head, tpt=tpt, fem=gender == "female",
        arm_f=arm(sh_f, p["shF"], p["elF"]), arm_b=arm(sh_b, p["shB"], p["elB"]),
        leg_f=leg(p["hipF"], p["kneeF"], True), leg_b=leg(p["hipB"], p["kneeB"], False),
        w_top=12 if gender == "female" else 14, w_hip=11 if gender == "female" else 12,
    )


# --------------------------------------------------------------------------- pieces
# Each piece is (z, layer, draw(cv)). z is the true paint order.


def body_pieces(gender, p, s):
    out = []
    hand = lambda cv, h, front: cv.circle(h, 4.2, SKIN if front else SKIN_SHADE)

    def arm(cv, a, front):
        sh, e, h = a
        cv.capsule(sh, e, 8, rgba(UNDER) if front else shade(UNDER, 0.8))
        cv.capsule(e, h, 7.5, SKIN if front else SKIN_SHADE)
        hand(cv, h, front)

    def leg(cv, l, front):
        h, k, f = l
        col = rgba(PANTS) if front else shade(PANTS, 0.8)
        cv.capsule(h, k, 9.5, col)
        cv.capsule(k, f, 8.5, col)
        cv.capsule((f[0] - 1, f[1] - 3), (f[0] + 6, f[1] + 1), 8, rgba(BOOTS) if front else shade(BOOTS, 0.8))

    def torso(cv):
        t, wt, wh = s["tpt"], s["w_top"], s["w_hip"]
        cv.poly([t(-wh, 2), t(wh, 2), t(wt, TORSO - 2), t(-wt + 2, TORSO)], rgba(UNDER))
        cv.capsule(t(-wh, 4), t(wh, 4), 4, shade(PANTS, 0.7))

    def face(cv):
        hc = s["head"]
        cv.circle(hc, HEAD_R * 0.86, SKIN)
        ey = hc[1] + 3
        for ex, sc in ((hc[0] + 13, 1.0), (hc[0] - 1, 0.8)):
            if p["eyes"] == "open":
                cv.circle((ex, ey), 4.2 * sc, OUTLINE, outline=False)
                cv.circle((ex, ey + 0.8), 3.0 * sc, (150, 110, 60, 255), outline=False)
                cv.circle((ex + 1.2, ey - 1.6), 1.3 * sc, (255, 255, 255, 255), outline=False)
                if s["fem"]:
                    cv.line((ex - 4 * sc, ey - 4.5), (ex + 4.5 * sc, ey - 5.5), 1.4, OUTLINE)
            elif p["eyes"] == "hurt":
                cv.line((ex - 3, ey - 3), (ex + 3, ey), 1.6, OUTLINE)
                cv.line((ex + 3, ey), (ex - 3, ey + 3), 1.6, OUTLINE)
            else:
                cv.line((ex - 3.5, ey + 1), (ex + 3.5, ey + 1), 1.6, OUTLINE)
        cv.blend(lambda l: l.circle((hc[0] + 16, hc[1] + 11), 3, (255, 160, 160, 140), outline=False))
        cv.line((hc[0] + 8, hc[1] + 14), (hc[0] + 12, hc[1] + 14.5), 1.4, OUTLINE)

    out.append((30, "body", lambda cv: arm(cv, s["arm_b"], False)))
    out.append((40, "body", lambda cv: leg(cv, s["leg_b"], False)))
    out.append((50, "body", torso))
    out.append((60, "body", lambda cv: leg(cv, s["leg_f"], True)))
    out.append((80, "body", face))
    out.append((100, "body", lambda cv: arm(cv, s["arm_f"], True)))
    # The front hand closes over the weapon grip.
    out.append((130, "body", lambda cv: hand(cv, s["arm_f"][2], True)))
    return out


def outfit_pieces(look, gender, p, s, marked=False):
    o, wave, out = (MARKED_OUTFITS if marked else OUTFITS)[look], p["wave"], []
    core = rgba(o.get("gem") or (255, 250, 220))
    t, wt, wh, top, hip = s["tpt"], s["w_top"], s["w_hip"], s["top"], s["hip"]
    if o.get("cape"):
        def cape(cv):
            col = rgba(o["cape"])
            cv.poly([(top[0] - 8, top[1] + 2), (top[0] + 4, top[1] + 1),
                     (hip[0] - 8 + wave * 2, hip[1] + 30), (hip[0] - 28 + wave * 5, hip[1] + 24)], shade(col, 0.82))
            cv.line((hip[0] - 9 + wave * 2, hip[1] + 29), (hip[0] - 27 + wave * 5, hip[1] + 23), 2.2, rgba(o["trim"]))
        out.append((10, "outfit", cape))

    def sleeve(cv, a, front):
        sh, e, h = a
        col = rgba(o["robe"]) if front else shade(o["robe"], 0.8)
        cuff = (e[0] + (h[0] - e[0]) * o["sleeve"], e[1] + (h[1] - e[1]) * o["sleeve"])
        cv.capsule(sh, e, 10.5, col)
        cv.capsule(e, cuff, 10 + o["sleeve"] * 3, col)
        cv.circle(cuff, 5.5 + o["sleeve"] * 1.5, rgba(o["trim"]) if front else shade(o["trim"], 0.8))

    out.append((32, "outfit", lambda cv: sleeve(cv, s["arm_b"], False)))

    def robe(cv):
        col = rgba(o["robe"])
        cv.poly([t(-wh - 1, 1), t(wh + 1, 1), t(wt + 1, TORSO - 1), t(-wt + 1, TORSO + 1)], col)
        # Collar V and a centre panel in the trim colour.
        cv.poly([t(-5, TORSO), t(7, TORSO - 1), t(1, TORSO - 10)], rgba(o["trim"]), width=1.0)
        cv.line(t(1, TORSO - 10), t(1, 6), 2.4, rgba(o["trim"]))
        skirt_len = 6 + o["skirt"] * (THIGH + SHIN - 6)
        flare = 5 + o["skirt"] * 9
        cv.poly([t(-wh - 1, 4), t(wh + 1, 4), t(wh + flare + wave, -skirt_len), t(-wh - flare + wave, -skirt_len)],
                shade(o["robe"], 0.94))
        cv.line(t(-wh - flare + wave + 1, -skirt_len + 1.6), t(wh + flare + wave - 1, -skirt_len + 1.6), 2.6,
                rgba(o["trim"]))
        cv.line(t(1, 4), t(1 + wave * 0.5, -skirt_len + 2), 2.2, rgba(o["trim"]))
        cv.capsule(t(-wh, 5), t(wh, 5), 4.5, rgba(o["sash"]))
        cv.poly([t(4, 5), t(9, -12 + wave), t(5, -12 + wave)], rgba(o["sash"]), width=1.0)
        if o.get("mantle"):
            m = rgba(o["mantle"])
            cv.poly([t(-wt - 2, TORSO - 1), t(wt + 3, TORSO - 2), t(wt + 1, TORSO - 12), t(1, TORSO - 16),
                     t(-wt, TORSO - 12)], m)
            cv.line(t(-wt, TORSO - 12), t(1, TORSO - 16), 1.4, rgba(o["trim"]))
            cv.line(t(1, TORSO - 16), t(wt + 1, TORSO - 12), 1.4, rgba(o["trim"]))
        if o.get("glow"):
            cv.blend(lambda l: l.circle(t(1, TORSO - 12), 6, (255, 240, 170, 150), outline=False))
            cv.circle(t(1, TORSO - 12), 2.6, core, outline=False)
    # After the front leg: a long robe hangs over the legs.
    out.append((65, "outfit", robe))

    def front(cv):
        sleeve(cv, s["arm_f"], True)
        if o.get("pauldron"):
            sh = s["arm_f"][0]
            cv.circle((sh[0], sh[1] + 1), 7.5, rgba(o["mantle"]))
            cv.circle((sh[0] - 1.5, sh[1] - 1), 2.4, core, outline=False)
    out.append((102, "outfit", front))
    return out


def head_pieces(look, gender, p, s, marked=False):
    h, hc, wave, fem, out = (MARKED_HEADS if marked else HEADS)[look], s["head"], p["wave"], s["fem"], []
    hair = rgba(HAIR[gender])
    if fem and not h.get("hood"):
        def tail(cv):
            sway = wave * 3
            cv.poly([(hc[0] - 18, hc[1] - 14), (hc[0] - 30 + sway, hc[1] + 8), (hc[0] - 34 + sway * 1.5, hc[1] + 30),
                     (hc[0] - 22 + sway, hc[1] + 14), (hc[0] - 10, hc[1] - 2)], hair)
        out.append((20, "head", tail))
    if h.get("hood"):
        def hood_back(cv):
            cv.poly([(hc[0] - 30, hc[1] - 6), (hc[0] - 22, hc[1] - 30), (hc[0] + 2, hc[1] - 36),
                     (hc[0] + 24, hc[1] - 26), (hc[0] + 6, hc[1] + 6), (hc[0] - 14 + wave, hc[1] + 30),
                     (hc[0] - 30 + wave * 2, hc[1] + 24)], shade(h["hood"], 0.85))
        out.append((20, "head", hood_back))
    if h.get("halo"):
        def halo(cv):
            c = (hc[0] - 4, hc[1] - 12)
            cv.blend(lambda l: l.circle(c, 40, (255, 236, 160, 70), outline=False))
            cv.blend(lambda l: l.circle(c, 34, (255, 246, 200, 80), outline=False))
        out.append((5, "head", halo))

    def front(cv):
        if h.get("hood"):
            col = rgba(h["hood"])
            cv.poly([(hc[0] - 29, hc[1] + 8), (hc[0] - 27, hc[1] - 16), (hc[0] - 12, hc[1] - 31), (hc[0] + 6, hc[1] - 33),
                     (hc[0] + 24, hc[1] - 24), (hc[0] + 29, hc[1] - 6), (hc[0] + 20, hc[1] - 14),
                     (hc[0] + 4, hc[1] - 16), (hc[0] - 10, hc[1] - 8), (hc[0] - 16, hc[1] + 14)], col)
            # Fringe peeking out under the hood.
            cv.poly([(hc[0] - 6, hc[1] - 17), (hc[0] + 18, hc[1] - 15), (hc[0] + 10, hc[1] - 8), (hc[0] + 2, hc[1] - 11)],
                    hair, width=1.0)
            cv.line((hc[0] - 27, hc[1] - 14), (hc[0] + 6, hc[1] - 31), 2.2, rgba(h["hood_trim"]))
            cv.line((hc[0] + 6, hc[1] - 31), (hc[0] + 27, hc[1] - 10), 2.2, rgba(h["hood_trim"]))
            return
        cv.poly([(hc[0] - 27, hc[1] + 4), (hc[0] - 26, hc[1] - 14), (hc[0] - 14, hc[1] - 26), (hc[0] + 4, hc[1] - 29),
                 (hc[0] + 20, hc[1] - 22), (hc[0] + 27, hc[1] - 8), (hc[0] + 16, hc[1] - 12), (hc[0] + 6, hc[1] - 6),
                 (hc[0] - 2, hc[1] - 12), (hc[0] - 10, hc[1] - 4), (hc[0] - 16, hc[1] + 10)], hair)
        if fem:
            cv.poly([(hc[0] - 22, hc[1] - 4), (hc[0] - 16, hc[1] + 20), (hc[0] - 10, hc[1] + 4)], hair)
        elif not h.get("mitre"):
            cv.poly([(hc[0] - 6, hc[1] - 26), (hc[0] + 2, hc[1] - 36), (hc[0] + 8, hc[1] - 26)], hair)
        if h.get("circlet"):
            cv.line((hc[0] - 24, hc[1] - 13), (hc[0] + 24, hc[1] - 18), 3.0, rgba(h["circlet"]))
            cv.poly([(hc[0] + 6, hc[1] - 22), (hc[0] + 10, hc[1] - 15), (hc[0] + 2, hc[1] - 14)], rgba(h["gem"]), width=1.0)
        if h.get("mitre"):
            m = rgba(h["mitre"])
            cv.poly([(hc[0] - 22, hc[1] - 14), (hc[0] + 22, hc[1] - 19), (hc[0] + 14, hc[1] - 44),
                     (hc[0] + 2, hc[1] - 56), (hc[0] - 12, hc[1] - 42)], m)
            cv.line((hc[0] - 21, hc[1] - 15), (hc[0] + 21, hc[1] - 20), 3.0, rgba(h["mitre_trim"]))
            cv.line((hc[0] + 1, hc[1] - 18), (hc[0] + 2, hc[1] - 52), 2.4, rgba(h["mitre_trim"]))
            cv.line((hc[0] - 6, hc[1] - 36), (hc[0] + 10, hc[1] - 37), 2.4, rgba(h["mitre_trim"]))
    out.append((90, "head", front))
    return out


def weapon_angle(p):
    """Direction the weapon points from the hand, in rig space (radians, y down).

    Tilted forward so the head of the staff rides clear of the face."""
    return -math.pi / 2 + p["weapon"] + 0.5 - max(0.0, p["weapon"]) * 0.6


def hand_socket(s, p):
    """[x, y, degrees] of the front hand and weapon direction, in cell px."""
    cv = Canvas(p["rot"], p["dx"], p["dy"])
    x, y = cv.tx(s["arm_f"][2])
    return [round(x / SS, 2), round(y / SS, 2), round(math.degrees(weapon_angle(p) + p["rot"]), 2)]


def weapon_pieces(look, gender, p, s):
    w = WEAPONS[look]
    hand = s["arm_f"][2]
    ang = weapon_angle(p)
    L = w["length"]
    top = (hand[0] + 4 + math.cos(ang) * L, hand[1] + math.sin(ang) * L)
    bot = (hand[0] - math.cos(ang) * 16, hand[1] - math.sin(ang) * 16)
    ux, uy = math.cos(ang), math.sin(ang)
    px, py = -uy, ux
    glow = max(p["glow"], 0.35 if w.get("glow") else 0)

    def draw(cv):
        cv.capsule(bot, top, 4.2, rgba(w["shaft"]))
        metal, kind = rgba(w["metal"]), w["kind"]
        if glow > 0.05:
            cv.blend(lambda l: l.circle(top, 11 + 9 * glow, (255, 236, 160, int(130 * glow)), outline=False))
        if kind == "cross":
            cv.capsule((top[0] - ux * 2, top[1] - uy * 2), (top[0] + ux * 9, top[1] + uy * 9), 4.2, metal)
            a = (top[0] + px * 7, top[1] + py * 7)
            b = (top[0] - px * 7, top[1] - py * 7)
            cv.capsule(a, b, 4.2, metal)
        elif kind == "mace":
            cv.circle((top[0] + ux * 4, top[1] + uy * 4), 7.5, metal)
            for k in (-1, 1):
                cv.poly([(top[0] + ux * 4 + px * 7 * k, top[1] + uy * 4 + py * 7 * k),
                         (top[0] + ux * 4 + px * 12 * k, top[1] + uy * 4 + py * 12 * k),
                         (top[0] + ux * 9 + px * 7 * k, top[1] + uy * 9 + py * 7 * k)], metal, width=1.0)
            cv.circle((top[0] + ux * 4, top[1] + uy * 4), 3.2, rgba(w["gem"]))
        elif kind == "sun":
            c = (top[0] + ux * 6, top[1] + uy * 6)
            for k in range(8):
                a = k * math.pi / 4
                cv.line(c, (c[0] + math.cos(a) * 15, c[1] + math.sin(a) * 15), 2.6, metal)
            cv.circle(c, 9, metal)
            cv.circle(c, 4.2, rgba(w["gem"]))
        else:  # wings
            c = (top[0] + ux * 6, top[1] + uy * 6)
            for k in (-1, 1):
                cv.poly([(c[0], c[1]), (c[0] + px * 24 * k - ux * 4, c[1] + py * 24 * k - uy * 4),
                         (c[0] + px * 18 * k + ux * 8, c[1] + py * 18 * k + uy * 8),
                         (c[0] + px * 8 * k + ux * 4, c[1] + py * 8 * k + uy * 4)], metal)
            cv.poly([(c[0] + ux * 16, c[1] + uy * 16), (c[0] + px * 5, c[1] + py * 5), (c[0] - ux * 4, c[1] - uy * 4),
                     (c[0] - px * 5, c[1] - py * 5)], rgba(w["gem"]))
            cv.circle((c[0] + ux * 2, c[1] + uy * 2), 2.4, (255, 255, 255, 255), outline=False)
        # Collar where the head meets the shaft.
        cv.capsule((top[0] - ux * 6 + px * 4, top[1] - uy * 6 + py * 4),
                   (top[0] - ux * 6 - px * 4, top[1] - uy * 6 - py * 4), 3, metal)

    return [(120, "weapon", draw)]


# --------------------------------------------------------------------------- render


def _mask(im, test):
    return im.point(lambda v: 255 if test(v) else 0)


def split_parts(im):
    """Split a marker-coloured supersampled layer into fixed/main/trim/gem images."""
    r, g, b, a = im.split()
    grey = _mask(ImageChops.lighter(ImageChops.difference(r, g), ImageChops.difference(g, b)), lambda v: v == 0)
    zero_g, zero_r = _mask(g, lambda v: v == 0), _mask(r, lambda v: v == 0)
    trim = ImageChops.multiply(ImageChops.multiply(zero_g, _mask(ImageChops.difference(r, b), lambda v: v == 0)),
                               _mask(r, lambda v: v > 0))
    gem = ImageChops.multiply(ImageChops.multiply(zero_r, _mask(ImageChops.difference(g, b), lambda v: v == 0)),
                              _mask(g, lambda v: v > 0))
    tinted = ImageChops.lighter(ImageChops.lighter(grey, trim), gem)
    parts = {
        "fixed": Image.merge("RGBA", (r, g, b, ImageChops.multiply(a, ImageChops.invert(tinted)))),
        "main": Image.merge("RGBA", (r, g, b, ImageChops.multiply(a, grey))),
        "trim": Image.merge("RGBA", (r, r, r, ImageChops.multiply(a, trim))),
        "gem": Image.merge("RGBA", (g, g, g, ImageChops.multiply(a, gem))),
    }
    return parts


def render(pieces, p, split=()):
    """Render pieces into one image per layer, cut where a lower layer must show on top.

    Layers named in `split` come back as {part: image} for tinting."""
    rank = {name: i for i, name in enumerate(LAYERS)}
    drawn = []
    for z, layer, fn in sorted(pieces, key=lambda x: x[0]):
        cv = Canvas(p["rot"], p["dx"], p["dy"])
        fn(cv)
        drawn.append((z, layer, cv.im))
    layers = {}
    for z, layer, im in drawn:
        occluders = [o for oz, ol, o in drawn if oz > z and rank[ol] < rank[layer]]
        if occluders:
            cover = occluders[0].getchannel("A")
            for o in occluders[1:]:
                cover = ImageChops.lighter(cover, o.getchannel("A"))
            alpha = ImageChops.multiply(im.getchannel("A"), ImageChops.invert(cover))
            im = im.copy()
            im.putalpha(alpha)
        if layer in layers:
            layers[layer].alpha_composite(im)
        else:
            layers[layer] = im
    out = {}
    for k, v in layers.items():
        if k in split:
            out[k] = {part: im.resize(CELL, Image.LANCZOS) for part, im in split_parts(v).items()}
        else:
            out[k] = v.resize(CELL, Image.LANCZOS)
    return out


def write_clip(folder, action, frames, durations, loop, hit_frame, sockets=None):
    folder.mkdir(parents=True, exist_ok=True)
    cols = min(8, len(frames))
    atlas = Image.new("RGBA", (CELL[0] * cols, CELL[1] * math.ceil(len(frames) / cols)))
    for i, f in enumerate(frames):
        atlas.paste(f, ((i % cols) * CELL[0], (i // cols) * CELL[1]))
    page = f"{action}-atlas-00.webp"
    atlas.save(folder / page, "WEBP", quality=90, method=5)
    for old in folder.glob("*-atlas-00.png"):
        old.unlink()
    events = [{"name": "hit", "atMs": sum(durations[:hit_frame]), "frame": hit_frame}] if hit_frame is not None else []
    manifest = {
        "schemaVersion": "3.0", "name": action, "artSource": "codeart layered (tools/sprite-rig/layered_rig.py)",
        "sourceSize": list(CELL), "sourceAnchor": [float(ANCHOR[0]), float(ANCHOR[1])],
        "frameCount": len(frames), "durationsMs": durations, "durationSeconds": sum(durations) / 1000,
        "fps": round(1000 * len(frames) / sum(durations), 3), "loop": loop, "bodyHeightPx": 140,
        "events": events, "sampling": "linear",
        **({"sockets": sockets} if sockets else {}),
        "fallback": {"type": "png-atlas", "cellSize": list(CELL),
                     "pages": [{"file": page, "firstFrame": 0, "frameCount": len(frames), "columns": cols}]},
    }
    (folder / "animation.json").write_text(json.dumps(manifest, indent=2) + "\n")


def export(job, gender, sheet=None):
    name = f"{job}-{gender}"
    base = ROOT / name
    acts = rig.actions("mage")  # staff-caster poses
    makers = {"outfit": outfit_pieces, "head": head_pieces}
    tinted = [("outfit", k) for k in OUTFITS] + [("head", k) for k in HEADS]
    parts_used = {"outfit": {}, "head": {}}
    preview_rows = []
    for action, (poses, durations, loop, hit_frame) in acts.items():
        body, hand, sockets = [], [], []
        weapons = {k: [] for k in WEAPONS}
        looks = {c: {part: [] for part in PARTS} for c in tinted}
        for p in poses:
            s = skeleton(gender, p)
            bodies = body_pieces(gender, p, s)
            body.append(render(bodies, p)["body"])
            sockets.append(hand_socket(s, p))
            # The front hand alone, drawn over the weapon picture.
            hand.append(render([pc for pc in bodies if pc[0] == 130], p)["body"])
            for look in WEAPONS:
                layers = render(bodies + weapon_pieces(look, gender, p, s), p)
                weapons[look].append(layers.get("weapon") or Image.new("RGBA", CELL))
            # Each look on top of the body so the cut-outs are right.
            for slot, look in tinted:
                layers = render(bodies + makers[slot](look, gender, p, s, marked=True), p, split=(slot,))
                for part in PARTS:
                    looks[(slot, look)][part].append((layers.get(slot) or {}).get(part) or Image.new("RGBA", CELL))
        write_clip(base / "body" / action, action, body, durations, loop, hit_frame, {"hand": sockets})
        write_clip(base / "hand" / action, action, hand, durations, loop, hit_frame)
        for look, frames in weapons.items():
            write_clip(base / "weapon" / look / action, action, frames, durations, loop, hit_frame)
        for (slot, look), parts in looks.items():
            for part, frames in parts.items():
                if not any(f.getbbox() for f in frames):
                    continue
                parts_used[slot].setdefault(look, set()).add(part)
                write_clip(base / slot / look / part / action, action, frames, durations, loop, hit_frame)
        if sheet:
            row = []
            for i in range(len(poses)):
                im = body[i].copy()
                for slot, look in (("outfit", "robe-3"), ("head", "hood")):
                    for part in PARTS:
                        im.alpha_composite(looks[(slot, look)][part][i])
                im.alpha_composite(weapons["staff-3"][i])
                row.append(im)
            preview_rows.append(row)
    # Portrait: idle frame 0 in tier-3 gear, head and shoulders.
    p0 = acts["idle"][0][0]
    s0 = skeleton(gender, p0)
    full = Image.new("RGBA", (CELL[0] * SS, CELL[1] * SS))
    stack = body_pieces(gender, p0, s0) + outfit_pieces("robe-3", gender, p0, s0) + \
        head_pieces("mitre", gender, p0, s0) + weapon_pieces("staff-3", gender, p0, s0)
    for z, layer, fn in sorted(stack, key=lambda x: x[0]):
        cv = Canvas(p0["rot"], p0["dx"], p0["dy"])
        fn(cv)
        full.alpha_composite(cv.im)
    full = full.resize(CELL, Image.LANCZOS)
    box = full.getbbox()
    cx = (box[0] + box[2]) // 2
    top = box[1]
    size = 150
    portrait = full.crop((cx - size // 2, top, cx + size // 2, top + size)).resize((221, 221), Image.LANCZOS)
    portrait.save(base / "portrait.webp", "WEBP", quality=92)
    if sheet:
        w = max(len(r) for r in preview_rows)
        im = Image.new("RGBA", (CELL[0] * w, CELL[1] * len(preview_rows)), (40, 52, 70, 255))
        for y, r in enumerate(preview_rows):
            for x, f in enumerate(r):
                im.alpha_composite(f, (x * CELL[0], y * CELL[1]))
        im.save(sheet)
    entry = {
        "dir": name, "height": 112, "facing": 1, "portrait": "portrait.webp",
        "source": "codeart layered (tools/sprite-rig/layered_rig.py)",
        "actions": ACTION_FOLDERS,
        "layers": {
            "order": ["outfit", "head", "weapon"],
            "looks": {"outfit": list(OUTFITS), "head": list(HEADS), "weapon": list(WEAPONS)},
            # Tint parts per look; weapon looks have none (drawn as is).
            "parts": {slot: {look: [p for p in PARTS if p in used] for look, used in looks.items()}
                      for slot, looks in parts_used.items()},
            "hand": "hand",
            # Default tints for a hero with no armour (the plain robe).
            "tints": {"main": "#ece4d2", "trim": "#96704a", "gem": "#6ebeff"},
        },
    }
    return name, entry


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sets", nargs="*", help="e.g. priest-male; default: priest male and female")
    ap.add_argument("--sheet", help="contact sheet PNG of the first set in tier-3 gear")
    args = ap.parse_args()
    wanted = args.sets or ["priest-male", "priest-female"]
    index_path = ROOT / "index.json"
    index = json.loads(index_path.read_text())
    for n, name in enumerate(wanted):
        job, gender = name.split("-")
        key, entry = export(job, gender, sheet=args.sheet if n == 0 else None)
        index["sets"][key] = entry
        print("wrote", key)
    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
