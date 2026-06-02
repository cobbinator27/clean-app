-- Payroll reconcile parity for clean_owner_income.
-- The unified Payroll screen reconciles BOTH people the same way: enter the
-- actual total withdrawal and actual net pay; tax reserve is computed. These
-- two columns store the owner side's actuals (Julie's live in
-- clean_monthly_financials as payroll_withdrawal / payroll_deposit).
--
-- Additive only. Apply via the Supabase SQL editor (project loljmtegtdmvpoounozw).

alter table public.clean_owner_income
  add column if not exists actual_withdrawal numeric,  -- real total payroll withdrawal for the owner
  add column if not exists actual_deposit    numeric;  -- real net pay deposited to the owner
