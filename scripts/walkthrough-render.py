#!/usr/bin/env python3
"""
Render a captured Help Centre walkthrough into a shareable MP4.

Input is the manifest produced by scripts/walkthrough-capture.py (the same
frames/labels/hotspots stored on tutorial_videos.walkthrough_frames). Nothing is
invented: every frame in the video is a real captured screenshot, every caption
is the stored step label, and the highlight ring is drawn at the stored hotspot.

Usage:
    python3 scripts/walkthrough-render.py /tmp/walkthrough/logging-in/manifest.json \
        --title "Logging in to AQTA" --out /tmp/walkthrough/logging-in.mp4
"""
import argparse
import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 800
SHOT_H = 700           # area reserved for the screenshot
CAPTION_H = H - SHOT_H
FPS = 24
FADE_FRAMES = 8
TITLE_SECONDS = 2.5

BG = (12, 20, 34)
CAPTION_BG = (17, 28, 46)
ACCENT = (56, 189, 148)
TEXT = (240, 245, 250)
MUTED = (156, 172, 194)

import re
import urllib.request

LANG = "en"

FONT_REG = "/nix/store/0hdgmcjy7q8zn7h3amz8nf96l9qh7wv0-liberation-fonts-2.1.5/share/fonts/truetype/LiberationSans-Regular.ttf"
FONT_BOLD = "/nix/store/0hdgmcjy7q8zn7h3amz8nf96l9qh7wv0-liberation-fonts-2.1.5/share/fonts/truetype/LiberationSans-Bold.ttf"

# Urdu captions render in Jameel Noori Nastaleeq (the academy's Nastaliq face,
# already used across the app). Noto Naskh is only a fallback if the CDN copy
# cannot be fetched. Latin words and digits inside an Urdu caption are drawn
# with Liberation Sans, because the Urdu faces have no Latin glyphs and Pillow
# would otherwise paint tofu boxes.
NASTALIQ_POINTER = Path(__file__).resolve().parents[1] / "src/assets/fonts/Jameel-Noori-Nastaleeq-Regular.ttf.asset.json"
NASTALIQ_HOSTS = [
    "https://id-preview--205c6690-e8af-4742-9dce-ca0cd7736df2.lovable.app",
    "https://lms.alqurantimeacademy.com",
    "https://alqurantimeacademy.lovable.app",
]
NASTALIQ_CACHE = Path("/tmp/aqta-fonts/Jameel-Noori-Nastaleeq-Regular.ttf")
NASKH_FALLBACK = (
    "/nix/store/dg3hd9mqha517djbgpgnq8r4q1j1wn30-noto-fonts-2025.11.01/"
    "share/fonts/noto/NotoNaskhArabic[wght].ttf"
)


def urdu_font_path() -> str:
    if NASTALIQ_CACHE.exists() and NASTALIQ_CACHE.stat().st_size > 1_000_000:
        return str(NASTALIQ_CACHE)
    try:
        rel = json.loads(NASTALIQ_POINTER.read_text())["url"]
    except Exception:
        return NASKH_FALLBACK
    NASTALIQ_CACHE.parent.mkdir(parents=True, exist_ok=True)
    for host in NASTALIQ_HOSTS:
        try:
            urllib.request.urlretrieve(host + rel, NASTALIQ_CACHE)
            if NASTALIQ_CACHE.stat().st_size > 1_000_000:
                return str(NASTALIQ_CACHE)
        except Exception:
            continue
    return NASKH_FALLBACK



URDU_FONT = NASKH_FALLBACK  # replaced with the Nastaliq path for --lang ur


def font(path: str, size: int):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


F_TITLE = font(FONT_BOLD, 52)
F_SUB = font(FONT_REG, 26)
F_STEP = font(FONT_BOLD, 22)
F_LABEL = font(FONT_REG, 26)

# Latin companions for the Urdu faces, keyed by the Urdu font size.
LATIN_FOR = {}

ARABIC_CHARS = r"\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF"
RUN_SPLIT = re.compile(rf"([{ARABIC_CHARS}][{ARABIC_CHARS}\s\u060C\u061B\u061F.,]*)")


def shape(text: str) -> str:
    """Joined forms + visual RTL order for an all-Arabic-script chunk."""
    import arabic_reshaper
    from bidi.algorithm import get_display

    return get_display(arabic_reshaper.reshape(text))


def normalize_ur(text: str) -> str:
    return text.replace("—", "،").replace("–", "،").replace("/", " ، ")


def split_runs(text: str):
    """[(is_arabic, chunk)] in logical order."""
    out = []
    for part in RUN_SPLIT.split(normalize_ur(text)):
        if not part:
            continue
        is_ar = bool(re.match(rf"[{ARABIC_CHARS}]", part))
        out.append((is_ar, part))
    return out


def latin_font(ur_font):
    size = max(14, int(getattr(ur_font, "size", 26) * 0.72))
    if size not in LATIN_FOR:
        LATIN_FOR[size] = font(FONT_REG, size)
    return LATIN_FOR[size]


def mixed_width(d, text, ur_font) -> float:
    total = 0.0
    for is_ar, chunk in split_runs(text):
        f = ur_font if is_ar else latin_font(ur_font)
        total += d.textlength(shape(chunk) if is_ar else chunk, font=f)
    return total


def draw_mixed_rtl(d, right_x, y, text, ur_font, fill):
    """Draws a mixed Urdu/Latin line right-aligned, runs laid out RTL."""
    x = right_x
    for is_ar, chunk in split_runs(text):
        f = ur_font if is_ar else latin_font(ur_font)
        txt = shape(chunk) if is_ar else chunk
        w = d.textlength(txt, font=f)
        dy = 0 if is_ar else int(getattr(ur_font, "size", 26) * 0.18)
        d.text((x - w, y + dy), txt, font=f, fill=fill)
        x -= w
    return right_x - x


def wrap_mixed(d, text, ur_font, max_w):
    words, lines, cur = normalize_ur(text).split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if mixed_width(d, trial, ur_font) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# --- Urdu captions are rasterised by Chromium (proper Nastaliq shaping) ------
import sys as _sys

_sys.path.insert(0, str(Path(__file__).resolve().parent))
import urdu_text  # noqa: E402

UR_STRIPS: dict = {}


def _ur_item(text, size, color, weight, max_w):
    return {
        "text": text,
        "size": int(size),
        "color": color,
        "weight": str(weight),
        "max_w": int(max_w),
    }


def prewarm_ur(items):
    """Rasterise every Urdu caption up front in a single browser session."""
    urdu_text.FONT_FILE = Path(URDU_FONT)
    UR_STRIPS.update(urdu_text.render_strips(items))


def paste_ur(canvas, text, size, color, weight, right_x, y, max_w=None):
    item = _ur_item(text, size, color, weight, max_w or (W - 96))
    key = urdu_text._key(item["text"], item["size"], item["color"], item["max_w"], item["weight"])
    path = UR_STRIPS.get(key)
    if path is None or not Path(path).exists():
        UR_STRIPS.update(urdu_text.render_strips([item]))
        path = UR_STRIPS[key]
    strip = Image.open(path).convert("RGBA")
    canvas.paste(strip, (int(right_x - strip.width), int(y)), strip)




def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def hold_seconds(label: str) -> float:
    return round(min(7.0, max(3.5, 2.5 + len(label.split()) / 2.6)), 2)


def compose(shot_path: Path, step: int, total: int, label: str, hotspot, pulse: float):
    """One video frame: screenshot + caption bar + hotspot ring at `pulse` phase."""
    canvas = Image.new("RGB", (W, H), BG)
    shot = Image.open(shot_path).convert("RGB")
    scale = min(W / shot.width, SHOT_H / shot.height)
    sw, sh = int(shot.width * scale), int(shot.height * scale)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    ox, oy = (W - sw) // 2, (SHOT_H - sh) // 2
    canvas.paste(shot, (ox, oy))

    if hotspot:
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        cx = ox + hotspot["x"] * sw
        cy = oy + hotspot["y"] * sh
        base = 26
        for ring, phase in ((0, pulse), (1, (pulse + 0.5) % 1.0)):
            r = base + phase * 34
            alpha = int(200 * (1 - phase))
            od.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ACCENT + (alpha,), width=5)
        od.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], fill=ACCENT + (150,))
        canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")

    d = ImageDraw.Draw(canvas)
    d.rectangle([0, SHOT_H, W, H], fill=CAPTION_BG)
    d.rectangle([0, SHOT_H, W, SHOT_H + 3], fill=ACCENT)
    if LANG == "ur":
        paste_ur(canvas, f"مرحلہ {step} از {total}", 26, "#38bd94", 400, W - 48, SHOT_H + 12)
        paste_ur(canvas, label, 34, "#f0f5fa", 400, W - 48, SHOT_H + 46, max_w=W - 96)
    else:
        d.text((48, SHOT_H + 18), f"STEP {step} OF {total}", font=F_STEP, fill=ACCENT)
        lines = wrap(d, label, F_LABEL, W - 96)[:2]
        y = SHOT_H + 48
        for line in lines:
            d.text((48, y), line, font=F_LABEL, fill=TEXT)
            y += 32
    return canvas


def title_card(title: str, total: int):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, H // 2 + 90, W, H // 2 + 94], fill=ACCENT)
    if LANG == "ur":
        sub = f"لائیو ایل ایم ایس سے ریکارڈ کیا گیا {total} مرحلوں کا واک تھرو"
        paste_ur(img, title, 58, "#f0f5fa", 600, W - 100, H // 2 - 110, max_w=W - 200)
        paste_ur(img, sub, 30, "#9cacc2", 400, W - 100, H // 2 + 116, max_w=W - 200)
        return img
    sub = f"A {total}-step walkthrough recorded from the live LMS"
    lines = wrap(d, title, F_TITLE, W - 200)
    y = H // 2 - 60 - (len(lines) - 1) * 30
    for line in lines:
        d.text((100, y), line, font=F_TITLE, fill=TEXT)
        y += 62
    d.text((100, H // 2 + 120), sub, font=F_SUB, fill=MUTED)
    return img




def label_of(frame: dict) -> str:
    """Urdu renders use the step's own Urdu caption when the flow provides one."""
    if LANG == "ur" and frame.get("label_ur"):
        return frame["label_ur"]
    return frame["label"]


def render(manifest: dict, title: str, out: Path) -> dict:
    frames = sorted(manifest["frames"], key=lambda f: f["step"])
    total = len(frames)
    tmp = Path(tempfile.mkdtemp(prefix="wt-render-"))
    n = 0

    if LANG == "ur":
        items = [
            _ur_item(title, 58, "#f0f5fa", 600, W - 200),
            _ur_item(f"لائیو ایل ایم ایس سے ریکارڈ کیا گیا {total} مرحلوں کا واک تھرو", 30, "#9cacc2", 400, W - 200),
        ]
        for f in frames:
            items.append(_ur_item(f"مرحلہ {f['step']} از {total}", 26, "#38bd94", 400, W - 96))
            items.append(_ur_item(label_of(f), 34, "#f0f5fa", 400, W - 96))
        prewarm_ur(items)


    def emit(img):
        nonlocal n
        n += 1
        img.save(tmp / f"f{n:05d}.png")

    card = title_card(title, total)
    for i in range(int(TITLE_SECONDS * FPS)):
        emit(Image.blend(Image.new("RGB", (W, H), BG), card, min(1.0, i / 10)))

    prev_last = None
    for f in frames:
        shot = Path(f.get("local") or f["path"])
        secs = hold_seconds(label_of(f))
        count = int(secs * FPS)
        for i in range(count):
            pulse = (i % FPS) / FPS
            img = compose(shot, f["step"], total, label_of(f), f.get("hotspot"), pulse)
            if prev_last is not None and i < FADE_FRAMES:
                img = Image.blend(prev_last, img, (i + 1) / FADE_FRAMES)
            emit(img)
            if i == count - 1:
                prev_last = img

    for i in range(int(1.2 * FPS)):
        emit(Image.blend(prev_last, Image.new("RGB", (W, H), BG), min(1.0, i / (1.2 * FPS))))

    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-framerate", str(FPS), "-i", str(tmp / "f%05d.png"),
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[-2000:])

    poster = out.with_suffix(".jpg")
    compose(Path(frames[0].get("local") or frames[0]["path"]), frames[0]["step"], total,
            label_of(frames[0]), frames[0].get("hotspot"), 0.0).save(poster, quality=88)

    shutil.rmtree(tmp, ignore_errors=True)
    return {
        "mp4": str(out),
        "poster": str(poster),
        "frames": n,
        "duration_seconds": round(n / FPS, 2),
        "bytes": out.stat().st_size,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--title", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--lang", default="en", choices=["en", "ur"])
    args = ap.parse_args()
    global LANG, URDU_FONT, F_TITLE, F_SUB, F_STEP, F_LABEL, SHOT_H, CAPTION_H
    LANG = args.lang
    if LANG == "ur":
        URDU_FONT = urdu_font_path()
        # Nastaliq sits taller than Latin type, so the caption band grows.
        SHOT_H = 672
        CAPTION_H = H - SHOT_H
        F_TITLE = font(URDU_FONT, 54)
        F_SUB = font(URDU_FONT, 28)
        F_STEP = font(URDU_FONT, 24)
        F_LABEL = font(URDU_FONT, 32)


    manifest = json.loads(Path(args.manifest).read_text())
    print(json.dumps(render(manifest, args.title, Path(args.out)), indent=2))


if __name__ == "__main__":
    main()
