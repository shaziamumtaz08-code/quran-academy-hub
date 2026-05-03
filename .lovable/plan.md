## Move Connections icon into ID/roles pill

**File:** `src/pages/UserManagement.tsx`

1. **Inside the ID pill role-icon strip** (around lines 1892–1901): after the 8 role-icon slots, append a small clickable `Network` icon separated by a thin left border. On click, `stopPropagation` (so it doesn't trigger the ID-copy button) and `navigate('/connections/{ut}/{user.id}')` using the same role-resolution fallback (`teacher → student → parent → student`).

2. **Actions column** (lines 1939–1952): remove the standalone Network `<Button>`. Keep the `Network` lucide import (now used inside the pill).

**Why safe:** purely a relocation of an existing `navigate()` handler — no data, route, or permission changes. `stopPropagation` preserves the ID copy-to-clipboard behavior.