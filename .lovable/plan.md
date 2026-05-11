## My understanding (in plain language)

You want the **student portal and parent portal to look and behave exactly the same** — same menu items, same pages, same dashboard layout. The only real difference is:

- **Student login** = sees only themselves.
- **Parent login** = sees a kid toggle at the top to switch between their children, and the dashboard/pages then act as if "viewing as that child".

For **read-only things** (dashboard, reports, fees view, resources, attendance history) → no difference, parent just sees the selected child's data.

For **active things the parent can do on the child's behalf** (apply for leave, send a DM, post a comment in class circle, raise a Work Hub ticket, mark something, reply to a teacher) → the action goes through, but it must be **stamped as the parent**, not the child. So teachers/admins seeing the message/ticket/comment know it came from the parent — typically shown as something like *"Ayesha's mother (Bushra Naseer)"* or a small **"by Parent"** badge next to the name.

This keeps accountability honest (we never pretend the child wrote something the parent wrote) while still letting the parent fully operate the child's portal from a single login.

---

## What I'll change

### 1. Unify the menu (NavRail) for student and parent
Today the parent sees only Home / Reports / Communication. Student sees Dashboard / My Courses / Resources / Communication.
→ Both will get the **same set of menu items**: Dashboard, My Courses, Resources, Communication, Fees, Work Hub (and any others a student already gets). Plus the access matrix entries that currently exclude parent from a student-side page will be opened up to parent (view + create where appropriate).

### 2. Active "kid context" for parent
A small piece of shared state ("currently viewing kid X") will be set by the kid toggle at the top of the dashboard and **persist across all menu pages**. So when a parent opens *My Courses*, *Resources*, *Fees*, *Work Hub*, etc., those pages load data for the selected child — not for the parent themselves.

For students, this context is just "themselves" and the toggle is hidden.

### 3. "Acted by parent" stamping on every write
Anywhere the portal lets you create something — leave request, DM, class-circle comment, work hub ticket/comment, reply, reaction — the saved row will record:
- **subject_student_id** = the child the action is *about* (so it shows up in the child's history)
- **acted_by_user_id** = the actually-logged-in user (parent or student)
- **acted_by_role** = `parent` or `student`

In the UI, wherever that item is displayed (teacher's inbox, admin's work hub, class chat), the author label will read **"Parent of [Child Name]"** or show a small **"(Parent)"** badge when the actor is the parent. Student-authored items show normally.

### 4. Visual confirmation for the parent
While the parent is acting on a child's behalf, a small persistent banner at the top of the page will read something like:
> *Acting as parent of **Ayesha Khan** — your name will be shown on anything you post.*

This avoids accidental "I thought I was posting as my kid" confusion.

### 5. No data duplication
We're not copying menus or pages. Parent will literally render the same student pages, just with the kid-context applied. One source of truth for both portals.

---

## What I'll need from you before coding

A couple of decisions that change the implementation:

1. **Label style** for parent-authored items in teacher/admin views — do you want **"Bushra Naseer (Parent of Ayesha)"** (full transparency) or just a small **"(Parent)"** badge after the child's name?
2. **Fees page** — when parent is in kid-context, should it show *only that child's* invoices, or stay as the existing family-wide "Pay All" view? (Currently family-bulk-payment is a separate parent feature.)
3. Any pages you explicitly want to **stay parent-only** (e.g. Family Management / linking new children / resetting kid PIN) that students should NOT see — I'll keep those hidden from students.

Once you answer those three, I'll implement in one pass.