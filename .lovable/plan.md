

# Add Extended Leave Types

## What Changes

The approved Work Hub plan already includes a `ticket_subcategories` table with a "Leave Request" category. This update simply expands the default subcategories seeded for that category.

### Updated Leave Request Subcategories

| Subcategory | Default TAT (hours) | Notes |
|-------------|---------------------|-------|
| Sick Leave | 24 | Short-term illness |
| Personal Leave | 48 | General personal reasons |
| Emergency | 4 | Urgent, fast approval needed |
| Planned Vacation | 168 (7 days) | Pre-planned time off |
| Religious/Holiday | 72 | Eid, etc. |
| **Pregnancy Leave** | 168 | Extended leave, typically teachers |
| **Hajj Leave** | 168 | Pilgrimage, pre-planned |
| **Umrah Leave** | 168 | Pilgrimage, shorter duration |

### Implementation

No new tables or columns needed. These three entries are added to the seed SQL in the same migration that creates `ticket_subcategories`:

```text
INSERT INTO ticket_subcategories (category, name, sort_order, tat_override_hours)
VALUES
  ('leave_request', 'Pregnancy Leave', 6, 168),
  ('leave_request', 'Hajj Leave', 7, 168),
  ('leave_request', 'Umrah Leave', 8, 168);
```

The Create Ticket dialog will automatically show these in the subcategory dropdown when "Leave Request" is selected. No UI changes required beyond what is already planned.

This will be included when the full Work Hub migration is executed.

