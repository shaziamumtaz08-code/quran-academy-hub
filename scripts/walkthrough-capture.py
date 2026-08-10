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
    if by == "text_last":
        # Dropdown options render above content that repeats the same label;
        # the last match is the one inside the open listbox.
        return page.get_by_text(target, exact=False).last
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


# --------------------------------------------------------------------------
# Capture-account authentication (no service-role, no backdoor)
#
# The runner signs in with ordinary Supabase email/password auth using a
# dedicated academy-owned capture account. Credentials are read ONLY from
# environment secrets (CAPTURE_ACCOUNT_EMAIL / CAPTURE_ACCOUNT_PASSWORD) and
# are never written to disk, logs, screenshots or flow files.
#
# When a flow declares "impersonate_email", the runner then goes through the
# EXISTING audited impersonate-user edge function (super_admin/admin only,
# writes user_activity_log) and lands on /impersonate, exactly like the admin
# UI does. RLS and role checks stay fully in force.
# --------------------------------------------------------------------------

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY", "")


def _post(path: str, body: dict, token: str | None = None) -> tuple[int, dict]:
    import urllib.error
    import urllib.request

    req = urllib.request.Request(
        f"{SUPABASE_URL}{path}",
        data=json.dumps(body).encode(),
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {token or SUPABASE_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}


def capture_sign_in(flow: dict | None = None) -> tuple[dict | None, str]:
    """Password sign-in as the capture/demo account. Returns (session, message).

    Least-privilege default: each flow names the demo account it captures
    (`capture_email`, a non-sensitive value kept in the flow file) and they all
    share one password held in the CAPTURE_ACCOUNT_PASSWORD secret. No admin
    identity and no impersonation is needed in that mode.
    """
    email = ((flow or {}).get("capture_email") or os.environ.get("CAPTURE_ACCOUNT_EMAIL", "")).strip()

    password = os.environ.get("CAPTURE_ACCOUNT_PASSWORD", "")
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None, "Supabase env vars missing in the capture environment."
    if not (email and password):
        return None, (
            "Capture credentials not configured. Set the flow's capture_email "
            "(or CAPTURE_ACCOUNT_EMAIL) and add CAPTURE_ACCOUNT_PASSWORD in "
            "Project Settings, Secrets."
        )
    status, data = _post("/auth/v1/token?grant_type=password", {"email": email, "password": password})
    if status != 200 or not data.get("access_token"):
        return None, f"Capture account sign-in refused (HTTP {status}). Check the stored credentials."
    return data, "signed in"


def impersonate(session: dict, target_email: str, expect_role: str | None) -> tuple[str | None, str]:
    """Uses the audited impersonate-user function. Fails closed on any problem."""
    token = session["access_token"]
    # Resolve the target profile through PostgREST under the capture account's
    # own RLS — no service-role, no elevated access.
    import urllib.parse
    import urllib.request

    q = urllib.parse.urlencode({"select": "id,full_name", "email": f"eq.{target_email}", "limit": "1"})
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/profiles?{q}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            rows = json.loads(r.read() or b"[]")
    except Exception as exc:
        return None, f"Could not resolve demo identity {target_email}: {exc}"
    if not rows:
        return None, f"Demo identity {target_email} not found — refusing to capture."
    target_id = rows[0]["id"]

    if expect_role:
        q = urllib.parse.urlencode({"select": "role", "user_id": f"eq.{target_id}"})
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/user_roles?{q}",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"},
        )
        try:
            with urllib.request.urlopen(req) as r:
                roles = [x["role"] for x in json.loads(r.read() or b"[]")]
        except Exception as exc:
            return None, f"Could not verify role for {target_email}: {exc}"
        if expect_role not in roles:
            return None, f"{target_email} does not hold the {expect_role} role — refusing to capture."

    status, data = _post(
        "/functions/v1/impersonate-user",
        {"targetUserId": target_id, "redirectTo": "http://localhost:8080/impersonate"},
        token,
    )
    if status != 200 or not data.get("tokenHash"):
        return None, f"Impersonation refused for {target_email} (HTTP {status})."
    return data["tokenHash"], "ok"


async def capture_auth(page, base_url: str, flow: dict) -> tuple[bool, str]:
    """Signs in through the app's own login form (no storage injection, no
    service role) so the session is created exactly like a real user's."""
    email = (flow.get("capture_email") or os.environ.get("CAPTURE_ACCOUNT_EMAIL", "")).strip()
    password = os.environ.get("CAPTURE_ACCOUNT_PASSWORD", "")
    if not (email and password):
        return False, (
            "Capture credentials not configured. Set the flow's capture_email and "
            "add CAPTURE_ACCOUNT_PASSWORD in Project Settings, Secrets."
        )

    await page.goto(f"{base_url}/login", wait_until="domcontentloaded")
    try:
        await page.get_by_label("Email Address").fill(email)
        await page.get_by_label("Password").fill(password)
        await page.get_by_role("button", name="Sign In").click()
        await page.wait_for_timeout(9000)
    except Exception as exc:
        return False, f"Login form interaction failed: {exc}"
    if "/login" in page.url:
        return False, f"Sign-in as {email} did not complete."

    target = flow.get("impersonate_email")
    if not target:
        return True, f"signed in as {email}"

    session, msg = capture_sign_in(flow)
    if not session:
        return False, msg
    token_hash, imsg = impersonate(session, target, flow.get("expect_role"))
    if not token_hash:
        return False, imsg
    await page.goto(
        f"{base_url}/impersonate?impersonate=1&th={token_hash}&next=/dashboard",
        wait_until="domcontentloaded",
    )
    await page.wait_for_timeout(6000)
    if "/impersonate" in page.url:
        return False, f"Impersonated session for {target} did not start."
    return True, f"impersonating {target}"


async def run(flow: dict, out_dir: Path) -> dict:
    base_url = flow.get("base_url", "http://localhost:8080")
    out_dir.mkdir(parents=True, exist_ok=True)
    frames, problems, skipped = [], [], []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            timezone_id="Asia/Karachi",
        )
        page = await context.new_page()

        if flow.get("auth") == "capture":
            ok, msg = await capture_auth(page, base_url, flow)
            print(f"[auth] {msg}")
            if not ok:
                await browser.close()
                return {"status": "needs_review", "frames": [], "problems": [msg]}

        elif flow.get("auth") == "session":
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
                # Steps marked "optional" describe UI that only appears when the
                # account has the underlying data (an invoice, a scheduled class).
                # They are recorded as skipped, never faked, and never block the run.
                if step.get("optional"):
                    skipped.append(
                        f"Step {step['step']} ({label}) skipped — "
                        f"{step.get('optional_note', 'the screen state was not present on the demo account.')}"
                    )
                else:
                    problems.append(f"Step {step['step']} ({label}): {type(exc).__name__} {exc}"[:300])
                continue

            shot = out_dir / f"step-{step['step']:02d}.png"
            await page.screenshot(path=str(shot))
            frames.append(
                {
                    "step": step["step"],
                    "label": label,
                    "label_ur": step.get("label_ur"),
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
    return {"status": status, "frames": frames, "problems": problems, "skipped": skipped}


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
