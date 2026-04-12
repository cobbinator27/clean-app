export type EventStatus =
  | 'scheduled'
  | 'arrived'
  | 'in_progress'
  | 'done'
  | 'payment_pending'
  | 'paid'
  | 'cancelled'

export type EventType = 'regular' | 'one_off' | 'move_out' | 'deep_clean' | 'other'

export type Recurrence = 'weekly' | 'biweekly' | 'monthly' | null

export interface CleanCustomer {
  id: string
  name: string
  address: string | null
  area: string | null
  phone: string | null
  email: string | null
  primary_rate: number | null
  secondary_rate: number | null
  one_way_miles: number | null
  recurrence: Recurrence
  recurrence_day: string | null   // 'monday' | 'tuesday' | etc.
  recurrence_start: string | null // 'YYYY-MM-DD' anchor date
  status: 'active' | 'inactive'
  notes: string | null
}

export interface CleanEvent {
  id: string
  customer_id: string
  scheduled_date: string
  scheduled_time: string | null
  status: EventStatus
  event_type: EventType
  is_recurring_instance: boolean
  recurrence_series_id: string | null
  expected_amount: number | null
  actual_amount: number | null
  payment_method: string | null
  payment_date: string | null
  arrived_at: string | null
  left_at: string | null
  hours_logged: number | null
  hours_manual_override: boolean | null
  mileage_expense_snapshot: number | null
  notes: string | null
  customer?: CleanCustomer
}

export interface CleanBusinessSettings {
  id: string
  household_id: string
  sb_income_category_id: string
  sb_expense_category_id: string
  mileage_rate: number
  flat_expense_per_clean: number
  hourly_rate: number
  payroll_overhead_factor: number
  tax_reserve_pct: number
  monthly_gross_target: number
  monthly_takehome_target: number
}

export interface CleanMonthlyFinancials {
  id: string
  household_id: string
  month_key: string                   // YYYY-MM
  gross_income: number
  expected_income: number
  total_mileage_expense: number
  total_flat_expense: number
  gross_wages: number                 // estimated payroll = hours × rate × overhead
  payroll_withdrawal: number | null   // actual payroll — entered at month-end
  payroll_deposit: number | null
  income_as_profit: number
  tax_reserve: number
  net_to_household: number            // THE pacing number SB reads
  total_hours: number
  payroll_submitted: boolean
  payroll_submitted_at: string | null
  finalized: boolean
  finalized_at: string | null
  sb_adjustment_transaction_id: string | null
  sb_adjustment_synced_at: string | null
  sb_total_synced: number | null
}
