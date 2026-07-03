<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Scheduling & clients — hard invariants (2026-05-31)

The schedule lives in `clean_events` rows materialized from each client's recurrence
settings. These rows are **not** a live view of active clients, so the schedule will
drift unless the following invariants hold. Duplicate and inactive-client "ghost"
cleans were a long-running bug; they kept coming back because an auto-generator ran on
every dashboard load throttled by **per-device** `localStorage`, and nothing enforced
uniqueness — so any device could regenerate rows another had just cleared. Don't
reintroduce either gap.

- **One clean per client per day.** Enforced by DB constraint
  `clean_events_one_per_customer_day` — `UNIQUE (customer_id, scheduled_date)`. Inserts
  must use `upsert(..., { onConflict: 'customer_id,scheduled_date', ignoreDuplicates })`
  or handle Postgres error `23505`. Do not drop this constraint.
- **Inactive clients have no future scheduled cleans.** Deactivating a client deletes
  **all** their future `scheduled` events; paid/done/cancelled are kept for records.
- **No duplicate client records.** Client creation warns if the name already exists
  (active *or* inactive) — reactivate the existing record instead of making a second.
- **Auto-gen throttle is shared, not per-device.** Lives in
  `clean_business_settings.schedule_last_generated_at`, not `localStorage`.

Relevant code: `src/lib/schedule-generator.ts`, `src/components/AddCustomerSheet.tsx`,
`src/app/(dashboard)/dashboard/customers/[id]/page.tsx`. Migration:
`supabase/migrations/20260531_clean_dedup_and_constraints.sql`.

# Home screen is the entry point (2026-07-01)

`/dashboard` redirects to `/dashboard/home` — the operator-facing landing built for
Julie's daily use, **not** the admin dashboard. Home surfaces three things:
today's cleans (with one-tap Arrive/Mark Done/Log Payment), **missed cleans**
(`status = 'scheduled'` AND `scheduled_date < today` — cleans that were never closed
out), and payments due (`status IN ('done','payment_pending')`). All resolve actions
reuse `CleanEventSheet`; Home adds no new mutation logic and no schema. Code:
`src/app/(dashboard)/dashboard/home/page.tsx`.

The **admin dashboard** (`/dashboard/admin`, reached via Settings) is the owner-only
financial view (YTD, compliance, month-end close) — keep it separate from Home.

# Admin is organized by person (2026-07-02)

The admin financial views are framed around **each person's own money**, not a
generic monthly/yearly split. Tabs (`src/components/AdminTabs.tsx`): **Julie ·
Daniel · Payroll · Yearly · Taxes**. Routes are kept stable and do **not** match the
labels — don't "fix" this:

- **Julie** → `/dashboard/admin/financials` — her cleaning P&L by month; hero is her
  take-home (`payroll_deposit`) + YTD. Absorbed the old "Monthly" tab.
- **Daniel** → `/dashboard/admin/owner` — owner extra income (`clean_owner_income`);
  leads with "net that stays with you" (`computeOwnerIncome().netToYou`) this month + YTD.
- **Payroll** → `/dashboard/admin/payroll` — reconcile the month: **one combined
  withdrawal** box + **net pay entered per person** (Julie / Daniel). Withdrawal is
  split by estimated share for each person's tax reserve; net pay feeds each person's tab.
- **Yearly** (`/dashboard/admin`) = household overview + compliance checklist. **Taxes**
  = tax summary by year.

Money is written **only** to `clean_*` tables (`clean_monthly_financials` for Julie,
`clean_owner_income` for Daniel). **Nothing is synced to Simple Budgets** — the app
only reads SB expense/budget rows. The `sb_adjustment_*` columns on
`clean_monthly_financials` are placeholders for a planned (unbuilt) Julie→SB sync.

Selected month/year is sticky across tabs via `src/lib/use-admin-period.ts`
(localStorage-backed `useStickyMonthKey` / `useStickyYear`).
