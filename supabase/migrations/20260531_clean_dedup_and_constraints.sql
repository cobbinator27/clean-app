-- Stop duplicate / ghost cleans at the source.
--
-- Apply via the Supabase SQL editor (project ref: loljmtegtdmvpoounozw) AFTER
-- you've reviewed the audit output. This migration is in two parts:
--   A. Collapse existing same-client / same-day duplicate cleans down to one row.
--   B. Add a UNIQUE constraint so the database itself refuses a second clean for
--      the same client on the same day from now on.
-- Plus a shared "last generated" timestamp so the auto-generator coordinates
-- across devices instead of racing (Julie's phone vs. the laptop).
--
-- Read part A before running — it DELETES rows. It only ever deletes the
-- *lower-value* duplicate when two cleans share a client + date, keeping the one
-- that represents the most real work/money (paid > done > … > scheduled).

begin;

-- ── A. Collapse existing duplicates ──────────────────────────────────────────
-- For each (customer_id, scheduled_date) that has more than one row, keep the
-- single highest-priority row and delete the rest. Priority favours rows that
-- represent completed work or money so we never lose a real record.
with ranked as (
  select
    id,
    row_number() over (
      partition by customer_id, scheduled_date
      order by
        case status
          when 'paid'            then 0
          when 'payment_pending' then 1
          when 'done'            then 2
          when 'in_progress'     then 3
          when 'arrived'         then 4
          when 'scheduled'       then 5
          when 'cancelled'       then 6
          else 7
        end,
        -- tie-break: prefer rows that were actually touched (have notes / arrival)
        (arrived_at is null),
        (notes is null),
        id
    ) as rn
  from clean_events
)
delete from clean_events
where id in (select id from ranked where rn > 1);

-- ── B. Enforce one clean per client per day going forward ─────────────────────
-- A full unique constraint: at most one clean_events row per (customer_id,
-- scheduled_date). The app already treats a date as "occupied" regardless of
-- status, so this matches existing behaviour — it just makes the DB enforce it
-- instead of trusting an application-level check that two devices can race past.
alter table clean_events
  add constraint clean_events_one_per_customer_day
  unique (customer_id, scheduled_date);

-- ── C. Shared auto-generator throttle ─────────────────────────────────────────
-- The generator's "don't re-run within 6h" guard lived in per-device
-- localStorage, so each device had its own timer and they raced. Move the
-- timestamp into the household's settings row so all devices share one clock.
alter table clean_business_settings
  add column if not exists schedule_last_generated_at timestamptz;

commit;
