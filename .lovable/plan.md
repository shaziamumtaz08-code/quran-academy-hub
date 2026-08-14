# Quran Lesson Marking — Juz unit, multi-segment entry, normalized display

## What exists today (verified)

- All lesson marking lives on the single `attendance` row. Sabaq is stored as flat "from/to" columns: `sabaq_marker_type` (`ruku` | `ayah` | `quarter`), `sabaq_surah_from/to`, `sabaq_ayah_from/to`, `sabaq_ruku_from_juz/number`, `sabaq_ruku_to_juz/number`, `sabaq_quarter_from_juz/number`, `sabaq_quarter_to_juz/number`, plus legacy `surah_name`, `ayah_from`, `ayah_to`.
- Entry UI: `UnifiedAttendanceForm.tsx` holds all the state and passes it to `NazraAttendanceFields` / `HifzAttendanceFields`, which both render the same `SabaqSection.tsx` (Ruku / Ayah / Quarter toggle, each with a From row and a To row). One range per lesson, no Juz option.
- Display: `lesson_covered` is a free-text string built at save time, and it is built in **two** places with different rules — `UnifiedAttendanceForm.tsx` (~line 688) and `src/pages/Attendance.tsx` (~line 671). Both only handle the ayah case (`"Al-Jinn 1 - Al-Jinn 7"`); ruku and quarter entries save an empty lesson string. Roughly 15 screens read `lesson_covered` for history, dashboards, and reports.

That split builder is the root of the inconsistent display today, so the normalization work (item 3) also fixes existing ruku/quarter lessons showing blank.

## Assumptions (correct me if wrong)

- Multi-segment is needed for **both** Hifz and Nazra (a Nazra teacher can also read two spots in one sitting); Juz stays Hifz-only.
- The Juz unit means "whole Juz / range of Juz" (e.g. Juz 5, or Juz 5–6), not a partial Juz.
- Existing records stay as they are; they get a normalized display generated on read, and are rewritten only when the row is next edited.

## 1. Data model

**New child table `attendance_lesson_segments`** — one row per segment, ordered:

- `attendance_id` (FK, cascade delete), `segment_index`, `section` (`sabaq` for now; leaves room for sabqi/manzil later)
- `marker_type`: `ayah` | `ruku` | `quarter` | `juz`
- `surah_from`, `ayah_from`, `surah_to`, `ayah_to`
- `juz_from`, `unit_from`, `juz_to`, `unit_to` (used by ruku/quarter/juz)
- `display_text` — the normalized string for this segment
- Standard `id`, `created_at`, plus grants for `authenticated` / `service_role` and RLS that mirrors the existing `attendance` policies (a user may read/write a segment when they may read/write its parent attendance row).

**Two new columns on `attendance`**:

- `lesson_display` — the full normalized lesson string for the row (all segments joined with `+`), the single value reports and history should read.
- `lesson_segment_count` — convenience for showing a "2 segments" badge without a join.

**Back-compat, extend-only**: the existing `sabaq_*` columns stay and keep being written from **segment 1**, so every current query, report, and dashboard keeps working untouched. `lesson_covered` also keeps being written (same value as `lesson_display`) so nothing that reads it breaks; new code reads `lesson_display`.

## 2. UI

**Juz option (Hifz only)** — a fourth toggle "Juz" appears in `SabaqSection` next to Ruku / Ayah / Quarter, rendered only when the subject is Hifz. It shows a single "From Juz" select and an optional "To Juz" select (30 entries, showing `Juz 5 — Wal Mohsanat`), with a live total of "Juz covered". Nazra keeps the current three toggles.

**Multi-segment entry** — the Sabaq block becomes a list of segment cards:

```text
Sabaq (New Reading)
┌ Segment 1 ─────────────────────────── [x remove] ┐
│ [Ruku][Ayah][Quarter][Juz]  From … → To …        │
└──────────────────────────────────────────────────┘
┌ Segment 2 ─────────────────────────── [x remove] ┐
│ [Ruku][Ayah][Quarter][Juz]  From … → To …        │
└──────────────────────────────────────────────────┘
        [ + Add another segment ]
Total: 12 ayahs · 2 segments
Preview: Surah Al-Baqarah, verse 1-5 + Surah Al-Baqarah, verse 280-286
```

- One segment by default, so the form looks the same as today for the normal case.
- Each segment picks its own marker type, so "a few ayahs at the start of the Para plus a ruku at the end" is expressible.
- Remove is hidden when only one segment exists; a soft cap of 5 segments.
- A live normalized preview sits under the list, so the teacher sees exactly what will be saved.
- History and report rows show the joined string, with segment 2+ on a second line on mobile.

## 3. Normalized display string

A single new module `src/lib/lessonFormat.ts` becomes the only place a lesson string is built, replacing both existing inline builders:

- `formatSegment(segment)` → one segment string
- `formatLesson(segments)` → segments joined with ` + `
- `formatLessonFromRow(row)` → builds the string from a legacy `attendance` row (old `sabaq_*` columns), so historic records render in the new format without any data migration

Rules, using the existing `SURAHS` and `JUZ_DATA` tables:

| Input style | Normalized output |
| --- | --- |
| Ayah, same surah | `Surah Al-Jinn, verse 1-7` |
| Ayah, single verse | `Surah Al-Jinn, verse 5` |
| Ayah, crossing surahs | `Surah Al-Jinn, verse 20 – Surah Al-Muzzammil, verse 4` |
| Ruku, one | `Juz 15, Ruku 3` |
| Ruku, range in one Juz | `Juz 15, Ruku 3-5` |
| Ruku, crossing Juz | `Juz 15, Ruku 20 – Juz 16, Ruku 2` |
| Quarter | `Juz 7, 2nd Quarter` / `Juz 7, 2nd–4th Quarter` |
| Juz (Hifz) | `Juz 5` / `Juz 5-6` |
| Multi-segment | segments joined with ` + ` |

The string is computed once on save and stored in `lesson_display` (and each segment's `display_text`), so reports, PDFs, and WhatsApp messages all read the same stored text rather than re-deriving it. `formatLessonFromRow` covers rows saved before this change.

## Technical notes

- Migration: create `attendance_lesson_segments` (create → grants → enable RLS → policies), add `lesson_display` and `lesson_segment_count` to `attendance`. No column is renamed or dropped.
- `UnifiedAttendanceForm.tsx` moves from ~16 flat sabaq state variables to a `segments: LessonSegment[]` array; on save it writes the segment rows, mirrors segment 1 into the existing `sabaq_*` columns, and writes `lesson_display`/`lesson_covered` from `formatLesson`.
- `src/pages/Attendance.tsx` drops its own lesson-string builder and calls `formatLesson` instead.
- Read paths (`RecentAttendanceCards`, `StudentHistoryDialog`, `DetailedProgressView`, dashboards, `AttendanceReports`, report PDFs) switch to `lesson_display ?? formatLessonFromRow(row) ?? lesson_covered`.
- Editing an existing lesson loads its segments if present, otherwise seeds one segment from the legacy columns.
- Validation: `to` must not precede `from`, ayah numbers bounded by the surah length, ruku numbers bounded by `getRukuCountForJuz`, and duplicate/overlapping segments flagged with a warning rather than a hard block.

## Sequence

1. Migration (segments table + two attendance columns).
2. `src/lib/lessonFormat.ts` with unit tests over each input style.
3. Segment-list UI in `SabaqSection` + Juz toggle gated to Hifz.
4. Save/hydrate rewiring in `UnifiedAttendanceForm.tsx` and `src/pages/Attendance.tsx`.
5. Read paths switched to the normalized string.
