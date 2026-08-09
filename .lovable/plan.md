# Turn the verified walkthrough into a real shareable MP4

## What I found (verified, not assumed)

**1. Where the 6 captured screens live**
- Storage: private bucket `tutorial-captures`, objects `logging-in/step-01.png` … `step-06.png` (PNG, ~334 KB each, 1280x900 viewport). Confirmed by querying `storage.objects`.
- Metadata: `tutorial_videos` row "Logging in to AQTA" (`59fed1fa-…`), `walkthrough_status = ready`, `walkthrough_generated_at = 2026-08-09 14:41 UTC`, and `walkthrough_frames` = 6 JSON entries, each with `step`, `label`, `route`, `path`, and a normalised click `hotspot` (`x`,`y` as 0..1 fractions). All 6 have hotspots.
- Playback today: `src/components/tutorials/WalkthroughViewer.tsx` mints signed URLs and shows Next/Previous with a pulsing hotspot ring — exactly the slideshow you reviewed. There is no video anywhere: the row's `video_url` is empty and `storage_path` is null.
- The capture runner is `scripts/walkthrough-capture.py` (Playwright). The PNGs it wrote to `/tmp` are gone (sandbox is ephemeral) — the bucket copies are the surviving source.

**2. Can a real video be assembled automatically? Yes.**
- `ffmpeg` is present in the build sandbox with `libx264` (MP4/H.264), `libvpx-vp9` and `gif` encoders — confirmed by `ffmpeg -encoders`.
- Everything the video needs already exists in the data: ordered frames, per-step labels, and hotspot coordinates. Nothing has to be invented; the renderer only re-draws what was already captured and verified.

**3. Can it be stored and shared? Yes, with one decision.**
- The MP4 can be uploaded to storage and recorded on the tutorial row (`storage_path` / `video_url`), and the existing detail page already renders a `<video>` player when a URL is present — no new player UI needed.
- For a link you can send to a parent outside the LMS, a signed URL expires, so it must be either a public bucket or a token share page (the app already uses that pattern in `LibraryShare.tsx` / `PublicPolicies.tsx`). See the choice below.

**4. Fallback** — not needed. A true MP4 is achievable with the current stack.

## Proposed build

**Renderer** — new `scripts/walkthrough-render.py`:
- Downloads the frames for a tutorial from `tutorial-captures` using its `walkthrough_frames` order.
- For each step composes a 1280x720 frame: the screenshot, a lower caption bar with `Step N of 6 — <label>`, and a highlight ring drawn at the stored hotspot (Pillow, already installed).
- Renders a hold per step (~4s, +1s per 12 words of label) plus a short cross-fade between steps, and a 2s title card using the guide title.
- Encodes with ffmpeg `libx264 + yuv420p + faststart` to MP4 at 30fps (broadly playable, including WhatsApp). A `.webm` copy is optional and cheap; skip unless asked.
- Uploads the MP4 and writes `storage_path`, `duration_seconds`, and `thumbnail_url` (first frame) back onto the `tutorial_videos` row.

**Sharing** — pick one:
- (A) Public bucket `tutorial-videos-public`: simplest, gives a permanent plain URL. Note the workspace may block public buckets; if it rejects, we fall back to (B).
- (B) Keep the bucket private and add a public share page `/help/w/:token` that resolves a per-tutorial share token and streams the MP4 via a short-lived signed URL minted server-side. Same pattern as the existing library share link, nothing public-by-accident.
Recommendation: try (A), fall back to (B) automatically.

**In-app** — add a "Download / Share video" action on the guide detail page next to the existing slideshow. The slideshow stays; the video is an addition, not a replacement.

**Scope of this pass**: render and publish the video for the one guide that actually has verified frames (Logging in). The other four guides remain `pending` — they need an authenticated capture run first, which requires you to be signed in to the preview once.

## Technical notes
- Files: new `scripts/walkthrough-render.py`; small edits to `src/pages/Tutorials.tsx` (share/download action) and possibly a new `src/pages/WalkthroughShare.tsx` + route if we land on option (B).
- DB: reuses existing `tutorial_videos` columns (`storage_path`, `video_url`, `duration_seconds`, `thumbnail_url`); a `share_token` column is added only under option (B).
- No change to the capture runner or to `WalkthroughViewer`.
