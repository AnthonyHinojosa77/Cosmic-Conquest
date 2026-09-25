"""Turn a ChatGPT-made PNG into game-ready WebP art.

Usage:
  python3 script/art/process.py character <in.png> <out.webp> [--height 900]
  python3 script/art/process.py scene     <in.png> <out.webp> [--width 1536]
  python3 script/art/process.py portrait  <in.png> <out.webp>

character: generated on a plain flat cream background; the background is
  cut out to transparency, trimmed and resized to at most --height. An input
  that already has a transparent background keeps its own alpha.
scene:     wide 3:2 art, only resized (never upscaled) and re-encoded.
portrait:  center-cropped to square and resized to 512x512.

Needs Python 3 with pillow (10+), numpy and scipy.
"""
import argparse
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps
from scipy import ndimage

# Enclosed background pockets (e.g. between an arm and the torso) are only
# removed when they are both big and very flat. Lower thresholds wrongly
# erased the white shine on the silver suit.
POCKET_MIN_PX = 4000
POCKET_MAX_MEAN_DIST = 6
BG_DIST = 30


def background_mask(rgb):
    a = np.asarray(rgb).astype(int)
    edge = np.concatenate([
        a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3),
        a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3),
    ])
    bg = np.median(edge, axis=0)  # plain cream background colour
    dist = np.sqrt(((a - bg) ** 2).sum(-1))
    lab, n = ndimage.label(dist < BG_DIST)
    border = np.setdiff1d(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]), [0])
    idx = np.arange(1, n + 1)
    sizes = np.bincount(lab.ravel(), minlength=n + 1)[1:]
    means = ndimage.mean(dist, lab, index=idx)
    pockets = idx[(sizes > POCKET_MIN_PX) & (means < POCKET_MAX_MEAN_DIST) & ~np.isin(idx, border)]
    return np.isin(lab, np.concatenate([border, pockets]))


def cutout(im, height=900):
    if im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info:
        rgba = im.convert("RGBA")
        if rgba.getchannel("A").getextrema()[0] < 255:
            return trim_and_size(rgba, height)  # already cut out
        im = rgba
    rgb = im.convert("RGB")
    bgmask = background_mask(rgb)
    if bgmask.mean() < 0.15:
        sys.exit("cutout: under 15% of the image looks like background; is it on a plain flat cream background?")
    fg = ndimage.binary_opening(~bgmask, iterations=1)
    # Pull the edge in 1px so the feathered rim sits on the ink outline,
    # not on the cream background (avoids a light halo on dark scenes).
    fg = ndimage.binary_erosion(fg, iterations=1)
    alpha = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    rgba = rgb.copy()
    rgba.putalpha(alpha)
    return trim_and_size(rgba, height)


def trim_and_size(rgba, height):
    rgba = rgba.crop(rgba.getchannel("A").getbbox())
    if rgba.height > height:  # never upscale
        rgba = rgba.resize((round(rgba.width * height / rgba.height), height), Image.LANCZOS)
    return rgba


def main():
    p = argparse.ArgumentParser(description="Process ChatGPT art for the game.")
    p.add_argument("kind", choices=["character", "scene", "portrait"])
    p.add_argument("src")
    p.add_argument("out")
    p.add_argument("--height", type=int, default=900, help="max character height in px")
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
        ImageOps.fit(im.convert("RGB"), (512, 512), Image.LANCZOS).save(args.out, "WEBP", quality=84)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
