-- Owner / extra-income tracking, kept SEPARATE from clean_monthly_financials.
-- One row per household per month: the flat extra amount. The wage/tax/profit
-- breakdown is computed live in the app from that month's real financials, so it
-- is intentionally NOT stored here.
--
-- Apply via the Supabase SQL editor (project ref: loljmtegtdmvpoounozw). If your
-- households table is named differently, adjust the FK reference below.

create table if not exists public.clean_owner_income (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  month_key       text not null,                 -- 'YYYY-MM'
  amount          numeric not null default 0,
  mirror_expenses boolean not null default false,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (household_id, month_key)
);

alter table public.clean_owner_income enable row level security;

-- Household-scoped access, mirroring the other clean_* tables.
create policy "owner_income_household_access"
  on public.clean_owner_income
  for all
  using (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );
