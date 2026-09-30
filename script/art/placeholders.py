"""Make the tiny blurred stand-ins shown while scene art downloads.

Usage:
  python3 script/art/placeholders.py

For every scene, showdown backdrop and suspect portrait it writes a ~32px WebP
(inlined as a data URI) and the picture's average colour to
client/src/generated/placeholders.json, which the game bundles. The browser
shows the stand-in, blurred and scaled up, until the full picture has
downloaded and decoded, then fades the real art in over it.

Run it again after adding or replacing art (process.py doesn't call it).
Villain showdown cutouts never come through here: they live outside the public
folder (art/showdown/) because they give the culprit away, and this file ships
to the browser.

Needs Python 3 with pillow (10+).
"""
import base64
import io
import json
import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "client" / "public"
OUT = ROOT / "client" / "src" / "generated" / "placeholders.json"
LONG_SIDE = 32


def wanted(path: pathlib.Path) -> bool:
    name = path.stem
    if path.parent.name == "scenes":
        return True
    return (
        name in ("bounty-office-no-hero", "aurelia-gates")
        or name.startswith("showdown-")
        or name.startswith("suspect-")
    )


def placeholder(path: pathlib.Path) -> dict:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    scale = LONG_SIDE / max(w, h)
    tiny = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    buf = io.BytesIO()
    tiny.save(buf, "WEBP", quality=40, method=6)
    r, g, b = im.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    return {
        "src": "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode(),
        "color": f"#{r:02x}{g:02x}{b:02x}",
        "ratio": round(w / h, 4),
    }


def main():
    files = sorted(p for d in ("scenes", "game") for p in (PUBLIC / d).glob("*.webp") if wanted(p))
    data = {f"./{p.parent.name}/{p.name}": placeholder(p) for p in files}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    size = sum(len(v["src"]) for v in data.values())
    print(f"wrote {len(data)} placeholders ({size // 1024} KB of data URIs) to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
