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

FONT_REG = "/nix/store/0hdgmcjy7q8zn7h3amz8nf96l9qh7wv0-liberation-fonts-2.1.5/share/fonts/truetype/LiberationSans-Regular.ttf"
FONT_BOLD = "/nix/store/0hdgmcjy7q8zn7h3amz8nf96l9qh7wv0-liberation-fonts-2.1.5/share/fonts/truetype/LiberationSans-Bold.ttf"


def font(path: str, size: int):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


F_TITLE = font(FONT_BOLD, 52)
F_SUB = font(FONT_REG, 26)
F_STEP = font(FONT_BOLD, 22)
F_LABEL = font(FONT_REG, 26)


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
    lines = wrap(d, title, F_TITLE, W - 200)
    y = H // 2 - 60 - (len(lines) - 1) * 30
    for line in lines:
        d.text((100, y), line, font=F_TITLE, fill=TEXT)
        y += 62
    d.text((100, H // 2 + 120), f"A {total}-step walkthrough recorded from the live LMS",
           font=F_SUB, fill=MUTED)
    return img


def render(manifest: dict, title: str, out: Path) -> dict:
    frames = sorted(manifest["frames"], key=lambda f: f["step"])
    total = len(frames)
    tmp = Path(tempfile.mkdtemp(prefix="wt-render-"))
    n = 0

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
        secs = hold_seconds(f["label"])
        count = int(secs * FPS)
        for i in range(count):
            pulse = (i % FPS) / FPS
            img = compose(shot, f["step"], total, f["label"], f.get("hotspot"), pulse)
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
            frames[0]["label"], frames[0].get("hotspot"), 0.0).save(poster, quality=88)

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
    args = ap.parse_args()
    manifest = json.loads(Path(args.manifest).read_text())
    print(json.dumps(render(manifest, args.title, Path(args.out)), indent=2))


if __name__ == "__main__":
    main()
