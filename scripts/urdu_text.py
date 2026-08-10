#!/usr/bin/env python3
"""
Urdu caption rasteriser for the Help Centre walkthrough renderer.

Pillow cannot shape Nastaliq (no Raqm/HarfBuzz in this environment), which is why
earlier Urdu videos fell back to Naskh and painted tofu boxes wherever a caption
mixed in an English word. Instead we let Chromium do the shaping: the caption is
laid out as real RTL HTML with the academy's Jameel Noori Nastaleeq webfont plus a
Latin fallback, then screenshotted as a transparent PNG strip and composited into
the video frame. Same engine the LMS itself uses, so the typography matches.
"""
from __future__ import annotations

import hashlib
import html
import json
from pathlib import Path

CACHE = Path("/tmp/aqta-urdu-strips")
FONT_FILE = Path("/tmp/aqta-fonts/Jameel-Noori-Nastaleeq-Regular.ttf")


def _font_src() -> str:
    """Data URL for the Nastaliq face so Chromium needs no network."""
    import base64

    data = base64.b64encode(FONT_FILE.read_bytes()).decode()
    return f"url(data:font/ttf;base64,{data}) format('truetype')"


def _key(text: str, size: int, color: str, max_w: int, weight: str) -> str:
    raw = json.dumps([text, size, color, max_w, weight], ensure_ascii=False)
    return hashlib.sha1(raw.encode()).hexdigest()[:20]


def render_strips(items: list[dict]) -> dict[str, Path]:
    """items: [{text, size, color, max_w, weight}] -> {cache_key: png path}.

    Only the items missing from the on-disk cache are rendered, so repeated
    renders of the same walkthrough cost nothing.
    """
    CACHE.mkdir(parents=True, exist_ok=True)
    out: dict[str, Path] = {}
    todo = []
    for it in items:
        k = _key(it["text"], it["size"], it["color"], it["max_w"], it.get("weight", "400"))
        p = CACHE / f"{k}.png"
        out[k] = p
        it["_key"] = k
        if not p.exists():
            todo.append(it)
    if not todo:
        return out

    blocks = "\n".join(
        f'<div class="cap" id="c{i}" style="font-size:{it["size"]}px;color:{it["color"]};'
        f'max-width:{it["max_w"]}px;font-weight:{it.get("weight", "400")}">'
        f'{html.escape(it["text"])}</div>'
        for i, it in enumerate(todo)
    )
    page_html = f"""<!doctype html><meta charset="utf-8">
<style>
  @font-face {{ font-family:'JameelUrdu'; src:{_font_src()}; }}
  html,body {{ margin:0; padding:0; background:transparent; }}
  .cap {{
    font-family:'JameelUrdu','Noto Naskh Arabic','Liberation Sans',sans-serif;
    direction:rtl; text-align:right; line-height:1.9;
    padding:6px 4px 14px; display:inline-block; white-space:normal;
  }}
</style>{blocks}"""

    tmp_html = CACHE / "_render.html"
    tmp_html.write_text(page_html, encoding="utf-8")

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.goto(tmp_html.as_uri())
        page.wait_for_timeout(600)
        for i, it in enumerate(todo):
            page.locator(f"#c{i}").screenshot(
                path=str(CACHE / f"{it['_key']}.png"), omit_background=True
            )
        browser.close()
    return out
