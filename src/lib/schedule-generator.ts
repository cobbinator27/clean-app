import type { SupabaseClient } from '@supabase/supabase-js'
import type { CleanCustomer } from '@/types/clean'

// Minimal shape we need from the DB — partial of CleanCustomer plus household_id
interface RecurringCustomer extends Pick<CleanCustomer, 'id' | 'name' | 'primary_rate' | 'recurrence' | 'recurrence_day' | 'recurrence_start'> {
  household_id: string
}
import {
  toLocalDateString,
  addDays,
  nextDayOfWeek,
  isBiweeklyOn,
} from './date-utils'

const WEEKS_AHEAD = 10

interface GeneratorResult {
  generated: number
  skipped: number
  customers: number
}

/**
 * Generate recurring clean events for all active customers with a recurrence
 * schedule. Looks ahead WEEKS_AHEAD weeks from today. Skips dates that
 * already have an event for that customer.
 */
export async function generateRecurringEvents(
  supabase: SupabaseClient,
  householdId: string
): Promise<GeneratorResult> {
  // 1. Load active customers with recurrence set
  const { data: customerData, error: cxErr } = await supabase
    .from('clean_customers')
    .select('id, name, primary_rate, recurrence, recurrence_day, recurrence_start, household_id')
    .eq('household_id', householdId)
    .eq('status', 'active')
    .not('recurrence', 'is', null)

  if (cxErr) throw new Error(`Failed to load customers: ${cxErr.message}`)

  const customers = (customerData ?? []) as RecurringCustomer[]
  if (customers.length === 0) return { generated: 0, skipped: 0, customers: 0 }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = addDays(today, WEEKS_AHEAD * 7)

  let totalGenerated = 0
  let totalSkipped = 0

  for (const customer of customers) {
    if (!customer.recurrence) continue

    // Each customer gets one stable series UUID per run
    const seriesId = crypto.randomUUID()

    // Build candidate dates based on recurrence type
    const candidateDates = buildCandidateDates(customer as RecurringCustomer, today, endDate)

    for (const dateStr of candidateDates) {
      // Check if event already exists for this customer on this date
      const { data: existing } = await supabase
        .from('clean_events')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('scheduled_date', dateStr)
        .not('status', 'eq', 'cancelled')
        .limit(1)
        .single()

      if (existing) {
        totalSkipped++
        continue
      }

      // Insert new event
      const { error: insertErr } = await supabase.from('clean_events').insert({
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

      if (!insertErr) {
        totalGenerated++
      }
    }
  }

  return {
    generated: totalGenerated,
    skipped: totalSkipped,
    customers: customers.length,
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildCandidateDates(
  customer: RecurringCustomer,
  from: Date,
  to: Date
): string[] {
  const { recurrence, recurrence_day, recurrence_start } = customer
  const dates: string[] = []

  if (recurrence === 'weekly') {
    // One event per week on recurrence_day (or Monday if not set)
    const dayName = recurrence_day ?? 'monday'
    let cursor = nextDayOfWeek(from, dayName)
    while (cursor <= to) {
      dates.push(toLocalDateString(cursor))
      cursor = addDays(cursor, 7)
    }

  } else if (recurrence === 'bi_weekly') {
    // Every two weeks on recurrence_day
    // Anchor: recurrence_start if set, otherwise today
    const dayName = recurrence_day ?? 'monday'
    const anchor = recurrence_start
      ? parseLocalDate(recurrence_start)
      : from

    let cursor = nextDayOfWeek(from, dayName)
    while (cursor <= to) {
      if (isBiweeklyOn(cursor, anchor)) {
        dates.push(toLocalDateString(cursor))
      }
      cursor = addDays(cursor, 7)
    }

  } else if (recurrence === 'monthly') {
    // One event per month — use day-of-month from recurrence_start, or 1st
    const dayOfMonth = recurrence_start
      ? parseLocalDate(recurrence_start).getDate()
      : 1

    // Walk month by month
    let year = from.getFullYear()
    let month = from.getMonth() // 0-indexed

    while (true) {
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const day = Math.min(dayOfMonth, daysInMonth)
      const candidate = new Date(year, month, day)
      if (candidate > to) break
      if (candidate >= from) {
        dates.push(toLocalDateString(candidate))
      }
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
