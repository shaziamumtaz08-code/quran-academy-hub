# Expand QA Test-Mate to cover the entire app

Today QA Test-Mate runs ~5 checks in 2 areas (demo links, RLS isolation). This plan scales it to **9 modules, ~60 checks**, with module-level run buttons so you can test one area or everything.

## What will be covered

| # | Module | Sample checks (each one returns ✅/❌/⚠️) |
|---|---|---|
| 1 | **Identity & Users** | every profile has unique email; no orphan `user_roles` rows; no archived users in active lists; phone numbers normalize to E.164; no duplicate URNs |
| 2 | **Academics / Assignments** | every active assignment has a valid teacher + student + subject; paused assignments have no future schedules; no overlapping schedules for same teacher; substitution chain integrity |
| 3 | **Attendance & Zoom** | every Zoom session has a license; no attendance rows without a session; >50% duration rule applied correctly; orphan `zoom_attendance_logs`; holidays suppress missed-attendance flags |
| 4 | **Finance — Invoicing** | every fee invoice has a valid student + plan; paid invoices are immutable (no updates after `paid_at`); ledger balances to zero per student; family bulk-pay links resolve |
| 5 | **Finance — Payroll** | salary math = `(Base_Rate / Days_In_Month) * Active_Days` for sampled teachers; volunteer staff have zero payouts; PKR currency on all salary rows; partially-paid payouts are `draft` |
| 6 | **Demo / Leads pipeline** | (existing) + every lead has a valid status transition; rescheduled demo resets status; webhook-created leads have applicant linkage |
| 7 | **Teaching OS** | every `session_plan` belongs to a syllabus; outline PDFs have valid storage URLs; speaking attempts have audio + transcript; quiz attempts grade correctly |
| 8 | **Communication** | chat groups have ≥1 member; no orphan DMs; WhatsApp messages have a contact; notification queue isn't backed up >24h |
| 9 | **Security / RLS** | (existing) + spot-check 15 critical tables refuse anon SELECT; `service_role` grants present on every public table; no policies missing GRANT statements |

## How the UI changes

- **Module cards** on the QA Test-Mate page — each shows last run status, pass/fail count, and a "Run this module" button.
- **"Run all" button** at the top — runs the full suite (~30–60 sec).
- **Filterable run history** — by module + status.
- **Chat still works** — you can ask "show me failed checks from yesterday's payroll run" in plain English.
- **Optional nightly cron** — auto-run the full suite at 3am and write results so you wake up to a green/red dashboard.

## Process for the user

1. Open Settings → QA Test-Mate.
2. Click "Run all" once a week (or after a deploy) → see which modules are green/red.
3. Click any ❌ to expand evidence (the offending row IDs, error messages).
4. Ask the AI to suggest a fix or run a specific module again.

## Technical details

- One edge function per module: `qa-check-identity`, `qa-check-academics`, `qa-check-attendance`, `qa-check-finance-invoicing`, `qa-check-finance-payroll`, `qa-check-demo`, `qa-check-teaching`, `qa-check-comms`, `qa-check-security`.
- Existing `qa-run-checks` becomes the orchestrator that fans out to all module functions in parallel and aggregates results into `qa_runs`.
- New table column `qa_runs.module` (text) to filter by domain.
- New table `qa_check_results` (one row per individual check per run) for drill-down evidence — replaces the current inline JSON blob.
- All checks are **read-only** — no data is modified, no test users created.
- Sample-based on large tables (e.g. 50 most recent invoices) to keep runtime <60s.

## Limitations to be honest about

- **Sampling, not exhaustive** — checking every row in `attendance` (millions) would be too slow; we sample recent + random rows. Critical-table checks (users, roles) are exhaustive.
- **Catches data/RLS regressions, not UI bugs** — won't tell you if a button is broken; will tell you if the data the button depends on is corrupt.
- **No write-path testing** — won't create a fake invoice to test the create flow. That needs separate end-to-end tests (Playwright) which is a different tool.
- **AI chat costs credits per message**; the checks themselves are free.
- **Scoped to current division** by default — admins can toggle "all divisions" if they have global access.

## Build order

1. Schema migration: add `module` column + new `qa_check_results` table.
2. Refactor existing checks into the orchestrator pattern.
3. Add Identity + Academics modules (highest-value, used daily).
4. Add Finance modules (Invoicing, Payroll).
5. Add Attendance/Zoom + Demo + Teaching + Comms + Security.
6. UI: module cards, drill-down, filters.
7. Optional: nightly cron.

Total scope: ~9 new edge functions, 1 migration, ~600 lines of UI. Estimated build time across the conversation: 4–6 focused turns.

**Approve this plan to start building, or tell me which modules to drop/add first.**
