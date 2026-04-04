

# Role-Aware Ticket Assignment in WorkHub

## Problem
When assigning a ticket to someone who holds multiple roles (e.g., Admin + Teacher), there is no way to indicate which role the ticket is meant for. The recipient's inbox becomes a mixed bag with no context about whether a ticket needs their "teacher" or "admin" attention.

## Solution
Add a **"Target Role"** field to tickets so the creator specifies which role context the ticket is for. This role tag is displayed as a badge on ticket cards, making it immediately clear in the inbox.

## Changes

### 1. Database Migration
- Add `target_role` (text, nullable) column to the `tickets` table
- Stores the intended role context (e.g., `teacher`, `admin`, `admin_fees`)

### 2. Create Ticket Dialog (`CreateTicketDialog.tsx`)
- After selecting an assignee, fetch that user's roles from `user_roles` table
- Show a **"For Role"** dropdown populated with only that assignee's actual roles
- Store the selected role in `target_role` when inserting the ticket
- If the assignee has only one role, auto-select it and skip the dropdown

### 3. Ticket List (`TicketList.tsx`)
- Display a role badge (e.g., "As Teacher", "As Admin") on each ticket card next to the assignee name
- Color-coded by role type for quick scanning

### 4. Ticket Detail (`TicketDetail.tsx`)
- Show the target role in the ticket header metadata section

### 5. Assignee Picker Enhancement
- Change the assignee dropdown to show users grouped or labeled with their roles: e.g., "Sana Sanaullah (Teacher, Admin)"
- When a user is selected, if they have multiple roles, the "For Role" picker appears

## Files Modified
1. **Migration SQL** — add `target_role` column
2. **`src/components/hub/CreateTicketDialog.tsx`** — role-aware assignee picker + target role field
3. **`src/components/hub/TicketList.tsx`** — role badge on ticket cards
4. **`src/components/hub/TicketDetail.tsx`** — role in header metadata

