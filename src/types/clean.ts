export type EventStatus =
  | 'scheduled'
  | 'arrived'
  | 'in_progress'
  | 'done'
  | 'payment_pending'
  | 'paid'
  | 'cancelled'

export type EventType = 'regular' | 'one_off' | 'move_out' | 'deep_clean' | 'other'

export type Recurrence = 'weekly' | 'bi_weekly' | 'monthly' | null

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
  is_active: boolean
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
  expected_amount: number | null
  actual_amount: number | null
  payment_method: string | null
  payment_date: string | null
  arrived_at: string | null
  left_at: string | null
  hours_logged: number | null
  mileage_expense_snapshot: number | null
  notes: string | null
  customer?: CleanCustomer
}
