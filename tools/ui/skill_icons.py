"""Draw the pixel-art skill, potion and auto icons for the action bar.

Each icon is drawn on a 20 x 20 true-pixel grid with plain (non-antialiased)
shapes, then gets a 1-pixel dark outline, and is saved 1:1 to
public/assets/ui/skills/<name>.webp. The game shows them nearest-sampled
(public/skill-icons.js), so every pixel stays square at any HUD size.

    python3 tools/ui/skill_icons.py

Only Pillow is required.
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[2] / "public/assets/ui/skills"
N = 20
INK = (26, 18, 48, 255)
C = {
    "w": (255, 246, 216), "g": (239, 195, 84), "G": (176, 124, 36), "y": (255, 224, 102),
    "s": (214, 222, 236), "S": (125, 138, 160), "b": (120, 74, 40), "r": (226, 58, 69),
    "R": (142, 31, 42), "o": (255, 140, 42), "B": (61, 127, 230), "c": (168, 216, 255),
    "n": (79, 202, 89), "N": (31, 138, 67), "p": (155, 93, 229), "P": (92, 52, 160),
    "k": (255, 170, 190),
}


def canvas():
    im = Image.new("RGBA", (N, N))
    return im, ImageDraw.Draw(im)


def col(k):
    return C[k] + (255,)


def outline(im):
    src = im.copy()
    a = src.getchannel("A").load()
    px = im.load()
    for y in range(N):
        for x in range(N):
            if a[x, y]:
                continue
            if any(0 <= x + dx < N and 0 <= y + dy < N and a[x + dx, y + dy] and src.getpixel((x + dx, y + dy)) != INK
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = INK
    return im


def line(d, pts, k, w=1):
    d.line(pts, fill=col(k), width=w)


def poly(d, pts, k):
    d.polygon(pts, fill=col(k))


def dot(d, x, y, k):
    d.point((x, y), fill=col(k))


def sword(d, x0=3, y0=16, length=12, blade="s", edge="w"):
    # Diagonal blade from the grip (bottom-left) up to the tip (top-right).
    for i in range(length):
        dot(d, x0 + 2 + i, y0 - 2 - i, blade)
        dot(d, x0 + 3 + i, y0 - 2 - i, edge if i < length - 1 else blade)
        dot(d, x0 + 2 + i, y0 - 1 - i, blade)
    line(d, [(x0, y0 - 3), (x0 + 3, y0)], "g")  # guard
    line(d, [(x0 + 1, y0 - 4), (x0 + 4, y0 - 1)], "G")
    line(d, [(x0 - 1, y0 + 2), (x0 + 1, y0)], "b")  # grip
    dot(d, x0 - 2, y0 + 3, "g")


def arrow(d, x0, y0, x1, y1, shaft="b", head="s", feather="r"):
    line(d, [(x0, y0), (x1, y1)], shaft)
    ang = math.atan2(y1 - y0, x1 - x0)
    for s in (-1, 1):
        a = ang + math.pi + s * 0.6
        line(d, [(x1, y1), (round(x1 + 3 * math.cos(a)), round(y1 + 3 * math.sin(a)))], head)
    dot(d, x1, y1, head)
    for s in (-1, 1):
        a = ang + math.pi + s * 0.9
        line(d, [(x0, y0), (round(x0 + 2 * math.cos(a)), round(y0 + 2 * math.sin(a)))], feather)


def ring(d, cx, cy, r, k, w=1):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col(k), width=w)


def disc(d, cx, cy, r, k):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col(k))


def star(d, cx, cy, r, k, inner=0.42, points=4):
    pts = []
    for i in range(points * 2):
        a = -math.pi / 2 + i * math.pi / points
        rr = r if i % 2 == 0 else r * inner
        pts.append((round(cx + rr * math.cos(a)), round(cy + rr * math.sin(a))))
    poly(d, pts, k)


def potion(liquid, light, mark):
    im, d = canvas()
    d.rectangle([7, 2, 12, 4], fill=col("b"))
    d.rectangle([8, 5, 11, 7], fill=col("s"))
    disc(d, 9.5, 12.5, 5.5, "s")
    disc(d, 9.5, 12.5, 4.5, liquid)
    d.rectangle([5, 9, 14, 10], fill=col("s"))
    d.rectangle([6, 9, 13, 10], fill=col(light))
    dot(d, 7, 11, "w")
    dot(d, 7, 12, "w")
    mark(d)
    return im


def draw():
    icons = {}
    # ---- swordsman
    im, d = canvas(); sword(d); icons["swordsman-0"] = im
    im, d = canvas()
    for i, k in enumerate("cww"):
        d.arc([2 + i, 1 + i, 18 - i, 17 - i], 200, 330, fill=col(k), width=1)
    sword(d, 3, 17, 8); icons["swordsman-1"] = im
    im, d = canvas(); sword(d, 3, 17, 11)
    for y in (5, 9, 13):
        line(d, [(11, y), (17, y - 3)], "r")
    icons["swordsman-2"] = im
    im2, d2 = canvas()  # crescent moon
    disc(d2, 9, 10, 7, "g"); disc(d2, 9, 10, 6, "y"); d2.ellipse([7, 1, 20, 14], fill=(0, 0, 0, 0))
    star(d2, 15, 14, 3, "w"); dot(d2, 4, 3, "w"); dot(d2, 16, 3, "c")
    icons["swordsman-3"] = im2
    im, d = canvas()
    poly(d, [(10, 1), (15, 7), (12, 7), (12, 12), (8, 12), (8, 7), (5, 7)], "r")
    poly(d, [(10, 3), (13, 7), (11, 7), (11, 11), (9, 11), (9, 7), (7, 7)], "o")
    poly(d, [(4, 13), (16, 13), (17, 18), (3, 18)], "g")
    line(d, [(4, 15), (16, 15)], "G")
    icons["swordsman-4"] = im
    # ---- archer
    im, d = canvas()
    d.arc([1, 2, 13, 18], 270, 90, fill=col("b"), width=2)
    line(d, [(7, 2), (7, 18)], "w")
    arrow(d, 4, 10, 17, 10); icons["archer-0"] = im
    im, d = canvas()
    for y, x0 in ((4, 2), (15, 4), (8, 1)):
        line(d, [(x0, y), (x0 + 6, y)], "n")
    arrow(d, 3, 12, 17, 6, head="n", feather="N")
    line(d, [(2, 12), (5, 12)], "c"); icons["archer-1"] = im
    im, d = canvas()
    arrow(d, 2, 14, 16, 4, head="p", feather="n")
    for x, y in ((14, 9), (15, 12), (13, 15)):
        dot(d, x, y, "n"); dot(d, x, y + 1, "N")
    disc(d, 16, 4, 1.5, "n"); icons["archer-2"] = im
    im, d = canvas()
    for x in (4, 10, 16):
        arrow(d, x - 2, 1 + (x % 4), x, 15 - (x % 4), head="s", feather="r")
    line(d, [(1, 18), (18, 18)], "S"); icons["archer-3"] = im
    im, d = canvas()
    ring(d, 10, 10, 8, "r"); ring(d, 10, 10, 5, "w"); disc(d, 10, 10, 2, "r")
    for a, b in (((10, 0), (10, 3)), ((10, 17), (10, 19)), ((0, 10), (3, 10)), ((17, 10), (19, 10))):
        line(d, [a, b], "g")
    icons["archer-4"] = im
    # ---- mage
    im, d = canvas()
    line(d, [(3, 18), (11, 9)], "b"); line(d, [(4, 18), (12, 9)], "G")
    star(d, 13, 7, 6, "c"); star(d, 13, 7, 3, "w"); icons["mage-0"] = im
    im, d = canvas()
    for i, k in enumerate("Rro"):
        line(d, [(2 + i, 17 - i * 2), (9, 10)], k, 2)
    disc(d, 12, 8, 6, "r"); disc(d, 12, 8, 4.5, "o"); disc(d, 13, 7, 2.5, "y"); dot(d, 13, 6, "w")
    icons["mage-1"] = im
    im, d = canvas()
    star(d, 10, 10, 9, "r", 0.5, 8); star(d, 10, 10, 6, "o", 0.5, 8); disc(d, 10, 10, 3, "y"); dot(d, 10, 10, "w")
    icons["mage-2"] = im
    im, d = canvas()
    for a in range(3):
        t = a * math.pi / 3
        x, y = 8 * math.cos(t), 8 * math.sin(t)
        line(d, [(round(10 - x), round(10 - y)), (round(10 + x), round(10 + y))], "c", 2)
    for a in range(6):
        t = a * math.pi / 3
        dot(d, round(10 + 8 * math.cos(t)), round(10 + 8 * math.sin(t)), "w")
    disc(d, 10, 10, 2, "w"); icons["mage-3"] = im
    im, d = canvas()
    hexa = [(round(10 + 9 * math.cos(math.pi / 6 + i * math.pi / 3)), round(10 + 9 * math.sin(math.pi / 6 + i * math.pi / 3))) for i in range(6)]
    poly(d, hexa, "P")
    inner = [(round(10 + 6 * math.cos(math.pi / 6 + i * math.pi / 3)), round(10 + 6 * math.sin(math.pi / 6 + i * math.pi / 3))) for i in range(6)]
    poly(d, inner, "p"); star(d, 10, 10, 3, "w"); icons["mage-4"] = im
    # ---- priest
    im, d = canvas()
    d.rectangle([8, 2, 11, 17], fill=col("g")); d.rectangle([3, 6, 16, 9], fill=col("g"))
    line(d, [(9, 3), (9, 16)], "y"); line(d, [(4, 7), (15, 7)], "y"); icons["priest-0"] = im
    im, d = canvas()
    for a in range(8):
        t = a * math.pi / 4
        line(d, [(round(10 + 6 * math.cos(t)), round(10 + 6 * math.sin(t))), (round(10 + 9 * math.cos(t)), round(10 + 9 * math.sin(t)))], "y")
    disc(d, 10, 10, 5, "g"); disc(d, 10, 10, 4, "y"); disc(d, 9, 9, 1.5, "w"); icons["priest-1"] = im
    im, d = canvas()
    disc(d, 6, 7, 4, "n"); disc(d, 13, 7, 4, "n"); poly(d, [(2, 8), (17, 8), (10, 17)], "n")
    disc(d, 6, 6, 1.5, "w")
    d.rectangle([9, 6, 10, 13], fill=col("w")); d.rectangle([6, 9, 13, 10], fill=col("w")); icons["priest-2"] = im
    im, d = canvas()
    ring(d, 10, 10, 8, "g", 2); ring(d, 10, 10, 3, "y")
    for a in range(8):
        t = a * math.pi / 4
        line(d, [(round(10 + 3 * math.cos(t)), round(10 + 3 * math.sin(t))), (round(10 + 7 * math.cos(t)), round(10 + 7 * math.sin(t)))], "y")
    dot(d, 10, 10, "w"); icons["priest-3"] = im
    im, d = canvas()
    d.ellipse([3, 1, 16, 6], outline=col("y"), width=1); d.ellipse([4, 2, 15, 5], outline=col("g"), width=1)
    star(d, 10, 13, 6, "w"); star(d, 10, 13, 3, "y"); dot(d, 3, 11, "y"); dot(d, 17, 15, "y")
    icons["priest-4"] = im
    # ---- shared
    def plus(d):
        d.rectangle([9, 10, 10, 15], fill=col("w")); d.rectangle([7, 12, 12, 13], fill=col("w"))

    def drop(d):
        poly(d, [(9, 10), (11, 13), (10, 15), (8, 15), (7, 13)], "w")

    icons["potion-hp"] = potion("r", "k", plus)
    icons["potion-mp"] = potion("B", "c", drop)
    im, d = canvas()
    d.arc([2, 2, 18, 18], 200, 340, fill=col("n"), width=2)
    d.arc([2, 2, 18, 18], 20, 160, fill=col("n"), width=2)
    poly(d, [(15, 2), (18, 7), (13, 7)], "n"); poly(d, [(5, 18), (2, 13), (7, 13)], "n")
    poly(d, [(8, 6), (14, 10), (8, 14)], "w"); icons["auto"] = im
    return icons


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, im in draw().items():
        outline(im).save(OUT / f"{name}.webp", "WEBP", lossless=True)
    print("wrote", len(list(OUT.glob("*.webp"))), "icons")


if __name__ == "__main__":
    main()
