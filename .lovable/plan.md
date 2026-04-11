

# Plan: AI Content Quality + Visual Rendering Overhaul

## Overview
Upgrade the Teaching OS content kit in two areas: (1) richer AI prompts in the edge function for higher-quality slides, flashcards, and worksheets, and (2) layout-aware rendering in the frontend with new slide layout types, enhanced flashcard display, and improved infographic visuals.

## Part 1: Edge Function — Better Prompts

**File: `supabase/functions/generate-content-kit/index.ts`**

- **Model**: Keep `google/gemini-3-flash-preview` (it's a supported gateway model). Compensate with better prompts and increased `maxTokens`.
- **Slides prompt** (lines 31-57): Replace with the detailed prompt from the spec — adds `vocabularyItems`, `grammarTable`, `activityInstruction` fields, new layout types (`dialogue-practice`, `grammar-table`, `visual-prompt`), stricter quality standards, and `maxTokens: 6000`.
- **Flashcards prompt** (lines 85-108): Add `rootLetters`, `category`, `usageNote` fields, request 15-20 cards, stricter diacritics requirements, `maxTokens: 5000`.
- **Worksheet prompt** (lines 111-138): Expand exercise types to 8 varieties (sentence construction, reading comprehension, dialogue completion, error correction), request 4-6 items per exercise, `maxTokens: 5000`.
- **Quiz/infographic/mindmap**: No changes (already adequate).

After editing, deploy the edge function.

## Part 2: Frontend Types Update

**File: `src/pages/TeachingOSContentKit.tsx`**

- Extend `SlideData` interface (~line 49) to add optional fields: `grammarTable`, `vocabularyItems`.
- Extend `Flashcard` interface (~line 73) to add optional fields: `rootLetters`, `category`, `usageNote`.
- Update the slide DB-to-state mapping (~line 456) to include new fields from the `bullets` JSON (where the DB stores extra data).

## Part 3: Slide Layout-Aware Rendering

**File: `src/pages/TeachingOSContentKit.tsx`** — `SlideContent` function (~line 1623)

Replace the single-layout rendering with a switch on `slide.layoutType`:

- **`arabic-vocab` / `two-column-vocab`**: 2-column vocabulary grid showing arabic, transliteration, english, and example for each item using `slide.vocabularyItems`.
- **`dialogue-practice`**: Alternating speech-bubble style lines from `slide.bullets` with activity instruction callout.
- **`grammar-table`**: Renders `slide.grammarTable` as a styled HTML table.
- **`title-bullets` (default)**: Current layout, kept as-is but with minor polish.

All layouts keep the existing phase-based theming (SLIDE_THEMES + template overrides).

## Part 4: Flashcard Visual Enhancement

**File: `src/pages/TeachingOSContentKit.tsx`** — `FlashcardItem` function (~line 1798)

- Add `rootLetters` display (small badge below Arabic text on front).
- Add `category` badge on the card.
- Add `usageNote` on the back side below the example sentence.
- Keep existing flip animation and script detection logic.

## Part 5: Infographic Visual Polish

**File: `src/pages/TeachingOSContentKit.tsx`** — infographic rendering (~line 948)

- Upgrade the header area with larger typography and template-aware accent colors.
- Add a subtle decorative border/pattern to the center fact.
- Keep the existing grid layout but improve card styling with hover effects.

## Part 6: Font Loading

**File: `index.html`**

- The Arabic fonts (Noto Naskh Arabic, Amiri, Noto Nastaliq Urdu) are already loaded.
- Add Poppins and Lora to the existing Google Fonts link for template heading variety.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-content-kit/index.ts` | Upgraded prompts for slides, flashcards, worksheets; increased maxTokens |
| `src/pages/TeachingOSContentKit.tsx` | Extended types; layout-aware slide rendering; flashcard & infographic visual upgrades |
| `index.html` | Add Poppins + Lora fonts |

## What Won't Change
- Edge function API endpoint, auth, CORS, JSON parsing logic
- DB table structures (content_kits, slides, flashcards, worksheets)
- Data flow: generate → parse → save → render
- Custom prompt / style prompt functionality
- Template selector, PPTX download, study mode
- Existing visual templates (kept, not replaced — they already have rich phase-specific overrides)

