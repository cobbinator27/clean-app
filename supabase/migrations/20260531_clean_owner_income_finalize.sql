-- Reconciliation / finalize support for clean_owner_income.
-- Adds the ability to lock in a month with the OWNER'S ACTUAL numbers
-- (what really ran through payroll as wages, and what was actually set aside
-- for taxes), mirroring the month-end "finalize" flow on clean_monthly_financials.
--
-- Additive only — safe to run after 20260531_clean_owner_income.sql.
-- Apply via the Supabase SQL editor (project ref: loljmtegtdmvpoounozw).

alter table public.clean_owner_income
  add column if not exists finalized          boolean     not null default false,
  add column if not exists finalized_at        timestamptz,
  add column if not exists actual_wages        numeric,     -- real W-2 wages run for the owner that month
  add column if not exists actual_tax_reserve  numeric;     -- real amount set aside for taxes
