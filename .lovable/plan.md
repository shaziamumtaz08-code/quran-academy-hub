

# Content Kit Visual Quality Upgrade

## Problem
The Content Kit outputs (slides, flashcards, quizzes, etc.) have basic styling with plain Urdu/Arabic fonts, lacking the polished, branded look of tools like Gamma. The current approach relies on hardcoded phase-based color themes with no user control over visual style.

## Solution: Template System + Style Prompt Panel

### 1. Built-in Visual Templates (like Gamma)
Add 5-6 curated branded templates that control the entire visual language across all content types:

| Template | Style |
|----------|-------|
| **Academy Classic** | Deep navy + gold, Islamic geometric patterns, premium serif headers |
| **Modern Minimal** | Clean white, thin borders, subtle accent colors, sans-serif |
| **Islamic Heritage** | Warm cream/parchment, ornamental borders, Amiri calligraphy, arabesque corners |
| **Vibrant Learning** | Colorful gradient cards, rounded shapes, playful but professional |
| **Dark Scholar** | Dark backgrounds, neon cyan accents, tech-forward feel |

Each template defines: background gradients, accent colors, card styles, font pairings, decorative elements, and Arabic/Urdu font treatment.

### 2. Style Prompt Panel
Add a dedicated "Style & Design" section in the generator bar (alongside existing "Add specs") where teachers can type natural-language styling instructions like:
- "Use green and gold Islamic theme"
- "Make it colorful and kid-friendly"
- "Professional corporate style with minimal decoration"

This prompt gets injected into the AI generation for text/layout decisions AND controls CSS variables for the rendered output.

### 3. Improved Font Rendering
- Use `Noto Nastaliq Urdu` with proper line-height (2.4) and larger sizes for Urdu content
- Use `Noto Naskh Arabic` with line-height (2.0) for Arabic content  
- Auto-detect script and apply appropriate font family
- Increase Arabic/Urdu font sizes across slides (32px+), flashcards (28px+), and quiz questions

### Technical Changes

**Files to modify:**

1. **`src/pages/TeachingOSContentKit.tsx`**
   - Add `VISUAL_TEMPLATES` constant with 5-6 template definitions (colors, fonts, decorations)
   - Add template selector UI (horizontal card strip) above the generator bar
   - Add "Style prompt" textarea alongside existing "Add specs"
   - Refactor `SlideContent`, `FlashcardItem`, `QuizCard`, `StudyMode` to accept a template object
   - Apply Nastaliq font for Urdu, Naskh for Arabic with proper sizing
   - Update `downloadPptx` and `exportAsPDF` to use selected template colors/fonts

2. **`supabase/functions/generate-content-kit/index.ts`**
   - Accept `stylePrompt` parameter
   - Inject style context into AI prompts so generated text aligns with chosen aesthetic (e.g., formal vs. playful tone)

3. **`src/index.css`** (minor)
   - Ensure Google Font imports for Noto Nastaliq Urdu and Noto Naskh Arabic are loading (already present)

### UI Flow
1. Teacher selects a course/session and lands on Content Kit
2. A horizontal template strip shows 5-6 visual previews (small colored cards)
3. Clicking a template updates the entire kit's visual rendering instantly
4. "Style prompt" field allows free-text override for AI-generated content tone
5. Template choice persists in localStorage per session
6. All exports (PPTX, PDF) honor the selected template

