

# Unified Connections — Multi-Role + Complete Course View

## Problem (jo aap ne bola)
1. Abida teacher hai PAR woh khud bhi student ho sakti hai (Tafseer Quran enrolled) — sirf teacher view dikh raha hai.
2. Nida = parent + student + maybe teacher — abhi sirf ek role ka graph load hota hai.
3. Courses sirf "active" filter ho rahe hain — completed/past courses miss ho rahe hain.
4. Group academy + one-to-one dono ka data ek saath nahi dikh raha.
5. Click kar ke quick view nahi milta apne dashboard se.

## Fix — 3 cheezein

### 1. Multi-role graph (root cause)
`UserConnectionsGraph` ko refactor karo. `userType` prop optional banao. Component khud detect kare us profile ki **saari roles** (`user_roles` table se) aur har role ka data parallel fetch kare, phir ek hi unified graph mein dikhaye:

- **Center node**: person ka naam + saari roles ke chips (e.g. "Teacher · Student · Parent")
- **Branches grouped by role**:
  - As Teacher → students (with subject), classes, co-teachers
  - As Student → teachers, courses enrolled, siblings
  - As Parent → children → unke teachers
- **Color-coded section headers** (faint group nodes) so visually clear ho ke "ye uske teacher-life ka hai, ye student-life ka"

### 2. Complete course history (active + completed + past)
- Hatao `.eq('status', 'active')` filter from `course_enrollments` and `student_teacher_assignments`.
- Status badge har course/assignment node pe: green=Active, blue=Completed, grey=Paused/Ended.
- Bhi add: courses **completed long ago** (with completion date subtitle).

### 3. User-facing "My Connections" entry points
Aap ne ye bhi mention kiya — student/teacher/parent apne dashboard se ek click pe apna full graph dekh sake:
- **StudentDashboard**: ek "My Network" card → opens `/connections/student/{myId}`
- **TeacherDashboard**: same → `/connections/teacher/{myId}`
- **ParentDashboard**: "Family Map" tile → `/connections/parent/{myId}`

Plus: full-page header pe **role tabs** (e.g. `[All] [As Teacher] [As Student] [As Parent]`) — user filter kar sake jab graph bara ho.

## Visual upgrade (aesthetics)
- Center node bigger, gradient bg, role chips ke neeche
- Role-group "lane" backgrounds (subtle tinted rectangles dagre-rendered behind related nodes) so 3 worlds visually separate
- Edge labels mein subject + status (e.g. "Hifz · Completed")
- Hover pe node — show mini popover with: role, subject/course, dates, "Open profile →" link

## Files to touch
1. `src/components/connections/UserConnectionsGraph.tsx` — refactor to multi-role aggregator
2. `src/pages/UserConnections.tsx` — add role filter tabs
3. `src/components/dashboard/StudentDashboard.tsx` — add "My Network" entry card
4. `src/components/dashboard/teacher/TeacherQuickActions.tsx` — add "My Network" tile
5. `src/components/dashboard/ParentDashboard.tsx` — add "Family Map" tile

## What stays the same
- `/admin/schema-explorer` (database view) — untouched
- Existing drawer Connections tabs — automatically benefit from the refactor (no breaking change)
- React Flow + dagre stack — same

## Out of scope (confirm if you want these too)
- Editing relationships from the graph (currently read-only)
- Export graph as PNG/PDF
- Showing financial/attendance stats inside connection cards

