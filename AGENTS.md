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
