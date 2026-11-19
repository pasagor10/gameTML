"""Snap AI-drawn "pixel style" art to a true pixel grid.

Generated pixel art comes at high resolution: each art pixel is a block of
roughly p x p screen pixels, slightly off-grid and soft at the edges. This
finds p and the grid phase from the image's edge profile, then scales the art
down so one output pixel is one art pixel, with the magenta backdrop keyed
out, alpha made binary and the colours reduced.

  from pixel_snap import grid, snap
  p, ox, oy = grid(im)
  small = snap(im, p, ox, oy, colours=32)

Only Pillow is required.
"""
from __future__ import annotations

import cmath
import math

from PIL import Image, ImageChops


def is_key(p):
    r, g, b = p[0], p[1], p[2]
    return r > 150 and b > 150 and g < 0.55 * min(r, b)


def _profile(im: Image.Image, axis: int):
    g = im.convert("L")
    W, H = g.size
    if axis == 0:
        d = ImageChops.difference(g.crop((1, 0, W, H)), g.crop((0, 0, W - 1, H)))
        p = list(d.resize((W - 1, 1), Image.BOX).getdata())
    else:
        d = ImageChops.difference(g.crop((0, 1, W, H)), g.crop((0, 0, W, H - 1)))
        p = list(d.resize((1, H - 1), Image.BOX).getdata())
    k, n = 15, len(p)
    pre = [0.0]
    for v in p:
        pre.append(pre[-1] + v)
    out = []
    for i, v in enumerate(p):
        a, b = max(0, i - k), min(n, i + k + 1)
        out.append(v - (pre[b] - pre[a]) / (b - a))
    return out


def _spectrum(prof, p):
    return sum(v * cmath.exp(2j * math.pi * i / p) for i, v in enumerate(prof))


def grid(im: Image.Image, lo=3.0, hi=16.0, hint=None):
    """(p, ox, oy): art pixel size and the offset of the first cell edge.

    hint: roughly known pixel size (skips the search, refines around it)."""
    profs = [_profile(im, 0), _profile(im, 1)]

    def power(p):
        return sum(abs(_spectrum(pr, p)) for pr in profs)

    if hint:
        best = max((hint + 0.01 * j for j in range(-30, 31)), key=power)
        fine = [best + 0.002 * j for j in range(-10, 11)]
        p = max(fine, key=power)
        off = [(cmath.phase(_spectrum(pr, p)) / (2 * math.pi) * p + 0.5 + 1) % p for pr in profs]
        return p, off[0], off[1]
    steps = [lo + 0.05 * j for j in range(int((hi - lo) / 0.05) + 1)]
    best = max(steps, key=power)
    # A peak at p also shows at 2p (every other edge): prefer the finer grid
    # when it is nearly as strong.
    half = best / 2
    if half >= lo and power(half) > 0.6 * power(best):
        best = half
    fine = [best + 0.002 * j for j in range(-40, 41)]
    p = max(fine, key=power)
    # Edge profile index i is the step between pixels i and i + 1.
    off = [(cmath.phase(_spectrum(pr, p)) / (2 * math.pi) * p + 0.5 + 1) % p for pr in profs]
    return p, off[0], off[1]


def keyed(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            if is_key(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
    return rgba


def snap(im: Image.Image, p: float, ox: float = 0.0, oy: float = 0.0, alpha_cut=110) -> Image.Image:
    """True-pixel RGBA of `im` (keyed off magenta unless it already has alpha)."""
    rgba = im if im.mode == "RGBA" else keyed(im)
    W, H = rgba.size
    cols, rows = int((W - ox) // p), int((H - oy) // p)
    box = (ox, oy, ox + cols * p, oy + rows * p)
    small = rgba.convert("RGBa").resize((cols, rows), Image.Resampling.BOX, box=box).convert("RGBA")
    a = small.getchannel("A").point(lambda v: 255 if v >= alpha_cut else 0)
    small.putalpha(a)
    return small


def quantize(frames, colours=32):
    """One shared palette for a list of RGBA images (opaque pixels only)."""
    opaque = [px[:3] for f in frames for px in f.getdata() if px[3]]
    if not opaque:
        return frames
    side = math.ceil(math.sqrt(len(opaque)))
    sample = Image.new("RGB", (side, side))
    sample.putdata(opaque + [opaque[-1]] * (side * side - len(opaque)))
    pal = sample.quantize(colors=colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = []
    for f in frames:
        q = f.convert("RGB").quantize(palette=pal, dither=Image.Dither.NONE).convert("RGBA")
        q.putalpha(f.getchannel("A"))
        out.append(q)
    return out


def upscale(im: Image.Image, n: int) -> Image.Image:
    return im if n == 1 else im.resize((im.width * n, im.height * n), Image.NEAREST)
