"""Turn a ChatGPT-made PNG into game-ready WebP art.

Usage:
  python3 script/art/process.py character <in.png> <out.webp> [--height 900]
  python3 script/art/process.py scene     <in.png> <out.webp> [--width 1536]
  python3 script/art/process.py portrait  <in.png> <out.webp>

character: generated on a plain flat cream background; the background is
  cut out to transparency, trimmed and resized to a fixed height.
scene:     wide 3:2 art, only resized (never upscaled) and re-encoded.
portrait:  square, resized to 512x512.

Needs Python 3 with pillow, numpy and scipy.
"""
import argparse

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

# Enclosed background pockets (e.g. between an arm and the torso) are only
# removed when they are both big and very flat. Lower thresholds wrongly
# erased the white shine on the silver suit.
POCKET_MIN_PX = 4000
POCKET_MAX_MEAN_DIST = 6
BG_DIST = 30


def cutout(im, height=900):
    im = im.convert("RGB")
    a = np.asarray(im).astype(int)
    edge = np.concatenate([
        a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3),
        a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3),
    ])
    bg = np.median(edge, axis=0)  # plain cream background colour
    dist = np.sqrt(((a - bg) ** 2).sum(-1))
    lab, n = ndimage.label(dist < BG_DIST)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(border))
    idx = np.arange(1, n + 1)
    sizes = ndimage.sum(np.ones_like(lab), lab, index=idx)
    means = ndimage.mean(dist, lab, index=idx)
    for i, sz, m in zip(idx, sizes, means):
        if i not in border and sz > POCKET_MIN_PX and m < POCKET_MAX_MEAN_DIST:
            bgmask |= lab == i
    mask = ndimage.binary_opening(~bgmask, iterations=1)
    alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    rgba = im.copy()
    rgba.putalpha(alpha)
    rgba = rgba.crop(rgba.getbbox())
    w = int(rgba.width * height / rgba.height)
    return rgba.resize((w, height), Image.LANCZOS)


def main():
    p = argparse.ArgumentParser(description="Process ChatGPT art for the game.")
    p.add_argument("kind", choices=["character", "scene", "portrait"])
    p.add_argument("src")
    p.add_argument("out")
    p.add_argument("--height", type=int, default=900, help="character height in px")
    p.add_argument("--width", type=int, default=1536, help="max scene width in px")
    args = p.parse_args()

    im = Image.open(args.src)
    if args.kind == "character":
        cutout(im, args.height).save(args.out, "WEBP", quality=86)
    elif args.kind == "scene":
        im = im.convert("RGB")
        if im.width > args.width:
            im = im.resize((args.width, round(im.height * args.width / im.width)), Image.LANCZOS)
        im.save(args.out, "WEBP", quality=82)
    else:
        im.convert("RGB").resize((512, 512), Image.LANCZOS).save(args.out, "WEBP", quality=84)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
