# Zoom in-app join: current failure diagnosis (read-only)

## Verdict

The Meeting SDK credentials are fine. The join fails only for **host (teacher) role 1**, because the signature function cannot mint the host **ZAK** and returns HTTP **409 `{"error":"ZAK_UNAVAILABLE"}`**. The browser turns that into the generic "Edge Function returned a non-2xx status code" text in the fallback modal.

Do not recopy the Meeting SDK Client ID/Secret — they are proven working (see evidence).

## Evidence captured just now (live, deployed code)

Called the deployed `zoom-meeting-signature` with a real user token, account `50ff8351…` (saniya.aqt, `credential_status = verified`), meeting number `8640987589`:

```text
role 1 (teacher/host)  -> HTTP 409  {"error":"ZAK_UNAVAILABLE"}
role 0 (attendee)      -> HTTP 200  { signature: "<jwt>", zak: null }
```

So:
- Signature/JWT generation works (200 with a valid JWT for the same account and meeting number).
- Meeting SDK Client ID/Secret are present and used successfully (21-char ID, 32-char secret on that row).
- The only failing branch is `mintZak()` inside `zoom-meeting-signature`, which returns `null` on any failure and triggers the 409.

## Answers to the 10 questions

1. **Modal owner:** `src/hooks/useInAppZoomJoin.tsx` — the `sdk.failed` block. It is triggered by `onFailure` from `src/components/classroom/ZoomSdkMeeting.tsx`. Callers with role 1: `StartClassButton.tsx`, `LaunchClassCard.tsx`, `LiveClasses.tsx` (teacher).
2. **Failing function:** `zoom-meeting-signature` (not `zoom-join-class`; that one returned `sdkReady: true` and the modal only opens after it succeeds).
3. **Exact response:** `409` with body `{"error":"ZAK_UNAVAILABLE"}`.
4. **Failing branch:** `mintZak()`. It performs two calls: (a) S2S OAuth token at `zoom.us/oauth/token`, (b) `GET api.zoom.us/v2/users/{zoom_user_id}/token?type=zak`. It swallows both statuses and returns `null`, so Zoom's real status/error is currently invisible. Because this same account's S2S credentials already passed host lookup (`credential_status = verified`, `credential_error = null`, validated 2026-08-31), step (a) is very likely fine and step (b) is the failure — the ZAK endpoint needs its own scope (`user:read:token:admin` / `user_zak:read:admin`, classic `user:read:admin` + ZAK permission) that the account-validation check does not exercise. This is strongly indicated but not yet proven, because the function logs nothing.
5. **Credential acceptance:** Meeting SDK pair is accepted (JWT signed and returned; role 0 join path works). S2S pair for the same account is valid for user lookup; whether it carries the ZAK scope is exactly what the missing log line would prove. Separately, `shazia.aqt` (`bd4131c8…`) is still `credential_status = failed` with stored error: missing `user:read:user:admin` scope — that account's S2S app is genuinely under-scoped.
6. **Role / meeting / linkage:** role sent was `1` (teacher host path). Meeting number `8640987589` matches the `meeting_link` stored on account `50ff8351…`; the most recent `live_sessions` row (21:45 UTC, teacher `e3dbe31c…`) carries that same `zoom_account_id`. Linkage is correct.
7. **Origin of the message:** the signature function's 409. `supabase.functions.invoke` returns `data = null` for non-2xx, so `ZoomSdkMeeting`'s friendly "cannot host in-app classes yet" branch never fires and the raw client error string surfaces instead.
8. **Logs:** `zoom-meeting-signature` logs contain only `booted` lines — the function has zero `console` output, so no failed request detail exists. Diagnosis came from a live call against the deployed function.
9. **SDK version:** `@zoom/meetingsdk` **6.2.0** installed. Join params used (`signature`, `meetingNumber`, `password`, `tk`, `zak`, `userName`, `userEmail`) match the 6.x embedded client contract; the JWT payload (`appKey`/`sdkKey`, `mn`, `role`, `iat`, `exp`, `tokenExp`) also matches 6.x. No version mismatch.

## Minimum fix (10) — for a later build session, nothing changed yet

1. **Surface the real Zoom error.** In `mintZak`, capture the HTTP status and Zoom's `code`/`message` for both the OAuth and ZAK calls, `console.error` them, and return them in the 409 body as `detail` (no secret values). One teacher click then proves scope-vs-token in the logs.
2. **Stop masking the reason in the UI.** `supabase.functions.invoke` drops the body on non-2xx — read `error.context.json()` (or switch to a direct `fetch`) in `ZoomSdkMeeting.tsx` so `ZAK_UNAVAILABLE` shows its intended message instead of "non-2xx status code".
3. **Then the one-line real fix, driven by step 1's evidence:** if the ZAK call returns a scope error, add the ZAK scope (`user:read:token:admin`, granular) to that account's S2S app and reactivate it — no credential recopying involved. Re-run the same two curl probes to confirm role 1 returns 200 with a `zak`.
4. **Optional resilience:** when ZAK is unavailable, return 200 with `signature` and `zakUnavailable: true` so the teacher gets the "join in the Zoom app" fallback directly rather than an error-shaped failure.
