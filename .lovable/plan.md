# Attendance Modal Clarity Pass

## Scope
- Rework attendance status tiles into compact icon-first controls while retaining the existing selected-state logic and the single shared status description below the grid.
- Remove the duplicate remarks field and replace the collapsed voice-note accordion with one always-visible inline mic-and-remarks row; expand recorder controls only after the mic is pressed.
- Restyle the recorder with semantic theme tokens and concise copy so it remains legible in light and dark modes.
- Combine Sabqi and Manzil into two compact switch chips with tooltip explanations.
- Repeat the calculated lesson total inside the “Will be recorded as” preview and add the whole-Juz guidance under “To Juz”.
- Preserve all attendance state, validation, calculations, upload behavior, and save/database writes.

## Verification
- Check the modal at desktop and mobile widths, including status selection, the mic expansion, remarks entry, Hifz revision switches, and whole-Juz lesson preview.
- Confirm the project build remains healthy.

## Required security follow-up
- After the UI work, restrict unrelated users from reading sensitive profile fields while preserving legitimate profile access through the existing protected sensitive-data pattern.
