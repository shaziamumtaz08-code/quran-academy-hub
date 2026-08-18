# Library as single source of truth, VCR as the universal player

Today the VCR renders one thing only: the Mushaf. Qaida lives in its own tracker, PDFs live in the Library, and `student_progress` can only point at a syllabus item plus a free-text page/ayah string. This plan turns the Library into the one content store, makes the syllabus a thin pointer into it, gives teachers a private working layer, and rebuilds the VCR reading card as a content-type-agnostic player.

## The model

```text
Library item  (Qaida edition | Mushaf edition | PDF | video/link)
      ^
      |  points at (never copies)
Syllabus pointer  = library_item_id + position { baab/word | juz:ayah | pdf page }
      ^
      |  resolves to
VCR player  = one parchment card + one page-turn language, three adapters
      ^
      |  teacher may also open directly from
Teacher space  = pinned library items + her own private uploads
```

- The Library keeps owning files, metadata, visibility and access rules. Nothing is duplicated into syllabus or VCR tables.
- A syllabus pointer stores *what* and *where*, never content.
- Teacher space items stay private until she formally assigns one into a student's syllabus, at which point it becomes a normal pointer the student can see.

## Build path

### 1. Content adapter layer (frontend)
Replace `VcrStaticPage` internals with a `VcrReader` shell that owns the parchment card, elevation, page-turn, zoom and font controls, and delegates content to an adapter:

- `mushaf` — current line renderer, unchanged behaviour.
- `qaida` — baab/page renderer with word-tap flashcards (reuses the existing Qaida word data and tap-to-hear scope).
- `pdf` — page render via the existing pdf worker, plus highlight, pointer and zoom; annotations kept per session, not baked into the file.

Every adapter exposes the same contract: `totalUnits`, `goTo(unit)`, `currentLabel`, `onComplete()`. That is what makes a Qaida baab, a Mushaf page and a library PDF feel like the same object.

### 2. Polymorphic progress
Extend (never rewrite) `student_progress`:

- add `content_type` (`mushaf` | `qaida` | `pdf`), `library_item_id`, `reference` jsonb
- keep `current_item_id` and `current_page_or_ayah` populated for backward compatibility
- same extension on `vcr_sessions` so "what was covered" is comparable across content types

`syllabus_items` gains `library_item_id` and `content_type`; its existing `reference` jsonb becomes the position payload.

"Mark complete" and pace tracking then read one shape regardless of content, so the syllabus pace line and Class Room roster work unchanged.

### 3. Teacher space
A new `teacher_library_pins` table (teacher_id, library_item_id, note, private-by-default RLS) plus an "Assign to syllabus" action that writes a pointer row. Teacher uploads go through the existing Library upload path with a private visibility flag — no second storage path.

### 4. VCR wiring
- Opening `/vcr/:studentId` resolves the syllabus pointer and mounts the matching adapter.
- A content switcher in the VCR header lets a teacher open anything from her own space mid-class without leaving the room.
- Completion, session notes and autosave stay exactly as they are today.

## Order of work

1. Migration: extend `student_progress`, `vcr_sessions`, `syllabus_items`; create `teacher_library_pins` with grants + RLS.
2. `VcrReader` shell + `mushaf` adapter (behaviour-preserving refactor, verify nothing regresses).
3. `qaida` adapter with word-tap flashcards.
4. `pdf` adapter with page-flip, highlight, pointer, zoom.
5. Teacher space panel + "Assign to syllabus".
6. Syllabus page and Class Room read the polymorphic pointer.

Each step ships independently; the VCR keeps working throughout.
