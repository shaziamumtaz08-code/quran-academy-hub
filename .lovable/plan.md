
# Multi-Tenant LMS Architecture Expansion

## Build Order & Status

### ✅ Part 1: Leads Pipeline (DONE)
- Database: `leads` and `demo_sessions` tables with RLS
- UI: Kanban board with 10 pipeline stages
- Features: Create leads, view details, add notes, move stages, mark lost
- Navigation: People → Leads Pipeline (admin/super_admin/admin_admissions)

### 🔲 Part 2: Demo Session Scheduling
- Schedule demo classes from lead detail
- Teacher assignment for demos
- Demo feedback collection form

### 🔲 Part 3: Smart Enrollment Form
- Token-based public enrollment form (/enroll/{token})
- Age-triggered parental consent
- Pre-filled from lead data

### 🔲 Part 4: Public Course Catalog & Inquiry Form
- Enhanced public browsing page
- Standalone inquiry form (creates leads)

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
