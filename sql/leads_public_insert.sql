-- ─────────────────────────────────────────────────────────────
-- Public quote form → clean_leads
-- Applied 2026-04-19 via MCP migration: allow_public_lead_submissions
-- ─────────────────────────────────────────────────────────────

-- The `clean_leads` table already has the columns the form uses
-- (name, email, phone, address, heard_from, notes, status).
-- No schema changes needed.

-- Allow anonymous users (public quote form) to INSERT leads,
-- constrained to Julie's household and status='new'.
-- The existing "household members can manage leads" policy remains
-- unchanged for authenticated access.

drop policy if exists "Public can submit leads" on public.clean_leads;

create policy "Public can submit leads"
on public.clean_leads
for insert
to anon
with check (
  household_id = 'd77828c0-f323-46d5-bda0-cb02a5f7ee35'
  and status = 'new'
);

-- ─────────────────────────────────────────────────────────────
-- Verification (2026-04-19):
--   ✅ anon can insert with correct household_id and status='new'
--   ✅ anon blocked when inserting with wrong household_id
--   ✅ anon blocked when inserting with status != 'new'
--   ✅ anon cannot SELECT/UPDATE/DELETE (no other policies apply)
--
-- Note: Supabase JS client defaults to `Prefer: return=minimal`
-- on .insert() without .select(), so no SELECT policy is needed
-- for the quote form to succeed.
-- ─────────────────────────────────────────────────────────────
