# clean. — Complete Project Knowledge Transfer

**Cleaning Business Management Web App · spokane-clean.com**  
Daniel Cobb · April 2026 · v2.0

---

## 1. Project Overview

clean. is a custom web application that replaces a fragmented workflow (Google Calendar + Jotform + Google Sheets + Apps Script) with a single unified system for managing a solo residential cleaning business. Julie Cobb is the cleaner and primary daily user. Daniel Cobb handles admin, finances, and technical maintenance.

The app is live and in active development. Julie is beginning to use it as the primary tool for managing her schedule and payments.

### 1.1 The Three Surfaces

| Surface | Description |
|---|---|
| **Public Website** | Replaces WordPress at spokane-clean.com. SEO-optimized, customer-facing. Includes quote/lead capture form. BUILT — homepage, services, about, contact pages. Route group `(public)` with Header/Footer layout. JSON-LD schema, DM Serif Display heading font. Quote form → `clean_leads` table via server action. Google Voice (509) 720-8067. |
| **Cleaner Portal** | Julie's mobile-first daily app. Schedule view, client management, time tracking, payment logging. BUILT — actively being refined. |
| **Admin Portal** | Daniel's financial dashboard. Income summary, payroll export, tax tracker, compliance calendar, business settings. PARTIALLY BUILT. Tabs: Yearly, Monthly (`/financials`), Owner+ (`/owner` — extra-income tracker, §8.4), Taxes (`/taxes` — combined Julie + owner tax reserve, YTD + by federal quarter). |

### 1.2 The Old Workflow (Replaced)

- Google Calendar — all appointments created and managed manually
- Apps Script — exported calendar events to Google Sheets, generating a clean ID per event (date code + client ID)
- Jotform — Julie submitted two forms per clean: one for time, one for payment
- Google Sheets — Daniel manually reconciled everything, calculated expenses, tracked payroll
- **Pain points:** two form submissions per clean, personal calendar events polluted imports, no single source of truth, manual monthly reconciliation, Google Calendar clunky for rescheduling on mobile

---

## 2. Tech Stack & Infrastructure

| | |
|---|---|
| **Frontend** | Next.js 16 (App Router) + TypeScript + Tailwind CSS |
| **Backend / DB** | Supabase (Postgres + Auth + RLS) — shared project with Simple Budgets |
| **Hosting** | Vercel (free Hobby tier) — auto-deploys from GitHub on push to main |
| **Auth** | Supabase Auth — same accounts as Simple Budgets (Daniel + Julie) |
| **Repo** | github.com/cobbinator27/clean-app |
| **Local path** | /Users/danielcobb/Documents/clean-app |
| **Local dev** | `npm run dev` → http://localhost:3001 |
| **Vercel URL** | clean-app-six.vercel.app (temp) — will move to spokane-clean.com |
| **Supabase project** | loljmtegtdmvpoounozw (same as Simple Budgets) |
| **Primary color** | #2C5F8A (teal blue) |

### 2.1 Key Architecture Decisions

- Same Supabase project as Simple Budgets — enables direct DB-level integration for V1.5 payment sync
- All clean. tables prefixed with `clean_` to avoid conflicts with Simple Budgets tables
- Same RLS pattern: `my_household_id()` helper → `household_members` table lookup
- **Household ID: `d77828c0-f323-46d5-bda0-cb02a5f7ee35`**
- Mobile-first design — Julie uses this on her phone between cleans all day
- No separate admin app — admin view is a section within the same Next.js app

---

## 3. Database Schema

### 3.1 Tables

| Table | Purpose |
|---|---|
| `clean_business_settings` | One row per household. All adjustable rates, targets, Simple Budgets category IDs, home base address for mileage. |
| `clean_leads` | Prospective clients from quote form. Pipeline: new → contacted → quoted → won/lost. |
| `clean_customers` | Active and inactive clients. Recurrence schedule, rates, mileage, notes. |
| `clean_events` | The atomic unit. Every clean is a row. Status pipeline, time tracking, payment, expense snapshots. |
| `clean_monthly_financials` | Monthly summary with finalized flag. Tracks Simple Budgets sync state. |
| `clean_compliance_items` | Tax deadlines, license renewals. Pre-seeded with real dates. |
| `clean_owner_income` | Owner's extra/non-clean income, tracked SEPARATELY from `clean_monthly_financials` (does NOT touch SB). One row per household per month. Has finalize/reconcile columns (`finalized`, `actual_wages`, `actual_tax_reserve`). See §8.4. |

### 3.2 Key Fields — clean_customers

| Field | Notes |
|---|---|
| `status` | `'active'` or `'inactive'` — NOT a boolean `is_active` field |
| `recurrence` | `'weekly'`, `'biweekly'`, `'monthly'`, or `null` |
| `recurrence_day` | `'monday'` through `'sunday'` — lowercase, no hyphens |
| `recurrence_start` | Anchor date for biweekly scheduling — determines which weeks are "on" |
| `one_way_miles` | Auto-calculated via Maps API, stored on record, used for mileage expense |
| `estimated_hours` | Tiered: <$150 = 1.5hrs, <$175 = 2hrs, $175+ = 3hrs |

### 3.3 Key Fields — clean_events

| Field | Notes |
|---|---|
| `status` | `scheduled → arrived → in_progress → done → payment_pending → paid → cancelled` |
| `is_recurring_instance` | `true` = auto-generated by scheduler, `false` = manually added |
| `mileage_expense_snapshot` | Snapshotted at clean creation — rate changes don't affect history |
| `flat_expense_snapshot` | Optional $5 per-clean (phase out post V1.5) |
| `hours_manual_override` | `true` = Julie entered hours manually, don't auto-calculate |
| `sb_transaction_id` | ID of linked Simple Budgets transaction (V1.5) |

### 3.4 Business Settings (Current Values)

| Setting | Value |
|---|---|
| Mileage rate | $0.725/mile (IRS 2024 rate) — adjustable |
| Flat expense per clean | $5.00 — set to $0 after Simple Budgets integration |
| Julie's hourly rate | $20.00/hr — adjustable |
| Payroll overhead factor | 1.08 (8% employer taxes/fees on top of wages) |
| Tax reserve % | 22% of profit — adjustable |
| Monthly gross target | $3,500 |
| Monthly take-home target | $2,900 |
| Employee deduction rate | 7.65% (FICA 6.2% + Medicare 1.45%) |
| SB Income category ID | `149cfb77-1d17-4e46-8070-683e5a4e813f` (Cleaning Income) |
| SB Expense category ID | `112c21b2-d6ac-45f3-b831-9f1bb5097e33` (clean. Business Expenses) |
| SB Supplies category ID | `5ccfe7a4-e80b-48e0-9fb2-3afee4ea3058` (Cleaning Supplies) |

### 3.5 Compliance Items (Pre-Seeded)

| Item | Due Date |
|---|---|
| Business Tax Return | March 15 annually |
| Personal Tax Return | April 15 annually |
| WA Business Excise Tax | April 15 annually |
| Q1 Estimated Tax | April 15 |
| Q2 Estimated Tax | June 16 |
| Q3 Estimated Tax | September 15 |
| Q4 Estimated Tax | January 15 |
| Business License Renewal | July 31 annually |

---

## 4. Active Clients (as of April 2026)

12 active clients. 3 inactive: Lauren Dickinson, Amanda Delise, Jenny Poon.

| Client | Rate | Frequency | Day | Area |
|---|---|---|---|---|
| Tiffanie Keplar | $150 | Bi-Weekly | Thursday | Millwood |
| Katherine Melka | $135 | Bi-Weekly | Thursday | Central Spokane |
| Anne Walter | $110 | Bi-Weekly | Monday | West Spokane |
| Kristen Lee | $125 | Bi-Weekly | Monday | Mt. Spokane |
| Sharon Withrow | $100 | Bi-Weekly | Monday | Mt. Spokane |
| Tom Thomas | $130 | Monthly | — | West Spokane |
| Hannah Owens | $175 | Bi-Weekly | Friday | Deer Park |
| Barb Jones | $125 | Bi-Weekly | Thursday | Colbert |
| Maggie Kazemba | $200 | Monthly | — | Millwood |
| Marina | $130 | Weekly | Tuesday | — |
| Leslie Vancil | $130 | Bi-Weekly | Monday | South Hill |
| Stephanie Grineau | $135 | Bi-Weekly | Thursday | — |

---

## 5. What's Built (Current State)

### 5.1 Feature Status

| Feature | Status | Notes |
|---|---|---|
| Project scaffold | ✅ Done | Next.js 16, Tailwind, Supabase, Vercel deployed |
| Auth / login page | ✅ Done | Shared with Simple Budgets — same Supabase project |
| Bottom nav | ✅ Done | Schedule / Clients / Payments / Settings |
| Schedule view | ✅ Done | Week navigation, day sections, today highlight, empty day collapse |
| Clean event cards | ✅ Done | Status badges, action buttons, tap to open sheet |
| CleanEventSheet | ✅ Done | Full detail sheet with time tracking, payment flow, reschedule |
| Status pipeline | ✅ Done | Tap to advance, long press for full status picker |
| Long press status picker | ✅ Done | On both cards and detail sheet via StatusPicker component |
| Time tracking | ✅ Done | Arrive/depart timestamps, manual entry, auto-calc hours, override |
| Log Payment flow | ✅ Done | Amount → mismatch warning → method pills → confirm |
| Reschedule flow | ✅ Done | "Just this clean" or "This and all future cleans" |
| Clients list page | ✅ Done | Search, Active/Inactive tabs, floating + button |
| Client detail page | ✅ Done | Stats, upcoming/history split, edit mode |
| Client edit / save | ✅ Done | All fields including recurrence — constraint bug fixed |
| Add Client sheet | ✅ Done | Full form with recurrence fields |
| Deactivate client workflow | ✅ Done | Prompts to remove future cleans on deactivation |
| Rebuild schedule prompt | ✅ Done | Triggers when recurrence fields change on save |
| Payments tab | ✅ Done | Outstanding + history, inline payment logging |
| Add Clean modal | ✅ Done | Client selector, date, type, amount — wired to + button |
| Schedule generator | ✅ Done | Generates 10 weeks rolling, biweekly anchor logic |
| Duplicate detection | ✅ Done | Date-only matching, never recreates cancelled events |
| Auto-run on load | ✅ Done | Runs silently, max once per 6 hours via localStorage |
| Settings page | ✅ Done | Refresh schedule, rebuild all, account, sign out |
| Address copy button | ✅ Done | Clipboard copy with checkmark feedback, no accidental map opens |
| Client data import | ✅ Done | All 12 active clients seeded with real April schedule |
| Compliance items seeded | ✅ Done | 8 tax/license deadlines pre-loaded |
| Business settings seeded | ✅ Done | All rates and targets saved to DB |
| Pacing engine | ✅ Done | `src/lib/pacing.ts` — real-time net income calculation, upserts to `clean_monthly_financials` |
| Admin financials page | ✅ Done | `/dashboard/admin/financials` — pacing dashboard, month-end finalize with actual payroll |

---

## 6. What's In Progress / Needs Fixing

### 6.1 Known Bugs

| Bug | Status | Notes |
|---|---|---|
| Duplicate Log Payment button | ✅ Fixed | Commit 6670945 |
| Week header shows wrong date | 🔧 Fix needed | Shows "Apr 6" instead of "Apr 7" — minor UTC offset display bug |

### 6.2 Queued Prompts

All previously queued prompts (17, 18, 9a, 9) have been completed.

---

## 7. Full Roadmap

### V1 — Remaining to Complete

| Feature | Notes |
|---|---|
| ~~Public website~~ | ✅ BUILT. Home, Services, About, Contact/Quote form. JSON-LD schema, DM Serif Display font, route groups. Needs: RLS policy for anonymous lead inserts, Deer Park area page (V3), domain DNS migration. |
| Lead management | Quote form → Lead record → Pipeline (New/Contacted/Quoted/Won/Lost) → Convert to Client |
| Admin financial dashboard | Monthly gross, payroll cost, mileage expenses, profit, tax reserve, take-home. Mirrors existing spreadsheet formulas. |
| Payroll export | Monthly hours CSV for payroll company. Mark month as submitted. |
| Tax & compliance tracker UI | Compliance items view — mark paid, due-soon alerts on dashboard. |
| Business settings UI | Editable rates, targets, home base address, mileage rate, SB category IDs. |
| Google Calendar iCal feed | Read-only feed URL Julie adds to Google Calendar for visibility. |
| Mileage auto-calculation | Google Maps Distance Matrix API — calculates one_way_miles when address saved. |
| Domain migration | Move spokane-clean.com DNS from Bluehost to Vercel. Drop WordPress. Public site is built and deployed — just needs DNS cutover. |
| Julie onboarding | Walk Julie through the app, train on daily workflow, get her off Jotform. |

### V1.5 — Simple Budgets Integration

Both apps share the same Supabase project. clean. maintains a **net_to_household** number in `clean_monthly_financials` that SB reads directly — no per-payment transactions are synced. This number updates in real time on every schedule change and becomes finalized after Daniel runs payroll at month-end.

**Integration is bidirectional:**
- clean. → SB: `net_to_household` feeds the Cleaning Income category's "actual" amount
- SB → clean.: Pacing engine pulls expense totals from SB's `transactions` table (Business Expenses + Cleaning Supplies categories)

| Feature | Status | Notes |
|---|---|---|
| Pacing engine (`src/lib/pacing.ts`) | ✅ Built | `recalculatePacing()` computes full financial breakdown, upserts to `clean_monthly_financials` |
| Real-time pacing updates | ✅ Built | Fires on every event mutation: payment, cancel, reschedule, add, schedule generation, deactivation |
| Admin financials page | ✅ Built | `/dashboard/admin/financials` — month nav, full breakdown, event counts, finalization |
| Month-end finalize | ✅ Built | Enter actual payroll withdrawal + deposit → finalize → locks month |
| SB Dashboard reads pacing | ✅ Built | SB reads `net_to_household` from `clean_monthly_financials` for Cleaning Income category |
| SB expense pull | ✅ Built | Pacing queries SB `transactions` for Business Expenses + Cleaning Supplies categories |
| SQL prerequisites | ✅ Done | All columns verified and created |
| SB category IDs | ✅ Configured | Income, Business Expenses, and Cleaning Supplies categories linked |

**Architecture:**
- clean. owns all business finances: gross, mileage, tax reserves, payroll estimates
- SB provides expense data (recurring business expenses + cleaning supplies)
- SB reads the net income number (pacing during month, finalized after payroll)
- No individual payment transactions flow to SB — cleaner separation
- `clean_monthly_financials.net_to_household` is the bridge field SB reads

### V2 — Payments + Customer Portal

- Stripe card + ACH bank transfer payment processing
- Customer self-service portal — upcoming cleans, autopay setup
- Two-way Google Calendar sync via API
- Automated payment reminders (text/email)
- Review capture — post-payment prompt with Google Business Profile direct link
- Google Business Profile link stored in Business Settings

### V3 — Intelligence + SEO

- Service area landing pages — /deer-park-house-cleaning (priority), /spokane-valley, /south-hill, etc.
- Google Local Services Ads setup
- Paid campaign landing page (separate URL, single CTA)
- AI-assisted recurring transaction detection
- Plaid bank connection
- Automated payroll export

---

## 8. Financial Model

### 8.1 Per-Clean Calculations

| | Formula |
|---|---|
| Mileage expense | `one_way_miles × 2 × $0.725` — snapshotted at clean creation |
| Flat expense | $5.00 per clean (optional) |
| Estimated hours | Tier: `<$150 = 1.5h`, `<$175 = 2h`, `$175+ = 3h` — replaced by actual `hours_logged` when available |

### 8.2 Monthly Pacing Formula

| | Formula |
|---|---|
| Gross Income | Sum of `actual_amount` (if paid) or `expected_amount` for all non-cancelled events |
| Gross Wages | `total_hours × $20/hr` (pure labor, no overhead) |
| Payroll Withdrawal | `Gross Wages × 1.08` (employer taxes: FICA + Medicare + FUTA) — estimated during month, actual at finalization |
| Payroll Deposit | `Gross Wages × 0.9235` (after 7.65% employee FICA/Medicare) — estimated during month, actual at finalization |
| Total Expenses | Mileage + SB Business Expenses + SB Cleaning Supplies + Flat Per-Clean |
| Income as Profit | `Gross Income - Payroll Withdrawal - Total Expenses` |
| Tax Reserve (22%) | `Income as Profit × 0.22` |
| Transfer to Bank | `Tax Reserve + Payroll Withdrawal` (what Daniel moves to separate account) |
| Net to Household | `Gross Income - Transfer to Bank + Payroll Deposit` (THE pacing number SB reads) |

### 8.3 March 2026 Example (Verified Against Actual Payroll)

| | Amount |
|---|---|
| Gross Income | $3,160.00 |
| Gross Wages (40.5 hrs × $20) | $810.00 |
| Payroll Withdrawal ($810 × 1.08) | $876.82 |
| Payroll Deposit (Julie's take-home) | $748.04 |
| Total Expenses (mileage + SB) | $620.00 |
| Income as Profit | $1,663.18 |
| Tax Reserve (22%) | $365.90 |
| Transfer to Bank | $1,242.72 |
| Net to Household | ~$2,665 |

### 8.4 Owner / Extra Income (added May 2026)

**Why:** clean. is taxed as an **S-corp**, so Daniel is an owner-employee whose pay is correctly W-2 wages + distributions (not an owner's draw). Extra/non-clean business income for 2026 is booked as clean. income at the *same blended ratios* as Julie's real months — a deliberate stopgap until per-source deductions are broken out properly in a future tax year.

**How it works:** On the Owner+ tab (`/dashboard/admin/owner`), enter a flat extra amount for a month. It reads *that same month's* actual ratios from `clean_monthly_financials` (wage ratio = `gross_wages / gross_income`) and splits the amount using the same payroll/tax formulas as §8.2 — owner W-2 wages (reasonable comp), employee/employer payroll tax, profit/distribution, and tax reserve. An expense-free vs. mirror-month-expenses toggle controls whether phantom expenses are subtracted (default expense-free = conservative, reserves more for tax).

**Kept separate:** Nothing here writes to `clean_monthly_financials` or syncs to Simple Budgets. Daniel moves the money manually for now.

**Reconcile:** A month can be "locked in" with actuals (`actual_wages`, `actual_tax_reserve`) — same pattern as month-end finalize on `clean_monthly_financials`. Locked months show actuals everywhere instead of the estimate.

**Tax Center** (`/dashboard/admin/taxes`): combined view of tax reserve across BOTH sides — Julie (`clean_monthly_financials.tax_reserve`) + owner (`clean_owner_income`) — as YTD and per **federal estimated-tax quarter** (Q2 = Apr–May, Q4 = Sep–Dec, NOT calendar quarters). Locked owner months use actuals; others use the live estimate.

**Code:** `src/lib/owner-income.ts` (per-month breakdown), `src/lib/tax-summary.ts` (combined aggregation), pages under `src/app/(dashboard)/dashboard/admin/{owner,taxes}/`. Migrations: `20260531_clean_owner_income.sql` + `..._finalize.sql` (both applied to project `loljmtegtdmvpoounozw`).

> ⚠️ **CPA caveat:** the wage-vs-distribution split currently mirrors Julie's ratio. The S-corp **"reasonable compensation"** amount is the figure the IRS scrutinizes — confirm it with a CPA before relying on these numbers at filing. This tool shows money *set aside*, not a filed tax calculation.

---

## 9. Brand & Marketing Strategy

### 9.1 Positioning

> *clean. is for people who want someone they trust in their home — not a rotating crew, not the cheapest option, not a task list. A relationship.*

Three differentiators (keep these from the current website):
- **flexible.** — customizable tasks, not a fixed checklist
- **stress-free.** — same person every time, the owner herself
- **family.** — treats clients like family, builds real relationships

### 9.2 Ideal Client

- Dual-income household or busy professional — values time over saving $20
- Generally tidy home — wants it to feel really clean, not managed
- Wants someone dependable they can trust with a key
- NOT: price shoppers, people who want to micromanage, clients needing heavy baseline deep cleaning

### 9.3 Local SEO Priority

- **Google Business Profile** — top priority. 2 reviews → 20+ is the goal. Review prompt in V2 customer portal.
- LocalBusiness schema markup baked into new website
- **Deer Park service area page** — priority given existing client density and community presence
- Other area pages: Spokane Valley, North Spokane, South Hill, Suncrest
- Google Local Services Ads — when ready, after organic + GBP optimized

---

## 10. Development Workflow

### 10.1 How to Work on This App

| Task | How |
|---|---|
| Brainstorming | Use Claude chat for product decisions, architecture, SQL, and planning |
| Building | Paste large prompts into VS Code Claude agent — handles all file creation, editing, terminal |
| Deploying | `git add . && git commit -m 'message' && git push` → Vercel auto-deploys |
| Database changes | Run SQL in Supabase SQL editor: supabase.com/dashboard/project/loljmtegtdmvpoounozw/sql/new |
| Testing | Desktop: localhost:3001 · Mobile: Vercel URL on iPhone |

### 10.2 Prompt Writing Guidelines

When writing VS Code agent prompts:
- One large comprehensive prompt per feature area — the agent handles everything end to end
- Always specify file paths explicitly (`src/app/dashboard/...`, `src/components/...`)
- Always specify the Supabase pattern: `createClient()` from `@/lib/supabase`, `household_id` from `household_members`
- Specify the design: mobile-first, `#2C5F8A` primary, `rounded-2xl` cards, bottom sheets with drag handle
- Include the TypeScript types: `CleanEvent`, `CleanCustomer` from `@/types/clean`
- For status updates: always call `onUpdate` with the updated event for optimistic UI

### 10.3 Critical Code Patterns

**Getting household_id (client-side):**
```typescript
const { data: { user } } = await supabase.auth.getUser()
const { data: member } = await supabase
  .from('household_members')
  .select('household_id')
  .eq('user_id', user.id)
  .single()
const householdId = member.household_id
```

**Supabase constraint values (must match exactly):**
- `recurrence`: `'weekly'` | `'biweekly'` | `'monthly'` | `null` — NOT `'bi-weekly'`, `'Biweekly'`, `'none'`
- `recurrence_day`: `'monday'` | `'tuesday'` | ... | `'sunday'` — lowercase, no hyphens
- `status` (events): `'scheduled'` | `'arrived'` | `'in_progress'` | `'done'` | `'payment_pending'` | `'paid'` | `'cancelled'`
- `status` (customers): `'active'` | `'inactive'` — NOT a boolean `is_active`

### 10.4 Common Pitfalls

- `my_household_id()` returns null in Supabase SQL editor — always use the hardcoded household ID for manual queries
- Generator duplicate detection must be **date-only** — never match on `scheduled_time`
- Generator **never recreates cancelled events** — check status in existingDates Set
- Expense values are **snapshotted at event creation** — don't recalculate from current settings
- `recurrence_start` is the biweekly anchor — if null, generator skips that client
- Status updates must call `onUpdate` with full updated event for optimistic UI
- **Pacing:** Any code that mutates events must call `recalculatePacing(supabase, householdId, monthKey)` (fire-and-forget with `.catch(console.error)`). The pacing engine skips finalized months.

### 10.5 Pacing / SB Integration Pattern

The V1.5 integration uses a **pacing model** — NOT per-payment transaction sync:

- `src/lib/pacing.ts` contains `recalculatePacing()` — queries all non-cancelled events for a month, pulls SB expenses, computes full financial breakdown, upserts to `clean_monthly_financials`
- The `net_to_household` field in `clean_monthly_financials` is THE number SB reads
- Business settings are cached with 5-min TTL via `fetchBusinessSettings()`
- Finalized months are locked — `recalculatePacing()` skips them
- Admin page at `/dashboard/admin/financials` (no nav entry — Daniel navigates directly)
- Estimated hours use tier: `<$150 = 1.5h`, `<$175 = 2h`, `$175+ = 3h`
- Pacing formula: `Net = Gross - (TaxReserve + PayrollWithdrawal) + PayrollDeposit`
- Tax reserve applies to income as profit: `(Gross - PayrollWithdrawal - AllExpenses) × tax_reserve_pct`
- SB expenses (Business Expenses + Cleaning Supplies categories) are pulled from SB `transactions` table each recalculation
- Admin page target pulls from SB `monthly_budgets` for the Cleaning Income category, not from static business settings

---

## 11. Important SQL Reference

> All queries in SQL editor must use the hardcoded household ID, not `my_household_id()`

**Get all active clients:**
```sql
select id, name, recurrence, recurrence_day, recurrence_start
from clean_customers
where household_id = 'd77828c0-f323-46d5-bda0-cb02a5f7ee35'
and status = 'active'
order by name;
```

**Get all events for a week:**
```sql
select ce.scheduled_date, cc.name, ce.status, ce.expected_amount
from clean_events ce
join clean_customers cc on cc.id = ce.customer_id
where ce.household_id = 'd77828c0-f323-46d5-bda0-cb02a5f7ee35'
and ce.scheduled_date between '2026-04-07' and '2026-04-13'
order by ce.scheduled_date, ce.scheduled_time;
```

**Find duplicate events:**
```sql
select customer_id, scheduled_date, count(*)
from clean_events
where household_id = 'd77828c0-f323-46d5-bda0-cb02a5f7ee35'
group by customer_id, scheduled_date
having count(*) > 1;
```

**Safe delete future unconfirmed events for a client:**
```sql
delete from clean_events
where customer_id = '[CLIENT_ID]'
and scheduled_date >= current_date
and status = 'scheduled'
and arrived_at is null
and notes is null
and hours_manual_override = false;
```

**Update client recurrence:**
```sql
update clean_customers
set recurrence = 'biweekly',
    recurrence_day = 'tuesday',
    recurrence_start = '2026-04-07'
where id = '[CLIENT_ID]'
and household_id = 'd77828c0-f323-46d5-bda0-cb02a5f7ee35';
```

**Monthly financial summary:**
```sql
select
  sum(case when status = 'paid' then actual_amount else 0 end) as gross_income,
  sum(mileage_expense_snapshot) as total_mileage,
  count(*) filter (where status = 'paid') as paid_cleans,
  count(*) filter (where status = 'payment_pending') as outstanding_cleans,
  sum(hours_logged) as total_hours
from clean_events
where household_id = 'd77828c0-f323-46d5-bda0-cb02a5f7ee35'
and to_char(scheduled_date, 'YYYY-MM') = '2026-04';
```

---

*clean. Knowledge Transfer · Daniel Cobb · April 2026 · v2.0*
