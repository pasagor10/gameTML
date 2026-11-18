"""Painted-style priest staffs, drawn to sit with the painted Lanna priest.

A slim lacquered wooden shaft with gold fittings and a finial per gear tier,
shaded like the painted robes (warm gold, soft dark outline, light from the
upper left). The hand holds it a little below the middle, staff upright.

    staff_frame(look, palm, angle, place) -> RGBA image

`palm` is the gripping palm in rig space, `angle` the direction from the hand
to the tip (radians, y down, -pi/2 is straight up) and `place(point)` maps a
rig-space point to output pixels.
"""
from __future__ import annotations

import math

from PIL import Image, ImageDraw, ImageFilter

SS = 3  # supersampling for clean edges

GOLD = dict(dark=(104, 64, 22, 255), base=(206, 152, 62, 255), light=(250, 220, 140, 255))
WOOD = dict(dark=(58, 34, 20, 255), base=(118, 72, 40, 255), light=(178, 122, 74, 255))
LENGTH, BELOW = 92.0, 36.0  # rig px; hand grips BELOW px up from the foot

LOOKS = {
    # gem colour per tier; finial drawn by kind
    "staff-1": dict(kind="lotus", gem=None),
    "staff-2": dict(kind="ring", gem=(96, 176, 236)),
    "staff-3": dict(kind="sun", gem=(222, 70, 52)),
    "staff-4": dict(kind="flame", gem=(120, 226, 250)),
}


class Painter:
    def __init__(self, size, place, scale):
        self.size = (size[0] * SS, size[1] * SS)
        self.im = Image.new("RGBA", self.size)
        self.place, self.scale = place, scale * SS

    def pt(self, q):
        x, y = self.place(q)
        return (x * SS, y * SS)

    def shape(self, points, fill, outline=None, width=0.9):
        layer = Image.new("RGBA", self.size)
        d = ImageDraw.Draw(layer)
        pts = [self.pt(q) for q in points]
        if outline:
            d.line(pts + [pts[0]], fill=outline, width=max(1, round(width * self.scale)), joint="curve")
        d.polygon(pts, fill=fill)
        self.im.alpha_composite(layer)

    def gold(self, points, palette=GOLD, gem=None):
        """A gold piece: outline, base, and a lit inner sheen toward the upper left."""
        self.shape(points, palette["base"], palette["dark"])
        cx = sum(x for x, _ in points) / len(points)
        cy = sum(y for _, y in points) / len(points)
        span = max(math.dist((cx, cy), q) for q in points)
        sheen = [(cx + (x - cx) * 0.55 - span * 0.16, cy + (y - cy) * 0.55 - span * 0.16) for x, y in points]
        light = palette["light"][:3] + (150,)
        self.shape(sheen, light)

    def glow(self, centre, radius, colour):
        layer = Image.new("RGBA", self.size)
        x, y = self.pt(centre)
        r = radius * self.scale
        ImageDraw.Draw(layer).ellipse((x - r, y - r, x + r, y + r), fill=colour[:3] + (120,))
        self.im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(r * 0.45)))

    def gem(self, centre, radius, colour):
        self.glow(centre, radius * 2.2, colour)
        self.gold(circle(centre, radius + 1.0))
        dark = tuple(int(c * 0.55) for c in colour) + (255,)
        self.shape(circle(centre, radius), colour + (255,), dark, 0.6)
        self.shape(circle((centre[0] - radius * 0.35, centre[1] - radius * 0.35), radius * 0.38), (255, 255, 255, 210))

    def done(self, size):
        return self.im.resize(size, Image.Resampling.LANCZOS)


def circle(c, r, n=28):
    return [(c[0] + math.cos(k * 2 * math.pi / n) * r, c[1] + math.sin(k * 2 * math.pi / n) * r) for k in range(n)]


def staff_frame(look, palm, angle, place, size, scale, grip=None):
    """One frame of the staff for `look` (staff-1..4) gripped at `palm`.

    With `grip` (cuff, fist, radius, skin from painted_priest.grip_rig) a
    closed fist is painted around the shaft, growing out of the sleeve cuff."""
    spec = LOOKS[look]
    ux, uy = math.cos(angle), math.sin(angle)  # toward the tip
    nx, ny = -uy, ux                            # across the shaft

    def at(a, b=0.0):
        """a px along the staff from the palm (tip positive), b across it."""
        return (palm[0] + ux * a + nx * b, palm[1] + uy * a + ny * b)

    pen = Painter(size, place, scale)
    foot, top = -BELOW, LENGTH - BELOW
    # Shaft: dark edge, lacquered body, then a lit stripe on the upper-left side.
    side = 1 if nx < 0 else -1  # the across direction that faces up-left
    pen.shape([at(foot, -1.5), at(top, -1.2), at(top, 1.2), at(foot, 1.5)], WOOD["base"], WOOD["dark"], 0.8)
    pen.shape([at(foot + 2, side * 0.2), at(top - 2, side * 0.2), at(top - 2, side * 0.9), at(foot + 2, side * 1.0)], WOOD["light"][:3] + (170,))
    # Gold fittings: a pointed foot cap, a band above the grip, a collar under the finial.
    pen.gold([at(foot - 3.5), at(foot, -2.2), at(foot + 4, -2.0), at(foot + 4, 2.0), at(foot, 2.2)])
    for a in (7.0, top - 4.5):
        pen.gold([at(a, -2.3), at(a + 3.2, -2.3), at(a + 3.2, 2.3), at(a, 2.3)])
    pen.gold([at(top - 1.2, -3.2), at(top + 1.2, -2.0), at(top + 1.2, 2.0), at(top - 1.2, 3.2)])
    finial(pen, spec, at, top + 1.2)
    if grip:
        fist(pen, grip, (ux, uy), (nx, ny))
    return pen.done(size)


def fist(pen, grip, u, n):
    """A closed hand around the shaft: wrist from the cuff, four curled
    fingers stacked along the staff with their knuckles away from the arm,
    and the thumb wrapped over the top. Shaded in the painted hand's skin."""
    c, r, cuff = grip["fist"], grip["radius"], grip["cuff"]
    base = grip["skin"]
    tone = lambda k, a=255: tuple(max(0, min(255, round(v * k))) for v in base) + (a,)
    shade, dark, light = tone(0.8), tone(0.5), tuple(round(v + (255 - v) * 0.45) for v in base) + (170,)

    def at(a, b):
        return (c[0] + u[0] * a + n[0] * b, c[1] + u[1] * a + n[1] * b)

    # Which side of the staff the arm comes from; knuckles face the other way.
    side = 1 if (cuff[0] - c[0]) * n[0] + (cuff[1] - c[1]) * n[1] > 0 else -1
    # Wrist: from the cuff into the back of the fist.
    wx, wy = c[0] - cuff[0], c[1] - cuff[1]
    length = math.hypot(wx, wy) or 1
    px, py = -wy / length, wx / length
    w0, w1 = r * 0.55, r * 0.72
    back = at(0, side * r * 0.35)
    pen.shape([(cuff[0] + px * w0, cuff[1] + py * w0), (back[0] + px * w1, back[1] + py * w1),
               (back[0] - px * w1, back[1] - py * w1), (cuff[0] - px * w0, cuff[1] - py * w0)],
              tone(0.92), dark, 0.7)
    # Palm block behind the fingers.
    pen.shape([at(-r * 0.95, side * r * 1.0), at(r * 0.95, side * r * 1.0),
               at(r * 1.0, -side * r * 0.2), at(-r * 1.0, -side * r * 0.2)], shade, dark, 0.7)
    # Four curled fingers, top to bottom, rounded on the knuckle side.
    h = r * 1.9 / 4
    for i in range(4):
        a0 = r * 0.95 - i * h
        a1 = a0 - h * 1.05
        k = -side
        finger = [at(a0, side * r * 0.25), at(a0, k * r * 0.75), at(a0 - h * 0.15, k * r * 1.02),
                  at((a0 + a1) / 2, k * r * 1.12), at(a1 + h * 0.15, k * r * 1.02), at(a1, k * r * 0.75),
                  at(a1, side * r * 0.25)]
        pen.shape(finger, tone(1.0 - i * 0.04), dark, 0.6)
        pen.shape([at(a0 - h * 0.2, k * r * 0.2), at(a0 - h * 0.2, k * r * 0.85),
                   at(a0 - h * 0.45, k * r * 0.95), at(a0 - h * 0.45, k * r * 0.2)], light)
    # Thumb over the top of the fist, toward the arm side.
    pen.shape([at(r * 0.75, side * r * 0.75), at(r * 1.25, side * r * 0.2), at(r * 1.15, -side * r * 0.45),
               at(r * 0.7, -side * r * 0.5), at(r * 0.55, side * r * 0.1)], tone(0.97), dark, 0.6)


def finial(pen, spec, at, base):
    kind, gem = spec["kind"], spec["gem"]
    if kind == "lotus":
        # A closed lotus bud on a little cup of petals.
        for k in (-1, 1):
            pen.gold([at(base, 0), at(base + 2, k * 4.6), at(base + 6.5, k * 4.2), at(base + 4.5, k * 1.2)])
        pen.gold([at(base + 1, 0), at(base + 3, -3.6), at(base + 8, -3.4), at(base + 13, 0), at(base + 8, 3.4), at(base + 3, 3.6)])
    elif kind == "ring":
        # An open gold ring with a hanging gem, a small spire on top.
        c = at(base + 8.5)
        pen.gold(circle(c, 7.6))
        hole = Image.new("L", pen.size, 0)
        x, y = pen.pt(c)
        r = 5.0 * pen.scale
        ImageDraw.Draw(hole).ellipse((x - r, y - r, x + r, y + r), fill=255)
        pen.im.putalpha(Image.composite(Image.new("L", pen.size, 0), pen.im.getchannel("A"), hole))
        pen.gold([at(base + 15.5, -1.8), at(base + 21, 0), at(base + 15.5, 1.8)])
        pen.gem(at(base + 7.5), 2.6, gem)
    elif kind == "sun":
        # A rayed sun disc around a red gem.
        c = at(base + 9)
        rays = []
        for k in range(24):
            r = 11.5 if k % 2 == 0 else 7.0
            a = k * math.pi / 12
            rays.append((c[0] + math.cos(a) * r, c[1] + math.sin(a) * r))
        pen.gold(rays)
        pen.gold(circle(c, 6.2))
        pen.gem(c, 3.3, gem)
    else:
        # Lanna flame (kranok) wings rising to a tall tip, around a bright gem.
        c = at(base + 8)
        for k in (-1, 1):
            pen.gold([at(base, k * 1.5), at(base + 3, k * 10), at(base + 9, k * 14.5), at(base + 12, k * 12),
                      at(base + 10, k * 9), at(base + 17, k * 11.5), at(base + 15, k * 6), at(base + 9, k * 2.5)])
        pen.gold([at(base + 5, -3.5), at(base + 14, -4), at(base + 26, 0), at(base + 14, 4), at(base + 5, 3.5)])
        pen.gem(c, 3.4, gem)
