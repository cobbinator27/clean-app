const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Format a Date as 'YYYY-MM-DD' using local (not UTC) time.
 */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns the Monday of the week containing `date`, in local time.
 */
export function getWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * Add `days` to a Date, returning a new Date (local time).
 */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Returns the next occurrence of `dayName` on or after `startDate`.
 * dayName: 'monday' | 'tuesday' | ... | 'sunday'
 */
export function nextDayOfWeek(startDate: Date, dayName: string): Date {
  const target = DAY_NAMES.indexOf(dayName.toLowerCase())
  if (target === -1) throw new Error(`Invalid day name: ${dayName}`)
  const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const current = d.getDay()
  const diff = (target - current + 7) % 7
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * Returns true if `date` falls on an "on" week for a bi-weekly schedule
 * anchored at `anchorDate`. The anchor date is always an "on" week.
 */
export function isBiweeklyOn(date: Date, anchorDate: Date): boolean {
  const anchorMonday = getWeekMonday(anchorDate)
  const dateMonday = getWeekMonday(date)
  const diffMs = dateMonday.getTime() - anchorMonday.getTime()
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
  return diffWeeks % 2 === 0
}

/**
 * Returns true if `date` is today (local time).
 */
export function isToday(date: Date): boolean {
  const today = new Date()
  return toLocalDateString(date) === toLocalDateString(today)
}

/**
 * Returns true if `date` is in the past (before today, local time).
 */
export function isPast(date: Date): boolean {
  return toLocalDateString(date) < toLocalDateString(new Date())
}

/**
 * Format a time string ('HH:MM' 24h) as '9:00 AM'.
 */
export function formatTime(time: string | null): string | null {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

/**
 * Format a 'YYYY-MM-DD' date string as 'Thursday, April 10'.
 */
export function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format a 'YYYY-MM-DD' date string as 'Thu, Apr 10'.
 */
export function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a Date as 'Mon Apr 7' for day section headers.
 */
export function formatDayHeader(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * Format a Date as 'Apr 7' for week nav header.
 */
export function formatWeekHeader(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Format a timestamp ISO string as '9:04 AM'.
 */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

/**
 * Format a 'YYYY-MM-DD' payment_date as 'Apr 7'.
 */
export function formatPaymentDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
