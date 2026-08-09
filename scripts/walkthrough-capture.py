#!/usr/bin/env python3
"""
Help Centre walkthrough capture runner.

Drives the real LMS in a headless browser and screenshots each verified step of a
tutorial flow. It never invents UI: every step declares a target that must exist on
the page, and the run fails (status "needs_review") if a target cannot be found.

Usage:
    python3 scripts/walkthrough-capture.py flows/logging-in.json --out /tmp/walkthrough

Flow file shape:
{
  "tutorial_id": "uuid",
  "slug": "logging-in",
  "base_url": "http://localhost:8080",
  "auth": "none" | "session",          # "session" restores the injected preview session
  "steps": [
    {"step": 1, "label": "Open the academy link", "action": "goto", "route": "/login"},
    {"step": 2, "label": "Choose Email & Password", "action": "click", "target": "Email & Password", "by": "text"},
    {"step": 3, "label": "Press Sign In", "action": "verify", "target": "Sign In", "by": "role:button"}
  ]
}

Actions: goto | click | verify | wait
Selector kinds ("by"): text | role:button | role:tab | role:link | testid | css
Every click/verify step records the target's centre as a click hotspot so the player
can highlight it.
"""
import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright


def locator_for(page, target: str, by: str):
    if by == "text":
        return page.get_by_text(target, exact=False).first
    if by.startswith("role:"):
        return page.get_by_role(by.split(":", 1)[1], name=target).first
    if by == "testid":
        return page.get_by_test_id(target).first
    if by == "css":
        return page.locator(target).first
    raise ValueError(f"Unknown selector kind: {by}")


async def restore_session(context, page, base_url: str) -> bool:
    """Restores the preview Supabase session when the harness injected one."""
    cookies = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cookies:
        await context.add_cookies([{**c, "url": base_url} for c in json.loads(cookies)])
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if not (key and session):
        return bool(cookies)
    await page.goto(base_url, wait_until="domcontentloaded")
    await page.evaluate(
        f"localStorage.setItem({json.dumps(key)}, {json.dumps(session)})"
    )
    return True


async def run(flow: dict, out_dir: Path) -> dict:
    base_url = flow.get("base_url", "http://localhost:8080")
    out_dir.mkdir(parents=True, exist_ok=True)
    frames, problems = [], []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        if flow.get("auth") == "session":
            ok = await restore_session(context, page, base_url)
            if not ok:
                await browser.close()
                return {
                    "status": "needs_review",
                    "frames": [],
                    "problems": [
                        "No preview session available — sign in to the preview so an "
                        "authenticated capture can run."
                    ],
                }

        for step in flow["steps"]:
            label = step["label"]
            action = step.get("action", "verify")
            hotspot = None
            try:
                if action == "goto" or step.get("route"):
                    await page.goto(base_url + step["route"], wait_until="domcontentloaded")
                    await page.wait_for_timeout(step.get("settle_ms", 2500))

                if action == "wait":
                    await page.wait_for_timeout(step.get("settle_ms", 1500))

                if step.get("target"):
                    loc = locator_for(page, step["target"], step.get("by", "text"))
                    await loc.wait_for(state="visible", timeout=step.get("timeout_ms", 8000))
                    box = await loc.bounding_box()
                    size = page.viewport_size
                    if box and size:
                        hotspot = {
                            "x": round((box["x"] + box["width"] / 2) / size["width"], 4),
                            "y": round((box["y"] + box["height"] / 2) / size["height"], 4),
                        }
            except Exception as exc:  # target missing => do not guess, flag it
                problems.append(f"Step {step['step']} ({label}): {type(exc).__name__} {exc}"[:300])
                continue

            shot = out_dir / f"step-{step['step']:02d}.png"
            await page.screenshot(path=str(shot))
            frames.append(
                {
                    "step": step["step"],
                    "label": label,
                    "route": step.get("route"),
                    "path": f"{flow['slug']}/step-{step['step']:02d}.png",
                    "local": str(shot),
                    "hotspot": hotspot,
                }
            )

            # Perform the click only after capturing the "before" state.
            if action == "click" and step.get("target"):
                try:
                    await locator_for(page, step["target"], step.get("by", "text")).click()
                    await page.wait_for_timeout(step.get("settle_ms", 2000))
                except Exception as exc:
                    problems.append(f"Step {step['step']} click failed: {exc}"[:200])

        await browser.close()

    status = "ready" if frames and not problems else ("needs_review" if frames else "failed")
    return {"status": status, "frames": frames, "problems": problems}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("flow")
    parser.add_argument("--out", default="/tmp/walkthrough")
    args = parser.parse_args()

    flow = json.loads(Path(args.flow).read_text())
    out_dir = Path(args.out) / flow["slug"]
    result = asyncio.run(run(flow, out_dir))
    result["tutorial_id"] = flow["tutorial_id"]
    result["slug"] = flow["slug"]
    (out_dir / "manifest.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "ready" else 1


if __name__ == "__main__":
    sys.exit(main())
