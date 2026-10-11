#!/usr/bin/env python3
"""Resize one image per stdin line to a small WebP thumbnail."""
import base64
import io
import json
import sys

from PIL import Image

Image.MAX_IMAGE_PIXELS = 40_000_000


def thumb(data):
    image = Image.open(io.BytesIO(data))
    image.seek(0)
    if getattr(image, "is_animated", False):
        image.seek(0)
    bands = image.getbands()
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in bands else "RGB")
    image.thumbnail((240, 240), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    image.save(out, "WEBP", quality=62, method=4)
    return out.getvalue()


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    job = json.loads(line)
    try:
        webp = thumb(base64.b64decode(job["b64"]))
        sys.stdout.write(json.dumps({"id": job["id"], "ok": True, "b64": base64.b64encode(webp).decode("ascii")}) + "\n")
    except Exception as err:
        sys.stdout.write(json.dumps({"id": job["id"], "ok": False, "error": str(err)[:180]}) + "\n")
    sys.stdout.flush()
