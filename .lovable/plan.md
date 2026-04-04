
# Multi-Tenant LMS Architecture Expansion

## Build Order & Status

### ✅ Part 1: Leads Pipeline (DONE)
- Database: `leads` and `demo_sessions` tables with RLS
- UI: Kanban board with 10 pipeline stages
- Features: Create leads, view details, add notes, move stages, mark lost
- Navigation: People → Leads Pipeline (admin/super_admin/admin_admissions)

### ✅ Part 2: Demo Session Scheduling (DONE)
- Schedule demo classes from lead detail dialog (Demo tab)
- Teacher assignment dropdown for demos
- Demo feedback collection with star rating + response (yes/thinking/no)
- Auto-advance lead status based on feedback response
- Demo status management: Done, No Show, Cancel

### ✅ Part 3: Smart Enrollment Form (DONE)
- Token-based public enrollment form (`/enroll/{token}`)
- Age-triggered parental consent (DOB → computed age)
- Forced oversight for under-13
- Pre-filled from lead data
- Consent checkboxes (terms, privacy, parental)
- Form link generation from lead detail (Enroll tab)

### ✅ Part 4: Public Inquiry Form (DONE)
- Standalone public form at `/inquiry`
- Creates leads without login required
- For self/child/other selection
- Subject interest, preferred time, message

### 🔲 Part 5: Minor/Child Login
- Username + PIN authentication
- Parent-child profile linking
- Profile selector for parent sessions

### 🔲 Part 6: Parent Dashboard Enhancements
- Family management (PIN reset, username change)
- Multi-child overview cards

### 🔲 Part 7: Identity Architecture Migration
- platform_persons layer
- URN system (org_relationships)
- Role enrollment tags
- Matching engine (Edge Function)
