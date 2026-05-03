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

export type LeadStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost'

export interface CleanLead {
  id: string
  household_id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  home_type: string | null
  frequency_interest: string | null
  heard_from: string | null
  notes: string | null
  status: LeadStatus
  lost_reason: string | null
  converted_at: string | null
  converted_to: string | null
  created_at: string
  updated_at: string
}

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
  sb_supplies_category_id: string | null
  mileage_rate: number
  flat_expense_per_clean: number
  hourly_rate: number
  payroll_overhead_factor: number
  tax_reserve_pct: number
  monthly_gross_target: number
  monthly_takehome_target: number
}

export interface CleanComplianceItem {
  id: string
  household_id: string
  name: string
  due_date: string             // YYYY-MM-DD
  recurrence: 'annual' | 'quarterly' | 'none' | null
  amount: number | null
  paid: boolean
  paid_at: string | null
  link: string | null
  notes: string | null
}

export interface CleanMonthlyFinancials {
  id: string
  household_id: string
  month_key: string                   // YYYY-MM
  gross_income: number
  expected_income: number
  total_mileage_expense: number
  total_flat_expense: number
  gross_wages: number                 // hours × hourly_rate (pure labor)
  payroll_withdrawal: number | null   // gross_wages × overhead (total payroll cost out)
  payroll_deposit: number | null      // gross_wages × 0.9235 (what Julie receives)
  sb_expenses_total: number           // SB Business Expenses + Cleaning Supplies
  income_as_profit: number            // gross - payroll_withdrawal - mileage - sb_expenses
  tax_reserve: number                 // income_as_profit × 22%
  transfer_to_bank: number            // tax_reserve + payroll_withdrawal
  net_to_household: number            // gross - transfer_to_bank + payroll_deposit
  total_hours: number
  payroll_submitted: boolean
  payroll_submitted_at: string | null
  finalized: boolean
  finalized_at: string | null
  sb_adjustment_transaction_id: string | null
  sb_adjustment_synced_at: string | null
  sb_total_synced: number | null
}
