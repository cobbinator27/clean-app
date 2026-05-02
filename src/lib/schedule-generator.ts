import type { SupabaseClient } from '@supabase/supabase-js'
import type { CleanCustomer, CleanEvent } from '@/types/clean'
import {
  toLocalDateString,
  addDays,
  nextDayOfWeek,
  isBiweeklyOn,
} from './date-utils'
import { recalculatePacing } from './pacing'

const WEEKS_AHEAD = 10
const AUTO_RUN_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours
export const LAST_GENERATED_KEY = 'clean_last_generated'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecurringCustomer extends Pick<
  CleanCustomer,
  'id' | 'name' | 'primary_rate' | 'recurrence' | 'recurrence_day' | 'recurrence_start'
> {
  household_id: string
}

export interface GeneratorResult {
  generated: number
  skipped: number
  protected: number
  customers: number
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate recurring clean events for all active clients with a recurrence
 * schedule. Looks ahead WEEKS_AHEAD weeks from today.
 *
 * Safety rules:
 * - Events with status != 'scheduled', non-null notes, or non-null arrived_at
 *   are "protected" and are never touched.
 * - Plain 'scheduled' events with no modifications are left in place (skipped).
 * - Bi-weekly customers without recurrence_start are skipped — we won't guess.
 * - Uses a single batch insert per customer for performance.
 */
export async function generateRecurringEvents(
  supabase: SupabaseClient,
  householdId: string
): Promise<GeneratorResult> {
  // 1. Load active customers with a recurrence set
  const { data: customerData, error: cxErr } = await supabase
    .from('clean_customers')
    .select('id, name, primary_rate, recurrence, recurrence_day, recurrence_start, household_id')
    .eq('household_id', householdId)
    .eq('status', 'active')
    .not('recurrence', 'is', null)

  if (cxErr) throw new Error(`Failed to load clients: ${cxErr.message}`)

  const customers = (customerData ?? []) as RecurringCustomer[]
  if (customers.length === 0) return { generated: 0, skipped: 0, protected: 0, customers: 0 }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = addDays(today, WEEKS_AHEAD * 7)

  let totalGenerated = 0
  let totalSkipped = 0
  let totalProtected = 0

  for (const customer of customers) {
    if (!customer.recurrence) continue

    // Bi-weekly requires an anchor — skip without one
    if (customer.recurrence === 'biweekly' && !customer.recurrence_start) {
      console.warn(`[schedule-generator] Skipping ${customer.name} — bi-weekly but no recurrence_start set`)
      continue
    }

    const candidateDates = buildCandidateDates(customer, today, endDate)
    if (candidateDates.length === 0) continue

    // 2. Fetch ALL existing events for this customer in the window (including cancelled)
    const { data: existingData } = await supabase
      .from('clean_events')
      .select('scheduled_date, status, notes, arrived_at')
      .eq('customer_id', customer.id)
      .gte('scheduled_date', toLocalDateString(today))
      .lte('scheduled_date', toLocalDateString(endDate))

    const existing = (existingData ?? []) as Array<{
      scheduled_date: string
      status: string
      notes: string | null
      arrived_at: string | null
    }>

    // Build a Set of all occupied dates (any status, including cancelled)
    const existingDates = new Set(existing.map(e => e.scheduled_date))

    // Separately track protected dates for the result count
    const protectedDates = new Set(
      existing
        .filter(e =>
          e.status !== 'scheduled' ||
          (e.notes !== null && e.notes.trim() !== '') ||
          e.arrived_at !== null
        )
        .map(e => e.scheduled_date)
    )

    // 3. Determine which dates need a new insert
    const seriesId = crypto.randomUUID()
    const toInsert: object[] = []

    for (const dateStr of candidateDates) {
      if (existingDates.has(dateStr)) {
        // Any existing event on this date (including cancelled) → skip
        if (protectedDates.has(dateStr)) {
          totalProtected++
        } else {
          totalSkipped++
        }
        continue
      }

      // No event on this date — queue for insert
      toInsert.push({
        household_id: customer.household_id ?? householdId,
        customer_id: customer.id,
        scheduled_date: dateStr,
        scheduled_time: null,
        status: 'scheduled',
        event_type: 'regular',
        is_recurring_instance: true,
        recurrence_series_id: seriesId,
        expected_amount: customer.primary_rate ?? null,
      })
    }

    // 4. Batch insert
    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from('clean_events').insert(toInsert)
      if (!insertErr) {
        totalGenerated += toInsert.length
      } else {
        console.error(`[schedule-generator] Insert failed for ${customer.name}:`, insertErr.message)
      }
    }
  }

  // Recalculate pacing for all affected months
  if (totalGenerated > 0) {
    const affectedMonths = new Set<string>()
    const cursor = new Date(today)
    while (cursor <= endDate) {
      affectedMonths.add(toLocalDateString(cursor).substring(0, 7))
      cursor.setMonth(cursor.getMonth() + 1)
      cursor.setDate(1)
    }
    for (const monthKey of affectedMonths) {
      recalculatePacing(supabase, householdId, monthKey).catch(console.error)
    }
  }

  return {
    generated: totalGenerated,
    skipped: totalSkipped,
    protected: totalProtected,
    customers: customers.length,
  }
}

// ── Wipe & rebuild ────────────────────────────────────────────────────────────

export interface RebuildResult {
  removed: number
  generated: number
  skipped: number
  protected: number
  customers: number
}

/**
 * Wipe all unprotected future events for the household, then regenerate from
 * each active customer's current recurrence settings.
 *
 * "Unprotected" matches the same rules as the per-customer cleanup:
 *   status='scheduled', notes IS NULL, arrived_at IS NULL,
 *   hours_manual_override IS NULL or false.
 *
 * Anything paid, cancelled, in-progress, or manually edited stays put.
 */
export async function wipeAndRebuildSchedule(
  supabase: SupabaseClient,
  householdId: string
): Promise<RebuildResult> {
  const todayStr = toLocalDateString(new Date())

  const { data: deleted, error: delErr } = await supabase
    .from('clean_events')
    .delete()
    .eq('household_id', householdId)
    .gte('scheduled_date', todayStr)
    .eq('status', 'scheduled')
    .is('arrived_at', null)
    .is('notes', null)
    .or('hours_manual_override.is.null,hours_manual_override.eq.false')
    .select('id')

  if (delErr) throw new Error(`Wipe failed: ${delErr.message}`)
  const removed = deleted?.length ?? 0

  const gen = await generateRecurringEvents(supabase, householdId)

  return {
    removed,
    generated: gen.generated,
    skipped: gen.skipped,
    protected: gen.protected,
    customers: gen.customers,
  }
}

// ── Auto-run helper ───────────────────────────────────────────────────────────

/**
 * Run the generator silently if it hasn't run in the last AUTO_RUN_INTERVAL_MS.
 * Safe to call on every page load — throttled by localStorage timestamp.
 */
export async function autoGenerateIfStale(
  supabase: SupabaseClient,
  householdId: string
): Promise<void> {
  const lastRun = localStorage.getItem(LAST_GENERATED_KEY)
  if (lastRun) {
    const elapsed = Date.now() - new Date(lastRun).getTime()
    if (elapsed < AUTO_RUN_INTERVAL_MS) return
  }

  try {
    const result = await generateRecurringEvents(supabase, householdId)
    localStorage.setItem(LAST_GENERATED_KEY, new Date().toISOString())
    if (result.generated > 0) {
      console.log(`[schedule-generator] Auto-generated ${result.generated} cleans across ${result.customers} clients`)
    }
  } catch (err) {
    console.error('[schedule-generator] Auto-run failed:', err)
  }
}

// ── Exported helper ───────────────────────────────────────────────────────────

/**
 * Given a list of events for a customer, returns the earliest event date
 * (from scheduled, arrived, done, or paid events) as an anchor for recurrence_start.
 */
export function getAnchorDateFromEvents(customerEvents: CleanEvent[]): string | null {
  const relevant = customerEvents
    .filter(e => ['scheduled', 'arrived', 'in_progress', 'done', 'paid'].includes(e.status))
    .map(e => e.scheduled_date)
    .sort()
  return relevant[0] ?? null
}

// ── Internal date helpers ─────────────────────────────────────────────────────

function buildCandidateDates(customer: RecurringCustomer, from: Date, to: Date): string[] {
  const { recurrence, recurrence_day, recurrence_start } = customer
  const dates: string[] = []

  if (recurrence === 'weekly') {
    const dayName = recurrence_day ?? 'monday'
    let cursor = nextDayOfWeek(from, dayName)
    while (cursor <= to) {
      dates.push(toLocalDateString(cursor))
      cursor = addDays(cursor, 7)
    }

  } else if (recurrence === 'biweekly') {
    // recurrence_start is guaranteed non-null here (checked by caller)
    const dayName = recurrence_day ?? 'monday'
    const anchor = parseLocalDate(recurrence_start!)
    let cursor = nextDayOfWeek(from, dayName)
    while (cursor <= to) {
      if (isBiweeklyOn(cursor, anchor)) {
        dates.push(toLocalDateString(cursor))
      }
      cursor = addDays(cursor, 7)
    }

  } else if (recurrence === 'monthly') {
    const dayOfMonth = recurrence_start ? parseLocalDate(recurrence_start).getDate() : 1
    let year = from.getFullYear()
    let month = from.getMonth()
    while (true) {
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const day = Math.min(dayOfMonth, daysInMonth)
      const candidate = new Date(year, month, day)
      if (candidate > to) break
      if (candidate >= from) dates.push(toLocalDateString(candidate))
      month++
      if (month > 11) { month = 0; year++ }
    }
  }

  return dates
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}
