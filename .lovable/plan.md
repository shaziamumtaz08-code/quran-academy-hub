# Zoom Meeting SDK audit — "Signature is invalid" / class won't open in-app

No code changed. Findings below are based on reading the current implementation plus the stored Zoom account rows.

## What I inspected

- `supabase/functions/zoom-meeting-signature/index.ts` (JWT generation)
- `src/components/classroom/ZoomSdkMeeting.tsx` (SDK init + join)
- `src/hooks/useInAppZoomJoin.tsx`, `src/components/classroom/ZoomClassPanel.tsx`, `src/components/zoom/ZoomLiveOperations.tsx` (callers/roles)
- `src/lib/zoomLink.ts` (meeting number / passcode parsing)
- `supabase/functions/zoom-join-class/index.ts` (sdkReady payload)
- `@zoom/meetingsdk` v6.2.0 typings (`embedded.d.ts` JoinOptions)
- `zoom_accounts` rows (credential shape only — no secret values read)

## Classification

This is **not** a frontend SDK-initialisation problem. `client.init()` succeeds and Zoom itself renders the error, which means the JWT reached Zoom's validator. It is a mix of:

1. **Join-authorization problem (primary, teacher path)** — `role: 1` is sent with no `zak`.
2. **Signature-generation risk (secondary)** — the payload deviates from Zoom's current reference implementation.
3. **Data problem (student/attendee path)** — one code path passes the encrypted `pwd` token as the meeting password.

## Root causes, precisely

### 1. Host joins (`role: 1`) never send a ZAK — the main failure

Teacher entry points send role 1: `StartClassButton.tsx` (`useInAppZoomJoin(1)`), `LaunchClassCard.tsx`, `LiveClasses.tsx`, `ZoomClassPanel.tsx` (`userRole === 'teacher' ? 1 : 0`).

Zoom's Meeting SDK requires a **ZAK token** to start/host a meeting (`JoinOptions.zak` exists in `embedded.d.ts` at line ~857). `ZoomSdkMeeting.tsx`'s `client.join({...})` passes only `signature, meetingNumber, password, userName, userEmail`. A role-1 signature without ZAK — or a role-1 signature for a meeting the SDK app's Zoom account does not own — is rejected as error 3712, which the SDK surfaces as "Signature is invalid". This matches the reported behaviour exactly.

Fix: in `zoom-meeting-signature`, when `role === 1`, also mint a ZAK using the same account's **S2S OAuth** credentials (`zoom_accounts.zoom_client_id/secret/zoom_account_id_cred`) via `GET /v2/users/{zoom_user_id}/token?type=zak`, return it, and pass it through as `join({ ..., zak })` in `ZoomSdkMeeting.tsx`. Both SDK-enabled accounts (`saniya.aqt`, `shazia.aqt`) do have S2S credentials stored, so this is possible today. If ZAK cannot be minted, degrade that user to the external Zoom link rather than attempting a role-1 SDK join.

OBF tokens are not applicable here (they are the mutually-exclusive alternative to ZAK for OAuth-user joins); ZAK is the right mechanism.

### 2. JWT payload drifted from Zoom's reference sample

`zoom-meeting-signature` currently signs `{ appKey, mn: Number(meetingNumber), role, iat, exp, tokenExp }`.

- `mn` is emitted as a **number**. Zoom's official auth-endpoint sample passes the meeting number as the **string** it received. Numeric `mn` is an unverified deviation introduced earlier; it should be reverted to a string.
- `sdkKey` was removed. v6 typings say sdkKey is only deprecated **as a join parameter**; Zoom's sample still includes `sdkKey` alongside `appKey` in the JWT. Restoring `sdkKey: clientId` is harmless and matches the reference.
- Everything else (HS256, `iat` back-dated 30s, 2h `exp`, `tokenExp === exp`) is valid.

Fix in `zoom-meeting-signature/index.ts`: sign `{ sdkKey: clientId, appKey: clientId, mn: meetingNumber /* string */, role, iat, exp, tokenExp: exp }`.

### 3. Credentials are correct in shape — not the cause

Verified in `zoom_accounts`: the two SDK-enabled rows hold Meeting SDK values distinct from their S2S values, contain no whitespace, and match Zoom's Client ID charset (21 and 22 chars; the underscore in `c3w_…` is legal). The earlier "underscore is invalid" theory was wrong. Remaining external caveat: the Meeting SDK app is still in **Local Test / Draft** in Zoom Marketplace, which restricts usage to the developer account and its allow-listed test users — worth confirming once the code fixes land.

### 4. Attendee path can pass the wrong password

`src/lib/zoomLink.ts` returns `url.searchParams.get('pwd')`, which for modern links is the **encrypted** token (e.g. Saniya's `JpugPdap7qT0…Cf.1`), not the passcode (`H9VYjV`). `ZoomClassPanel.tsx` feeds that value straight into `ZoomSdkMeeting`'s `password` prop. `useInAppZoomJoin` is fine because `zoom-join-class` returns the plain `meeting_passcode`.

Fix: have `ZoomClassPanel` use the class's stored `meeting_passcode`, and treat a `pwd` value that is long/contains `.` as an encrypted token — pass it as `tk`, never as `password`.

### 5. Meeting-number semantics

Several accounts (including Saniya, `8640987589`) use 10-digit **PMI** links on free tiers. PMI joins are fine for attendees, but a role-1 PMI start still requires ZAK — reinforcing fix 1.

## Recommended change set (when you approve)

1. `supabase/functions/zoom-meeting-signature/index.ts`
   - restore `sdkKey` + string `mn` in the JWT
   - for `role === 1`, mint and return `zak` via S2S OAuth for that account
   - return a distinct error code when ZAK is unavailable
2. `src/components/classroom/ZoomSdkMeeting.tsx`
   - accept and forward `zak` in `client.join`
   - forward encrypted `pwd` as `tk` instead of `password`
3. `src/lib/zoomLink.ts` — distinguish plain passcode vs encrypted `pwd` token
4. `src/components/classroom/ZoomClassPanel.tsx` — pass the stored plain passcode
5. Confirm the Zoom Marketplace Meeting SDK app is activated (or the joining accounts are on its test allow-list)

## Verification after the fix

- Teacher role-1 join on Saniya's class opens in-app without the Zoom error modal
- Admin/student role-0 join into the same live meeting still works
- Accounts without SDK credentials still fall back cleanly to the external Zoom link
