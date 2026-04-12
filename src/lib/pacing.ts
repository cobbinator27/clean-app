import type { SupabaseClient } from '@supabase/supabase-js'
import type { CleanBusinessSettings, CleanMonthlyFinancials } from '@/types/clean'

// ── Settings cache ───────────────────────────────────────────────────────────

let cachedSettings: CleanBusinessSettings | null = null
let cachedSettingsAt = 0
const SETTINGS_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function fetchBusinessSettings(
  supabase: SupabaseClient,
  householdId: string
): Promise<CleanBusinessSettings | null> {
  if (cachedSettings && Date.now() - cachedSettingsAt < SETTINGS_TTL_MS) {
    return cachedSettings
  }
  const { data, error } = await supabase
    .from('clean_business_settings')
    .select('*')
    .eq('household_id', householdId)
    .single()
  if (error || !data) {
    console.error('[pacing] Failed to load business settings:', error?.message)
    return null
  }
  cachedSettings = data as CleanBusinessSettings
  cachedSettingsAt = Date.now()
  return cachedSettings
}

// ── Estimated hours tier ─────────────────────────────────────────────────────

function estimateHours(expectedAmount: number | null): number {
  if (!expectedAmount) return 1.5
  if (expectedAmount < 150) return 1.5
  if (expectedAmount < 175) return 2
  return 3
}

// ── Main recalculation ───────────────────────────────────────────────────────

interface EventRow {
  expected_amount: number | null
  actual_amount: number | null
  status: string
  hours_logged: number | null
  mileage_expense_snapshot: number | null
  customer_id: string
}

interface CustomerMileage {
  id: string
  one_way_miles: number | null
}

export async function recalculatePacing(
  supabase: SupabaseClient,
  householdId: string,
  monthKey: string // 'YYYY-MM'
): Promise<void> {
  // 1. Check if month is already finalized — don't overwrite
  const { data: existing } = await supabase
    .from('clean_monthly_financials')
    .select('id, finalized')
    .eq('household_id', householdId)
    .eq('month_key', monthKey)
    .maybeSingle()

  if (existing?.finalized) return

  // 2. Load business settings
  const settings = await fetchBusinessSettings(supabase, householdId)
  if (!settings) return

  // 3. Load all non-cancelled events for the month
  const monthStart = `${monthKey}-01`
  const nextMonth = incrementMonth(monthKey)
  const nextMonthStart = `${nextMonth}-01`

  const { data: eventData, error: evErr } = await supabase
    .from('clean_events')
    .select('expected_amount, actual_amount, status, hours_logged, mileage_expense_snapshot, customer_id')
    .eq('household_id', householdId)
    .gte('scheduled_date', monthStart)
    .lt('scheduled_date', nextMonthStart)
    .neq('status', 'cancelled')

  if (evErr) {
    console.error('[pacing] Failed to load events:', evErr.message)
    return
  }

  const events = (eventData ?? []) as EventRow[]

  // 4. For events missing mileage, look up customer one_way_miles
  const customerIdsNeedingMileage = [
    ...new Set(
      events
        .filter(e => e.mileage_expense_snapshot == null)
        .map(e => e.customer_id)
    ),
  ]

  const customerMileageMap: Map<string, number> = new Map()
  if (customerIdsNeedingMileage.length > 0) {
    const { data: custData } = await supabase
      .from('clean_customers')
      .select('id, one_way_miles')
      .in('id', customerIdsNeedingMileage)

    for (const c of (custData ?? []) as CustomerMileage[]) {
      customerMileageMap.set(c.id, c.one_way_miles ?? 0)
    }
  }

  // 5. Calculate totals
  let grossIncome = 0
  let expectedIncome = 0
  let totalHours = 0
  let totalMileage = 0

  for (const event of events) {
    // Revenue: actual if paid, expected otherwise
    const revenue = event.status === 'paid'
      ? (event.actual_amount ?? event.expected_amount ?? 0)
      : (event.expected_amount ?? 0)
    grossIncome += revenue

    // Expected: always from expected_amount (before actuals)
    expectedIncome += event.expected_amount ?? 0

    // Hours: logged if available, else estimate from amount tier
    const hours = event.hours_logged ?? estimateHours(event.expected_amount)
    totalHours += hours

    // Mileage: snapshot if available, else compute from customer
    let mileage = event.mileage_expense_snapshot
    if (mileage == null) {
      const oneWay = customerMileageMap.get(event.customer_id) ?? 0
      mileage = oneWay * 2 * settings.mileage_rate
    }
    totalMileage += mileage
  }

  const grossWages = totalHours * settings.hourly_rate * settings.payroll_overhead_factor
  const flatExpense = events.length * settings.flat_expense_per_clean
  const taxableIncome = grossIncome - totalMileage
  const taxReserve = taxableIncome * settings.tax_reserve_pct
  const incomeAsProfit = grossIncome - grossWages - totalMileage - flatExpense
  const netToHousehold = grossIncome - grossWages - taxReserve

  // 6. Upsert into clean_monthly_financials
  const row = {
    household_id: householdId,
    month_key: monthKey,
    gross_income: round2(grossIncome),
    expected_income: round2(expectedIncome),
    total_mileage_expense: round2(totalMileage),
    total_flat_expense: round2(flatExpense),
    gross_wages: round2(grossWages),
    income_as_profit: round2(incomeAsProfit),
    tax_reserve: round2(taxReserve),
    net_to_household: round2(netToHousehold),
    total_hours: round2(totalHours),
  }

  if (existing) {
    const { error } = await supabase
      .from('clean_monthly_financials')
      .update(row)
      .eq('id', existing.id)
    if (error) console.error('[pacing] Failed to update financials:', error.message)
  } else {
    const { error } = await supabase
      .from('clean_monthly_financials')
      .insert({ ...row, finalized: false, payroll_submitted: false })
    if (error) console.error('[pacing] Failed to insert financials:', error.message)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function incrementMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  if (m === 12) return `${y + 1}-01`
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
