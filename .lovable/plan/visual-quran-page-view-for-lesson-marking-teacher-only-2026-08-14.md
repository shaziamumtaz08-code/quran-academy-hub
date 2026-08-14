# Visual Quran Page View for Lesson Marking (Teacher-only)

## 1. What exists today (verified)

- `surahs` — 114 rows (name, ayah count, juz range). Usable as-is.
- `rukus` — table exists (surah_number, ruku_number, ayah_from/to, juz_number) but is **empty (0 rows)**.
- `noorani_qaida_baabs / _pages / _words` — Qaida only, 312 words. Not Quran text.
- `attendance_lesson_segments` — the normalized segment store built last phase.
- Code: `src/lib/quranData.ts` (surah list + unit conversion), `src/lib/juzData.ts` (juz names, ruku counts), `src/lib/lessonFormat.ts` (normalizer).

Conclusion: **no Quran text, no ayah-level data, and no mushaf page/line layout exists anywhere.** All of it has to be imported. `rukus` also needs seeding (556 rows) since ruku marking currently relies on hardcoded counts only.

## 2. Data model — new reference tables

All read-only reference data: `GRANT SELECT` to `authenticated`, RLS enabled with a simple "any authenticated user can read" policy, writes restricted to `service_role`.

```
quran_ayahs
  id, surah_number, ayah_number, text_indopak, text_uthmani (nullable),
  juz_number, hizb_quarter, ruku_number, sajdah boolean, unique(surah,ayah)

mushaf_editions
  id, code ('qudratullah-15'), name, lines_per_page, total_pages, script

mushaf_pages
  id, edition_id, page_number, juz_number, surah_start, surah_end,
  unique(edition_id, page_number)

mushaf_lines
  id, edition_id, page_number, line_number (1..15),
  line_type ('ayah' | 'surah_name' | 'basmallah'),
  surah_number (for headers),
  first_surah, first_ayah, first_word_index,
  last_surah,  last_ayah,  last_word_index,
  is_centered, unique(edition_id, page_number, line_number)

mushaf_words            -- optional, phase 2 (word-level tap accuracy)
  id, edition_id, page_number, line_number, word_index,
  surah_number, ayah_number, text
```

`mushaf_lines` alone is enough for "tap a line → know the exact ayah range on it". `mushaf_words` is only needed if teachers must stop mid-line on a specific word.

Also seed `rukus` (556 rows) so Ruku marking becomes data-driven and a tapped line can be resolved to its ruku.

## 3. Sourcing & import

Source: **QUL — Quranic Universal Library (qul.tarteel.ai)**, which publishes free downloadable exports of exactly this: IndoPak/Qudratullah 15-line mushaf layouts (610 pages × 15 lines) as SQLite/JSON, plus IndoPak ayah text and ayah metadata (juz, hizb, ruku, sajdah). Fallback/cross-check sources: `quran-align`/`quran.com` API v4 (`/verses/by_page` with `mushaf=indopak-15`), and the open `quran-json` datasets.

Import approach:
1. Download the QUL layout + IndoPak text exports into a scratch folder (not committed).
2. A one-off Node script converts them into CSV/JSON batches.
3. Load via a set of migrations (batched inserts) or a `service_role` seeding edge function for the large text tables (~6,236 ayahs, ~9,150 lines, ~78k words if word table is included).
4. Validation pass after import: 610 pages present, every page has 15 lines, ayah coverage 1..end for all 114 surahs, no gaps between consecutive line ranges.

Licensing: QUL data is openly licensed; store attribution in `mushaf_editions.name`/notes.

## 4. Page-view screen (teacher-only)

New route `/quran-page` (also openable as a dialog from the attendance form). Guarded to teacher/admin roles only; not linked in student or parent navigation.

- Header: edition badge, Juz / Surah / page-number jump, prev/next page.
- Page canvas: renders 15 lines of IndoPak text right-to-left in a mushaf-like frame, using the existing Arabic/Naskh font stack. Each line is a tappable row.
- Tap behaviour: first tap sets **start**, second tap sets **end** (or "start from previous lesson's end" when a prior record exists). Selected range is highlighted.
- Footer bar: live normalized preview from `formatLessonSegments`, "Add as another segment", and "Use this lesson" — which returns segments to the caller.
- Optional bookmark: remember last page per teacher/student pair for fast resume.

Mobile: same layout, larger tap targets, page swipe left/right.

## 5. Feeding the existing marking system

The page view is a **generator of `LessonSegment` objects** — nothing about storage changes.

- Tapped start line → `first_surah/first_ayah`; tapped end line → `last_surah/last_ayah`.
- Emit `{ markerType: 'ayah', surahFrom, ayahFrom, surahTo, ayahTo }` from `src/lib/lessonFormat.ts`.
- A small `src/lib/mushafResolve.ts` maps the same tapped range to `ruku` or `juz` segments when the teacher's marker preference is Ruku/Juz (using the seeded `rukus` table and `juz_number`), so Hifz teachers marking by Juz get an equivalent auto-filled segment.
- `SabaqSection.tsx` gets a "Pick on Quran page" button. Its result populates the existing primary-segment state (or appends to `extraSegments`), so save/hydrate paths, `lesson_display`, `lesson_segment_count`, and legacy `sabaq_*` mirroring all continue to work untouched.
- Dropdowns stay as a fallback for anyone who prefers them or when offline.

## 6. Suggested build order

1. Reference schema migration + `rukus` seeding.
2. Import script + validated load of ayahs, pages, lines.
3. Read-only page-view screen (browse only).
4. Tap-to-select + segment emission wired into `SabaqSection`.
5. Optional word-level precision (`mushaf_words`).

## Open questions

- Should the tapped stop-point default to "end of line" or should teachers also pick a word (needs `mushaf_words`)?
- Should students/parents ever see a read-only page view of what was covered, or strictly teacher-only?
