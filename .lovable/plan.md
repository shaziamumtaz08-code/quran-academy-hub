## Goal
Let admins click any quiz result row to see the **full per-question breakdown** for that single attempt — what was asked, what the student answered, what was correct, and why.

## Where it goes
`src/pages/QuizEngine.tsx` → Results tab table. Add a small **"View" (eye icon) button** on each row. The existing row click (which expands the student's attempt-history bars) stays as-is.

Clicking "View" opens a new `<AttemptDetailDialog />` component.

## New component: `src/components/quiz/AttemptDetailDialog.tsx`

Reads everything from the already-loaded attempt row (`questions` + `answers` jsonb are stored per attempt — no extra query needed).

### Header
- Student name + email
- Quiz name · Session #N · Attempt #N
- Score `X/Y` · Percentage badge · **Pass/Fail** badge (uses `quiz_bank.passing_percentage`)
- Date+time submitted · Time taken
- Optional: difficulty mix summary (e.g. `5 easy · 3 medium · 2 hard`)

### Body — per-question list
For each question in `attempt.questions[i]`:

- Question number + difficulty chip + type chip (`MCQ` / `True/False` / `Fill-in`)
- Question text (RTL-aware: if quiz language is `ar` or `ur`, render with `dir="rtl"` and the project's Arabic/Urdu font class)
- **Correct / Incorrect** badge (green check / red X) computed by comparing `answers[i]` to `correctIndex` (for mcq/tf) or to the expected text for fib
- Options list (mcq / tf): each option row marks:
  - ✓ green ring = correct answer
  - ✗ red ring = student's wrong pick
  - ✓ green filled = student's correct pick
  - neutral = other options
- Fill-in: show "Your answer: …" and "Expected: …" side-by-side
- Explanation block (collapsible) if `question.explanation` exists
- "Not answered" tag if `answers[i]` is `undefined`

### Footer
- Summary strip: `✓ Correct: N  ✗ Wrong: M  — Not answered: K`
- Buttons:
  - **Previous / Next attempt** — navigates within the currently filtered results list (so admin can sweep through a session quickly)
  - **Print** (`window.print()` with print-styled dialog content)
  - **Close**

## Wire-up in `QuizEngine.tsx`

1. Add state: `const [detailAttemptId, setDetailAttemptId] = useState<string | null>(null)`.
2. In the Results table, add a leading icon-button column:
   ```
   <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailAttemptId(a.id); }}>
     <Eye className="h-3.5 w-3.5" />
   </Button>
   ```
   `stopPropagation` so it doesn't toggle the existing expand row.
3. At the bottom of the Results tab, render:
   ```
   <AttemptDetailDialog
     open={!!detailAttemptId}
     onOpenChange={(o) => !o && setDetailAttemptId(null)}
     attempts={filteredResults}       // for Prev/Next nav
     attemptId={detailAttemptId}
     sessionNumberMap={sessionNumberMap}
     attemptNumberMap={attemptNumberMap}
   />
   ```

## Access control
The component is rendered only inside `QuizEngine.tsx`, which is already an admin/staff page (RLS on `quiz_attempts` already restricts row visibility to admins + course staff via existing policies). No new RLS work needed.

## Out of scope (call out, not building)
- Editing scores / overriding pass-fail
- Adding examiner comments per question
- Student-side review (this is admin-only)

## Technical notes
- No new dependencies. Uses existing shadcn `Dialog`, `Badge`, `Button`, lucide icons (`Eye`, `Check`, `X`, `Printer`, `ChevronLeft`, `ChevronRight`).
- RTL detection: read `attempt.quiz_bank?.language` (already joined in the existing query — but we currently only select `id, name, passing_percentage`). I'll extend that select to also pull `language`.
- Single-file new component (~180 lines) + ~15-line wiring change in `QuizEngine.tsx`. Existing tab structure, filters, and bulk actions stay untouched.
