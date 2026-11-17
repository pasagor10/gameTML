"""Code-drawn chibi hero sprite sets, no image-generation API needed.

Each hero is a 2D skeleton (hips, knees, shoulders, elbows, head) with
painted parts layered on top. Poses are keyframed per action, rendered at 4x
and downsampled for clean anti-aliasing, then written in Agent Sprite Forge's
animation.json 3.0 layout (PNG atlas fallback) so public/sprite-sets.js can
play them.

    python3 tools/sprite-rig/hero_rig.py                     # all heroes
    python3 tools/sprite-rig/hero_rig.py archer-male --sheet /tmp/sheet.png
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

SS = 4  # supersampling factor
CELL = (240, 200)  # output cell in source px (wide enough for the death fall)
ANCHOR = (120, 190)  # feet root inside the cell
OUTLINE = (42, 29, 26, 255)
SKIN = (255, 221, 196, 255)
SKIN_SHADE = (240, 188, 160, 255)
ROOT = Path(__file__).resolve().parents[2] / "public" / "assets" / "sprites"

# --------------------------------------------------------------------------- looks

LOOKS = {
    "archer": dict(
        tunic=(63, 143, 90), trim=(47, 179, 160), pants=(107, 74, 47), boots=(74, 50, 34),
        cape=(42, 127, 120), accent=(232, 194, 106), weapon="bow", skirt=0.35,
    ),
    "mage": dict(
        tunic=(91, 63, 168), trim=(159, 211, 255), pants=(60, 45, 110), boots=(52, 40, 80),
        cape=(54, 40, 120), accent=(232, 194, 106), weapon="staff", skirt=0.95, hat=True,
    ),
    "swordsman": dict(
        tunic=(200, 58, 58), trim=(217, 221, 230), pants=(70, 52, 48), boots=(60, 44, 40),
        cape=(150, 34, 44), accent=(232, 194, 106), weapon="sword", skirt=0.4, armor=True,
    ),
}
HAIR = {
    ("archer", "male"): (92, 60, 34), ("archer", "female"): (201, 139, 75),
    ("mage", "male"): (44, 62, 122), ("mage", "female"): (186, 168, 255),
    ("swordsman", "male"): (58, 42, 32), ("swordsman", "female"): (232, 211, 138),
}

# Skeleton lengths (source px).
THIGH, SHIN, TORSO, NECK, HEAD_R, UPPER, FORE = 19, 19, 32, 3, 31, 15, 14


def rgba(c, a=255):
    return (*c[:3], a)


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)


# --------------------------------------------------------------------------- geometry


def limb_end(p, ang, length):
    """Angle 0 points down, positive swings toward the front (+x)."""
    return (p[0] + math.sin(ang) * length, p[1] + math.cos(ang) * length)


class Canvas:
    """Draws in rig space (root at 0,0, y down) with a whole-body transform."""

    def __init__(self, rot=0.0, dx=0.0, dy=0.0):
        self.im = Image.new("RGBA", (CELL[0] * SS, CELL[1] * SS), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.rot, self.dx, self.dy = rot, dx, dy

    def tx(self, p):
        x, y = p
        c, s = math.cos(self.rot), math.sin(self.rot)
        x, y = x * c - y * s, x * s + y * c
        return ((ANCHOR[0] + x + self.dx) * SS, (ANCHOR[1] + y + self.dy) * SS)

    def poly(self, pts, fill, outline=True, width=1.6):
        q = [self.tx(p) for p in pts]
        if outline:
            self.d.line(q + [q[0]], fill=OUTLINE, width=int(width * 2 * SS), joint="curve")
            for p in q:
                r = width * SS
                self.d.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=OUTLINE)
        self.d.polygon(q, fill=fill)

    def circle(self, c, r, fill, outline=True, width=1.6):
        x, y = self.tx(c)
        if outline:
            R = (r + width) * SS
            self.d.ellipse((x - R, y - R, x + R, y + R), fill=OUTLINE)
        R = r * SS
        self.d.ellipse((x - R, y - R, x + R, y + R), fill=fill)

    def capsule(self, a, b, w, fill, outline=True):
        A, B = self.tx(a), self.tx(b)
        if outline:
            ow = (w + 3.2) * SS
            self.d.line([A, B], fill=OUTLINE, width=int(ow))
            for P in (A, B):
                r = ow / 2
                self.d.ellipse((P[0] - r, P[1] - r, P[0] + r, P[1] + r), fill=OUTLINE)
        self.d.line([A, B], fill=fill, width=int(w * SS))
        for P in (A, B):
            r = w * SS / 2
            self.d.ellipse((P[0] - r, P[1] - r, P[0] + r, P[1] + r), fill=fill)

    def line(self, a, b, w, fill):
        self.d.line([self.tx(a), self.tx(b)], fill=fill, width=max(1, int(w * SS)))

    def blend(self, draw_fn):
        """Draw translucent shapes on their own layer and composite them.

        ImageDraw writes RGBA values as-is, so drawing alpha < 255 directly
        would punch see-through holes in whatever is underneath.
        """
        layer = Canvas(self.rot, self.dx, self.dy)
        draw_fn(layer)
        self.im.alpha_composite(layer.im)

    def done(self):
        return self.im.resize(CELL, Image.LANCZOS)


# --------------------------------------------------------------------------- poses

BASE = dict(
    dx=0.0, dy=0.0, rot=0.0, lean=0.0, tilt=0.0,
    hipF=0.10, kneeF=0.05, hipB=-0.10, kneeB=0.05,
    shF=0.25, elF=0.35, shB=-0.15, elB=0.25,
    draw=0.0, arrow=False, wave=0.0, weapon=0.0, eyes="open", glow=0.0,
)


def pose(**kw):
    p = dict(BASE)
    p.update(kw)
    return p


def lerp_pose(a, b, t):
    out = {}
    for k, v in a.items():
        out[k] = v + (b[k] - v) * t if isinstance(v, float) else (a[k] if t < 0.5 else b[k])
    return out


def keyframes(keys, n, loop):
    """Sample n frames from [(t, pose)] keys on [0, 1]."""
    frames = []
    for i in range(n):
        t = i / n if loop else (i / (n - 1) if n > 1 else 0)
        for (t0, p0), (t1, p1) in zip(keys, keys[1:]):
            if t0 <= t <= t1:
                u = (t - t0) / max(1e-6, t1 - t0)
                u = u * u * (3 - 2 * u)  # smoothstep
                frames.append(lerp_pose(p0, p1, u))
                break
        else:
            frames.append(dict(keys[-1][1]))
    return frames


def cycle(n, fn):
    return [fn(i / n * 2 * math.pi) for i in range(n)]


def actions(job):
    """Per-action frame poses, durations, loop flag and hit frame."""
    acts = {}
    acts["idle"] = (
        cycle(6, lambda a: pose(dy=math.sin(a) * 1.2, shF=0.22 + math.sin(a) * 0.04,
                                shB=-0.12 - math.sin(a) * 0.04, wave=math.sin(a), tilt=math.sin(a) * 0.02)),
        [150] * 6, True, None,
    )
    acts["walk"] = (
        cycle(8, lambda a: pose(
            dy=-abs(math.sin(a)) * 2.5, hipF=math.sin(a) * 0.5, hipB=-math.sin(a) * 0.5,
            kneeF=0.15 + max(0, -math.sin(a)) * 0.6, kneeB=0.15 + max(0, math.sin(a)) * 0.6,
            shF=-math.sin(a) * 0.45, shB=math.sin(a) * 0.45, elF=0.4, elB=0.4,
            lean=0.05, wave=math.sin(a * 2))),
        [100] * 8, True, None,
    )
    acts["run"] = (
        cycle(8, lambda a: pose(
            dy=-abs(math.sin(a)) * 5 + 1, hipF=math.sin(a) * 0.6, hipB=-math.sin(a) * 0.6,
            kneeF=0.35 + max(0, -math.sin(a)) * 1.3, kneeB=0.35 + max(0, math.sin(a)) * 1.3,
            shF=-math.sin(a) * 0.8, shB=math.sin(a) * 0.8, elF=1.2, elB=1.2,
            lean=0.22, wave=math.sin(a * 2) * 1.5)),
        [75] * 8, True, None,
    )
    acts["jump"] = (
        [pose(dy=-2, hipF=0.6, kneeF=1.1, hipB=-0.3, kneeB=0.7, shF=1.3, shB=2.2, elF=0.2, elB=0.2, lean=0.1, wave=1),
         pose(dy=-2, hipF=0.4, kneeF=0.9, hipB=0.1, kneeB=1.1, shF=1.1, shB=1.4, elF=0.4, elB=0.4, lean=0.05, wave=0.5),
         pose(hipF=0.2, kneeF=0.4, hipB=-0.2, kneeB=0.5, shF=1.0, shB=-0.9, elF=0.5, elB=0.5, wave=-0.5),
         pose(dy=3, hipF=0.5, kneeF=1.0, hipB=-0.4, kneeB=1.0, shF=0.6, shB=-0.6, elF=0.6, elB=0.6, lean=0.15, wave=-1)],
        [100] * 4, False, None,
    )
    if job == "archer":
        ready = pose(shF=1.45, elF=0.12, shB=1.2, elB=-1.6, lean=-0.02, draw=0.15, arrow=True)
        full = pose(shF=1.55, elF=0.05, shB=1.0, elB=-2.5, lean=-0.06, draw=1.0, arrow=True, tilt=0.03)
        loose = pose(shF=1.55, elF=0.05, shB=0.4, elB=-2.0, lean=0.04, draw=0.0, arrow=False)
        acts["attack"] = (keyframes([(0, pose()), (0.3, ready), (0.55, full), (0.62, loose), (1, pose(shF=0.6, shB=0.2))], 6, False),
                          [60, 60, 70, 70, 90, 100], False, 3)
        sk = dict(full, shF=1.85, tilt=-0.12, glow=1.0)
        acts["skill"] = (keyframes([(0, pose()), (0.25, dict(ready, shF=1.85, glow=0.5)), (0.6, sk),
                                    (0.68, dict(loose, shF=1.85, glow=0.0)), (1, pose(shF=0.6))], 7, False),
                         [60, 70, 80, 90, 70, 90, 110], False, 4)
    elif job == "mage":
        raise_ = pose(shF=2.6, elF=0.2, shB=1.4, elB=0.6, lean=-0.1, glow=0.6, weapon=-0.3)
        thrust = pose(shF=1.6, elF=0.05, shB=-0.6, elB=0.4, lean=0.14, glow=1.0, weapon=0.6)
        acts["attack"] = (keyframes([(0, pose()), (0.4, raise_), (0.6, thrust), (1, pose())], 6, False),
                          [60, 70, 70, 80, 90, 100], False, 3)
        acts["skill"] = (keyframes([(0, pose()), (0.35, dict(raise_, shB=2.6, elB=0.2, glow=1.0)),
                                    (0.6, dict(thrust, glow=1.0)), (1, pose())], 7, False),
                         [70, 80, 80, 80, 80, 90, 110], False, 4)
    else:
        wind = pose(shF=2.8, elF=0.6, shB=2.4, elB=0.8, lean=-0.12, weapon=-0.4, hipF=0.3, hipB=-0.4)
        slash = pose(shF=1.0, elF=0.1, shB=0.6, elB=0.3, lean=0.22, weapon=0.9, hipF=0.6, kneeF=0.5, hipB=-0.6)
        acts["attack"] = (keyframes([(0, pose()), (0.35, wind), (0.55, slash), (1, pose(shF=0.5))], 6, False),
                          [60, 70, 60, 80, 90, 100], False, 3)
        acts["skill"] = (keyframes([(0, pose()), (0.3, dict(wind, glow=0.8)), (0.55, dict(slash, glow=1.0, weapon=1.4)),
                                    (1, pose())], 7, False),
                         [60, 70, 80, 70, 80, 90, 110], False, 3)
    acts["hurt"] = (
        [pose(lean=-0.25, tilt=-0.15, dx=-3, shF=0.9, shB=0.8, elF=0.9, elB=0.9, eyes="hurt"),
         pose(lean=-0.18, tilt=-0.1, dx=-2, shF=0.6, shB=0.5, eyes="hurt"),
         pose(lean=-0.05, dx=-1)],
        [80, 90, 110], False, None,
    )
    fall = [pose(lean=-0.2, tilt=-0.15, eyes="hurt", shF=0.9, shB=0.9),
            pose(rot=-0.35, dx=2, lean=-0.1, kneeF=0.6, kneeB=0.6, shF=1.6, shB=1.4, eyes="closed"),
            pose(rot=-0.9, dx=8, dy=-2, kneeF=0.4, kneeB=0.4, shF=2.2, shB=1.8, eyes="closed"),
            pose(rot=-1.4, dx=20, dy=-6, shF=2.6, shB=2.4, eyes="closed"),
            pose(rot=-1.5, dx=24, dy=-8, shF=2.8, shB=2.6, eyes="closed"),
            pose(rot=-1.52, dx=25, dy=-8, shF=2.9, shB=2.7, eyes="closed")]
    acts["death"] = (fall, [80, 90, 90, 100, 120, 200], False, None)
    return acts


# --------------------------------------------------------------------------- drawing


def draw_hero(job, gender, p):
    look, hair = LOOKS[job], HAIR[(job, gender)]
    fem = gender == "female"
    cv = Canvas(p["rot"], p["dx"], p["dy"])
    hip = (0.0, -(THIGH + SHIN) - 2)
    top = (hip[0] + math.sin(p["lean"]) * TORSO, hip[1] - math.cos(p["lean"]) * TORSO)
    neck = (top[0] + math.sin(p["lean"]) * NECK, top[1] - math.cos(p["lean"]) * NECK)
    head_c = (neck[0] + 4 + math.sin(p["lean"] + p["tilt"]) * HEAD_R * 0.9,
              neck[1] - math.cos(p["lean"] + p["tilt"]) * HEAD_R * 0.92)
    shoulder_f = (top[0] + 4, top[1] + 4)
    shoulder_b = (top[0] - 3, top[1] + 3)

    def leg(hip_ang, knee, front):
        h = (hip[0] + (2 if front else -2), hip[1])
        k = limb_end(h, hip_ang, THIGH)
        f = limb_end(k, hip_ang - knee, SHIN)
        col = rgba(look["pants"]) if front else shade(look["pants"], 0.8)
        cv.capsule(h, k, 9.5, col)
        cv.capsule(k, f, 8.5, col)
        boot = rgba(look["boots"]) if front else shade(look["boots"], 0.8)
        cv.capsule((f[0] - 1, f[1] - 3), (f[0] + 6, f[1] + 1), 8, boot)
        return f

    def arm(sh, ang, elbow, front):
        e = limb_end(sh, ang, UPPER)
        h = limb_end(e, ang + elbow, FORE)
        sleeve = rgba(look["tunic"]) if front else shade(look["tunic"], 0.78)
        cv.capsule(sh, e, 8.5, sleeve)
        cv.capsule(e, h, 7.5, SKIN if front else SKIN_SHADE)
        cv.circle(h, 4.2, SKIN if front else SKIN_SHADE)
        return e, h

    wave = p["wave"]
    # cape (behind everything)
    cape = rgba(look["cape"])
    cv.poly([(top[0] - 6, top[1] + 2), (top[0] + 3, top[1] + 1),
             (hip[0] - 10 + wave * 2, hip[1] + 18), (hip[0] - 22 + wave * 4, hip[1] + 12)], shade(cape, 0.85))

    # female ponytail behind the head
    if fem:
        sway = wave * 3
        tail = [(head_c[0] - 18, head_c[1] - 14), (head_c[0] - 30 + sway, head_c[1] + 8),
                (head_c[0] - 34 + sway * 1.5, head_c[1] + 30), (head_c[0] - 22 + sway, head_c[1] + 14),
                (head_c[0] - 10, head_c[1] - 2)]
        cv.poly(tail, rgba(hair))

    _, hand_b = arm(shoulder_b, p["shB"], p["elB"], False)
    leg(p["hipB"], p["kneeB"], False)

    # torso + skirt
    lean = p["lean"]
    def tpt(x, y):  # torso-local (x right, y up from hip)
        return (hip[0] + x * math.cos(lean) + y * math.sin(lean), hip[1] + x * math.sin(lean) - y * math.cos(lean))
    w_top, w_hip = (12 if fem else 14), (11 if fem else 12)
    body = [tpt(-w_hip, 2), tpt(w_hip, 2), tpt(w_top, TORSO - 2), tpt(-w_top + 2, TORSO)]
    cv.poly(body, rgba(look["tunic"]))
    if look.get("armor"):
        cv.poly([tpt(-9, 10), tpt(11, 10), tpt(12, TORSO - 4), tpt(-8, TORSO - 2)], rgba(look["trim"]))
        cv.line(tpt(1, 12), tpt(2, TORSO - 5), 1.4, rgba(look["accent"]))
    else:
        cv.line(tpt(3, TORSO - 3), tpt(1, 4), 2.2, rgba(look["trim"]))
    skirt_len = 6 + look["skirt"] * (THIGH + SHIN - 6)
    flare = 4 + look["skirt"] * 8
    sk = [tpt(-w_hip - 1, 4), tpt(w_hip + 1, 4), tpt(w_hip + flare + wave, -skirt_len), tpt(-w_hip - flare + wave, -skirt_len)]
    cv.poly(sk, shade(look["tunic"], 0.9))
    cv.line(tpt(-w_hip - flare + wave + 1, -skirt_len + 1.5), tpt(w_hip + flare + wave - 1, -skirt_len + 1.5), 2.4, rgba(look["trim"]))
    cv.capsule(tpt(-w_hip, 4), tpt(w_hip, 4), 4, shade(look["pants"], 0.7))  # belt
    cv.circle(tpt(2, 4), 2.6, rgba(look["accent"]))

    leg(p["hipF"], p["kneeF"], True)
    if look.get("armor"):
        cv.circle((shoulder_f[0], shoulder_f[1] + 1), 7, rgba(look["trim"]))

    # head
    hc = head_c
    cv.circle(hc, HEAD_R * 0.86, SKIN)
    hair_c = rgba(hair)
    cv.poly([(hc[0] - 27, hc[1] + 4), (hc[0] - 26, hc[1] - 14), (hc[0] - 14, hc[1] - 26), (hc[0] + 4, hc[1] - 29),
             (hc[0] + 20, hc[1] - 22), (hc[0] + 27, hc[1] - 8), (hc[0] + 16, hc[1] - 12), (hc[0] + 6, hc[1] - 6),
             (hc[0] - 2, hc[1] - 12), (hc[0] - 10, hc[1] - 4), (hc[0] - 16, hc[1] + 10)], hair_c)
    if not fem:
        cv.poly([(hc[0] - 6, hc[1] - 26), (hc[0] + 2, hc[1] - 36), (hc[0] + 8, hc[1] - 26)], hair_c)
    else:
        cv.poly([(hc[0] - 22, hc[1] - 4), (hc[0] - 16, hc[1] + 20), (hc[0] - 10, hc[1] + 4)], hair_c)
    # face (3/4 view toward +x)
    ey = hc[1] + 3
    for ex, sc in ((hc[0] + 13, 1.0), (hc[0] - 1, 0.8)):
        if p["eyes"] == "open":
            cv.circle((ex, ey), 4.2 * sc, OUTLINE, outline=False)
            cv.circle((ex, ey + 0.8), 3.0 * sc, (60, 110, 160, 255), outline=False)
            cv.circle((ex + 1.2, ey - 1.6), 1.3 * sc, (255, 255, 255, 255), outline=False)
            if fem:
                cv.line((ex - 4 * sc, ey - 4.5), (ex + 4.5 * sc, ey - 5.5), 1.4, OUTLINE)
        elif p["eyes"] == "hurt":
            cv.line((ex - 3, ey - 3), (ex + 3, ey), 1.6, OUTLINE)
            cv.line((ex + 3, ey), (ex - 3, ey + 3), 1.6, OUTLINE)
        else:
            cv.line((ex - 3.5, ey + 1), (ex + 3.5, ey + 1), 1.6, OUTLINE)
    cv.blend(lambda l: l.circle((hc[0] + 16, hc[1] + 11), 3, (255, 160, 160, 140), outline=False))
    cv.line((hc[0] + 8, hc[1] + 14), (hc[0] + 12, hc[1] + 14.5), 1.4, OUTLINE)
    if look.get("hat"):
        hat = rgba(look["tunic"])
        cv.poly([(hc[0] - 30, hc[1] - 12), (hc[0] + 28, hc[1] - 16), (hc[0] + 6, hc[1] - 22),
                 (hc[0] - 14 + wave * 2, hc[1] - 52), (hc[0] - 12, hc[1] - 20)], hat)
        cv.line((hc[0] - 20, hc[1] - 18), (hc[0] + 16, hc[1] - 20), 2.6, rgba(look["accent"]))
    else:
        cv.line((hc[0] - 22, hc[1] - 15), (hc[0] + 20, hc[1] - 20), 2.6, rgba(look["trim"]))

    # front arm + weapon
    elbow_f, hand_f = arm(shoulder_f, p["shF"], p["elF"], True)
    aim = math.atan2(hand_f[1] - elbow_f[1], hand_f[0] - elbow_f[0])
    aiming = p["draw"] > 0.05 or p["arrow"] or p["shF"] > 1.3
    if w_bow := (look["weapon"] == "bow"):
        # Held upright at rest; follows the forearm only while aiming.
        aim = aim if aiming else 0.0
    w = look["weapon"]
    if w == "bow":
        ux, uy = math.cos(aim), math.sin(aim)
        px, py = -uy, ux
        H, C = 30, 10
        tips = [(hand_f[0] + px * s * H - ux * C, hand_f[1] + py * s * H - uy * C) for s in (-1, 1)]
        bow = [(hand_f[0] + px * s * H - ux * C * s * s + ux * 3 * (1 - s * s),
                hand_f[1] + py * s * H - uy * C * s * s + uy * 3 * (1 - s * s)) for s in [i / 6 - 1 for i in range(13)]]
        for a, b in zip(bow, bow[1:]):
            cv.capsule(a, b, 3.4, (138, 90, 43, 255))
        pull = hand_b if p["draw"] > 0.05 else ((tips[0][0] + tips[1][0]) / 2, (tips[0][1] + tips[1][1]) / 2)
        cv.line(tips[0], pull, 1.0, (240, 235, 220, 255))
        cv.line(pull, tips[1], 1.0, (240, 235, 220, 255))
        if p["arrow"]:
            tip = (hand_f[0] + ux * 14, hand_f[1] + uy * 14)
            cv.line(pull, tip, 1.8, (110, 72, 40, 255))
            cv.poly([(tip[0] + ux * 6, tip[1] + uy * 6), (tip[0] + px * 3, tip[1] + py * 3), (tip[0] - px * 3, tip[1] - py * 3)],
                    (210, 214, 224, 255), width=0.8)
            if p["glow"] > 0.05:
                cv.blend(lambda l: l.circle(tip, 6 + 6 * p["glow"], (140, 255, 200, int(110 * p["glow"])), outline=False))
        cv.circle(hand_f, 4.2, SKIN)
    elif w == "staff":
        ang = -math.pi / 2 + p["weapon"]
        # Long staff so the orb rides above the head instead of over the face.
        top_s = (hand_f[0] + 6 + math.cos(ang) * 78, hand_f[1] + math.sin(ang) * 78)
        bot = (hand_f[0] - math.cos(ang) * 16, hand_f[1] - math.sin(ang) * 16)
        cv.capsule(bot, top_s, 4, (107, 74, 47, 255))
        if p["glow"] > 0.05:
            cv.blend(lambda l: l.circle(top_s, 9 + 8 * p["glow"], (159, 232, 255, int(120 * p["glow"])), outline=False))
        cv.circle(top_s, 6.5, (159, 232, 255, 255))
        cv.circle((top_s[0] - 1.8, top_s[1] - 2), 2, (255, 255, 255, 255), outline=False)
        cv.circle(hand_f, 4.2, SKIN)
    else:
        ang = aim - 1.0 + p["weapon"]  # rests forward-down, swings with the arm
        tip = (hand_f[0] + math.cos(ang) * 46, hand_f[1] + math.sin(ang) * 46)
        guard = (math.cos(ang + math.pi / 2) * 8, math.sin(ang + math.pi / 2) * 8)
        cv.capsule(hand_f, tip, 6, (226, 232, 240, 255))
        cv.line((hand_f[0] + math.cos(ang) * 6, hand_f[1] + math.sin(ang) * 6), tip, 1.2, (255, 255, 255, 255))
        if p["glow"] > 0.05:
            cv.blend(lambda l: l.capsule(hand_f, tip, 14, (255, 200, 120, int(110 * p["glow"])), outline=False))
        gx, gy = hand_f[0] + math.cos(ang) * 3, hand_f[1] + math.sin(ang) * 3
        cv.capsule((gx - guard[0], gy - guard[1]), (gx + guard[0], gy + guard[1]), 3.5, rgba(look["accent"]))
        cv.circle(hand_f, 4.2, SKIN)
    return cv.done()


# --------------------------------------------------------------------------- export


def export_set(job, gender, out_root=ROOT, sheet=None):
    name = f"{job}-{gender}"
    folders = {}
    rows = []
    for action, (poses, durations, loop, hit_frame) in actions(job).items():
        frames = [draw_hero(job, gender, p) for p in poses]
        rows.append(frames)
        folder = out_root / name / action
        folder.mkdir(parents=True, exist_ok=True)
        cols = min(8, len(frames))
        atlas = Image.new("RGBA", (CELL[0] * cols, CELL[1] * math.ceil(len(frames) / cols)))
        for i, f in enumerate(frames):
            atlas.paste(f, ((i % cols) * CELL[0], (i // cols) * CELL[1]))
        page = f"{action}-atlas-00.png"
        atlas.save(folder / page, optimize=True)
        events = []
        if hit_frame is not None:
            events.append({"name": "hit", "atMs": sum(durations[:hit_frame]), "frame": hit_frame})
        manifest = {
            "schemaVersion": "3.0",
            "name": action,
            "artSource": "codeart",
            "sourceSize": list(CELL),
            "sourceAnchor": [float(ANCHOR[0]), float(ANCHOR[1])],
            "frameCount": len(frames),
            "durationsMs": durations,
            "durationSeconds": sum(durations) / 1000,
            "fps": round(1000 * len(frames) / sum(durations), 3),
            "loop": loop,
            "bodyHeightPx": 140,
            "events": events,
            "sampling": "linear",
            "fallback": {"type": "png-atlas", "cellSize": list(CELL),
                         "pages": [{"file": page, "firstFrame": 0, "frameCount": len(frames), "columns": cols}]},
        }
        (folder / "animation.json").write_text(json.dumps(manifest, indent=2) + "\n")
        folders[action] = action
    if sheet:
        w = max(len(r) for r in rows)
        im = Image.new("RGBA", (CELL[0] * w, CELL[1] * len(rows)), (40, 52, 70, 255))
        for y, r in enumerate(rows):
            for x, f in enumerate(r):
                im.alpha_composite(f, (x * CELL[0], y * CELL[1]))
        im.save(sheet)
    return name, {
        "dir": name, "height": 118, "facing": 1, "source": "codeart (tools/sprite-rig/hero_rig.py)",
        "actions": {"idle": "idle", "walk": "walk", "run": "run", "jump": "jump", "attack": "attack",
                    "skill": "skill", "hit": "hurt", "death": "death"},
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sets", nargs="*", help="e.g. archer-male; default: every class and gender")
    ap.add_argument("--sheet", help="write a contact sheet PNG (single set only)")
    ap.add_argument("--register", nargs="*", default=None,
                    help="sets to list in index.json (default: the ones generated)")
    args = ap.parse_args()
    wanted = args.sets or [f"{j}-{g}" for j in LOOKS for g in ("male", "female")]
    entries = {}
    for name in wanted:
        job, gender = name.split("-")
        key, entry = export_set(job, gender, sheet=args.sheet if len(wanted) == 1 else None)
        entries[key] = entry
        print("wrote", key)
    index_path = ROOT / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {"sets": {}}
    for key in (args.register if args.register is not None else entries):
        if key in entries:
            index["sets"][key] = entries[key]
    index_path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main()
